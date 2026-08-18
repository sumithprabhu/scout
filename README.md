# Job Matcher — backend

Scrapes job listings from ATS boards (Greenhouse, Lever, Workday) and Naukri via
**Bright Data Scraper Studio**, parses each JD with Claude to extract the real
required tech stack, and matches it against a user's skills — surfacing only
genuinely relevant jobs and telling the user **exactly what's missing** on
near-misses instead of making them read every JD.

Backend only (Next.js API routes). No UI yet.

## Stack

- **Next.js 14** (App Router, TypeScript) — API routes under `/app/api`
- **MongoDB + Mongoose** — storage (`/models`)
- **Bright Data CLI** (`@brightdata/cli`) — four custom Scraper Studio collectors (`/scrapers`)
- **Amazon Nova on AWS Bedrock** (`@aws-sdk/client-bedrock-runtime`, Converse API) — JD skill extraction
- MongoDB-based per-identity daily rate limiter (no auth yet)

## Architecture (the pipeline)

```
 /api/scrape          /api/parse           /api/match            /api/jobs
 ──────────           ──────────           ──────────            ─────────
 Bright Data      →   Nova extracts    →   overlap scoring   →   sorted by fit,
 collector run        requiredSkills,      matched vs missing    missing skills
 → JobListing         niceToHave,          → MatchResult         shown for
                      seniority                                  near-misses
                      → ParsedJD
```

Every source funnels into one `NormalizedJob` shape (`lib/types.ts`), so storage,
parsing, and matching are all source-agnostic. See `scrapers/README.md` for the
Scraper Studio build/run design and the per-source rationale.

### Key design decisions (for the demo)

- **Global-cached Mongo connection** (`lib/db.ts`) — survives dev hot-reload and
  serverless cold starts instead of leaking connections.
- **One `NormalizedJob` contract** — the four very different sources never leak
  their shape past the scraper wrapper.
- **JD parsing via Amazon Nova (Bedrock Converse)** — a strict-JSON prompt +
  defensive parsing turns messy JD text into `requiredSkills`/`niceToHave`/
  seniority. Short/unparseable JDs are flagged low-confidence, never silently
  matched against garbage. Provider is isolated to `lib/jdParser.ts` behind a
  stable `parseJD()` signature, so switching models is a one-file change.
- **Explainable overlap scoring** (`lib/matchEngine.ts`) — required-skill overlap
  is 85% of the score, nice-to-haves 15% (renormalized when a component is
  absent). Every number is defensible by pointing at two sets. `missingSkills` is
  computed explicitly, in the JD's own wording.
- **Rate limit on `/api/scrape` only** — that's what spends Bright Data credits.

## Setup

```bash
npm install
cp .env.example .env    # fill MONGODB_URI, AWS creds + BEDROCK_*, BRIGHTDATA_API_KEY
npx tsx scripts/smoke-db.ts     # verify DB + models
npx tsx scripts/test-parse.ts   # verify Nova/Bedrock JD parsing (needs AWS creds + model access)
```

> JD parsing needs an IAM principal with `bedrock:InvokeModel` **and** Nova
> model access enabled in the Bedrock console (Model access) for `BEDROCK_REGION`.

### Bright Data collectors (one-time, ~5-10 min each, spends credits)

```bash
npx bdata login
npx bdata budget                        # confirm auth + credit
npx tsx scrapers/build-collectors.ts    # builds all four, prints .env lines
```

Paste the printed `BRIGHTDATA_COLLECTOR_*` ids into `.env`. See `scrapers/README.md`.

## API

| Method | Route | Body / query | Does |
|--------|-------|--------------|------|
| POST | `/api/scrape` | `{source, input, email?}` | Run a collector, store JobListings. Rate-limited. |
| POST | `/api/parse` | `{limit?}` or `{jobListingId}` | Extract skills from unparsed JDs via Claude → ParsedJD. |
| POST | `/api/profile` | `{identity, skills[], resumeText?}` | Upsert a user skill profile (no auth yet). |
| POST | `/api/match` | `{userProfileId, threshold?}` | Score the profile against every ParsedJD → MatchResult. |
| GET | `/api/jobs` | `?userProfileId=&minFit=&nearMissThreshold=&limit=` | Matched jobs sorted by fit, with missing skills + `nearMiss` flag. |

`input` for `/api/scrape` is a company slug (greenhouse/lever), a board URL
(workday), or a search query (naukri).

## Tests / verification

```bash
npx tsx scripts/smoke-db.ts      # DB connection + all 4 models + dedup index
npx tsx scripts/test-match.ts    # match engine (pure logic) — scoring + missing skills
# API integration (needs dev server + a low rate limit):
PORT=3111 SCRAPE_RATE_LIMIT_PER_DAY=2 npm run dev &
PORT=3111 npx tsx scripts/test-api.ts   # profile -> match -> jobs -> rate limit
```

## Known trade-offs

- **Next 14.2.x** carries DoS-class advisories fully patched only in Next 15 (a
  breaking upgrade). We don't use `next/image`; acceptable for the hackathon.
- Workday/Naukri collectors return **snippet-level** descriptions (no clean feed);
  those JDs parse at lower confidence and are flagged accordingly.
- Skill matching uses a small hand-curated alias table — extend as real scraped
  data reveals more variants.
