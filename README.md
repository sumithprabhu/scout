# Scout — company intelligence

Watch any company. Miss nothing.

Scout tracks a company's public pages — pricing, hiring, positioning, compliance,
integrations, changelog — scrapes them on a schedule with **Bright Data Scraper
Studio**, diffs each new snapshot against the last, and uses **Amazon Nova**
(Bedrock) to classify what changed and write a one-line, human-readable summary.
The signal lands in a live feed, so you learn what a competitor did the day they
do it — not next quarter.

## Stack

- **Next.js 14** (App Router, TypeScript) — API routes + UI
- **MongoDB + Mongoose** — storage (`/models`)
- **Bright Data Scraper Studio** (`@brightdata/cli`) — custom, purpose-built collectors (`/lib/scrapers`)
- **Amazon Nova on AWS Bedrock** (Converse API) — page classification, diff classification, summaries
- **Tailwind CSS + Framer Motion** — the light, interactive landing + app UI
- MongoDB-backed per-identity daily rate limiter (no heavy auth yet)

## How it works

```
add a company            discover pages          watch & diff            classify
────────────             ──────────────          ────────────            ────────
POST /api/companies   →  homepage links      →   scheduled scrape    →   Nova classifies
kicks off discovery      scraped + Nova           → Snapshot (v+1)        the diff, assigns
                         maps them to the 6       → diff vs previous      severity, writes a
                         page types              (noise-filtered)         one-line summary
                                                                          → SignalEvent
```

Results are delivered **push, not poll**: each collector's scheduled run POSTs to
`/api/webhook/scrape-result`, which stores the snapshot, diffs, and (if the change
is meaningful) creates a classified `SignalEvent`.

### Design decisions worth calling out

- **One LLM seam** (`lib/nova/client.ts`): every model call — `classifyPageType`,
  `classifyDiff`, `summarizeDiff` — routes through one `converseJSON()` helper, so
  swapping the model is a one-file change. Never throws; a bad call degrades
  gracefully instead of breaking a pipeline.
- **Collector registry deduped by URL** (`models/Collector.ts`): a unique index on
  the normalized URL means two companies sharing a page never pay for two AI
  builds, and creation is race-safe.
- **Own the backoff** (`lib/scrapers/collectorQueue.ts`): collector creation is
  staggered with exponential-backoff-with-jitter on the AI-Flow concurrency cap —
  which, in practice, surfaces as a malformed 500, so the classifier treats that
  as retryable too.
- **Generic, noise-filtered diff** (`lib/diff/computeDiff.ts`): page-type-agnostic
  and identity-keyed, so reflow/formatting churn is ignored and a reordered list
  isn't a false signal. Adding a new page type is one enum value + one prompt.
- **Same-site guard** in discovery — a scraped page URL on a foreign domain is
  dropped (fail safe, never attribute a competitor's page to the wrong company).

## Getting started

```bash
npm install
cp .env.example .env      # MONGODB_URI, AWS creds + BEDROCK_*, BRIGHTDATA_API_KEY, PUBLIC_BASE_URL, WEBHOOK_SECRET
npm run dev               # http://localhost:3000
npx tsx scripts/seed-demo.ts   # (optional) real Nova-written demo signals for the feed
```

Nova needs an IAM principal with `bedrock:InvokeModel` **and** Nova model access
enabled in the Bedrock console for `BEDROCK_REGION`.

### Bright Data collectors (one-time; building is free, runs spend credit)

```bash
npx bdata login
npx tsx scrapers/build-discovery-collector.ts   # builds the reusable discovery collector
```

Paste the printed `BRIGHTDATA_COLLECTOR_DISCOVERY` id into `.env`. Page-type
collectors are created on demand when you confirm a company's discovered pages.

## Screens

- `/` — landing page (product-forward, interactive)
- `/feed` — the global signal feed
- `/portfolio` — all tracked companies, ranked by activity
- `/companies/:id` — a company's activity, tracked pages, and signal history
- `/add` — add a company and watch discovery run

## API

| Method | Route | Does |
|--------|-------|------|
| POST | `/api/companies` | Add a company, kick off discovery (rate-limited). |
| GET | `/api/companies/:id/pages` | Discovered pages + a `suggestManualEntry` flag. |
| POST | `/api/companies/:id/pages` | Manually add or correct a page URL. |
| GET | `/api/companies/:id/events` | A company's signals, newest first. |
| GET | `/api/events` | Global feed across all companies, filterable by `signalType`. |
| POST | `/api/webhook/scrape-result` | Bright Data delivers scheduled-run results here. |

## Verification

Every layer is covered by a script that runs against real infra (Mongo, Nova, HTTP):

```bash
npx tsx scripts/smoke-intel-db.ts        # schemas, indexes, dedup guards
npx tsx scripts/test-diff.ts             # diff engine (noise filtering + detection)
npx tsx scripts/test-collector-queue.ts  # stagger + backoff (deterministic)
npx tsx scripts/test-ingest-pipeline.ts  # snapshot → diff → classify (real Nova)
npx tsx scripts/test-intel-api.ts        # every route over real HTTP (needs `next dev`)
```

## Notes

- The landing advertises 35 signal types (the roadmap); the shipped classifier
  currently produces the 6 core types (pricing, hiring, positioning, compliance,
  integration, changelog).
- Beta: free while we build. No auth beyond a simple identity string yet.
