/**
 * Real-Mongo test of the collector idempotency / reuse path (Step 3).
 *
 *   npx tsx scripts/test-collector-dedup.ts
 *
 * Proves ensureCollectorForUrl() dedupes BY URL: if a collector already exists
 * for a URL, it's REUSED (reused:true) and NO AI build is spawned — even across
 * different companies. This is the "don't spend a build twice" guarantee. We
 * seed the registry directly so the test is fast and spends zero builds; the
 * REAL build path is exercised by the burst test.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Collector } from "@/models/Collector";
import { ensureCollectorForUrl } from "@/lib/scrapers/createPageCollector";
import { normalizePageUrl } from "@/lib/intel/url";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  await connectDB();
  const tag = `dedup-${Date.now()}`;
  // Two URL spellings that normalize to the SAME page — reuse must span them.
  const urlA = `${tag}.example.com/pricing`;
  const urlAvariant = `https://www.${tag}.example.com/pricing/?ref=x`;
  const norm = normalizePageUrl(urlA)!;

  // Seed the registry as if a collector was already built for this URL.
  await Collector.create({ url: norm, collectorId: "c_seeded_reuse", pageType: "pricing" });

  console.log("\nreuse path (no build spawned):");
  const r1 = await ensureCollectorForUrl(urlA, "pricing");
  check("existing URL -> reused:true", r1.reused === true, JSON.stringify(r1));
  check("returns the seeded collectorId", r1.collectorId === "c_seeded_reuse", r1.collectorId);

  const r2 = await ensureCollectorForUrl(urlAvariant, "pricing");
  check("URL variant (www/query/slash) reuses same collector", r2.reused === true && r2.collectorId === "c_seeded_reuse",
    JSON.stringify(r2));

  const count = await Collector.countDocuments({ url: norm });
  check("still exactly ONE registry row for the URL", count === 1, `count=${count}`);

  console.log("\ncleaning up...");
  await Collector.deleteMany({ url: norm });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-collector-dedup failed:", e); process.exit(1); });
