/**
 * Build the ONE reusable homepage-link discovery collector. Run AFTER `bdata login`:
 *
 *   npx tsx scrapers/build-discovery-collector.ts
 *
 * Building is free (only running spends credit), takes ~5-10 min, and only needs
 * to happen ONCE — the resulting collector is reused for every company's
 * homepage (the extraction spec is identical across sites). Paste the printed id
 * into .env as BRIGHTDATA_COLLECTOR_DISCOVERY.
 *
 * Mirrors scrapers/build-collectors.ts exactly (shell out to the CLI, the
 * supported way to BUILD collectors; runs happen later via the REST wrapper).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// A stable, well-known page with a rich nav + footer to build against. The spec
// is deliberately host-agnostic so the same collector generalizes.
const SAMPLE_URL = "https://www.notion.so";
const NAME = "intel-discovery-links";
const DESCRIPTION =
  "From this homepage, extract EVERY hyperlink in the top navigation bar and the " +
  "page footer. For each link output a record with: text (the visible anchor text) " +
  "and href (the link's URL, absolute). Include dropdown/menu links. Output one " +
  "record per link.";

async function main() {
  console.log(`\n=== building discovery collector (${NAME}) ===`);
  console.log(`    url:  ${SAMPLE_URL}`);
  console.log(`    this can take 5-10 minutes (free build)...`);

  const { stdout } = await execFileAsync(
    "npx",
    ["bdata", "scraper", "create", SAMPLE_URL, DESCRIPTION, "--name", NAME, "--json"],
    { maxBuffer: 20 * 1024 * 1024, timeout: 15 * 60 * 1000 }
  );

  let collectorId = "";
  try {
    const parsed = JSON.parse(stdout);
    collectorId = parsed.collector_id ?? parsed.collectorId ?? "";
  } catch {
    collectorId = stdout.match(/"?collector_?id"?\s*[:=]\s*"?([\w-]+)"?/i)?.[1] ?? "";
  }

  if (!collectorId) {
    throw new Error(`Could not read collector_id from create output:\n${stdout}`);
  }

  console.log(`\n================ RESULT ================`);
  console.log(`Paste into your .env:\n`);
  console.log(`BRIGHTDATA_COLLECTOR_DISCOVERY=${collectorId}`);
  console.log(`\n=======================================`);
}

main().catch((e) => {
  console.error("build-discovery-collector failed:", e);
  process.exit(1);
});
