/**
 * Build all four Scraper Studio collectors, one `bdata scraper create` per
 * source. Run AFTER `bdata login`:
 *
 *   npx tsx scrapers/build-collectors.ts            # build all four
 *   npx tsx scrapers/build-collectors.ts greenhouse # build just one
 *
 * Each AI build takes ~5-10 min and costs credits, so we run them sequentially
 * with loud logging and write the resulting collector ids to
 * scrapers/collector-map.json + print ready-to-paste .env lines.
 *
 * NOTE: this shells out to the CLI (the supported way to BUILD collectors).
 * Running them later is done via the REST API in lib/scrapers/brightdata.ts.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { COLLECTOR_SPECS } from "./collectors.config";

const execFileAsync = promisify(execFile);

async function buildOne(spec: (typeof COLLECTOR_SPECS)[number]): Promise<string> {
  console.log(`\n=== building ${spec.source} (${spec.name}) ===`);
  console.log(`    url:  ${spec.sampleUrl}`);
  console.log(`    this can take 5-10 minutes...`);

  // `scraper create <url> <description> --name <name> --json` -> {collector_id,...}
  const { stdout } = await execFileAsync(
    "npx",
    [
      "bdata",
      "scraper",
      "create",
      spec.sampleUrl,
      spec.description,
      "--name",
      spec.name,
      "--json",
    ],
    { maxBuffer: 20 * 1024 * 1024, timeout: 15 * 60 * 1000 }
  );

  let collectorId = "";
  try {
    const parsed = JSON.parse(stdout);
    collectorId = parsed.collector_id ?? parsed.collectorId ?? "";
  } catch {
    // Fall back to a regex if the CLI wrapped the JSON in log lines.
    collectorId = stdout.match(/"?collector_?id"?\s*[:=]\s*"?([\w-]+)"?/i)?.[1] ?? "";
  }

  if (!collectorId) {
    throw new Error(
      `Could not read collector_id from create output for ${spec.source}:\n${stdout}`
    );
  }
  console.log(`    ✓ ${spec.source} -> ${collectorId}`);
  return collectorId;
}

async function main() {
  const only = process.argv[2];
  const specs = only
    ? COLLECTOR_SPECS.filter((s) => s.source === only)
    : COLLECTOR_SPECS;

  if (specs.length === 0) {
    console.error(`No spec matches "${only}". Sources: greenhouse, lever, workday, naukri`);
    process.exit(1);
  }

  const results: Record<string, { envVar: string; collectorId: string }> = {};
  for (const spec of specs) {
    try {
      const id = await buildOne(spec);
      results[spec.source] = { envVar: spec.envVar, collectorId: id };
    } catch (err) {
      console.error(`✗ ${spec.source} failed:`, (err as Error).message);
    }
  }

  const mapPath = join(process.cwd(), "scrapers", "collector-map.json");
  writeFileSync(mapPath, JSON.stringify(results, null, 2) + "\n");

  console.log(`\n\n================ RESULT ================`);
  console.log(`wrote ${mapPath}`);
  console.log(`\nPaste these into your .env:\n`);
  for (const { envVar, collectorId } of Object.values(results)) {
    console.log(`${envVar}=${collectorId}`);
  }
  console.log(`\n=======================================`);
}

main().catch((e) => {
  console.error("build-collectors failed:", e);
  process.exit(1);
});
