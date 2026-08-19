/**
 * The single source of truth for signal-type -> color. This mapping is itself a
 * UX feature: every place a signal appears (feed pill, filter chip, company
 * page, diff accent) pulls its color from HERE, so "orange = pricing" is learned
 * once and recognized everywhere. Colors are hex (not Tailwind classes) and
 * applied via inline style, so a dynamically-chosen color can never be purged.
 *
 * Palette per the brief:
 *   pricing    -> coral/orange  (warm = money = attention)
 *   hiring     -> teal          (growth)
 *   positioning-> pink/magenta  (messaging)
 *   compliance -> amber/yellow  (trust)
 *   integration-> blue          (ecosystem)
 * Two signal types the brief's 5-color list didn't cover get sensible, distinct
 * additions (flagged to the user): changelog -> emerald (shipping), other ->
 * slate. Brand purple is reserved for chrome (logo/primary/nav), never a signal.
 */
import type { SignalType } from "@/lib/intel/types";

export interface SignalStyle {
  label: string;
  /** solid accent — used for the diff "new value" and the pill dot */
  accent: string;
  /** pastel pill background */
  bg: string;
  /** bold, high-contrast same-hue text on the pastel bg */
  text: string;
}

export const SIGNAL_STYLES: Record<SignalType, SignalStyle> = {
  pricing_change:     { label: "Pricing",     accent: "#F97316", bg: "#FFE8D6", text: "#C2410C" },
  hiring_spike:       { label: "Hiring",      accent: "#14B8A6", bg: "#CFF3EC", text: "#0F766E" },
  positioning_shift:  { label: "Positioning", accent: "#EC4899", bg: "#FBDCEC", text: "#BE185D" },
  compliance_change:  { label: "Compliance",  accent: "#EAB308", bg: "#FAEEC4", text: "#A16207" },
  new_integration:    { label: "Integration", accent: "#3B82F6", bg: "#DBE8FE", text: "#1D4ED8" },
  changelog_entry:    { label: "Changelog",   accent: "#10B981", bg: "#D0F2E1", text: "#047857" },
  other:              { label: "Other",       accent: "#64748B", bg: "#E6EAF0", text: "#475569" },
};

export function signalStyle(type: string): SignalStyle {
  return SIGNAL_STYLES[type as SignalType] ?? SIGNAL_STYLES.other;
}

/** Order used for filter chips / legends (matches the brief's emphasis). */
export const SIGNAL_ORDER: SignalType[] = [
  "pricing_change",
  "hiring_spike",
  "positioning_shift",
  "compliance_change",
  "new_integration",
  "changelog_entry",
  "other",
];

// ---- severity (kept as a small dot/label so it never competes with the signal
// pill for color attention) ----
export const SEVERITY_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  high:   { label: "High",   dot: "#EF4444", text: "#F87171" },
  medium: { label: "Medium", dot: "#F59E0B", text: "#FBBF24" },
  low:    { label: "Low",    dot: "#64748B", text: "#94A3B8" },
};
export function severityStyle(sev: string) {
  return SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.low;
}

// ---- tracked-page status pills ----
export const STATUS_STYLES: Record<string, SignalStyle> = {
  active:      { label: "Active",      accent: "#10B981", bg: "#D0F2E1", text: "#047857" },
  discovering: { label: "Discovering", accent: "#3B82F6", bg: "#DBE8FE", text: "#1D4ED8" },
  broken:      { label: "Broken",      accent: "#EF4444", bg: "#FBDDDD", text: "#B91C1C" },
};
export function statusStyle(status: string): SignalStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES.discovering;
}

// ---- page-type labels (for the tracked-pages list) ----
export const PAGE_TYPE_LABELS: Record<string, string> = {
  homepage: "Homepage",
  pricing: "Pricing",
  careers: "Careers",
  trust: "Trust & Security",
  integrations: "Integrations",
  changelog: "Changelog",
};
