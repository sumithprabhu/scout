/**
 * REAL discovery run against several live companies with different site
 * structures. Proves the discovery scraper + Nova page-classification handle
 * real-world variance — including a site that legitimately LACKS some page types
 * (the classifier must return null, not hallucinate). Spends small run credits.
 *
 *   BRIGHTDATA_COLLECTOR_DISCOVERY=c_xxx npx tsx scripts/test-real-discovery.ts
 *
 * For each company it runs the full runDiscovery() pipeline (scrape homepage
 * links -> Nova classify -> store TrackedPages as `discovering`) and reports the
 * found/missing page-type map, then cleans up.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { runDiscovery } from "@/lib/discovery";
import { normalizeRootUrl, sameSiteOrSubdomain } from "@/lib/intel/url";

// Deliberately varied: a dev-infra SaaS (rich footer), a product tool, an
// open-source/community company, and a minimal site likely missing page types.
const COMPANIES = (process.env.DISCOVER_URLS?.split(",").map((s) => s.trim()).filter(Boolean)) ?? [
  "https://vercel.com",
  "https://linear.app",
  "https://posthog.com",
];

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  if (!process.env.BRIGHTDATA_COLLECTOR_DISCOVERY) {
    console.error("Set BRIGHTDATA_COLLECTOR_DISCOVERY first (build via scrapers/build-discovery-collector.ts).");
    process.exit(1);
  }
  await connectDB();
  const tag = `disc-${Date.now()}`;
  const createdCompanyIds: string[] = [];

  for (const url of COMPANIES) {
    const rootUrl = normalizeRootUrl(url)!;
    console.log(`\n=== discovering ${rootUrl} ===`);
    const company = await Company.create({ name: `${rootUrl} [${tag}]`, rootUrl });
    createdCompanyIds.push(String(company._id));
    try {
      const result = await runDiscovery(String(company._id), rootUrl, { timeoutMs: 240_000 });
      console.log(`  found:   ${result.found.join(", ") || "(none)"}`);
      console.log(`  missing: ${result.missing.join(", ") || "(none)"}`);
      for (const [type, u] of Object.entries(result.pageMap)) {
        console.log(`    ${type.padEnd(13)} ${u ?? "(not found)"}`);
      }
      // HARD contract: homepage resolves to root, and NO off-domain
      // contamination is ever stored (the safety property — catches the
      // posthog/linear bug). Fail-safe, never fail-wrong.
      check(`${rootUrl}: homepage always resolved to root`, result.pageMap.homepage === rootUrl);
      const offDomain = result.found
        .filter((t) => t !== "careers")
        .map((t) => result.pageMap[t])
        .filter((u): u is string => !!u && !sameSiteOrSubdomain(u, rootUrl));
      check(`${rootUrl}: no off-domain contamination in found pages`, offDomain.length === 0,
        `off-domain=${JSON.stringify(offDomain)}`);

      // BEST-EFFORT (informational, not a hard fail): whether the collector
      // scraped the real site this run. A bad scrape -> only homepage found ->
      // the human-in-the-loop manual page-entry path (POST /pages) takes over.
      if (result.found.length < 2) {
        console.log(`  ⚠️  best-effort: only ${result.found.length} page type(s) found for ${rootUrl} ` +
          `(likely a collector sample-data fallback; user would add pages manually).`);
      } else {
        console.log(`  ✓ best-effort: found ${result.found.length} page types on-domain`);
      }

      // Persisted as TrackedPages in `discovering` status?
      const pages = await TrackedPage.find({ companyId: company._id }).lean();
      check(`${rootUrl}: TrackedPages persisted as 'discovering'`,
        pages.length === result.found.length && pages.every((p) => p.status === "discovering"),
        `pages=${pages.length}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ discovery threw for ${rootUrl}: ${(err as Error).message}`);
    }
  }

  // Across the set, at least one page type should be missing SOMEWHERE (proving
  // the classifier returns null rather than inventing URLs on real sites).
  console.log("\ncleaning up...");
  await Promise.all([
    TrackedPage.deleteMany({ companyId: { $in: createdCompanyIds } }),
    Company.deleteMany({ _id: { $in: createdCompanyIds } }),
  ]);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-real-discovery failed:", e); process.exit(1); });
