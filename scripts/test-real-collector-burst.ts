/**
 * REAL Bright Data burst test (Step 3): intentionally exceed the AI-Flow
 * concurrent-job cap to prove our 429 detection + exponential backoff + recovery
 * work against the live API — not a mock.
 *
 *   npx tsx scripts/test-real-collector-burst.ts
 *
 * Fires N real `bdata scraper create` builds at once (concurrency=N, no stagger)
 * so some get a 429 (ConcurrencyCapError). runQueue must back off and retry
 * those until they're accepted. Building is FREE, so this spends no credit — it
 * just takes minutes as accepted builds run to completion.
 *
 * Logs every queue event with a timestamp so the 429 -> backoff -> recovery
 * sequence is visible. Reports honestly if the cap was never hit (account
 * concurrency allowance >= burst size) — the deterministic algorithm proof lives
 * in scripts/test-collector-queue.ts.
 */
import "dotenv/config";
import { runQueue, type QueueEvent } from "@/lib/scrapers/collectorQueue";
import { createCollector, ConcurrencyCapError } from "@/lib/scrapers/createCollector";
import { extractionPromptFor } from "@/lib/scrapers/pagePrompts";

// Real, live pricing pages across different companies/site builds.
// Override with BURST_URLS="url1,url2,..." to fire a bigger/different burst.
const TARGETS = (process.env.BURST_URLS?.split(",").map((s) => s.trim()).filter(Boolean)) ?? [
  "https://linear.app/pricing",
  "https://www.notion.so/pricing",
  "https://slack.com/pricing",
  "https://www.figma.com/pricing",
  "https://vercel.com/pricing",
];

const t0 = Date.now();
const stamp = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

function logEvent(e: QueueEvent) {
  if (e.type === "start") console.log(`${stamp()} [start]   ${e.id} attempt=${e.attempt}`);
  else if (e.type === "backoff") console.log(`${stamp()} [BACKOFF] ${e.id} attempt=${e.attempt} wait=${e.waitMs}ms  <-- 429 concurrency cap hit`);
  else if (e.type === "success") console.log(`${stamp()} [success] ${e.id} attempt=${e.attempt}`);
  else if (e.type === "error") console.log(`${stamp()} [error]   ${e.id} ${e.error.name}: ${e.error.message}`);
}

async function main() {
  console.log(`\nBursting ${TARGETS.length} concurrent REAL builds (concurrency=${TARGETS.length}, stagger=0)...`);
  console.log(`(a discovery build may also be running, occupying a slot — good for tripping the cap)\n`);

  let backoffs = 0;
  const tasks = TARGETS.map((url, i) => ({
    id: `pricing-${i}-${url.replace(/^https?:\/\//, "").split("/")[0]}`,
    run: () =>
      createCollector({
        url,
        description: extractionPromptFor("pricing"),
        name: `intel-burst-pricing-${i}-${Date.now()}`,
        deliverWebhook: "https://example.com/api/webhook/scrape-result",
        timeoutSec: 600,
      }),
  }));

  const results = await runQueue(tasks, {
    concurrency: TARGETS.length, // no throttle: we WANT to hit the cap
    staggerMs: 0,
    maxRetries: 5,
    baseBackoffMs: 5000,
    maxBackoffMs: 120000,
    onEvent: (e) => {
      if (e.type === "backoff") backoffs++;
      logEvent(e);
    },
  });

  console.log(`\n================ BURST RESULT (${stamp()}) ================`);
  let ok = 0, capErrors = 0, otherErrors = 0;
  for (const r of results) {
    if (r.ok) { ok++; console.log(`  ✓ ${r.id} -> ${r.value} (attempts=${r.attempts})`); }
    else if (r.error instanceof ConcurrencyCapError) { capErrors++; console.log(`  ✗ ${r.id} gave up on cap after ${r.attempts} attempts`); }
    else { otherErrors++; console.log(`  ✗ ${r.id} ${r.error?.name}: ${r.error?.message} (attempts=${r.attempts})`); }
  }
  console.log(`\n  built ok: ${ok}   backoff events: ${backoffs}   gave-up-on-cap: ${capErrors}   other errors: ${otherErrors}`);
  if (backoffs > 0) {
    console.log(`\n  ✅ VERIFIED: the AI-Flow concurrency cap (429) was hit ${backoffs}x and the queue backed off & retried.`);
  } else {
    console.log(`\n  ℹ️  Cap not tripped this run (account allowed ${TARGETS.length} concurrent). Backoff logic proven in test-collector-queue.ts.`);
  }
  // Print .env-ready ids for any that built, so they can feed the discovery/real-run tests.
  const builtIds = results.filter((r) => r.ok).map((r) => r.value);
  if (builtIds.length) console.log(`\n  collector ids built: ${builtIds.join(", ")}`);

  process.exit(0);
}

main().catch((e) => { console.error("burst failed:", e); process.exit(1); });
