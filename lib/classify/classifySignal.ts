import { converseJSON } from "@/lib/nova/client";
import type { DiffResult } from "@/lib/diff/computeDiff";
import {
  SIGNAL_TYPES,
  SEVERITIES,
  type SignalType,
  type Severity,
  type PageType,
} from "@/lib/intel/types";

/**
 * Turn a structured diff into a classified SignalEvent shape (type + severity +
 * one-line summary) via Nova.
 *
 * Per the spec, the Nova calls are split into single-purpose functions so the
 * model is swappable and each has one job:
 *   classifyDiff()  -> confirm/refine the signalType + assign severity
 *   summarizeDiff() -> write the human-readable one-liner
 * Both route through converseJSON() (lib/nova/client.ts), the single model seam.
 *
 * Every function degrades gracefully: if Nova returns nothing, we fall back to a
 * page-type-derived default so a classification failure still yields a usable
 * SignalEvent rather than dropping a real change on the floor.
 */

/** The obvious signal type for a page, used as the default/hint for Nova. */
const DEFAULT_SIGNAL_BY_PAGE: Record<PageType, SignalType> = {
  pricing: "pricing_change",
  careers: "hiring_spike",
  trust: "compliance_change",
  integrations: "new_integration",
  changelog: "changelog_entry",
  homepage: "positioning_shift",
};

function coerceSignalType(v: unknown, fallback: SignalType): SignalType {
  return typeof v === "string" && (SIGNAL_TYPES as readonly string[]).includes(v)
    ? (v as SignalType)
    : fallback;
}

function coerceSeverity(v: unknown, fallback: Severity): Severity {
  return typeof v === "string" && (SEVERITIES as readonly string[]).includes(v)
    ? (v as Severity)
    : fallback;
}

/** Compact the diff for the prompt so a huge diff can't blow the token budget. */
function diffForPrompt(diff: DiffResult): string {
  const trimmed = diff.changes.slice(0, 40);
  return JSON.stringify({ counts: diff.summaryCounts, changes: trimmed }, null, 0);
}

export interface ClassifyDiffResult {
  signalType: SignalType;
  severity: Severity;
}

/**
 * NOVA SEAM 1: confirm/refine the signal type and assign a severity.
 */
export async function classifyDiff(
  pageType: PageType,
  diff: DiffResult
): Promise<ClassifyDiffResult> {
  const fallbackType = DEFAULT_SIGNAL_BY_PAGE[pageType];
  const system = `You classify a diff between two snapshots of a company's ${pageType} page.
Return ONLY a JSON object: {"signalType": <one of ${JSON.stringify(SIGNAL_TYPES)}>, "severity": <one of ${JSON.stringify(SEVERITIES)}>}.
signalType: pick the category that best describes WHAT changed (a new SOC 2 badge on any page is "compliance_change"; a plan price change is "pricing_change"; many new roles is "hiring_spike"; a new integration is "new_integration"; a new release note is "changelog_entry"; reworded value props/headlines is "positioning_shift"; use "other" only if none fit).
severity: "high" = strategically significant (price hikes, dropped compliance cert, hiring surge, repositioning); "medium" = notable but routine (a few new roles, one new integration); "low" = minor (typo-level, single changelog line).
Output the JSON and nothing else.`;

  const parsed = await converseJSON<Record<string, unknown>>({
    system,
    user: `Page type: ${pageType}\nDiff:\n${diffForPrompt(diff)}`,
    maxTokens: 120,
  });

  if (!parsed) {
    // Heuristic severity fallback when the model is unavailable.
    const total = diff.changes.length;
    const severity: Severity = total >= 5 ? "high" : total >= 2 ? "medium" : "low";
    return { signalType: fallbackType, severity };
  }
  return {
    signalType: coerceSignalType(parsed.signalType, fallbackType),
    severity: coerceSeverity(parsed.severity, "low"),
  };
}

/**
 * NOVA SEAM 2: write the one-line human-readable summary shown in the feed.
 */
export async function summarizeDiff(
  pageType: PageType,
  companyName: string,
  diff: DiffResult
): Promise<string> {
  const system = `You write ONE concise, factual sentence describing what changed on a company's ${pageType} page, for a competitive-intelligence feed.
Rules: <= 140 chars, past tense, lead with the company name, state the concrete change and the old->new values when present. No hype, no emoji, no markdown.
Return ONLY a JSON object: {"summary": "<the sentence>"}.`;

  const parsed = await converseJSON<{ summary?: unknown }>({
    system,
    user: `Company: ${companyName}\nPage type: ${pageType}\nDiff:\n${diffForPrompt(diff)}`,
    maxTokens: 120,
  });

  const s = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  if (s) return s.slice(0, 200);

  // Deterministic fallback so the feed always has a readable line.
  const { added, removed, changed } = diff.summaryCounts;
  const parts = [
    added && `${added} added`,
    removed && `${removed} removed`,
    changed && `${changed} changed`,
  ].filter(Boolean);
  return `${companyName}: ${pageType} page updated (${parts.join(", ")}).`;
}

export interface ClassifiedSignal {
  signalType: SignalType;
  severity: Severity;
  summary: string;
}

/**
 * Orchestrator: run both Nova seams and return the fields for a SignalEvent.
 * Persistence lives in lib/intel/ingest.ts so classify has no DB dependency and
 * stays unit-testable.
 */
export async function classifySignal(
  pageType: PageType,
  companyName: string,
  diff: DiffResult
): Promise<ClassifiedSignal> {
  const [{ signalType, severity }, summary] = await Promise.all([
    classifyDiff(pageType, diff),
    summarizeDiff(pageType, companyName, diff),
  ]);
  return { signalType, severity, summary };
}
