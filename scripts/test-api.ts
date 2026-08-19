/**
 * Integration test for the API routes that don't need external services.
 * Seeds a parsed job directly, then drives profile -> match -> jobs over HTTP,
 * and checks the rate limiter. Requires the dev server on PORT (default 3111)
 * started with SCRAPE_RATE_LIMIT_PER_DAY=2.
 *   PORT=3111 npx tsx scripts/test-api.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { JobListing } from "../models/JobListing";
import { ParsedJD } from "../models/ParsedJD";
import { UserProfile } from "../models/UserProfile";
import { MatchResult } from "../models/MatchResult";

const BASE = `http://localhost:${process.env.PORT || 3111}`;
const IDENTITY = "itest@example.com";
const TAG = "itest";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`✓ ${name}`);
  else { failures++; console.error(`✗ ${name}`, detail ?? ""); }
}

async function main() {
  await connectDB();

  // Clean slate.
  const oldJobs = await JobListing.find({ collectorId: TAG }).select("_id").lean();
  const oldIds = oldJobs.map((j) => j._id);
  await Promise.all([
    ParsedJD.deleteMany({ jobListingId: { $in: oldIds } }),
    JobListing.deleteMany({ collectorId: TAG }),
    UserProfile.deleteMany({ identity: IDENTITY }),
  ]);

  // Seed one JobListing + ParsedJD (bypasses scrape/parse which need external svcs).
  const job = await JobListing.create({
    source: "greenhouse",
    companyName: "Acme",
    title: "Senior Backend Engineer",
    location: "Remote",
    rawDescriptionText: "Go, Kubernetes, PostgreSQL required. gRPC a plus.",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/itest-1",
    collectorId: TAG,
    isParsed: true,
  });
  await ParsedJD.create({
    jobListingId: job._id,
    requiredSkills: ["go", "kubernetes", "postgresql"],
    niceToHaveSkills: ["grpc"],
    seniorityLevel: "senior",
    parseConfidence: "high",
  });
  await MatchResult.deleteMany({ jobListingId: job._id });

  // 1. Create profile
  const pRes = await fetch(`${BASE}/api/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: IDENTITY, skills: ["Go", "PostgreSQL", "Docker"] }),
  });
  const profile = await pRes.json();
  check("POST /api/profile 200", pRes.status === 200, pRes.status);
  check("profile normalized skills to lowercase", profile.skills?.includes("go"), profile.skills);
  const userProfileId = profile.id;

  // 2. Match
  const mRes = await fetch(`${BASE}/api/match`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userProfileId, threshold: 50 }),
  });
  const match = await mRes.json();
  check("POST /api/match 200", mRes.status === 200, match);
  check("match computed >= 1", match.computed >= 1, match);

  // 3. Jobs — expect our seeded job with correct missing skill
  const jRes = await fetch(`${BASE}/api/jobs?userProfileId=${userProfileId}&nearMissThreshold=50`);
  const jobsBody = await jRes.json();
  check("GET /api/jobs 200", jRes.status === 200, jobsBody);
  const ours = (jobsBody.jobs ?? []).find((j: any) => j.jobListingId === String(job._id));
  check("seeded job returned", Boolean(ours), jobsBody.jobs);
  check("fit is 57 (2/3 required)", ours?.fitPercentage === 57, ours?.fitPercentage);
  check(
    "missingSkills is exactly ['kubernetes']",
    ours?.missingSkills?.length === 1 && ours.missingSkills[0] === "kubernetes",
    ours?.missingSkills
  );
  check("matchedSkills has go + postgresql", ours?.matchedSkills?.length === 2, ours?.matchedSkills);
  check("nearMiss flagged at threshold 50", ours?.nearMiss === true, ours);

  // 4. Rate limiter (limit=2). 3rd scrape must be 429 before hitting Bright Data.
  const statuses: number[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/api/scrape`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "greenhouse", input: "acme", email: "rl@example.com" }),
    });
    statuses.push(r.status);
  }
  check("3rd scrape is 429 (rate limited)", statuses[2] === 429, statuses);

  // Validation checks
  const badSource = await fetch(`${BASE}/api/scrape`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "linkedin", input: "x" }),
  });
  check("bad source -> 400", badSource.status === 400, badSource.status);

  // Cleanup
  await Promise.all([
    ParsedJD.deleteMany({ jobListingId: job._id }),
    JobListing.deleteMany({ collectorId: TAG }),
    UserProfile.deleteMany({ identity: IDENTITY }),
    MatchResult.deleteMany({ jobListingId: job._id }),
  ]);
  await mongoose.disconnect();

  console.log(failures === 0 ? "\nALL API INTEGRATION TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-api failed:", e); process.exit(1); });
