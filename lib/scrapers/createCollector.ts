import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Low-level: build ONE Bright Data Scraper Studio collector via the CLI.
 *
 * WHY THE CLI (not REST): `bdata scraper create` is the supported way to BUILD a
 * collector from a natural-language spec (the AI-Flow build). Runs happen later
 * over REST (lib/scrapers/brightdata.ts). This mirrors the job-matcher split
 * exactly: build with the CLI, run with REST.
 *
 * WHY --no-retry: the CLI can absorb the AI-Flow concurrent-job-cap 429 itself
 * (--max-retries), but then the backoff is invisible and untestable. We pass
 * --no-retry so the 429 surfaces to US and our collectorQueue owns the
 * exponential backoff. That makes "exponential backoff retry on 429" OUR logic
 * (defensible + observable), not a black box.
 */

/**
 * Retryable "the platform can't start this build right now" error. Named for the
 * documented cause (the AI-Flow concurrent-job cap 429), but see isConcurrencyCap
 * for the REAL-WORLD finding about how that cap actually surfaces.
 */
export class ConcurrencyCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyCapError";
  }
}

export class CollectorBuildError extends Error {
  constructor(message: string, readonly stderr?: string) {
    super(message);
    this.name = "CollectorBuildError";
  }
}

function apiKey(): string {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new CollectorBuildError("BRIGHTDATA_API_KEY is not set.");
  return key;
}

/**
 * Detect a retryable "can't start the build right now" signal so the queue backs
 * off instead of failing.
 *
 * REAL-WORLD FINDING (verified by bursting live builds, see
 * scripts/test-real-collector-burst.ts): the docs say the AI-Flow concurrent-job
 * cap returns HTTP 429, but on this account it actually surfaces as a MALFORMED
 * HTTP 500 at the generation-trigger step:
 *   "Failed to start AI generation ... sprintf invalid format %j (ide_automation ...)"
 * i.e. their backend hit a formatting bug while building the (real) capacity
 * error. The number of these 500s scaled directly with how many builds we fired
 * concurrently — so functionally it IS the cap. We therefore treat that specific
 * generation-start failure as retryable alongside a literal 429. Retries are
 * bounded by the queue's maxRetries, so a genuinely-broken request still gives
 * up safely rather than looping forever.
 */
function isConcurrencyCap(text: string): boolean {
  if (/\b429\b|concurrent|rate.?limit|too many requests|AI-?Flow/i.test(text)) return true;
  // The cap's real manifestation on this account: a 500 at "start AI generation".
  return /failed to start ai generation/i.test(text) || /ide_automation/i.test(text);
}

export interface CreateCollectorArgs {
  url: string;
  description: string; // <= 500 chars (validated by pagePrompts)
  name: string;
  /** Where Bright Data should POST scheduled-run results. */
  deliverWebhook: string;
  /** CLI polling timeout in seconds for the AI build (default 600). */
  timeoutSec?: number;
}

/**
 * Returns the new collector id. Throws ConcurrencyCapError on a 429 (so the
 * queue retries with backoff) or CollectorBuildError on any other failure.
 */
export async function createCollector(args: CreateCollectorArgs): Promise<string> {
  const timeoutSec = args.timeoutSec ?? 600;
  const cliArgs = [
    "bdata", "scraper", "create",
    args.url,
    args.description,
    "--name", args.name,
    "--deliver-webhook", args.deliverWebhook,
    "--no-retry",           // 429 -> surfaces to us; our queue backs off
    "--timeout", String(timeoutSec),
    "--json",
    "-k", apiKey(),
  ];

  let stdout = "";
  try {
    const res = await execFileAsync("npx", cliArgs, {
      maxBuffer: 20 * 1024 * 1024,
      // Give the child a hair more than the CLI's own poll timeout.
      timeout: (timeoutSec + 60) * 1000,
    });
    stdout = res.stdout;
  } catch (err: any) {
    const blob = `${err?.stdout ?? ""}\n${err?.stderr ?? ""}\n${err?.message ?? ""}`;
    if (isConcurrencyCap(blob)) {
      throw new ConcurrencyCapError(`AI-Flow concurrent-job cap (429) building "${args.name}"`);
    }
    throw new CollectorBuildError(`create failed for "${args.name}": ${err?.message}`, blob);
  }

  let collectorId = "";
  try {
    const parsed = JSON.parse(stdout);
    collectorId = parsed.collector_id ?? parsed.collectorId ?? "";
  } catch {
    collectorId = stdout.match(/"?collector_?id"?\s*[:=]\s*"?([\w-]+)"?/i)?.[1] ?? "";
  }
  if (!collectorId) {
    // A 429 can also come back on stdout as a JSON error envelope.
    if (isConcurrencyCap(stdout)) {
      throw new ConcurrencyCapError(`AI-Flow concurrent-job cap (429) building "${args.name}"`);
    }
    throw new CollectorBuildError(`no collector_id in create output for "${args.name}":\n${stdout}`);
  }
  return collectorId;
}
