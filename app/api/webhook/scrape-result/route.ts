import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TrackedPage } from "@/models/TrackedPage";
import { ingestSnapshot } from "@/lib/intel/ingest";
import { normalizePageUrl } from "@/lib/intel/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// ingestSnapshot is awaited in full here (diff + a Nova classify/summarize call)
// before responding to Bright Data — give it headroom beyond Vercel's short
// default in case of a slow Bedrock round-trip or retry backoff.
export const maxDuration = 30;

/**
 * POST /api/webhook/scrape-result?pageUrl=<url>
 *
 * Bright Data POSTs a collector's run output here on each scheduled run (we set
 * this as the collector's --deliver-webhook target, with the page URL baked into
 * the query at creation time). Thin by design: parse -> resolve page -> hand to
 * ingestSnapshot (which stores the versioned Snapshot, diffs, and classifies).
 *
 * Push, not poll (a hard requirement): we never sit polling /dca/dataset for
 * scheduled runs — Bright Data calls us. Manual "run now" flows reuse the same
 * ingestSnapshot pipeline so behavior is identical whoever triggers it.
 *
 * SECURITY: guarded by a shared secret (WEBHOOK_SECRET) so only Bright Data can
 * post. In dev with no secret set, the guard is skipped (logged).
 */

const CONTAINER_KEYS = ["data", "results", "items", "rows", "records"];

/** Bright Data delivery bodies vary: a bare array, {data:[...]}, or a single
 *  object. Normalize to a flat row list. */
function extractRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === "object") {
    for (const k of CONTAINER_KEYS) {
      const v = (body as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
    return [body as Record<string, unknown>];
  }
  return [];
}

/** Strip Bright Data echo/metadata so extractedFields is just the page data. */
function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "input" || k === "timestamp" || k.startsWith("_")) continue;
    out[k] = v;
  }
  return out;
}

function checkSecret(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] WEBHOOK_SECRET not set — accepting delivery unauthenticated (dev).");
    return true;
  }
  const url = new URL(req.url);
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");
  return provided === secret;
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const url = new URL(req.url);
  const rows = extractRows(body);
  if (rows.length === 0) {
    return NextResponse.json({ error: "delivery contained no rows" }, { status: 400 });
  }

  // Resolve which page this delivery is for: prefer the baked-in query param,
  // fall back to an echoed input.url on the first row.
  const rawPageUrl =
    url.searchParams.get("pageUrl") ??
    (rows[0]?.input as { url?: string } | undefined)?.url ??
    (typeof rows[0]?.url === "string" ? (rows[0].url as string) : undefined);
  const pageUrl = rawPageUrl ? normalizePageUrl(rawPageUrl) : null;
  if (!pageUrl) {
    return NextResponse.json({ error: "could not resolve pageUrl for delivery" }, { status: 400 });
  }

  await connectDB();
  // A URL can back multiple TrackedPages (shared infra across companies); ingest
  // each. Only active pages accept snapshots.
  const pages = await TrackedPage.find({ url: pageUrl, status: "active" }).lean();
  if (pages.length === 0) {
    return NextResponse.json(
      { error: `no active TrackedPage for ${pageUrl}` },
      { status: 404 }
    );
  }

  // Our extraction prompts emit ONE record per page; if a collector returns
  // several, the first cleaned row is the page's structured state.
  const extractedFields = cleanRow(rows[0]);
  const rawContent = JSON.stringify(rows).slice(0, 200_000);

  const outcomes = [];
  for (const page of pages) {
    try {
      outcomes.push(await ingestSnapshot({ trackedPageId: String(page._id), extractedFields, rawContent }));
    } catch (err) {
      console.error("[webhook] ingest failed for", String(page._id), err);
      outcomes.push({ trackedPageId: String(page._id), error: (err as Error).message });
    }
  }

  return NextResponse.json({ pageUrl, ingested: outcomes.length, outcomes });
}
