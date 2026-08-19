import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/models/UserProfile";
import { ParsedJD } from "@/models/ParsedJD";
import { MatchResult } from "@/models/MatchResult";
import { computeMatch } from "@/lib/matchEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/match
 * Body: { userProfileId: string, threshold?: number }
 *   Computes a MatchResult for the profile against EVERY ParsedJD and upserts
 *   them (so re-running refreshes rather than duplicates). `threshold` (default
 *   0) only affects the count reported as "surfaced" — we still store all
 *   matches so /api/jobs can show near-misses with their missing skills.
 */
export async function POST(req: Request) {
  let body: { userProfileId?: string; threshold?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userProfileId || !Types.ObjectId.isValid(body.userProfileId)) {
    return NextResponse.json({ error: "valid userProfileId is required" }, { status: 400 });
  }
  const threshold = Number(body.threshold ?? 0);

  await connectDB();
  const profile = await UserProfile.findById(body.userProfileId).lean();
  if (!profile) {
    return NextResponse.json({ error: "UserProfile not found" }, { status: 404 });
  }

  const parsedJDs = await ParsedJD.find().lean();

  let computed = 0;
  let surfaced = 0;
  for (const jd of parsedJDs) {
    const outcome = computeMatch(profile.skills ?? [], {
      requiredSkills: jd.requiredSkills ?? [],
      niceToHaveSkills: jd.niceToHaveSkills ?? [],
      seniorityLevel: jd.seniorityLevel,
    });

    await MatchResult.updateOne(
      { userProfileId: profile._id, jobListingId: jd.jobListingId },
      {
        $set: {
          fitPercentage: outcome.fitPercentage,
          matchedSkills: outcome.matchedSkills,
          missingSkills: outcome.missingSkills,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );
    computed++;
    if (outcome.fitPercentage >= threshold) surfaced++;
  }

  return NextResponse.json({
    userProfileId: String(profile._id),
    parsedJDs: parsedJDs.length,
    computed,
    threshold,
    surfaced,
  });
}
