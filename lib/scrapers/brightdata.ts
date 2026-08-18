/**
 * Bright Data Scraper Studio — programmatic run client (REST, not CLI).
 *
 * The CLI (`bdata scraper run`) is what we use to BUILD and manually test
 * collectors. But the Next.js backend must trigger runs on its own, so this
 * module talks to the same underlying DCA ("Data Collector API") endpoints the
 * CLI uses:
 *
 *   POST /dca/trigger?collector=<id>&queue_next=1   body: [{url}]  -> {collection_id}
 *   GET  /dca/dataset?id=<collection_id>            -> 202 building | 200 [rows]
 *
 * queue_next=1 = run immediately instead of queueing behind other jobs.
 *
 * >>> REVIEW THIS FILE CAREFULLY <<< — it is hand-written orchestration logic
 * (auth, the 202-poll loop, timeouts, error surfaces), not boilerplate.
 */

const API_BASE = "https://api.brightdata.com";

/** A raw row as returned by a collector. Shape depends on the collector's
 *  output schema; the per-source normalizers know how to read it. `input`
 *  echoes back the URL we triggered, which is handy for correlation. */
export type CollectorRow = Record<string, unknown> & {
  input?: { url?: string };
};

export class BrightDataError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "BrightDataError";
  }
}

function apiKey(): string {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) {
    throw new BrightDataError(
      "BRIGHTDATA_API_KEY is not set. Add it to .env (Bright Data control panel > Settings > API tokens)."
    );
  }
  return key;
}

/**
 * Trigger an async batch run of a collector against one or more URLs.
 * Returns the collection_id used to poll for results.
 */
export async function triggerCollector(
  collectorId: string,
  urls: string[]
): Promise<string> {
  if (!collectorId) {
    throw new BrightDataError(
      "Missing collectorId. Did you set the BRIGHTDATA_COLLECTOR_* env var for this source?"
    );
  }
  if (urls.length === 0) {
    throw new BrightDataError("triggerCollector called with no URLs.");
  }

  const endpoint = `${API_BASE}/dca/trigger?collector=${encodeURIComponent(
    collectorId
  )}&queue_next=1`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(urls.map((url) => ({ url }))),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new BrightDataError(
      `trigger failed (collector ${collectorId})`,
      res.status,
      text
    );
  }

  let parsed: { collection_id?: string; response_id?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BrightDataError(
      `trigger returned non-JSON response`,
      res.status,
      text
    );
  }

  // The docs call it collection_id; some responses use response_id. Accept both.
  const id = parsed.collection_id ?? parsed.response_id;
  if (!id) {
    throw new BrightDataError(
      `trigger response missing collection_id`,
      res.status,
      text
    );
  }
  return id;
}

/**
 * Poll /dca/dataset until the collection is ready (HTTP 200 with rows) or we
 * exceed `timeoutMs`. While building, the API returns HTTP 202.
 */
export async function pollDataset(
  collectionId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<CollectorRow[]> {
  const timeoutMs = opts.timeoutMs ?? 180_000; // 3 min default
  const intervalMs = opts.intervalMs ?? 4_000;
  const deadline = Date.now() + timeoutMs;

  const endpoint = `${API_BASE}/dca/dataset?id=${encodeURIComponent(
    collectionId
  )}`;

  while (true) {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });

    // 200 = ready. Body is the array of rows (or an object with a data array).
    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data)) return data as CollectorRow[];
      if (Array.isArray((data as any)?.data)) {
        return (data as any).data as CollectorRow[];
      }
      // A 200 that's an object with a status field means still-not-ready on some
      // deployments; treat as "keep waiting" rather than crashing.
      if ((data as any)?.status) {
        // fall through to the wait below
      } else {
        return [];
      }
    } else if (res.status !== 202) {
      // Anything other than 200/202 is a real error.
      const body = await res.text();
      throw new BrightDataError(
        `dataset poll failed (collection ${collectionId})`,
        res.status,
        body
      );
    }

    if (Date.now() > deadline) {
      throw new BrightDataError(
        `dataset ${collectionId} not ready within ${timeoutMs}ms (still building)`
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Convenience: trigger + poll in one call. This is what the per-source
 * scrapers use.
 */
export async function runCollector(
  collectorId: string,
  urls: string[],
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<CollectorRow[]> {
  const collectionId = await triggerCollector(collectorId, urls);
  return pollDataset(collectionId, opts);
}
