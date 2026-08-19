"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchGlobalEvents, fetchCompanies, type SignalEventDTO, type CompanyDTO } from "@/lib/ui/api";
import { SignalCard } from "@/components/feed/SignalCard";
import { FilterBar } from "@/components/feed/FilterBar";
import { FeedSkeleton, EmptyState } from "@/components/ui/States";

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

  const filtered = useMemo(() => {
    return (events ?? []).filter(
      (e) =>
        (!activeSignal || e.signalType === activeSignal) &&
        (!activeCompany || e.companyId === activeCompany)
    );
  }, [events, activeSignal, activeCompany]);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">Signal Feed</h1>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Every public change across the companies you track, classified and summarized as it happens.
          </p>
        </div>
        {events && events.length > 0 && (
          <span className="hidden text-sm text-ink-muted sm:block">
            {events.length} signal{events.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn’t load the feed: {error}
        </div>
      )}

      {!events && !error && <FeedSkeleton rows={5} />}

      {events && events.length === 0 && (
        <EmptyState
          icon="📡"
          title="No signals yet"
          hint="Track a company and Radar will start watching its public pages. New pricing, hiring, compliance, and positioning changes will show up here."
          action={
            <Link href="/add" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Track your first company
            </Link>
          }
        />
      )}

      {events && events.length > 0 && (
        <>
          <FilterBar
            activeSignal={activeSignal}
            onSignal={setActiveSignal}
            companies={companies}
            activeCompany={activeCompany}
            onCompany={setActiveCompany}
            counts={counts}
          />
          {filtered.length === 0 ? (
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
            <div className="space-y-3.5">
              {filtered.map((e, i) => (
                <SignalCard key={e.signalEventId} event={e} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
