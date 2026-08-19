/**
 * Multi-source aggregation demo (the product's actual differentiator).
 * Pulls REAL jobs from TWO different Bright Data collectors — Greenhouse (US
 * tech) and Naukri (India) — normalizes both into the shared shape, Nova-parses
 * them, and produces ONE ranked list across sources with missing skills.
 *
 * Uses cached collector datasets (free, ~16-day retention) so it costs no scrape
 * credit. Lever + Workday are verified to return the same schema (see
 * scrapers/collector-map.json) and flow through the identical path.
 *   npx tsx scripts/demo-multisource.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { pollDataset } from "../lib/scrapers/brightdata";
import { greenhouseAdapter } from "../lib/scrapers/sources/greenhouse";
import { naukriAdapter } from "../lib/scrapers/sources/naukri";
import type { SourceAdapter } from "../lib/scrapers/sources/shared";
import type { NormalizedJob } from "../lib/types";
import { JobListing } from "../models/JobListing";
import { UserProfile } from "../models/UserProfile";
import { MatchResult } from "../models/MatchResult";
import { ParsedJD } from "../models/ParsedJD";
import { parseAndStore } from "../lib/jdParser";
import { computeMatch } from "../lib/matchEngine";

const CONTAINER_KEYS = ["job_cards", "jobs", "results", "items", "listings", "postings", "data"];
function explode(rows: any[]): any[] {
  const out: any[] = [];
  for (const row of rows) {
    let ex = false;
    for (const k of CONTAINER_KEYS)
      if (Array.isArray(row?.[k]) && row[k].length && typeof row[k][0] === "object") { out.push(...row[k]); ex = true; break; }
    if (!ex) out.push(row);
  }
  return out;
}

// (collectionId, adapter, input, howMany) per source — cached datasets.
const SOURCES: Array<{ collectionId: string; adapter: SourceAdapter; input: string; take: number }> = [
  { collectionId: "j_msx9xwey23qiqcca7j", adapter: greenhouseAdapter, input: "gitlab", take: 6 },
  { collectionId: "j_msx6bsrs1jl3qeairh", adapter: naukriAdapter, input: "backend developer", take: 6 },
];

const DEMO_IDENTITY = "demo-multi@job-matcher.dev";
const DEMO_SKILLS = ["python", "go", "kubernetes", "docker", "postgresql", "aws", "git", "react"];

async function main() {
  await connectDB();

  const collected: NormalizedJob[] = [];
  for (const s of SOURCES) {
    const { ctx } = s.adapter.buildTargets(s.input);
    const raw = await pollDataset(s.collectionId, { timeoutMs: 30_000 });
    const jobs = explode(raw)
      .map((r) => s.adapter.normalizeRow(r, ctx))
      .filter((j): j is NormalizedJob => j !== null)
      .slice(0, s.take);
    console.log(`${s.adapter.source.padEnd(11)} ${jobs.length} jobs`);
    collected.push(...jobs);
  }
  console.log(`\nAggregated ${collected.length} real jobs across ${SOURCES.length} sources/collectors.\n`);

  const ids: string[] = [];
  for (const job of collected) {
    const doc = await JobListing.findOneAndUpdate(
      { source: job.source, applyUrl: job.applyUrl },
      { $set: { ...job, scrapedAt: new Date() }, $setOnInsert: { isParsed: false } },
      { upsert: true, new: true }
    );
    ids.push(String(doc._id));
  }

  console.log("Parsing all with Amazon Nova...");
  for (const id of ids) { const r = await parseAndStore(id); process.stdout.write(r.parseConfidence === "high" ? " ✓" : " ·"); }
  console.log("\n");

  const profile = await UserProfile.findOneAndUpdate(
    { identity: DEMO_IDENTITY }, { $set: { skills: DEMO_SKILLS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Profile: ${DEMO_SKILLS.join(", ")}\n`);

  const parsed = await ParsedJD.find({ jobListingId: { $in: ids } }).lean();
  const rows: Array<{ src: string; co: string; t: string; fit: number; miss: string[]; req: number }> = [];
  for (const jd of parsed) {
    const o = computeMatch(profile.skills, { requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills });
    await MatchResult.updateOne(
      { userProfileId: profile._id, jobListingId: jd.jobListingId },
      { $set: { fitPercentage: o.fitPercentage, matchedSkills: o.matchedSkills, missingSkills: o.missingSkills, computedAt: new Date() } },
      { upsert: true }
    );
    const l = await JobListing.findById(jd.jobListingId).select("title companyName source").lean();
    rows.push({ src: l?.source ?? "?", co: l?.companyName ?? "?", t: l?.title ?? "?", fit: o.fitPercentage, miss: o.missingSkills, req: o.requiredCount });
  }
  rows.sort((a, b) => b.fit - a.fit);

  console.log("=== ONE ranked list across Greenhouse + Naukri (real → Nova → match) ===\n");
  for (const r of rows) {
    const s = r.req === 0 ? "· no skills parsed" : r.miss.length === 0 ? "✓ full match" : `✗ missing: ${r.miss.slice(0, 7).join(", ")}`;
    console.log(`${String(r.fit).padStart(3)}%  [${r.src.padEnd(10)}] ${r.co.slice(0, 20).padEnd(20)} ${r.t.slice(0, 32)}\n       ${s}`);
  }
  console.log(`\nProfile id: ${profile._id}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
