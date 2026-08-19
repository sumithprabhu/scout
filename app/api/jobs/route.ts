import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MatchResult } from "@/models/MatchResult";
import type { JobListingDoc } from "@/models/JobListing";
// Ensure the referenced model is registered before populate() runs. Importing
// it for its side effect (model registration) is why it's here despite no direct use.
import "@/models/JobListing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/jobs?userProfileId=...&minFit=0&nearMissThreshold=60&limit=50
 *   Returns the user's matched jobs sorted by fit (desc). For each job we
 *   surface matchedSkills and, crucially, missingSkills — and flag `nearMiss`
 *   for strong-but-imperfect fits so the UI can say "you're close, here's what's
 *   missing" instead of making the user read the JD.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userProfileId = url.searchParams.get("userProfileId");
  const minFit = Number(url.searchParams.get("minFit") ?? 0);
  const nearMissThreshold = Number(url.searchParams.get("nearMissThreshold") ?? 60);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);

  if (!userProfileId || !Types.ObjectId.isValid(userProfileId)) {
    return NextResponse.json({ error: "valid userProfileId query param is required" }, { status: 400 });
  }

  await connectDB();

  const matches = await MatchResult.find({
    userProfileId: new Types.ObjectId(userProfileId),
    fitPercentage: { $gte: minFit },
  })
    .sort({ fitPercentage: -1, computedAt: -1 })
    .limit(limit)
    .populate<{ jobListingId: JobListingDoc & { _id: Types.ObjectId } }>(
      "jobListingId",
      "source companyName title location applyUrl postedDate"
    )
    .lean();

  const jobs = matches
    // Drop matches whose job was deleted (defensive — populate yields null then).
    .filter((m) => m.jobListingId)
    .map((m) => {
      const job = m.jobListingId as unknown as JobListingDoc & { _id: Types.ObjectId };
      const nearMiss =
        m.fitPercentage >= nearMissThreshold &&
        m.fitPercentage < 100 &&
        m.missingSkills.length > 0;
      return {
        jobListingId: String(job._id),
        source: job.source,
        companyName: job.companyName,
        title: job.title,
        location: job.location,
        applyUrl: job.applyUrl,
        postedDate: job.postedDate,
        fitPercentage: m.fitPercentage,
        matchedSkills: m.matchedSkills,
        missingSkills: m.missingSkills,
        nearMiss,
      };
    });

  return NextResponse.json({ count: jobs.length, jobs });
}
