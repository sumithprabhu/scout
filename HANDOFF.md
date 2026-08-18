# Job Matcher — Handoff

A handoff for picking this project up cold: what was built, what works, and the
strategic question the founder is weighing (whether the "aggregate every job in
the world" framing is viable, and what to do instead).

---

## 1. What the product is

Scrapes job listings from company career pages (Greenhouse, Lever, Workday) and
a job board (Naukri) via **Bright Data Scraper Studio**, parses each job
description with an LLM to extract the real required tech stack, and matches it
against a user's skill profile — surfacing only genuinely relevant jobs and
telling the user **exactly which skills they're missing** on near-misses, instead
of making them read every JD.

Hackathon build: solo, 7 days. Backend only (no UI). Hard requirement: must use
Bright Data Scraper Studio to build every scraper (no pre-built scraper library).

## 2. Tech stack

- **Next.js 14** (App Router, TypeScript) — API routes under `/app/api`
- **MongoDB Atlas + Mongoose** — storage (`/models`)
- **Bright Data CLI** (`@brightdata/cli`) — 4 custom Scraper Studio collectors (`/scrapers`)
- **Amazon Nova on AWS Bedrock** (`@aws-sdk/client-bedrock-runtime`, Converse API) — JD skill extraction (chosen over Claude to reuse the founder's AWS creds; isolated behind `parseJD()` in `lib/jdParser.ts`, a one-file swap)
- MongoDB-based per-identity daily rate limiter on `/api/scrape`

## 3. What's built and VERIFIED working

Everything below was run, not just compiled. `next build` + `tsc` are green.

| Layer | Status |
|---|---|
| Scaffold, Mongo connection (global-cached), 4 Mongoose models | ✅ `scripts/smoke-db.ts` |
| Match engine (overlap scoring + explicit missing-skills) | ✅ `scripts/test-match.ts` (16 assertions) |
| 5 API routes: scrape, parse, match, jobs, profile + rate limiter | ✅ `scripts/test-api.ts` (12 assertions over HTTP) |
| Amazon Nova JD parsing | ✅ `scripts/test-parse.ts` |
| All 4 Bright Data collectors returning full JDs | ✅ (see below) |
| Full pipeline on REAL scraped data | ✅ `scripts/ingest-cached.ts`, `scripts/demo-multisource.ts` |

### API routes
- `POST /api/scrape {source, input, email?}` — run a collector, store JobListings (rate-limited; `input` = company slug / board URL / search query)
- `POST /api/parse {limit?}` — Nova-extract skills from unparsed JDs → ParsedJD
- `POST /api/profile {identity, skills[], resumeText?}` — upsert a user skill profile (no auth yet)
- `POST /api/match {userProfileId, threshold?}` — score profile vs every ParsedJD → MatchResult
- `GET /api/jobs?userProfileId=&minFit=&nearMissThreshold=&limit=` — matched jobs sorted by fit, with missing skills + `nearMiss` flag

### Bright Data collectors (all working, full JDs)

| Source | Collector ID | Built against | Result |
|---|---|---|---|
| greenhouse | `c_msx9q4382esp256xog` | `job-boards.greenhouse.io/gitlab` | 50 jobs, full JD |
| lever | `c_msxa0g3b1ilusg0166` | `jobs.lever.co/spotify` | 101 jobs, full JD (complete: Spotify has exactly 101) |
| workday | `c_msxa3xjz2jxl9b2gae` | `nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite` | 820 jobs, full JD |
| naukri | `c_msx4q5e8japqva58p` | `naukri.com/backend-developer-jobs` | 270 jobs, skill-rich snippets |

**The winning recipe (hard-won):** Scraper Studio builds *browser* scrapers, so
pointing them at JSON API feeds returned **0 rows**. The fix that cracked all
three company boards: target the **rendered board page** and instruct the AI
*"discover every job, open each detail page, extract the full description."* The
AI generates the discovery + detail-page navigation from that plain-English spec.
Naukri is a single rendered search page (cards already carry a skill list).

**Gotchas encoded in the code:**
- Collectors output `[{title, location, description, apply_url, ...}]`. Naukri wraps jobs in a nested `job_cards` array → flattened by `explodeRows()` in `lib/scrapers/index.ts`.
- Workday omits `location` → recovered from the apply URL's `/job/<City-Region>/` path in `lib/scrapers/sources/workday.ts`.
- Use companies whose board renders ON the ATS domain (gitlab/discord/anthropic/spotify/palantir); some (Stripe) redirect off-domain.
- Building collectors is FREE; only *running* them (scraping) spends credit. Cached run results are re-fetchable free for ~16 days via `GET /dca/dataset?id=...`.
- `lib/scrapers/brightdata.ts` REST path (`/dca/trigger` + poll `/dca/dataset`) matches the CLI's batch fallback exactly.

Bright Data balance was ~$57; only small test-runs spent so far.

### Proof of the core value (real data)
```
=== ONE ranked list across Greenhouse + Naukri (real → Nova → match) ===
 21%  [naukri    ] Sekel Tech   Python Backend Developer
        missing: rds, css, restful, redis, microservices, lambda, ec2
 19%  [greenhouse] Gitlab       Intermediate Support Engineer
        missing: linux, ruby, bash, ruby on rails, ci/cd
  7%  [greenhouse] Gitlab       AI Engineer
        missing: javascript/typescript, rest apis, graphql, prompt engineering
```

---

## 4. The strategic question (why the founder is reconsidering)

The original pitch was **"one place to find every job."** The founder correctly
concluded this is **not a viable moat**, and the reasoning is sound:

1. **There is no global feed.** Greenhouse/Lever/Workday are platforms hosting
   *thousands of separate company boards*. Each company is its own board/slug or
   Workday tenant. "All of Greenhouse" doesn't exist to scrape — you'd enumerate
   companies one by one. A hardcoded company-slug list = a small fixed universe,
   which kills the "everything" promise.
2. **Per-company scale is bounded and expensive.** A run returns only that
   company's open roles (GitLab ~50, NVIDIA 820, Spotify 101). Getting breadth
   means many runs, and every job costs a detail-page fetch — so "10k per source"
   is thousands of page-loads that can exceed the credit balance.
3. **The universal-aggregator space is already owned** by LinkedIn, Indeed,
   Google Jobs, Naukri — capital-intensive incumbents. A solo build won't
   out-aggregate them on breadth.

So "be the universal source-of-truth by crawling every company page" is not
achievable (or defensible) for this team/timeline.

## 5. Recommended repositioning (the part worth keeping)

**The moat was never the aggregation — it's the intelligence layer**, which is
built and working: *"given your skills, here are the jobs you actually fit, and
the exact skill you're missing on the near-misses."* Aggregators dump thousands
of jobs and make you read them; this reads them and tells you the 12 that fit and
the one skill between you and the rest. That is LLM-native and the incumbents are
slow at it.

Two things resolve the moat problem AND keep the Bright Data requirement:

1. **Get breadth by scraping an *aggregator*, not company pages.** Bright Data is
   built to scrape big sites at scale. **Naukri already IS "one place with
   everything"** — scraping it (or Indeed / Google Jobs) via Bright Data gives
   breadth for free and uses Bright Data heavily. The per-company Greenhouse/
   Lever/Workday scraping becomes a secondary "we also go direct to the source"
   feature, not the core.
2. **Position as the brain, not the index.** Shift from "we aggregate jobs"
   (commodity) to "we tell you which jobs you fit and the one skill you're
   missing" (defensible, demo-able).

For a hackathon, judges reward a real insight that works + interesting tech —
both of which exist (skill-gap matching + multi-source Bright Data scraping).
Universal coverage is not required to win.

### Open decisions for the next agent to resolve with the founder
- Confirm the hackathon's judging criteria / theme (drives the exact wedge).
- Decide: keep the engine and re-point to "aggregator breadth + skill-gap brain,"
  OR pivot to a different "scrape something → LLM analyzes → tell the user
  something useful" product (the Bright Data + Nova + Mongo plumbing ports).
- If keeping: make Naukri (aggregator) the volume source; treat company boards as
  a garnish; do NOT invest in a company-slug catalog as the core.

---

## 6. How to run

```bash
npm install
cp .env.example .env   # MONGODB_URI, AWS creds + BEDROCK_*, BRIGHTDATA_API_KEY + 4 collector ids
npx tsx scripts/smoke-db.ts          # DB + models
npx tsx scripts/test-parse.ts        # Nova parsing (needs AWS creds + Bedrock Nova model access)
npx tsx scripts/demo-multisource.ts  # real multi-source → Nova → match (uses cached datasets, free)
```

`.env` needs: `MONGODB_URI`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`,
`BEDROCK_REGION=us-east-1`, `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`,
`BRIGHTDATA_API_KEY` (needs Admin token scope), and the 4 `BRIGHTDATA_COLLECTOR_*`
ids above. AWS principal needs `bedrock:InvokeModel` + Nova model access enabled
in the Bedrock console (us-east-1).

## 7. Known limitations / not done
- No UI (out of scope for the build).
- Nova occasionally extracts responsibility phrases ("large-scale distributed
  systems") as skills — prompt-tunable.
- `/api/scrape` is synchronous with a 540s poll timeout; production shape is
  async trigger + webhook/poller.
- Per-company scraping does not (and cannot cheaply) achieve global coverage — see §4.
- Next 14.2.x has DoS-class advisories patched only in Next 15 (breaking upgrade);
  acceptable for a hackathon (no `next/image` used).
