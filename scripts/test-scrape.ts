/**
 * Validation of the real Bright Data runtime path (spends a little credit).
 * Triggers the Greenhouse collector against stripe, polls for results, prints
 * the RAW collector output schema (so we can see the AI-chosen field names),
 * then runs it through the normalizer to see how many rows survive.
 *   npx tsx scripts/test-scrape.ts
 */
import "dotenv/config";
import { triggerCollector, pollDataset } from "../lib/scrapers/brightdata";
import { greenhouseAdapter } from "../lib/scrapers/sources/greenhouse";

async function main() {
  const collectorId = process.env.BRIGHTDATA_COLLECTOR_GREENHOUSE;
  if (!collectorId) throw new Error("BRIGHTDATA_COLLECTOR_GREENHOUSE not set");

  const { urls, ctx } = greenhouseAdapter.buildTargets("stripe");
  console.log(`collector=${collectorId}`);
  console.log(`target url=${urls[0]}\n`);

  console.log("Triggering collector run...");
  const collectionId = await triggerCollector(collectorId, urls);
  console.log(`collection_id=${collectionId}\nPolling (up to 8 min)...`);

  const rows = await pollDataset(collectionId, { timeoutMs: 480_000, intervalMs: 5_000 });
  console.log(`\nGot ${rows.length} raw rows.`);

  if (rows.length > 0) {
    console.log("\n=== RAW first row keys ===");
    console.log(Object.keys(rows[0]));
    console.log("\n=== RAW first row (truncated) ===");
    console.log(JSON.stringify(rows[0], null, 2).slice(0, 1200));
  }

  // Normalize.
  let usable = 0;
  const sample: unknown[] = [];
  for (const row of rows) {
    const job = greenhouseAdapter.normalizeRow(row, ctx);
    if (job) {
      usable++;
      if (sample.length < 2) sample.push({ title: job.title, location: job.location, applyUrl: job.applyUrl, descLen: job.rawDescriptionText.length });
    }
  }
  console.log(`\n=== NORMALIZED: ${usable}/${rows.length} usable, ${rows.length - usable} dropped ===`);
  console.log(JSON.stringify(sample, null, 2));

  if (usable === 0 && rows.length > 0) {
    console.log("\n⚠ Rows came back but none normalized — the collector's field names differ from the adapter's. Check the RAW keys above and update lib/scrapers/sources/greenhouse.ts pick() lists.");
  }
}

main().catch((e) => {
  console.error("\ntest-scrape failed:", e);
  process.exit(1);
});
