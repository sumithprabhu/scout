import type { SourceAdapter } from "./shared";
import { pick, htmlToText, prettifyCompany, parseDate, isUsable } from "./shared";

/**
 * Greenhouse. Company-scoped: one board per company slug.
 *
 * Target URL: the board's public JSON feed, which returns every open role WITH
 * full description content in a single response — so one collector run yields
 * complete JDs, no per-listing navigation needed. The Scraper Studio collector
 * is built to emit one record per job with the field names requested below.
 *
 *   Input:  a company slug, e.g. "airbnb"  (or a full boards.greenhouse.io URL)
 *   Feed:   https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 */
export const greenhouseAdapter: SourceAdapter = {
  source: "greenhouse",
  collectorEnvVar: "BRIGHTDATA_COLLECTOR_GREENHOUSE",

  buildTargets(input: string) {
    const slug = extractSlug(input);
    // Rendered board (the collector discovers jobs + follows to detail pages).
    // Works for companies whose board renders on job-boards.greenhouse.io.
    return {
      urls: [`https://job-boards.greenhouse.io/${slug}`],
      ctx: { input: slug, companyName: prettifyCompany(slug) },
    };
  },

  normalizeRow(row, ctx) {
    const job = {
      source: "greenhouse" as const,
      companyName:
        pick(row, ["company", "company_name", "companyName"]) || ctx.companyName,
      title: pick(row, ["title", "job_title", "name"]),
      location: pick(row, ["location", "location_name", "office"]),
      rawDescriptionText: htmlToText(
        pick(row, ["description_text", "description", "content", "body"])
      ),
      applyUrl: pick(row, ["apply_url", "applyUrl", "absolute_url", "url"]),
      postedDate: parseDate(
        pick(row, ["posted_date", "updated_at", "created_at"])
      ),
      collectorId: process.env.BRIGHTDATA_COLLECTOR_GREENHOUSE ?? "",
    };
    return isUsable(job) ? job : null;
  },
};

function extractSlug(input: string): string {
  // Accept a bare slug or a full board URL like
  // https://boards.greenhouse.io/airbnb (optionally with /jobs/...).
  const m = input.match(/greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#]+)/i);
  if (m) return m[1];
  return input.trim().replace(/^\/+|\/+$/g, "");
}
