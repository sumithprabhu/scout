import type { SourceAdapter } from "./shared";
import { pick, htmlToText, prettifyCompany, parseDate, isUsable } from "./shared";

/**
 * Lever. Company-scoped, same pattern as Greenhouse.
 *
 * Target URL: Lever's public postings feed in JSON mode, which includes each
 * posting's full plaintext description, team, location, and hosted apply URL.
 *
 *   Input:  a company slug, e.g. "netflix"  (or a full jobs.lever.co URL)
 *   Feed:   https://api.lever.co/v0/postings/{slug}?mode=json
 */
export const leverAdapter: SourceAdapter = {
  source: "lever",
  collectorEnvVar: "BRIGHTDATA_COLLECTOR_LEVER",

  buildTargets(input: string) {
    const slug = extractSlug(input);
    // Rendered board (collector discovers jobs + follows to detail pages).
    return {
      urls: [`https://jobs.lever.co/${slug}`],
      ctx: { input: slug, companyName: prettifyCompany(slug) },
    };
  },

  normalizeRow(row, ctx) {
    // Lever nests location/team under `categories`; the collector may flatten
    // these or keep them nested, so we check both.
    const categories = (row.categories as Record<string, unknown>) ?? {};
    const nestedLocation =
      typeof categories.location === "string" ? categories.location : "";
    const nestedTeam =
      typeof categories.team === "string" ? categories.team : "";

    const job = {
      source: "lever" as const,
      companyName:
        pick(row, ["company", "company_name", "companyName"]) || ctx.companyName,
      title: pick(row, ["title", "text", "job_title"]),
      location: pick(row, ["location", "location_name"]) || nestedLocation,
      rawDescriptionText: htmlToText(
        pick(row, [
          "description_text",
          "descriptionplain",
          "descriptionPlain",
          "description",
          "content",
        ])
      ),
      applyUrl: pick(row, ["apply_url", "applyUrl", "hostedurl", "hostedUrl", "url"]),
      postedDate: parseDate(pick(row, ["posted_date", "createdat", "createdAt"])),
      collectorId: process.env.BRIGHTDATA_COLLECTOR_LEVER ?? "",
    };
    // Team isn't part of NormalizedJob, but if there's no location fall back to it
    // so the row still passes the usability check for location-less remote roles.
    if (!job.location && nestedTeam) job.location = nestedTeam;
    return isUsable(job) ? job : null;
  },
};

function extractSlug(input: string): string {
  const m = input.match(/lever\.co\/([^/?#]+)/i);
  if (m) return m[1];
  return input.trim().replace(/^\/+|\/+$/g, "");
}
