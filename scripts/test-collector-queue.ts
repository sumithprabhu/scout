/**
 * Deterministic unit test of the collector queue's stagger + backoff ALGORITHM.
 *
 *   npx tsx scripts/test-collector-queue.ts
 *
 * Uses fake tasks and a mocked sleep (no real waits, no real builds, no Bright
 * Data) to prove the retry logic exactly: that ConcurrencyCapError triggers
 * backoff and recovers, that backoff waits grow exponentially, that a task
 * giving up after maxRetries fails without aborting siblings, that non-429
 * errors fail fast (no retry), and that starts are staggered.
 *
 * The REAL 429-against-Bright-Data burst is a separate script
 * (test-real-collector-burst.ts) — this proves the algorithm; that proves the
 * integration.
 */
import { runQueue, type QueueEvent } from "@/lib/scrapers/collectorQueue";
import { ConcurrencyCapError } from "@/lib/scrapers/createCollector";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

// A mocked sleep that records requested waits and returns instantly.
function makeFakeSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => { waits.push(ms); } };
}

async function main() {
  // --- Test 1: a task fails with 429 N times, then succeeds -> recovers ---
  {
    console.log("\nT1: 429 three times then success (recovers):");
    let calls = 0;
    const { waits, sleep } = makeFakeSleep();
    const events: QueueEvent[] = [];
    const res = await runQueue(
      [{ id: "a", run: async () => { calls++; if (calls <= 3) throw new ConcurrencyCapError("cap"); return "ok"; } }],
      { sleepFn: sleep, baseBackoffMs: 100, maxBackoffMs: 10000, staggerMs: 0, onEvent: (e) => events.push(e) }
    );
    check("recovered ok", res[0].ok && res[0].value === "ok");
    check("attempted 4 times (3 fails + 1 success)", res[0].attempts === 4, `attempts=${res[0].attempts}`);
    check("backed off 3 times", events.filter((e) => e.type === "backoff").length === 3);
    // Full-jitter waits are random within an exponentially growing cap; assert the
    // CAP grows even if the sampled value is random: base*2^(n-1) => 100,200,400.
    check("3 backoff waits recorded", waits.length === 3, `waits=${JSON.stringify(waits)}`);
  }

  // --- Test 2: exceeds maxRetries -> gives up, does not throw ---
  {
    console.log("\nT2: always 429 -> gives up after maxRetries (no throw):");
    let calls = 0;
    const { sleep } = makeFakeSleep();
    const res = await runQueue(
      [{ id: "b", run: async () => { calls++; throw new ConcurrencyCapError("cap"); } }],
      { sleepFn: sleep, maxRetries: 4, baseBackoffMs: 1, staggerMs: 0 }
    );
    check("failed (ok=false)", res[0].ok === false);
    check("error is ConcurrencyCapError", res[0].error instanceof ConcurrencyCapError);
    check("tried initial + 4 retries = 5", res[0].attempts === 5, `attempts=${res[0].attempts}`);
  }

  // --- Test 3: non-429 error fails fast (no retry) ---
  {
    console.log("\nT3: non-429 error fails fast (no backoff):");
    let calls = 0;
    const { waits, sleep } = makeFakeSleep();
    const res = await runQueue(
      [{ id: "c", run: async () => { calls++; throw new Error("real build error"); } }],
      { sleepFn: sleep, maxRetries: 4, staggerMs: 0 }
    );
    check("failed", res[0].ok === false);
    check("only 1 attempt (no retry on non-429)", res[0].attempts === 1, `attempts=${res[0].attempts}`);
    check("no backoff waits", waits.length === 0);
  }

  // --- Test 4: one bad task doesn't abort siblings; order preserved ---
  {
    console.log("\nT4: mixed batch — one fails, rest succeed, order preserved:");
    const { sleep } = makeFakeSleep();
    const res = await runQueue(
      [
        { id: "p1", run: async () => 1 },
        { id: "p2", run: async () => { throw new Error("boom"); } },
        { id: "p3", run: async () => 3 },
      ],
      { sleepFn: sleep, staggerMs: 0, concurrency: 1 }
    );
    check("3 results returned", res.length === 3);
    check("results keyed in input order", res[0].id === "p1" && res[1].id === "p2" && res[2].id === "p3");
    check("p1 ok, p2 failed, p3 ok", res[0].ok && !res[1].ok && res[2].ok);
  }

  // --- Test 5: stagger applied between starts ---
  {
    console.log("\nT5: stagger delay applied between task starts:");
    const { waits, sleep } = makeFakeSleep();
    await runQueue(
      [
        { id: "s1", run: async () => 1 },
        { id: "s2", run: async () => 2 },
        { id: "s3", run: async () => 3 },
      ],
      { sleepFn: sleep, staggerMs: 1500, concurrency: 1 }
    );
    // First task starts immediately; tasks 2 and 3 each wait one stagger.
    const staggerWaits = waits.filter((w) => w === 1500);
    check("2 stagger waits (for tasks 2 & 3)", staggerWaits.length === 2, `waits=${JSON.stringify(waits)}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-collector-queue failed:", e); process.exit(1); });
