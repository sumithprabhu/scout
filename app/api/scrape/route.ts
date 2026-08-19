import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { JobListing } from "@/models/JobListing";
import { runScraper } from "@/lib/scrapers";
import { checkRateLimit, resolveIdentity } from "@/lib/rateLimit";
import { JOB_SOURCES, type JobSource } from "@/lib/types";

// Mongoose + the Anthropic SDK need the Node runtime (not edge), and these
// routes must never be statically optimized — they do real work per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scrape
 * Body: { source: "greenhouse"|"lever"|"workday"|"naukri", input: string, email?: string }
 *   - input is a company slug (greenhouse/lever), a board URL (workday), or a
 *     search query (naukri).
 * Rate-limited per identity/day because each run spends Bright Data credits.
 */
export async function POST(req: Request) {
  let body: { source?: string; input?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { source, input, email } = body;
  if (!source || !JOB_SOURCES.includes(source as JobSource)) {
    return NextResponse.json(
      { error: `source must be one of: ${JOB_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!input || !input.trim()) {
    return NextResponse.json(
      { error: "input (company slug / board URL / search query) is required" },
      { status: 400 }
    );
  }

  // Rate limit BEFORE spending credits.
  const limit = Number(process.env.SCRAPE_RATE_LIMIT_PER_DAY ?? 25);
  const identity = resolveIdentity(req, email);
  const rl = await checkRateLimit(identity, limit);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Daily scrape limit reached", limit: rl.limit, identity: rl.identity },
      { status: 429, headers: { "x-ratelimit-remaining": String(rl.remaining) } }
    );
  }

  try {
    // Real collector runs take minutes (pagination + batch fallback), so give the
    // poll a generous ceiling. NOTE: this makes /api/scrape a long synchronous
    // request; the production shape is to trigger, return a job id, and ingest
    // results via a webhook/poller — out of scope for the hackathon.
    const result = await runScraper(source as JobSource, input.trim(), {
      timeoutMs: 540_000,
    });
    await connectDB();

    // Upsert each normalized job on (source, applyUrl) so re-runs don't duplicate.
    let inserted = 0;
    let updated = 0;
    for (const job of result.jobs) {
      const res = await JobListing.updateOne(
        { source: job.source, applyUrl: job.applyUrl },
        {
          $set: {
            companyName: job.companyName,
            title: job.title,
            location: job.location,
            rawDescriptionText: job.rawDescriptionText,
            postedDate: job.postedDate,
            collectorId: job.collectorId,
            scrapedAt: new Date(),
          },
          // Only on first insert: mark unparsed so /api/parse picks it up.
          $setOnInsert: { isParsed: false },
        },
        { upsert: true }
      );
      if (res.upsertedCount) inserted++;
      else if (res.modifiedCount) updated++;
    }

    return NextResponse.json({
      source: result.source,
      collectorId: result.collectorId,
      input: result.input,
      scraped: result.jobs.length,
      droppedRows: result.droppedRows,
      inserted,
      updated,
      rateLimitRemaining: rl.remaining,
    });
  } catch (err) {
    console.error("[/api/scrape] error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Scrape failed" },
      { status: 502 }
    );
  }
}
