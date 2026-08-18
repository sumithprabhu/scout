import type { SourceAdapter } from "./shared";
import { pick, htmlToText, parseDate, isUsable } from "./shared";

/**
 * Naukri. Query-scoped rather than company-scoped: the input is a search query,
 * and each result row is a different company. So companyName comes from the row,
 * not the context.
 *
 * Target URL: Naukri's keyword search results page (rendered HTML). The Scraper
 * Studio collector extracts one record per result card. Descriptions here are
 * snippets, not full JDs — Naukri only shows the full JD on the detail page — so
 * these will parse at lower confidence, which is expected and flagged downstream.
 *
 *   Input:  a search query, e.g. "backend engineer node"
 *   URL:    https://www.naukri.com/{slugified-query}-jobs
 */
export const naukriAdapter: SourceAdapter = {
  source: "naukri",
  collectorEnvVar: "BRIGHTDATA_COLLECTOR_NAUKRI",

  buildTargets(input: string) {
    const query = input.trim();
    const slug = query.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return {
      urls: [`https://www.naukri.com/${slug}-jobs`],
      // companyName intentionally empty: it's per-row for a search.
      ctx: { input: query, companyName: "" },
    };
  },

  normalizeRow(row, _ctx) {
    const job = {
      source: "naukri" as const,
      companyName: pick(row, ["company", "company_name", "companyName", "employer"]),
      title: pick(row, ["title", "job_title", "designation", "name"]),
      location: pick(row, ["location", "locations", "job_location"]),
      rawDescriptionText: htmlToText(
        pick(row, ["description", "description_snippet", "job_description", "snippet"])
      ),
      applyUrl: pick(row, ["apply_url", "applyUrl", "url", "listing_url", "job_url"]),
      postedDate: parseDate(pick(row, ["posted_date", "posted", "posted_on"])),
      collectorId: process.env.BRIGHTDATA_COLLECTOR_NAUKRI ?? "",
    };
    return isUsable(job) ? job : null;
  },
};
