/**
 * Scraper wrapper — the ONE function the Next.js backend calls to scrape any
 * source. It hides four very different collectors behind a uniform contract:
 *
 *     runScraper("greenhouse", "airbnb")  ->  NormalizedJob[]
 *     runScraper("naukri", "backend engineer node")  ->  NormalizedJob[]
 *
 * Flow: pick adapter -> build target URL(s) from the input -> trigger the
 * collector via the Bright Data REST API -> normalize every row -> drop unusable
 * rows -> hand back NormalizedJob[] ready to persist as JobListings.
 */
import { runCollector, type CollectorRow } from "./brightdata";
import type { JobSource, NormalizedJob } from "@/lib/types";
import { JOB_SOURCES } from "@/lib/types";
import type { SourceAdapter } from "./sources/shared";
import { greenhouseAdapter } from "./sources/greenhouse";
import { leverAdapter } from "./sources/lever";
import { workdayAdapter } from "./sources/workday";
import { naukriAdapter } from "./sources/naukri";

// Container keys an AI-built collector might wrap a page's jobs in. If a row is
// such a wrapper, we expand its inner array into individual job rows.
const CONTAINER_KEYS = [
  "job_cards",
  "jobs",
  "results",
  "items",
  "listings",
  "postings",
  "data",
];

function explodeRows(rows: CollectorRow[]): CollectorRow[] {
  const out: CollectorRow[] = [];
  for (const row of rows) {
    let expanded = false;
    for (const key of CONTAINER_KEYS) {
      const v = (row as Record<string, unknown>)[key];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        for (const item of v) out.push(item as CollectorRow);
        expanded = true;
        break;
      }
    }
    if (!expanded) out.push(row);
  }
  return out;
}

const ADAPTERS: Record<JobSource, SourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  workday: workdayAdapter,
  naukri: naukriAdapter,
};

export interface ScrapeResult {
  source: JobSource;
  collectorId: string;
  input: string;
  jobs: NormalizedJob[];
  /** Rows the collector returned but that we dropped as unusable. Useful signal
   *  when a collector's output schema drifts. */
  droppedRows: number;
}

export async function runScraper(
  source: JobSource,
  input: string,
  opts?: { timeoutMs?: number }
): Promise<ScrapeResult> {
  const adapter = ADAPTERS[source];
  if (!adapter) {
    throw new Error(
      `Unknown source "${source}". Expected one of: ${JOB_SOURCES.join(", ")}`
    );
  }

  const collectorId = process.env[adapter.collectorEnvVar];
  if (!collectorId) {
    throw new Error(
      `No collector id for "${source}". Set ${adapter.collectorEnvVar} in .env ` +
        `(get it from \`bdata scraper create\`; see the collector map / README).`
    );
  }

  const { urls, ctx } = adapter.buildTargets(input);
  console.log(
    `[scrape] source=${source} collector=${collectorId} input="${input}" -> ${urls.join(", ")}`
  );

  // AI-built collectors sometimes emit ONE row per page that wraps the actual
  // jobs in a nested array (e.g. Naukri returns [{ job_cards: [...] }]). Flatten
  // those so each job becomes its own row before normalizing.
  const rawRows = await runCollector(collectorId, urls, opts);
  const rows = explodeRows(rawRows);

  const jobs: NormalizedJob[] = [];
  let droppedRows = 0;
  for (const row of rows) {
    const job = adapter.normalizeRow(row, ctx);
    if (job) jobs.push(job);
    else droppedRows++;
  }

  console.log(
    `[scrape] source=${source} rows=${rows.length} usable=${jobs.length} dropped=${droppedRows}`
  );

  return { source, collectorId, input, jobs, droppedRows };
}

/**
 * The collector map — WHICH collector id serves WHICH source. Printed at startup
 * and by scripts/collector-map.ts so you always have the mapping handy for the
 * demo/README. Values are read from env at call time.
 */
export function collectorMap(): Record<JobSource, string> {
  const orUnset = (v?: string) => (v && v.trim() ? v : "(unset)");
  return {
    greenhouse: orUnset(process.env.BRIGHTDATA_COLLECTOR_GREENHOUSE),
    lever: orUnset(process.env.BRIGHTDATA_COLLECTOR_LEVER),
    workday: orUnset(process.env.BRIGHTDATA_COLLECTOR_WORKDAY),
    naukri: orUnset(process.env.BRIGHTDATA_COLLECTOR_NAUKRI),
  };
}
