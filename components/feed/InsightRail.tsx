"use client";

import Link from "next/link";
import { SIGNAL_ORDER, signalStyle } from "@/lib/ui/signals";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { domainOf } from "@/lib/ui/format";
import type { SignalEventDTO, CompanyDTO } from "@/lib/ui/api";

/**
 * The feed's right rail — the same "This week" summary the landing product mock
 * carried: a headline count, a per-signal distribution, and the most-active
 * company. Sticky on large screens; hidden below lg so the feed goes full-width.
 */
export function InsightRail({ events, companies = [] }: { events: SignalEventDTO[]; companies?: CompanyDTO[] }) {
  const total = events.length;
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.signalType] = (counts[e.signalType] ?? 0) + 1;
  const present = SIGNAL_ORDER.filter((t) => (counts[t] ?? 0) > 0);

  const domainById = new Map(companies.map((c) => [c.companyId, domainOf(c.rootUrl)] as const));
  const byCompany = new Map<string, { name: string; n: number }>();
  for (const e of events) {
    const prev = byCompany.get(e.companyId) ?? { name: e.companyName ?? "Unknown", n: 0 };
    prev.n += 1;
    byCompany.set(e.companyId, prev);
  }
  const top = [...byCompany.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);

  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">This week</div>

      <div className="mt-3 rounded-2xl border border-hairline-light bg-card p-4 shadow-card">
        <div className="text-[32px] font-extrabold leading-none text-ink">{total}</div>
        <div className="mt-1 text-[12px] text-ink-muted">changes detected</div>
      </div>

      {present.length > 0 && (
        <div className="mt-4 space-y-2.5 rounded-2xl border border-hairline-light bg-card p-4 shadow-card">
          {present.map((t) => {
            const s = signalStyle(t);
            const pct = total ? (counts[t] / total) * 100 : 0;
            return (
              <div key={t}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold" style={{ color: s.text }}>{s.label}</span>
                  <span className="text-faint tabular-nums">{counts[t]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.accent }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-4 rounded-2xl border border-hairline-light bg-card p-4 shadow-card">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Most active</div>
          <div className="mt-2.5 space-y-2.5">
            {top.map(([id, { name, n }]) => (
              <div key={id} className="flex items-center gap-2.5">
                <CompanyLogo name={name} domain={domainById.get(id)} size={24} />
                <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
                <span className="ml-auto shrink-0 text-[12px] text-faint tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/portfolio"
        className="mt-4 block rounded-2xl border border-dashed border-hairline px-4 py-3 text-center text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-pastel/50"
      >
        View full portfolio →
      </Link>
    </div>
  );
}
