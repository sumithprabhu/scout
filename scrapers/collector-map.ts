/**
 * Print the current source -> collector-id mapping from .env.
 *   npx tsx scrapers/collector-map.ts
 * Handy during the demo / for the README.
 */
import "dotenv/config";
import { collectorMap } from "@/lib/scrapers";

const map = collectorMap();
console.log("\nSource      Collector ID");
console.log("--------    ------------");
for (const [source, id] of Object.entries(map)) {
  console.log(`${source.padEnd(11)} ${id}`);
}
console.log("");
