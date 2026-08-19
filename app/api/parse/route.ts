import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { JobListing } from "@/models/JobListing";
import { parseAndStore } from "@/lib/jdParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/parse
 * Body (optional): { limit?: number, jobListingId?: string }
 *   - jobListingId: parse one specific listing (re-parse allowed).
 *   - otherwise: parse up to `limit` (default 20) not-yet-parsed listings.
 * Each parse is a Claude call, so we cap the batch to keep latency/cost bounded.
 */
export async function POST(req: Request) {
  let body: { limit?: number; jobListingId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  await connectDB();

  // Single-listing mode.
  if (body.jobListingId) {
    try {
      const result = await parseAndStore(body.jobListingId);
      return NextResponse.json({ parsed: 1, results: [{ jobListingId: body.jobListingId, ...result }] });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  // Batch mode: grab unparsed listings.
  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 50);
  const unparsed = await JobListing.find({ isParsed: false })
    .sort({ scrapedAt: 1 })
    .limit(limit)
    .select("_id")
    .lean();

  const results: Array<{ jobListingId: string; requiredSkills: string[]; parseConfidence: string }> = [];
  let failed = 0;
  for (const doc of unparsed) {
    const id = String(doc._id);
    try {
      const r = await parseAndStore(id);
      results.push({ jobListingId: id, requiredSkills: r.requiredSkills, parseConfidence: r.parseConfidence });
    } catch (err) {
      failed++;
      console.error(`[/api/parse] failed for ${id}:`, (err as Error).message);
    }
  }

  return NextResponse.json({
    requested: unparsed.length,
    parsed: results.length,
    failed,
    results,
  });
}
