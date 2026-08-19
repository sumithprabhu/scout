/**
 * DEV / DEMO ONLY — not the production data path.
 *
 * Bright Data Scraper Studio is the required scraper for this project. This
 * script exists ONLY to exercise the downstream pipeline (Nova parsing + skill
 * matching) on REAL job data while the Bright Data account is being provisioned.
 * It fetches a few real listings straight from the ATS public JSON feeds and
 * runs the exact same parse -> match -> rank path the API routes use.
 *
 *   npx tsx scripts/dev-ingest.ts
 *
 * When Bright Data is ready, POST /api/scrape replaces this seeding step and the
 * rest of the pipeline is unchanged.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { JobListing } from "../models/JobListing";
import { UserProfile } from "../models/UserProfile";
import { MatchResult } from "../models/MatchResult";
import { htmlToText } from "../lib/scrapers/sources/shared";
import { parseAndStore } from "../lib/jdParser";
import { computeMatch } from "../lib/matchEngine";
import { ParsedJD } from "../models/ParsedJD";
import type { NormalizedJob } from "../lib/types";

const PER_SOURCE = Number(process.env.DEV_INGEST_N || 5);

// This product targets tech roles, so seed real engineering listings. Require
// an actual "engineer"/"developer" title word — matching loose terms like
// "platform" pulls in sales roles ("Enterprise Platforms") that have no stack.
const ENG_TITLE = /\b(engineer|developer|programmer)\b/i;

// A demo skill profile chosen to produce a mix of strong fits and near-misses.
const DEMO_IDENTITY = "demo@job-matcher.dev";
const DEMO_SKILLS = ["python", "javascript", "react", "typescript", "aws", "sql", "docker"];

async function fetchGreenhouse(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  const data = (await res.json()) as { jobs: any[] };
  return (data.jobs || [])
    .filter((j) => ENG_TITLE.test(j.title ?? ""))
    .slice(0, PER_SOURCE)
    .map((j) => ({
    source: "greenhouse" as const,
    companyName: j.company_name || slug,
    title: j.title ?? "",
    location: j.location?.name ?? "",
    rawDescriptionText: htmlToText(j.content ?? ""),
    applyUrl: j.absolute_url ?? "",
    postedDate: j.updated_at ? new Date(j.updated_at) : null,
    collectorId: "dev-ingest-greenhouse",
  }));
}

async function fetchLever(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  const data = (await res.json()) as any[];
  return (data || [])
    .filter((p) => ENG_TITLE.test(p.text ?? ""))
    .slice(0, PER_SOURCE)
    .map((p) => ({
    source: "lever" as const,
    companyName: slug.charAt(0).toUpperCase() + slug.slice(1),
    title: p.text ?? "",
    location: p.categories?.location ?? p.categories?.team ?? "",
    rawDescriptionText: p.descriptionPlain ?? htmlToText(p.description ?? ""),
    applyUrl: p.hostedUrl ?? p.applyUrl ?? "",
    postedDate: p.createdAt ? new Date(p.createdAt) : null,
    collectorId: "dev-ingest-lever",
  }));
}

async function main() {
  await connectDB();

  // Clean prior dev-ingest data so re-runs start fresh (removes the sales roles
  // an earlier looser filter may have seeded).
  const stale = await JobListing.find({ collectorId: { $in: ["dev-ingest-greenhouse", "dev-ingest-lever"] } })
    .select("_id")
    .lean();
  const staleIds = stale.map((s) => s._id);
  await Promise.all([
    ParsedJD.deleteMany({ jobListingId: { $in: staleIds } }),
    MatchResult.deleteMany({ jobListingId: { $in: staleIds } }),
    JobListing.deleteMany({ collectorId: { $in: ["dev-ingest-greenhouse", "dev-ingest-lever"] } }),
  ]);

  console.log(`Fetching ${PER_SOURCE} real eng jobs each from Greenhouse(stripe) + Lever(spotify)...`);
  const jobs = [
    ...(await fetchGreenhouse("stripe")),
    ...(await fetchLever("spotify")),
  ].filter((j) => j.title && j.rawDescriptionText && j.applyUrl);

  // Upsert as JobListings (same dedup path the API uses).
  const ids: string[] = [];
  for (const job of jobs) {
    const doc = await JobListing.findOneAndUpdate(
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
        $setOnInsert: { isParsed: false },
      },
      { upsert: true, new: true }
    );
    ids.push(String(doc._id));
  }
  console.log(`Seeded ${ids.length} JobListings.\n`);

  // Parse each with Nova (real extraction).
  console.log("Parsing with Amazon Nova...");
  for (const id of ids) {
    const r = await parseAndStore(id);
    process.stdout.write(`  ${r.parseConfidence === "high" ? "✓" : "·"}`);
  }
  console.log("\n");

  // Demo profile.
  const profile = await UserProfile.findOneAndUpdate(
    { identity: DEMO_IDENTITY },
    { $set: { skills: DEMO_SKILLS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Demo profile skills: ${DEMO_SKILLS.join(", ")}\n`);

  // Match against every parsed JD and rank.
  const parsed = await ParsedJD.find({ jobListingId: { $in: ids } }).lean();
  const rows: Array<{ title: string; company: string; fit: number; missing: string[]; matched: number; required: number }> = [];
  for (const jd of parsed) {
    const outcome = computeMatch(profile.skills, {
      requiredSkills: jd.requiredSkills,
      niceToHaveSkills: jd.niceToHaveSkills,
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
    const listing = await JobListing.findById(jd.jobListingId).select("title companyName").lean();
    rows.push({
      title: listing?.title ?? "?",
      company: listing?.companyName ?? "?",
      fit: outcome.fitPercentage,
      missing: outcome.missingSkills,
      matched: outcome.matchedCount,
      required: outcome.requiredCount,
    });
  }

  rows.sort((a, b) => b.fit - a.fit);
  console.log("=== Top matches (real jobs, Nova-parsed, ranked by fit) ===\n");
  for (const r of rows.slice(0, 12)) {
    let status: string;
    if (r.required === 0) status = "  · no required skills parsed (low confidence)";
    else if (r.missing.length === 0) status = `  ✓ full match (${r.matched}/${r.required} required)`;
    else status = `  ✗ missing: ${r.missing.join(", ")}`;
    console.log(`${String(r.fit).padStart(3)}%  ${r.company} — ${r.title.slice(0, 48)}\n   ${status}`);
  }

  console.log(
    `\nProfile id for the API: ${profile._id}\n` +
      `Try: GET /api/jobs?userProfileId=${profile._id}&nearMissThreshold=50`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("dev-ingest failed:", e);
  process.exit(1);
});
