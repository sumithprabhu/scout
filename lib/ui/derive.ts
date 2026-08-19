import type { SignalEventDTO } from "./api";

/**
 * Client-side metrics derived from the events list (the backend doesn't return a
 * score or time-series — flagged; these are computed here, honestly labeled as
 * derived). Kept pure so they're easy to reason about and reuse (company header
 * + portfolio rows share them).
 */

const SEV_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const HALF_LIFE_DAYS = 10;

/**
 * "Activity score" 0-100: recency-decayed, severity-weighted volume of change.
 * A company shipping frequent high-severity changes scores high; a quiet one
 * decays toward 0. Saturating so a firehose can't exceed 100.
 */
export function activityScore(events: Pick<SignalEventDTO, "severity" | "detectedAt">[]): number {
  const now = Date.now();
  let raw = 0;
  for (const e of events) {
    const ageDays = Math.max(0, (now - new Date(e.detectedAt).getTime()) / 86_400_000);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    raw += (SEV_WEIGHT[e.severity] ?? 1) * decay;
  }
  // Saturating map: ~6 weighted recent points -> ~63, plateauing toward 100.
  return Math.round(100 * (1 - Math.exp(-raw / 6)));
}

/** Daily event counts over the last `days` days, oldest→newest, for a sparkline. */
export function eventFrequencySeries(
  events: Pick<SignalEventDTO, "detectedAt">[],
  days = 14
): { day: string; count: number }[] {
  const buckets: { day: string; count: number }[] = [];
  const dayMs = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (const e of events) {
    const d = new Date(e.detectedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/** Most recent event, or null. */
export function lastEvent<T extends { detectedAt: string }>(events: T[]): T | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt))[0];
}
