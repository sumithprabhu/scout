# Bright Data Scraper Studio — collectors

Four collectors, all **built fresh** via Scraper Studio's AI (`bdata scraper create`).
No pre-built job-scraping library is used anywhere — this is a hard hackathon rule.

## Architecture (the 60-second judge pitch)

```
 build (once, via CLI)                     run (per request, via REST API)
 ─────────────────────                     ───────────────────────────────
 bdata scraper create <sampleUrl> <desc>   POST /dca/trigger?collector=<id>  → collection_id
        → collector_id                     GET  /dca/dataset?id=<collection_id> → rows
                                           lib/scrapers normalizes rows → NormalizedJob
```

- **One collector per source**, built against a live sample page (see `collectors.config.ts`).
- Collectors are **parameterized**: built once against one company's structure, then
  run against any other slug/query. The wrapper (`lib/scrapers/`) turns a user's
  input (`"stripe"`, `"backend engineer"`) into the target URL and triggers the run.
- Every source funnels into one `NormalizedJob` shape (`lib/types.ts`), so storage,
  parsing, and matching are source-agnostic.

### Target pages per source

All four collectors scrape **rendered (JavaScript) pages** — Scraper Studio builds
browser-based scrapers, so a raw JSON API returns nothing (learned the hard way:
JSON-feed collectors came back with 0 rows). For the company boards, the collector
does **discovery + detail-page navigation**: it finds every posting on the board,
opens each one, and extracts the full JD text.

| Source     | Target the collector runs against       | Extraction |
|------------|-----------------------------------------|------------|
| Greenhouse | rendered board `job-boards.greenhouse.io/{co}` | discover jobs → follow to each detail page → **full JD** |
| Lever      | rendered board `jobs.lever.co/{co}`     | discover jobs → follow to each detail page → **full JD** |
| Workday    | rendered board `{co}.wdN.myworkdayjobs.com/{site}` | scroll/paginate → follow to detail → full JD (the hard one) |
| Naukri     | rendered search `naukri.com/{query}-jobs` | one page; each result card already carries a skill-rich snippet |

Note: some companies (e.g. Stripe) redirect their Greenhouse/Lever board to a
custom site — build/run against companies whose board renders on the ATS domain
(gitlab, discord, anthropic, spotify, palantir). Collectors that wrap jobs in a
nested array (Naukri's `job_cards`) are flattened by `explodeRows()` in
`lib/scrapers/index.ts`.

## Build the collectors

```bash
npx bdata login                       # opens browser, stores credentials
npx bdata budget                      # confirm you're authenticated + have credit
npx tsx scrapers/build-collectors.ts  # builds all four (~5-10 min each, uses credits)
# or one at a time:
npx tsx scrapers/build-collectors.ts greenhouse
```

This writes `scrapers/collector-map.json` and prints `.env` lines to paste:

```
BRIGHTDATA_COLLECTOR_GREENHOUSE=<id>
BRIGHTDATA_COLLECTOR_LEVER=<id>
BRIGHTDATA_COLLECTOR_WORKDAY=<id>
BRIGHTDATA_COLLECTOR_NAUKRI=<id>
```

## Collector map (fill in after building — for the demo)

| Source     | Collector ID          | Sample built against | Verified |
|------------|-----------------------|----------------------|----------|
| greenhouse | `c_msx9q4382esp256xog` | `job-boards.greenhouse.io/gitlab` | ✅ 50 jobs, full JD |
| lever      | `c_msxa0g3b1ilusg0166` | `jobs.lever.co/spotify` | ✅ 101 jobs, full JD |
| workday    | `c_msxa3xjz2jxl9b2gae` | `nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite` | ✅ 820 jobs, full JD |
| naukri     | `c_msx4q5e8japqva58p`  | `naukri.com/backend-developer-jobs` | ✅ 270 jobs, skill snippets |

Print the current map anytime: `npx tsx scrapers/collector-map.ts`
