import { connectDB } from "@/lib/db";
import { Collector } from "@/models/Collector";
import { TrackedPage } from "@/models/TrackedPage";
import { createCollector } from "./createCollector";
import { runQueue, type QueueResult, type QueueOptions } from "./collectorQueue";
import { extractionPromptFor } from "./pagePrompts";
import { normalizePageUrl } from "@/lib/intel/url";
import type { PageType } from "@/lib/intel/types";

/**
 * Turn a confirmed (url, pageType) into a live, collector-backed TrackedPage.
 *
 * IDEMPOTENCY (hard requirement, deduped BY URL not by company): before spending
 * an AI build we check the Collector registry for this exact normalized URL. If
 * a collector already exists we REUSE its id — so two companies sharing a URL,
 * or the same company re-added, never build twice. The registry's unique index
 * on url also makes concurrent creation race-safe.
 */

/** The URL Bright Data should POST scheduled-run results to. Public base comes
 *  from env (a tunnel in dev, the deployment origin in prod). We bake the page
 *  URL into the query so the webhook receiver knows which TrackedPage a delivery
 *  belongs to WITHOUT trusting the payload to echo it (AI-built collectors don't
 *  guarantee an input.url field). */
export function webhookTarget(pageUrl: string): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  // Bake the shared secret into the delivery URL so the webhook route accepts
  // only deliveries using the URL we handed Bright Data. Bright Data can't add
  // custom auth headers to a webhook, so the query-param secret is the practical
  // channel; the route also accepts it via header for other callers.
  const secret = process.env.WEBHOOK_SECRET;
  const secretParam = secret ? `&secret=${encodeURIComponent(secret)}` : "";
  const suffix = `/api/webhook/scrape-result?pageUrl=${encodeURIComponent(pageUrl)}${secretParam}`;
  if (!base) {
    // Non-fatal: the collector still builds; delivery just points at a stub until
    // PUBLIC_BASE_URL is set. We warn loudly because scheduled runs won't reach us.
    console.warn(
      "[createPageCollector] PUBLIC_BASE_URL not set — webhook delivery will point at a stub. " +
        "Set it to your tunnel/deploy origin so Bright Data can POST results."
    );
    return `https://example.com${suffix}`;
  }
  return `${base}${suffix}`;
}

export interface EnsureCollectorResult {
  collectorId: string;
  reused: boolean;
}

/**
 * Ensure a collector exists for this URL+pageType, reusing the registry if
 * possible. Does NOT touch TrackedPage — that's done by attachCollectorToPage so
 * the two concerns stay separable.
 */
export async function ensureCollectorForUrl(
  url: string,
  pageType: PageType,
  opts?: { timeoutSec?: number }
): Promise<EnsureCollectorResult> {
  await connectDB();
  const normUrl = normalizePageUrl(url);
  if (!normUrl) throw new Error(`ensureCollectorForUrl: invalid url "${url}"`);

  // Reuse path: a collector already exists for this exact URL.
  const existing = await Collector.findOne({ url: normUrl }).lean();
  if (existing?.collectorId) {
    return { collectorId: existing.collectorId, reused: true };
  }

  // Build path: spend one AI build, then register it.
  const collectorId = await createCollector({
    url: normUrl,
    description: extractionPromptFor(pageType),
    name: `intel-${pageType}-${Date.now()}`,
    deliverWebhook: webhookTarget(normUrl),
    timeoutSec: opts?.timeoutSec,
  });

  // Upsert on url so a race (two builds for the same URL) collapses to one row.
  // If we lost the race, the winner's id is what everyone uses.
  const doc = await Collector.findOneAndUpdate(
    { url: normUrl },
    { $setOnInsert: { url: normUrl, collectorId, pageType } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { collectorId: doc!.collectorId, reused: doc!.collectorId !== collectorId };
}

/** Attach a collector to a TrackedPage and flip it active. */
export async function attachCollectorToPage(
  trackedPageId: string,
  collectorId: string
): Promise<void> {
  await connectDB();
  await TrackedPage.updateOne(
    { _id: trackedPageId },
    { $set: { collectorId, status: "active" } }
  );
}

export interface ProvisionResult {
  trackedPageId: string;
  pageType: PageType;
  url: string;
  ok: boolean;
  reused?: boolean;
  collectorId?: string;
  attempts: number;
  error?: string;
}

/**
 * Provision collectors for a set of confirmed TrackedPages using the queue
 * (staggered + backoff). This is what the "activate company" flow calls after
 * the user confirms discovered pages.
 *
 * Pages that are already active with a collectorId are skipped (idempotent).
 */
export async function provisionCollectorsForPages(
  pages: { trackedPageId: string; url: string; pageType: PageType }[],
  queueOpts?: QueueOptions & { timeoutSec?: number }
): Promise<ProvisionResult[]> {
  const tasks = pages.map((p) => ({
    id: p.trackedPageId,
    run: async () => {
      const { collectorId, reused } = await ensureCollectorForUrl(p.url, p.pageType, {
        timeoutSec: queueOpts?.timeoutSec,
      });
      await attachCollectorToPage(p.trackedPageId, collectorId);
      return { collectorId, reused };
    },
  }));

  const byId = new Map(pages.map((p) => [p.trackedPageId, p]));
  const results = await runQueue(tasks, queueOpts);

  return results.map((r: QueueResult<{ collectorId: string; reused: boolean }>) => {
    const p = byId.get(r.id)!;
    return {
      trackedPageId: r.id,
      pageType: p.pageType,
      url: p.url,
      ok: r.ok,
      reused: r.value?.reused,
      collectorId: r.value?.collectorId,
      attempts: r.attempts,
      error: r.error?.message,
    };
  });
}
