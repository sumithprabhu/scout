"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { addCompany, fetchCompanyPages, addOrCorrectPage, type PagesResponse } from "@/lib/ui/api";
import { TaskRow, type TaskStatus } from "@/components/add/TaskRow";
import { StatusPill } from "@/components/ui/Pill";
import { PAGE_TYPE_LABELS } from "@/lib/ui/signals";
import { hostPath } from "@/lib/ui/format";

type Phase = "input" | "working" | "confirm" | "error";

const DISCOVERY_HINTS = [
  "Fetching the homepage…",
  "Extracting navigation & footer links…",
  "Classifying page types with Nova…",
  "Validating links are on-domain…",
];
const POLL_MS = 2500;
const MAX_POLL_MS = 75_000;

export default function AddCompanyPage() {
  return (
    <Suspense fallback={null}>
      <AddCompanyInner />
    </Suspense>
  );
}

function AddCompanyInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState(search.get("q") ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [addStatus, setAddStatus] = useState<TaskStatus>("pending");
  const [discoverStatus, setDiscoverStatus] = useState<TaskStatus>("pending");
  const [hintIdx, setHintIdx] = useState(0);
  const [pagesData, setPagesData] = useState<PagesResponse | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // rotate the discovery hint while running
  useEffect(() => {
    if (discoverStatus !== "running") return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % DISCOVERY_HINTS.length), POLL_MS);
    return () => clearInterval(t);
  }, [discoverStatus]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setPhase("working");
    setAddStatus("running");
    setErrorMsg(null);

    const res = await addCompany({ url: input.trim(), email: "demo@radar.app", discover: true });
    if (res.status === 429) {
      setErrorMsg("Daily add limit reached (this triggers real scrape + collector cost). Try again tomorrow or demo with the seeded companies.");
      setPhase("error");
      return;
    }
    if (res.status >= 400 || !res.body.companyId) {
      setErrorMsg(res.body.error || "Couldn’t add that company. Check the URL and try again.");
      setPhase("error");
      return;
    }

    setCompanyId(res.body.companyId);
    setCompanyName(res.body.name);
    setAddStatus("done");
    setDiscoverStatus("running");
    startPolling(res.body.companyId);
  }

  function startPolling(id: string) {
    const started = Date.now();
    const tick = async () => {
      try {
        const data = await fetchCompanyPages(id);
        setPagesData(data);
        const nonHome = data.pages.filter((p) => p.pageType !== "homepage").length;
        const timedOut = Date.now() - started > MAX_POLL_MS;
        // Settle when discovery has produced usable pages, or we hit the cap.
        if (nonHome > 0 || timedOut) {
          if (pollRef.current) clearInterval(pollRef.current);
          setDiscoverStatus("done");
          setPhase("confirm");
        }
      } catch {
        /* transient; keep polling */
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
  }

  const foundNonHome = pagesData?.pages.filter((p) => p.pageType !== "homepage").length ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Track a company</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter a company and Radar discovers its key public pages, then watches them for changes.
        </p>
      </div>

      {/* Command-style input */}
      {(phase === "input" || phase === "error") && (
        <form onSubmit={onSubmit}>
          <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-elevated px-4 py-3 shadow-pop focus-within:border-brand/60">
            <span className="text-ink-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Company name or URL — e.g. linear.app"
              className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted/70 outline-none"
            />
            <button type="submit" className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!input.trim()}>
              Discover
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
            <span>Try:</span>
            {["linear.app", "vercel.com", "stripe.com"].map((s) => (
              <button key={s} type="button" onClick={() => setInput(s)} className="rounded-full border border-hairline px-2.5 py-0.5 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
          {phase === "error" && errorMsg && (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}
        </form>
      )}

      {/* Live discovery task rows */}
      {phase === "working" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-hairline bg-elevated/40 px-4 py-3 text-sm text-ink">
            Tracking <span className="font-semibold">{companyName || input}</span>
          </div>
          <TaskRow status={addStatus} title="Add company to Radar" detail={addStatus === "done" ? "Company created" : "Registering…"} />
          <TaskRow
            status={discoverStatus}
            title="Discover public pages"
            detail={
              discoverStatus === "running" ? (
                <span>
                  {DISCOVERY_HINTS[hintIdx]} {foundNonHome > 0 && <span className="text-ink">· found {foundNonHome} so far</span>}
                </span>
              ) : "Discovery complete"
            }
          />
          <p className="px-1 text-xs text-ink-muted">
            Discovery runs a real Bright Data scrape in the background — this can take up to a minute.
          </p>
        </div>
      )}

      {/* Confirmation */}
      {phase === "confirm" && companyId && pagesData && (
        <ConfirmStep
          companyId={companyId}
          companyName={companyName}
          data={pagesData}
          onRefresh={async () => setPagesData(await fetchCompanyPages(companyId))}
          onDone={() => router.push(`/companies/${companyId}`)}
        />
      )}
    </div>
  );
}

function ConfirmStep({
  companyId,
  companyName,
  data,
  onRefresh,
  onDone,
}: {
  companyId: string;
  companyName: string;
  data: PagesResponse;
  onRefresh: () => Promise<void>;
  onDone: () => void;
}) {
  const found = data.pages;
  const missing = data.discovery.missingPageTypes;
  const suggestManual = data.discovery.suggestManualEntry;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-hairline-light bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Discovered pages for {companyName}</h2>
          <span className="text-xs text-ink-muted">{found.length} found · {missing.length} missing</span>
        </div>

        {found.length === 0 && (
          <p className="mt-3 text-sm text-ink-muted">No pages were discovered automatically.</p>
        )}

        <ul className="mt-3 divide-y divide-hairline-light">
          {found.map((p) => (
            <li key={p.trackedPageId} className="flex items-center gap-3 py-2.5">
              <span className="w-32 shrink-0 text-sm font-medium text-ink">{PAGE_TYPE_LABELS[p.pageType] ?? p.pageType}</span>
              <span className="flex-1 truncate font-mono text-xs text-ink-muted" title={p.url}>{hostPath(p.url)}</span>
              <StatusPill status={p.status} />
            </li>
          ))}
        </ul>
      </div>

      {/* Honest handling of the real suggestManualEntry flag */}
      {(suggestManual || missing.length > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          {suggestManual && (
            <p className="mb-3 text-sm text-amber-800">
              {data.discovery.message ?? "Automatic discovery came up short — add the pages you want to track by hand below."}
            </p>
          )}
          {!suggestManual && missing.length > 0 && (
            <p className="mb-3 text-sm text-ink-muted">Add any pages discovery missed:</p>
          )}
          <div className="space-y-2">
            {missing.map((pt) => (
              <ManualPageRow key={pt} companyId={companyId} pageType={pt} onAdded={onRefresh} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/feed" className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink">Go to feed</Link>
        <button onClick={onDone} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">View {companyName} →</button>
      </div>
    </div>
  );
}

function ManualPageRow({ companyId, pageType, onAdded }: { companyId: string; pageType: string; onAdded: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!url.trim()) return;
    setSaving(true);
    const res = await addOrCorrectPage(companyId, { pageType, url: url.trim() });
    setSaving(false);
    if (res.status < 400) {
      setSaved(true);
      await onAdded();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-sm font-medium text-ink">{PAGE_TYPE_LABELS[pageType] ?? pageType}</span>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={`https://…/${pageType}`}
        disabled={saved}
        className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-sm text-ink outline-none focus:border-brand/60 disabled:opacity-60"
      />
      <button
        onClick={save}
        disabled={saving || saved || !url.trim()}
        className="rounded-lg bg-brand/90 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saved ? "Added ✓" : saving ? "…" : "Add"}
      </button>
    </div>
  );
}
