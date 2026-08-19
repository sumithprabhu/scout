"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  fetchCompanyEvents,
  fetchCompanyPages,
  fetchCompanies,
  deleteCompany,
  type SignalEventDTO,
  type TrackedPageDTO,
  type CompanyDTO,
} from "@/lib/ui/api";
import { InsightCard } from "@/components/company/InsightCard";
import { SignalMix } from "@/components/company/SignalMix";
import { SignalCoverage } from "@/components/company/SignalCoverage";
import { SignalCard } from "@/components/feed/SignalCard";
import { FilterBar } from "@/components/feed/FilterBar";
import { StatusPill } from "@/components/ui/Pill";
import { FeedSkeleton, EmptyState, Skeleton } from "@/components/ui/States";
import { PAGE_TYPE_LABELS } from "@/lib/ui/signals";
import { hostPath, domainOf } from "@/lib/ui/format";

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [company, setCompany] = useState<CompanyDTO | null>(null);
  const [events, setEvents] = useState<SignalEventDTO[] | null>(null);
  const [pages, setPages] = useState<TrackedPageDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const historyRef = useRef<HTMLElement | null>(null);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteCompany(id);
      router.push("/portfolio");
    } catch {
      setDeleting(false);
      setError("Couldn’t remove that company. Try again.");
    }
  }

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCompanies(), fetchCompanyEvents(id), fetchCompanyPages(id)])
      .then(([co, ev, pg]) => {
        if (!alive) return;
        setCompany(co.companies.find((c) => c.companyId === id) ?? null);
        // The company-events route omits companyId/companyName; inject them so
        // the shared SignalCard renders identically to the global feed.
        const name = co.companies.find((c) => c.companyId === id)?.name ?? "Company";
        setEvents(ev.events.map((e) => ({ ...e, companyId: id, companyName: name })));
        setPages(pg.pages);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events ?? []) c[e.signalType] = (c[e.signalType] ?? 0) + 1;
    return c;
  }, [events]);

  const filtered = useMemo(
    () => (events ?? []).filter((e) => !activeSignal || e.signalType === activeSignal),
    [events, activeSignal]
  );

  function selectSignal(core: string | null) {
    setActiveSignal(core);
    if (core) requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (error && !company) {
    return (
      <div className="h-full overflow-y-auto px-6 py-8 lg:px-10">
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">Couldn’t load company: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-8 lg:px-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> Portfolio
        </Link>
        {company && (
          confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted">Stop tracking {company.name}?</span>
              <button onClick={onDelete} disabled={deleting} className="rounded-md bg-red-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? "Removing…" : "Remove"}
              </button>
              <button onClick={() => setConfirmingDelete(false)} disabled={deleting} className="rounded-md border border-hairline px-2.5 py-1 text-[12px] font-semibold text-ink-muted hover:text-ink">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600">
              <Trash2 size={14} /> Stop tracking
            </button>
          )
        )}
      </div>
      {error && company && <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!company || !events ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full !bg-black/[0.05]" />
          <Skeleton className="h-24 w-full !bg-black/[0.05]" />
          <FeedSkeleton rows={3} />
        </div>
      ) : (
        <div className="space-y-8">
          <InsightCard
            name={company.name}
            rootUrl={company.rootUrl}
            events={events}
            pagesCount={pages?.length}
            since={company.createdAt}
          />

          {events.length > 0 && <SignalMix counts={counts} />}

          {/* The 35-signal coverage board */}
          <SignalCoverage counts={counts} activeSignal={activeSignal} onSelect={selectSignal} />

          {/* Tracked pages */}
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">Tracked pages</h2>
            {!pages ? (
              <Skeleton className="h-20 w-full !bg-black/[0.05]" />
            ) : pages.length === 0 ? (
              <div className="rounded-xl border border-hairline bg-elevated/40 px-4 py-3 text-sm text-ink-muted">
                No pages tracked yet.{" "}
                <Link href="/add" className="font-medium text-brand-ink">Add pages →</Link>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {pages.map((p) => (
                  <div key={p.trackedPageId} className="flex items-center gap-3 rounded-xl border border-hairline-light bg-card px-4 py-3 shadow-card">
                    <span className="w-28 shrink-0 text-sm font-medium text-ink">{PAGE_TYPE_LABELS[p.pageType] ?? p.pageType}</span>
                    <span className="flex-1 truncate font-mono text-[11px] text-ink-muted" title={p.url}>{hostPath(p.url)}</span>
                    <StatusPill status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Signal history */}
          <section ref={historyRef} className="scroll-mt-20">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Signal history</h2>
              {activeSignal && (
                <button onClick={() => setActiveSignal(null)} className="text-xs font-semibold text-brand-ink hover:underline">
                  Clear filter
                </button>
              )}
            </div>
            {events.length === 0 ? (
              <EmptyState icon="◎" title="No changes detected yet" hint="Scout will post here the first time one of this company’s tracked pages changes." />
            ) : (
              <>
                {Object.keys(counts).length > 1 && (
                  <FilterBar activeSignal={activeSignal} onSignal={setActiveSignal} counts={counts} />
                )}
                <div className="space-y-3">
                  {filtered.map((e, i) => (
                    <SignalCard key={e.signalEventId} event={e} index={i} domain={domainOf(company.rootUrl)} />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
