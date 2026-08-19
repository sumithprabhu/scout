"use client";

import { useState } from "react";
import { ChevronDown, Radar } from "lucide-react";
import { CATALOG, GROUP_ORDER, TOTAL_SIGNALS, type CatalogEntry } from "@/lib/ui/catalog";

/**
 * A company's signal coverage. What matters is what has actually FIRED, so the
 * active signals (the ones the classifier has produced for this company) lead; the
 * remaining signals Scout monitors but hasn't seen change are tucked into a toggle
 * — visible when you want the full picture, out of the way when they'd just be a
 * wall of "nothing yet."
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
  const [showAll, setShowAll] = useState(false);

  const active = CATALOG.filter((e) => e.core && (counts[e.core] ?? 0) > 0);
  const monitored = CATALOG.filter((e) => !(e.core && (counts[e.core] ?? 0) > 0));

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Signal coverage</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Scout watches {TOTAL_SIGNALS} kinds of public change on this company.{" "}
          <span className="font-medium text-ink">{active.length} active</span> right now.
        </p>
      </div>

      {active.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((e) => (
            <CoverageCard
              key={e.name}
              entry={e}
              count={counts[e.core!] ?? 0}
              active={activeSignal === e.core}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-hairline bg-card-2/50 px-5 py-6 text-sm text-ink-muted">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint text-purple-deep">
            <Radar size={17} />
          </span>
          No changes have fired yet. Scout is watching {TOTAL_SIGNALS} kinds of public change and will surface them here the moment they happen.
        </div>
      )}

      {/* monitored signals — collapsed by default */}
      {monitored.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-hairline-light bg-card px-4 py-2.5 text-sm font-semibold text-ink-muted shadow-card transition-colors hover:text-ink"
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-ink/25" />
              <span className="absolute inset-0 animate-ping rounded-full bg-ink/15" />
            </span>
            {showAll ? "Hide" : "Show"} {monitored.length} signals Scout is monitoring
            <ChevronDown size={16} className={`ml-auto transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>

          {showAll && (
            <div className="mt-4 space-y-6">
              {GROUP_ORDER.map((group) => {
                const entries = monitored.filter((e) => e.group === group);
                if (entries.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{group}</h3>
                      <span className="h-px flex-1 bg-hairline-light" />
                      <span className="text-[11px] text-ink-muted/70">{entries.length}</span>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {entries.map((e) => (
                        <CoverageCard key={e.name} entry={e} count={0} active={false} onSelect={onSelect} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
          <h4 className={`truncate text-[13.5px] font-semibold ${live ? "text-ink" : "text-ink/55"}`}>
            {entry.name}
          </h4>
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
