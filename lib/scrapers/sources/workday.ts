import type { SourceAdapter } from "./shared";
import { pick, htmlToText, prettifyCompany, parseDate, isUsable } from "./shared";

/**
 * Workday. The hard one — and the best justification for using Scraper Studio.
 *
 * Workday boards are React apps with no consistent public JSON feed; the data
 * loads via tenant-specific POST calls to `/wday/cxs/...`. There is no clean URL
 * pattern across tenants (the datacenter segment is wd1/wd3/wd5/wd103/...), so
 * rather than try to construct it, we accept a full board URL as input. The
 * Scraper Studio collector was built to render the JS board and paginate the
 * results list, emitting one record per role.
 *
 *   Input:  a full board URL, e.g.
 *           https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite
 *           (or "tenant/site" shorthand -> defaults to wd1)
 */
export const workdayAdapter: SourceAdapter = {
  source: "workday",
  collectorEnvVar: "BRIGHTDATA_COLLECTOR_WORKDAY",

  buildTargets(input: string) {
    const url = toBoardUrl(input);
    const tenant = url.match(/https?:\/\/([^.]+)\./)?.[1] ?? input;
    return {
      urls: [url],
      ctx: { input: url, companyName: prettifyCompany(tenant) },
    };
  },

  normalizeRow(row, ctx) {
    const applyUrl = pick(row, ["apply_url", "applyUrl", "url", "external_url"]);
    // Workday collectors don't always emit a location field, but the location is
    // encoded in the detail-page URL path (…/job/China-Shanghai/Role_JR123/…).
    const location =
      pick(row, ["location", "locations", "location_name"]) ||
      locationFromWorkdayUrl(applyUrl);

    const job = {
      source: "workday" as const,
      companyName:
        pick(row, ["company", "company_name", "companyName"]) || ctx.companyName,
      title: pick(row, ["title", "job_title", "name"]),
      location,
      // Workday list pages often expose only a summary; the collector should
      // capture the full description where available, else the snippet. The JD
      // parser downstream tolerates shorter text and flags low confidence.
      rawDescriptionText: htmlToText(
        pick(row, ["description_text", "description", "job_description", "summary"])
      ),
      applyUrl,
      postedDate: parseDate(pick(row, ["posted_date", "posted_on", "start_date"])),
      collectorId: process.env.BRIGHTDATA_COLLECTOR_WORKDAY ?? "",
    };
    return isUsable(job) ? job : null;
  },
};

/** Pull "China-Shanghai" out of a Workday detail URL's /job/<loc>/<role>/ path. */
function locationFromWorkdayUrl(url: string): string {
  const m = url.match(/\/job\/([^/]+)\//i);
  if (!m) return "";
  return decodeURIComponent(m[1]).replace(/[-_]+/g, " ").trim();
}

function toBoardUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  // "tenant/site" shorthand -> best-effort URL (datacenter defaults to wd1).
  const [tenant, site] = trimmed.split("/");
  return `https://${tenant}.wd1.myworkdayjobs.com/${site ?? ""}`.replace(
    /\/+$/,
    ""
  );
}
