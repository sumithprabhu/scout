/**
 * End-to-end proof on REAL Bright Data-scraped jobs, using the cached Naukri
 * collection (free — already collected). Mirrors exactly what /api/scrape does
 * (normalize -> store), then runs parse (Nova) -> match -> rank.
 *   npx tsx scripts/ingest-cached.ts <collection_id>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { pollDataset } from "../lib/scrapers/brightdata";
import { naukriAdapter } from "../lib/scrapers/sources/naukri";
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
    let expanded = false;
    for (const k of CONTAINER_KEYS) {
      if (Array.isArray(row?.[k]) && row[k].length && typeof row[k][0] === "object") {
        out.push(...row[k]); expanded = true; break;
      }
    }
    if (!expanded) out.push(row);
  }
  return out;
}

const N_STORE = Number(process.env.INGEST_STORE || 20);
const N_PARSE = Number(process.env.INGEST_PARSE || 15);
const DEMO_IDENTITY = "demo-naukri@job-matcher.dev";
const DEMO_SKILLS = ["python", "django", "postgresql", "aws", "docker", "rest"];

async function main() {
  const id = process.argv[2] || "j_msx6bsrs1jl3qeairh";
  await connectDB();

  const { ctx } = naukriAdapter.buildTargets("backend developer");
  const raw = await pollDataset(id, { timeoutMs: 30_000 });
  const rows = explode(raw);
  const jobs = rows
    .map((r) => naukriAdapter.normalizeRow(r, ctx))
    .filter((j): j is NonNullable<typeof j> => j !== null)
    .slice(0, N_STORE);
  console.log(`Real Naukri jobs (Bright Data): ${rows.length} scraped, storing ${jobs.length}\n`);

  const ids: string[] = [];
  for (const job of jobs) {
    const doc = await JobListing.findOneAndUpdate(
      { source: job.source, applyUrl: job.applyUrl },
      { $set: { ...job, scrapedAt: new Date() }, $setOnInsert: { isParsed: false } },
      { upsert: true, new: true }
    );
    ids.push(String(doc._id));
  }

  console.log(`Parsing ${Math.min(N_PARSE, ids.length)} with Amazon Nova...`);
  for (const jid of ids.slice(0, N_PARSE)) {
    const r = await parseAndStore(jid);
    process.stdout.write(r.parseConfidence === "high" ? " ✓" : " ·");
  }
  console.log("\n");

  const profile = await UserProfile.findOneAndUpdate(
    { identity: DEMO_IDENTITY },
    { $set: { skills: DEMO_SKILLS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Demo profile: ${DEMO_SKILLS.join(", ")}\n`);

  const parsed = await ParsedJD.find({ jobListingId: { $in: ids.slice(0, N_PARSE) } }).lean();
  const out: Array<{ t: string; c: string; fit: number; miss: string[]; req: number }> = [];
  for (const jd of parsed) {
    const o = computeMatch(profile.skills, { requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills });
    await MatchResult.updateOne(
      { userProfileId: profile._id, jobListingId: jd.jobListingId },
      { $set: { fitPercentage: o.fitPercentage, matchedSkills: o.matchedSkills, missingSkills: o.missingSkills, computedAt: new Date() } },
      { upsert: true }
    );
    const l = await JobListing.findById(jd.jobListingId).select("title companyName").lean();
    out.push({ t: l?.title ?? "?", c: l?.companyName ?? "?", fit: o.fitPercentage, miss: o.missingSkills, req: o.requiredCount });
  }
  out.sort((a, b) => b.fit - a.fit);

  console.log("=== Ranked matches (REAL Naukri jobs → Nova → match) ===\n");
  for (const r of out) {
    const s = r.req === 0 ? "· no skills parsed" : r.miss.length === 0 ? "✓ full match" : `✗ missing: ${r.miss.slice(0, 8).join(", ")}`;
    console.log(`${String(r.fit).padStart(3)}%  ${r.c.slice(0, 26).padEnd(26)} ${r.t.slice(0, 34)}\n      ${s}`);
  }
  console.log(`\nProfile id: ${profile._id}\nAPI: GET /api/jobs?userProfileId=${profile._id}&nearMissThreshold=40`);

  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
