/**
 * REAL end-to-end: run a real Bright Data collector -> real scraped fields ->
 * ingest pipeline (Snapshot + diff + classify). Closes the "real scraped bytes"
 * gap for Step 4. Spends a small Bright Data credit (runs cost, builds are free).
 *
 *   npx tsx scripts/test-real-scrape-ingest.ts
 *
 * Uses the hubspot pricing collector built (and RECOVERED from the cap) during
 * the burst test. Runs it TWICE in a row against the live page and proves:
 *   - the collector returns usable structured pricing fields from a real page
 *   - snapshot v1 establishes a baseline
 *   - re-scraping the unchanged page -> diff no-op (no false-positive signal)
 * This is the user's "run the same collector twice, nothing changed" test on
 * genuinely-scraped data.
 */
import "dotenv/config";
import { runCollector } from "@/lib/scrapers/brightdata";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { ingestSnapshot } from "@/lib/intel/ingest";
import { normalizeRootUrl, normalizePageUrl } from "@/lib/intel/url";

const COLLECTOR_ID = process.env.HUBSPOT_PRICING_COLLECTOR ?? "c_msyu33rz12ts8o6thp";
const PAGE_URL = "https://www.hubspot.com/pricing";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "input" || k === "timestamp" || k.startsWith("_")) continue;
    out[k] = v;
  }
  return out;
}

async function scrapeOnce(label: string): Promise<Record<string, unknown>> {
  console.log(`\n[${label}] running collector ${COLLECTOR_ID} against ${PAGE_URL} (real scrape, may take minutes)...`);
  const rows = await runCollector(COLLECTOR_ID, [PAGE_URL], { timeoutMs: 300_000 });
  console.log(`[${label}] got ${rows.length} row(s)`);
  const fields = cleanRow((rows[0] ?? {}) as Record<string, unknown>);
  console.log(`[${label}] extracted fields keys: ${Object.keys(fields).join(", ") || "(none)"}`);
  return fields;
}

async function main() {
  await connectDB();
  const tag = `realscrape-${Date.now()}`;
  const company = await Company.create({ name: `HubSpot ${tag}`, rootUrl: normalizeRootUrl(`${tag}.hubspot.com`)! });
  const page = await TrackedPage.create({
    companyId: company._id, pageType: "pricing",
    url: normalizePageUrl(PAGE_URL)!, collectorId: COLLECTOR_ID, status: "active",
  });
  const pageId = String(page._id);

  // First real scrape -> baseline
  const fields1 = await scrapeOnce("scrape 1");
  check("real scrape returned non-empty structured fields", Object.keys(fields1).length > 0,
    JSON.stringify(fields1).slice(0, 300));
  const r1 = await ingestSnapshot({ trackedPageId: pageId, extractedFields: fields1 });
  check("v1 baseline (first-snapshot, no signal)", r1.versionNumber === 1 && r1.reason === "first-snapshot");
  console.log(`     sample of real scraped data: ${JSON.stringify(fields1).slice(0, 400)}`);

  // Second real scrape of the unchanged page -> should be a no-op
  const fields2 = await scrapeOnce("scrape 2");
  const r2 = await ingestSnapshot({ trackedPageId: pageId, extractedFields: fields2 });
  check("v2 stored (version 2)", r2.versionNumber === 2);
  check("re-scrape of unchanged page -> no-meaningful-change (no false signal)",
    r2.reason === "no-meaningful-change", `reason=${r2.reason}, changeCount=${r2.changeCount}`);
  if (r2.reason !== "no-meaningful-change") {
    // If the live page genuinely changed between runs (or extraction jittered),
    // show what differed so it's transparent rather than a silent fail.
    console.log(`     note: diff was non-empty; summary="${r2.summary}"`);
  }

  console.log("\ncleaning up...");
  await Promise.all([
    SignalEvent.deleteMany({ companyId: company._id }),
    Snapshot.deleteMany({ trackedPageId: pageId }),
    TrackedPage.deleteMany({ companyId: company._id }),
    Company.deleteMany({ _id: company._id }),
  ]);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-real-scrape-ingest failed:", e); process.exit(1); });
