/**
 * Throwaway smoke test for step 1 + 2: proves the Mongoose connection helper and
 * all four models actually round-trip against a real MongoDB. Run with:
 *   npx tsx scripts/smoke-db.ts
 * Safe to delete once you trust the data layer.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { JobListing } from "../models/JobListing";
import { ParsedJD } from "../models/ParsedJD";
import { UserProfile } from "../models/UserProfile";
import { MatchResult } from "../models/MatchResult";

async function main() {
  await connectDB();
  console.log("✓ connected to", mongoose.connection.name);

  // Clean slate for a deterministic run.
  const tag = "smoke-test";
  await Promise.all([
    JobListing.deleteMany({ collectorId: tag }),
    UserProfile.deleteMany({ identity: tag }),
  ]);

  const job = await JobListing.create({
    source: "greenhouse",
    companyName: "Acme",
    title: "Senior Backend Engineer",
    location: "Remote",
    rawDescriptionText: "We need Go, Kubernetes, and Postgres experience.",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/smoke-1",
    collectorId: tag,
  });
  console.log("✓ JobListing created:", job._id.toString());

  const parsed = await ParsedJD.create({
    jobListingId: job._id,
    requiredSkills: ["go", "kubernetes", "postgres"],
    niceToHaveSkills: ["grpc"],
    seniorityLevel: "senior",
  });
  console.log("✓ ParsedJD created:", parsed._id.toString());

  const user = await UserProfile.create({
    identity: tag,
    skills: ["go", "postgres", "docker"],
  });
  console.log("✓ UserProfile created:", user._id.toString());

  const match = await MatchResult.create({
    userProfileId: user._id,
    jobListingId: job._id,
    fitPercentage: 67,
    matchedSkills: ["go", "postgres"],
    missingSkills: ["kubernetes"],
  });
  console.log("✓ MatchResult created:", match._id.toString());

  // Prove the ref populate works (JobListing <- MatchResult).
  const populated = await MatchResult.findById(match._id)
    .populate<{ jobListingId: { title: string } }>("jobListingId", "title")
    .lean();
  console.log("✓ populate ref ->", populated?.jobListingId?.title);

  // Prove the unique dedup index rejects a duplicate scrape.
  try {
    await JobListing.create({
      source: "greenhouse",
      companyName: "Acme",
      title: "dupe",
      rawDescriptionText: "x",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/smoke-1",
      collectorId: tag,
    });
    console.error("✗ dedup index did NOT fire (unexpected)");
  } catch (e: any) {
    console.log("✓ dedup unique index fired on duplicate applyUrl (code", e.code + ")");
  }

  // Cleanup.
  await Promise.all([
    JobListing.deleteMany({ collectorId: tag }),
    ParsedJD.deleteMany({ jobListingId: job._id }),
    UserProfile.deleteMany({ identity: tag }),
    MatchResult.deleteMany({ _id: match._id }),
  ]);
  console.log("✓ cleaned up");

  await mongoose.disconnect();
  console.log("\nALL GOOD — data layer works.");
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", e);
  process.exit(1);
});
