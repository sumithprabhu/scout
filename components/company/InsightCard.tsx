"use client";

import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Sparkline } from "./Sparkline";
import type { SignalEventDTO } from "@/lib/ui/api";
import { activityScore, eventFrequencySeries, lastEvent } from "@/lib/ui/derive";
import { timeAgo, hostPath } from "@/lib/ui/format";

/**
 * Company header as an insight card: a headline metric (Activity score — derived
 * client-side, labeled as such) with a 14-day event-frequency sparkline, plus
 * supporting stats. This is the "one number + trend" pattern; the sparkline is a
 * single-series trend so it carries no legend and no axes.
 */
export function InsightCard({
  name,
  rootUrl,
  events,
  pagesCount,
  since,
}: {
  name: string;
  rootUrl: string;
  events: SignalEventDTO[];
  pagesCount?: number;
  since?: string;
}) {
  const score = activityScore(events);
  const series = eventFrequencySeries(events, 14);
  const last = lastEvent(events);
  const scoreColor = score >= 60 ? "#F97316" : score >= 30 ? "#EAB308" : "#8B78FF";
  const sinceLabel = since
    ? new Date(since).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-hairline-light bg-card p-6 shadow-card sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* identity */}
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={name} url={rootUrl} size={48} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{name}</h1>
            <a
              href={rootUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ink-muted hover:text-brand-ink"
            >
              {hostPath(rootUrl)} ↗
            </a>
          </div>
        </div>

        {/* headline metric + sparkline */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Activity score
            </div>
            <div className="text-4xl font-bold leading-none" style={{ color: scoreColor }}>
              {score}
            </div>
            <div className="mt-1 text-[11px] text-ink-muted">derived · last 10 days</div>
          </div>
          <div className="w-40 border-l border-hairline-light pl-5">
            <div className="mb-1 text-[11px] font-medium text-ink-muted">Signals · 14 days</div>
            <Sparkline data={series} color={scoreColor} height={40} />
          </div>
        </div>
      </div>

      {/* supporting stats */}
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4 border-t border-hairline-light pt-4 text-sm">
        <Stat label="Total signals" value={String(events.length)} />
        <Stat label="Last change" value={last ? timeAgo(last.detectedAt) : "Never"} />
        <Stat
          label="High severity"
          value={String(events.filter((e) => e.severity === "high").length)}
        />
        {pagesCount != null && <Stat label="Tracked pages" value={String(pagesCount)} />}
        {sinceLabel && <Stat label="Watching since" value={sinceLabel} />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-0.5 font-semibold text-ink">{value}</div>
    </div>
  );
}
