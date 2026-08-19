"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchGlobalEvents, fetchCompanies, type SignalEventDTO, type CompanyDTO } from "@/lib/ui/api";
import { SignalCard } from "@/components/feed/SignalCard";
import { FilterBar } from "@/components/feed/FilterBar";
import { InsightRail } from "@/components/feed/InsightRail";
import { FeedSkeleton, EmptyState } from "@/components/ui/States";
import { domainOf } from "@/lib/ui/format";

export default function FeedPage() {
  const [events, setEvents] = useState<SignalEventDTO[] | null>(null);
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [activeCompany, setActiveCompany] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchGlobalEvents({ limit: 150 }), fetchCompanies()])
      .then(([ev, co]) => {
        if (!alive) return;
        setEvents(ev.events);
        setCompanies(co.companies);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events ?? []) c[e.signalType] = (c[e.signalType] ?? 0) + 1;
    return c;
  }, [events]);

  const domainById = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const c of companies) m.set(c.companyId, domainOf(c.rootUrl));
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    return (events ?? []).filter(
      (e) =>
        (!activeSignal || e.signalType === activeSignal) &&
        (!activeCompany || e.companyId === activeCompany)
    );
  }, [events, activeSignal, activeCompany]);

  return (
    <div className="flex h-full flex-col">
      {/* fixed top bar */}
      <div className="shrink-0 border-b border-line bg-white/60 px-6 pb-4 pt-6 backdrop-blur-sm lg:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">Signal Feed</h1>
            <p className="mt-1 text-[14.5px] text-ink-muted">
              Every public change across the companies you track, classified as it happens.
            </p>
          </div>
          {events && events.length > 0 && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-[12.5px] font-semibold text-ink/70 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
              {events.length} signal{events.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* body: only the center list scrolls */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-10">
          {events && events.length > 0 && (
            <FilterBar
              activeSignal={activeSignal}
              onSignal={setActiveSignal}
              companies={companies}
              activeCompany={activeCompany}
              onCompany={setActiveCompany}
              counts={counts}
            />
          )}

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              Couldn’t load the feed: {error}
            </div>
          )}

          {!events && !error && <FeedSkeleton rows={6} />}

          {events && events.length === 0 && (
            <EmptyState
              icon="📡"
              title="No signals yet"
              hint="Track a company and Scout will start watching its public pages. New pricing, hiring, compliance, and positioning changes will show up here."
              action={
                <Link href="/add" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                  Track your first company
                </Link>
              }
            />
          )}

          {events && events.length > 0 && (
            filtered.length === 0 ? (
              <EmptyState
                icon="◎"
                title="No signals match these filters"
                hint="Try clearing a filter to see more activity."
                action={
                  <button
                    onClick={() => {
                      setActiveSignal(null);
                      setActiveCompany(null);
                    }}
                    className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="space-y-3.5 pb-4">
                {filtered.map((e, i) => (
                  <SignalCard key={e.signalEventId} event={e} index={i} domain={domainById.get(e.companyId)} />
                ))}
              </div>
            )
          )}
        </div>

        {/* fixed right rail (its own scroll if tall) */}
        {events && events.length > 0 && (
          <div className="hidden w-[288px] shrink-0 overflow-y-auto border-l border-line/70 px-5 py-6 xl:block">
            <InsightRail events={events} companies={companies} />
          </div>
        )}
      </div>
    </div>
  );
}
