"use client";

import { SIGNAL_ORDER, signalStyle } from "@/lib/ui/signals";

/**
 * Composition of a company's detected signals by type — a single 100%-wide
 * stacked bar (one axis: share of total) with a 2px surface gap between fills, and
 * a direct-labelled legend below. Colors follow the signal entity, never rank, so
 * "orange = pricing" holds here exactly as in the feed.
 */
export function SignalMix({ counts }: { counts: Record<string, number> }) {
  const present = SIGNAL_ORDER.filter((t) => (counts[t] ?? 0) > 0);
  const total = present.reduce((s, t) => s + (counts[t] ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-hairline-light bg-card p-5 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Signal mix</h2>
        <span className="text-xs text-ink-muted">{total} classified change{total === 1 ? "" : "s"}</span>
      </div>

      {/* stacked bar */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {present.map((t) => {
          const n = counts[t] ?? 0;
          const s = signalStyle(t);
          return (
            <div
              key={t}
              className="h-full rounded-[3px] first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(n / total) * 100}%`, backgroundColor: s.accent }}
              title={`${s.label}: ${n}`}
            />
          );
        })}
      </div>

      {/* legend */}
      <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
        {present.map((t) => {
          const n = counts[t] ?? 0;
          const s = signalStyle(t);
          const pct = Math.round((n / total) * 100);
          return (
            <div key={t} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.accent }} />
              <span className="text-sm text-ink">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums text-ink">{n}</span>
              <span className="text-xs text-ink-muted">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
