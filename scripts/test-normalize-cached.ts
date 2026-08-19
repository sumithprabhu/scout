/**
 * Validates the flatten + normalize fix against the ALREADY-COLLECTED Naukri
 * dataset (free — cached ~16 days), so we don't spend another credit.
 *   npx tsx scripts/test-normalize-cached.ts <collection_id>
 */
import "dotenv/config";
import { pollDataset } from "../lib/scrapers/brightdata";
import { naukriAdapter } from "../lib/scrapers/sources/naukri";

const CONTAINER_KEYS = ["job_cards", "jobs", "results", "items", "listings", "postings", "data"];
function explode(rows: any[]): any[] {
  const out: any[] = [];
  for (const row of rows) {
    let expanded = false;
    for (const k of CONTAINER_KEYS) {
      if (Array.isArray(row?.[k]) && row[k].length && typeof row[k][0] === "object") {
        out.push(...row[k]);
        expanded = true;
        break;
      }
    }
    if (!expanded) out.push(row);
  }
  return out;
}

async function main() {
  const id = process.argv[2] || "j_msx6bsrs1jl3qeairh";
  const raw = await pollDataset(id, { timeoutMs: 30_000 });
  console.log(`raw rows: ${raw.length}`);
  const rows = explode(raw);
  console.log(`after flatten: ${rows.length} job rows\n`);

  const { ctx } = naukriAdapter.buildTargets("backend developer");
  let usable = 0;
  const samples: any[] = [];
  for (const row of rows) {
    const job = naukriAdapter.normalizeRow(row, ctx);
    if (job) {
      usable++;
      if (samples.length < 4) samples.push({ title: job.title, company: job.companyName, location: job.location, descLen: job.rawDescriptionText.length, applyUrl: job.applyUrl });
    }
  }
  console.log(`NORMALIZED: ${usable}/${rows.length} usable\n`);
  console.log(JSON.stringify(samples, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
