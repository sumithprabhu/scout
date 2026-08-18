import { ConcurrencyCapError } from "./createCollector";

/**
 * Queued, staggered execution with exponential backoff on the AI-Flow
 * concurrent-job cap (429). This is the orchestration the spec requires: when a
 * company needs 6 collectors, do NOT fire 6 builds at once.
 *
 * TWO INDEPENDENT MECHANISMS (both matter, they solve different problems):
 *   1. STAGGER — start each task `staggerMs` after the previous START, and cap
 *      how many run at once (`concurrency`). This PREVENTS most 429s by never
 *      slamming the cap. Proactive.
 *   2. BACKOFF — if a task still hits the cap (someone else is also building),
 *      retry it after an exponentially growing, jittered wait. Reactive safety
 *      net. Only ConcurrencyCapError is retried; real build errors fail fast.
 *
 * Kept generic (works on any async task that may throw ConcurrencyCapError) so
 * it's unit-testable with a fake task WITHOUT spending real builds.
 */

export interface QueueOptions {
  /** Max tasks in flight at once. Default 2 (well under the cap). */
  concurrency?: number;
  /** Delay between successive task STARTS. Default 1500ms. */
  staggerMs?: number;
  /** Max retries per task on a 429. Default 4. */
  maxRetries?: number;
  /** First backoff wait; doubles each retry. Default 2000ms. */
  baseBackoffMs?: number;
  /** Cap on a single backoff wait. Default 60000ms. */
  maxBackoffMs?: number;
  /** Test seam: override the sleep so tests don't wait real seconds. */
  sleepFn?: (ms: number) => Promise<void>;
  /** Optional progress hook for logging/observability. */
  onEvent?: (e: QueueEvent) => void;
}

export type QueueEvent =
  | { type: "start"; id: string; attempt: number }
  | { type: "success"; id: string; attempt: number }
  | { type: "backoff"; id: string; attempt: number; waitMs: number }
  | { type: "error"; id: string; error: Error };

export interface QueueTask<T> {
  id: string;
  run: () => Promise<T>;
}

export interface QueueResult<T> {
  id: string;
  ok: boolean;
  value?: T;
  error?: Error;
  attempts: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Full jitter (AWS-style): wait a random amount in [0, exp] so simultaneous
 *  retriers don't re-collide in lockstep. */
function backoffWait(attempt: number, base: number, cap: number): number {
  const exp = Math.min(cap, base * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}

async function runWithBackoff<T>(
  task: QueueTask<T>,
  opts: Required<Pick<QueueOptions, "maxRetries" | "baseBackoffMs" | "maxBackoffMs">> & {
    sleep: (ms: number) => Promise<void>;
    onEvent?: (e: QueueEvent) => void;
  }
): Promise<QueueResult<T>> {
  let attempt = 0;
  while (true) {
    attempt++;
    opts.onEvent?.({ type: "start", id: task.id, attempt });
    try {
      const value = await task.run();
      opts.onEvent?.({ type: "success", id: task.id, attempt });
      return { id: task.id, ok: true, value, attempts: attempt };
    } catch (err) {
      // Only the concurrency cap is retryable. Real build errors fail fast.
      if (err instanceof ConcurrencyCapError && attempt <= opts.maxRetries) {
        const waitMs = backoffWait(attempt, opts.baseBackoffMs, opts.maxBackoffMs);
        opts.onEvent?.({ type: "backoff", id: task.id, attempt, waitMs });
        await opts.sleep(waitMs);
        continue;
      }
      opts.onEvent?.({ type: "error", id: task.id, error: err as Error });
      return { id: task.id, ok: false, error: err as Error, attempts: attempt };
    }
  }
}

/**
 * Run tasks with staggered starts + bounded concurrency + per-task backoff.
 * Never throws — every task yields a QueueResult (ok or error) so one failed
 * build doesn't abort the rest.
 */
export async function runQueue<T>(
  tasks: QueueTask<T>[],
  options: QueueOptions = {}
): Promise<QueueResult<T>[]> {
  const concurrency = options.concurrency ?? 2;
  const staggerMs = options.staggerMs ?? 1500;
  const sleep = options.sleepFn ?? defaultSleep;
  const backoffCfg = {
    maxRetries: options.maxRetries ?? 4,
    baseBackoffMs: options.baseBackoffMs ?? 2000,
    maxBackoffMs: options.maxBackoffMs ?? 60000,
    sleep,
    onEvent: options.onEvent,
  };

  const results: QueueResult<T>[] = new Array(tasks.length);
  let next = 0;

  // A worker pulls the next task, but only after a stagger delay based on its
  // global start index — so even with concurrency>1, starts are spread out.
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      if (i > 0) await sleep(staggerMs);
      results[i] = await runWithBackoff(tasks[i], backoffCfg);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}
