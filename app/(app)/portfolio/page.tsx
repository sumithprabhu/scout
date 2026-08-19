"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchCompanies, fetchGlobalEvents, type CompanyDTO, type SignalEventDTO } from "@/lib/ui/api";
import { Avatar } from "@/components/ui/Avatar";
import { SignalPill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/company/Sparkline";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { activityScore, eventFrequencySeries, lastEvent } from "@/lib/ui/derive";
import { timeAgo } from "@/lib/ui/format";

interface Row {
  company: CompanyDTO;
  events: SignalEventDTO[];
  score: number;
  series: { day: string; count: number }[];
  last: SignalEventDTO | null;
}

type SortKey = "name" | "score" | "last";

export default function PortfolioPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyDTO[] | null>(null);
  const [events, setEvents] = useState<SignalEventDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCompanies(), fetchGlobalEvents({ limit: 300 })])
      .then(([co, ev]) => {
        if (!alive) return;
        setCompanies(co.companies);
        setEvents(ev.events);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  const rows: Row[] = useMemo(() => {
    if (!companies) return [];
    const byCompany = new Map<string, SignalEventDTO[]>();
    for (const e of events) {
      const arr = byCompany.get(e.companyId) ?? [];
      arr.push(e);
      byCompany.set(e.companyId, arr);
    }
    return companies.map((company) => {
      const evs = byCompany.get(company.companyId) ?? [];
      return {
        company,
        events: evs,
        score: activityScore(evs),
        series: eventFrequencySeries(evs, 14),
        last: lastEvent(evs),
      };
    });
  }, [companies, events]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return dir * a.company.name.localeCompare(b.company.name);
      if (sortKey === "score") return dir * (a.score - b.score);
      const at = a.last ? +new Date(a.last.detectedAt) : 0;
      const bt = b.last ? +new Date(b.last.detectedAt) : 0;
      return dir * (at - bt);
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-muted">Every company you track, ranked by recent activity.</p>
        </div>
        <Link href="/add" className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white">+ Track a company</Link>
      </div>

      {error && <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">Couldn’t load portfolio: {error}</div>}

      {!companies && !error && <Skeleton className="h-64 w-full !bg-black/[0.05]" />}

      {companies && companies.length === 0 && (
        <EmptyState icon="🏢" title="No companies tracked yet" hint="Add your first company to start building your portfolio."
          action={<Link href="/add" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Track a company</Link>} />
      )}

      {companies && companies.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-hairline-light bg-card shadow-card">
          {/* header */}
          <div className="grid grid-cols-[1.6fr_0.8fr_1fr_2fr] items-center gap-4 border-b border-hairline-light px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <SortHeader label="Company" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
            <SortHeader label="Activity" active={sortKey === "score"} dir={sortDir} onClick={() => toggleSort("score")} />
            <span>Trend · 14d</span>
            <SortHeader label="Last signal" active={sortKey === "last"} dir={sortDir} onClick={() => toggleSort("last")} />
          </div>
          {/* rows */}
          {sorted.map((r) => (
            <button
              key={r.company.companyId}
              onClick={() => router.push(`/companies/${r.company.companyId}`)}
              className="grid w-full grid-cols-[1.6fr_0.8fr_1fr_2fr] items-center gap-4 border-b border-hairline-light px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-card-2"
            >
              <div className="flex items-center gap-3">
                <Avatar name={r.company.name} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{r.company.name}</div>
                  <div className="truncate text-xs text-ink-muted">{r.events.length} signal{r.events.length === 1 ? "" : "s"}</div>
                </div>
              </div>
              <ScoreBadge score={r.score} />
              <div className="h-9">
                {r.events.length > 0 ? <Sparkline data={r.series} height={36} /> : <span className="text-xs text-ink-muted">—</span>}
              </div>
              <div className="min-w-0">
                {r.last ? (
                  <div className="flex items-center gap-2">
                    <SignalPill type={r.last.signalType} />
                    <span className="truncate text-sm text-ink" title={r.last.summary}>{r.last.summary}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink-muted">{timeAgo(r.last.detectedAt)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-ink-muted">No changes yet</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 uppercase ${active ? "text-ink" : "hover:text-ink"}`}>
      {label}
      <span className="text-[9px]">{active ? (dir === "asc" ? "▲" : "▼") : "▾"}</span>
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "#F97316" : score >= 30 ? "#EAB308" : "#64748B";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-hairline-light">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}
