import type { CollectorRow } from "@/lib/scrapers/brightdata";
import type { JobSource, NormalizedJob } from "@/lib/types";

/**
 * Per-source knowledge lives behind this one interface. Each adapter knows two
 * source-specific things and nothing else:
 *   1. buildTargets — how to turn a user's slug/query into the URL(s) the
 *      collector should run against (this is the "parameterization").
 *   2. normalizeRow — how to read that collector's raw output into a NormalizedJob.
 *
 * Everything downstream (storage, parsing, matching) only ever sees NormalizedJob,
 * so adding a 5th source later means writing one adapter and nothing else.
 */
export interface SourceContext {
  /** The raw slug/query/url the user passed to /api/scrape. */
  input: string;
  /** Company name when the source is company-scoped (Greenhouse/Lever/Workday).
   *  Empty for Naukri, where company is per-row. */
  companyName: string;
}

export interface SourceAdapter {
  source: JobSource;
  /** Name of the env var holding this source's collector id. */
  collectorEnvVar: string;
  buildTargets(input: string): { urls: string[]; ctx: SourceContext };
  normalizeRow(row: CollectorRow, ctx: SourceContext): NormalizedJob | null;
}

// ---- small, dependency-free helpers (simple by design — review lightly) ----

/** Read the first present, non-empty value among candidate keys (case-insensitive).
 *  We try multiple names because the AI-built collector may label a field
 *  `apply_url`, `applyUrl`, `url`, or `absolute_url` depending on the source. */
export function pick(row: CollectorRow, keys: string[]): string {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) lowerMap.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lowerMap.get(key.toLowerCase());
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

/** Strip HTML tags + decode the handful of entities scraped JD text actually
 *  contains. NOT a full HTML parser — good enough to turn ATS description HTML
 *  into readable text for the LLM. Flagged as intentionally simple. */
export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Turn "acme-corp" or "Acme Corp" into a display name "Acme Corp". */
export function prettifyCompany(slug: string): string {
  return slug
    .replace(/^https?:\/\/[^/]+\//, "")
    .split(/[/?#]/)[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Parse a date string/epoch to a Date, or null if unparseable. */
export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    // Lever/Greenhouse sometimes give epoch millis.
    const d = new Date(value > 1e12 ? value : value * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Guard: a normalized job is only usable if it has the fields the rest of the
 *  pipeline depends on. Rows missing title or description are dropped, not stored. */
export function isUsable(job: NormalizedJob): boolean {
  return Boolean(job.title && job.rawDescriptionText && job.applyUrl);
}
