"use client";

import { CATALOG, GROUP_ORDER, TOTAL_SIGNALS, type CatalogEntry } from "@/lib/ui/catalog";

/**
 * The full 35-signal coverage board for a company. Every signal Scout watches is
 * shown, grouped by theme. A signal the shipped classifier produces ("live")
 * lights up in its accent color with a detected-count badge and is clickable to
 * filter the history below; the rest read as "monitoring" — honest about what's
 * tracked vs. what has actually fired. This is where the 35-signal taxonomy the
 * landing advertises becomes concrete, per company.
 */
export function SignalCoverage({
  counts,
  activeSignal,
  onSelect,
}: {
  counts: Record<string, number>;
  activeSignal: string | null;
  onSelect: (core: string | null) => void;
}) {
  const liveCount = CATALOG.filter((e) => e.core && (counts[e.core] ?? 0) > 0).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Signal coverage</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Scout watches {TOTAL_SIGNALS} kinds of public change on this company.{" "}
            <span className="font-medium text-ink">{liveCount} active</span> right now.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-teal" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-block h-2 w-2 rounded-full bg-ink/25">
              <span className="absolute inset-0 animate-ping rounded-full bg-ink/20" />
            </span>{" "}
            Monitoring
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {GROUP_ORDER.map((group) => {
          const entries = CATALOG.filter((e) => e.group === group);
          return (
            <div key={group}>
              <div className="mb-2.5 flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{group}</h3>
                <span className="h-px flex-1 bg-hairline-light" />
                <span className="text-[11px] text-ink-muted/70">{entries.length}</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <CoverageCard
                    key={e.name}
                    entry={e}
                    count={e.core ? counts[e.core] ?? 0 : 0}
                    active={!!e.core && activeSignal === e.core}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CoverageCard({
  entry,
  count,
  active,
  onSelect,
}: {
  entry: CatalogEntry;
  count: number;
  active: boolean;
  onSelect: (core: string | null) => void;
}) {
  const live = !!entry.core && count > 0;
  const clickable = live;
  const Icon = entry.Icon;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect(active ? null : entry.core!)}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border p-3.5 text-left transition-all ${
        live
          ? "cursor-pointer bg-card shadow-card hover:-translate-y-0.5 hover:shadow-card-hover"
          : "cursor-default border-hairline-light bg-card-2/60"
      }`}
      style={live ? { borderColor: active ? entry.accent : `${entry.accent}55` } : undefined}
    >
      {/* accent wash on live cards */}
      {live && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-full opacity-[0.06]"
          style={{ background: `linear-gradient(180deg, ${entry.accent}, transparent 60%)` }}
        />
      )}
      <div className="relative flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={
            live
              ? { backgroundColor: entry.bg, color: entry.accent }
              : { backgroundColor: "#EEEFF4", color: "#9CA0AD" }
          }
        >
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className={`truncate text-[13.5px] font-semibold ${live ? "text-ink" : "text-ink/55"}`}>
              {entry.name}
            </h4>
          </div>
        </div>
        {live ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
            style={{ backgroundColor: entry.bg, color: entry.text }}
          >
            {count}
          </span>
        ) : (
          <span className="relative mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/20">
            <span className="absolute inset-0 animate-ping rounded-full bg-ink/15" />
          </span>
        )}
      </div>
      <p className={`relative mt-2 line-clamp-2 text-[12px] leading-relaxed ${live ? "text-ink/70" : "text-ink/40"}`}>
        {entry.desc}
      </p>
      {live && (
        <span className="relative mt-2 text-[11px] font-semibold" style={{ color: entry.text }}>
          {active ? "Filtering history ✓" : `${count} detected · view →`}
        </span>
      )}
    </button>
  );
}
