import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { discoverPages } from "@/lib/scrapers/discoverPages";
import { classifyLinks, type PageTypeMap } from "./classifyLinks";
import { PAGE_TYPES, type PageType } from "@/lib/intel/types";
import { sameSiteOrSubdomain, registrableDomain } from "@/lib/intel/url";

// Careers pages legitimately live off-domain on an ATS. All OTHER page types
// (pricing/trust/integrations/changelog) should be on the company's own domain,
// so a foreign URL there signals a bad scrape (cross-company contamination).
const KNOWN_ATS_HOSTS = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com",
  "smartrecruiters.com", "myworkdayjobs.com", "bamboohr.com", "jobvite.com",
];

function isTrustworthyPageUrl(pageUrl: string, rootUrl: string, pageType: PageType): boolean {
  if (sameSiteOrSubdomain(pageUrl, rootUrl)) return true;
  if (pageType === "careers") {
    try {
      const host = new URL(pageUrl).hostname.toLowerCase();
      return KNOWN_ATS_HOSTS.some((ats) => host === ats || host.endsWith(`.${ats}`));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Discovery orchestrator: root URL -> tracked pages, stored as `discovering`.
 *
 * Flow (each step is its own module, per the separation-of-concerns requirement):
 *   discoverPages()  [lib/scrapers]  -> raw homepage links
 *   classifyLinks()  [lib/discovery] -> Nova maps links to page types
 *   upsert TrackedPage rows here     -> persisted for the "confirm what we found" UX
 *
 * TrackedPages are written with status "discovering" and collectorId=null. They
 * become "active" only after the user confirms and createPageCollector() (step 3)
 * attaches a collector. This is the human-in-the-loop checkpoint before we spend
 * credits building 6 collectors off a possibly-wrong guess.
 *
 * Idempotent: upserts on (companyId, pageType), so re-running discovery for a
 * company (e.g. it was re-added) refreshes guesses instead of duplicating rows.
 */

export interface DiscoveryResult {
  companyId: string;
  pageMap: PageTypeMap;
  /** page types we found a URL for */
  found: PageType[];
  /** page types discovery could not locate (null) */
  missing: PageType[];
  /** page types whose classified URL was rejected as off-domain (bad scrape) —
   *  surfaced so the reason for a weak result is transparent, not silent. */
  droppedOffDomain: { pageType: PageType; url: string }[];
  /** true when discovery came back with nothing usable beyond the homepage —
   *  the signal the UX uses to prompt the user to add pages manually. */
  needsManualEntry: boolean;
}

export async function runDiscovery(
  companyId: string,
  rootUrl: string,
  opts?: { timeoutMs?: number }
): Promise<DiscoveryResult> {
  await connectDB();

  const links = await discoverPages(rootUrl, opts);
  const pageMap = await classifyLinks(rootUrl, links);

  const found: PageType[] = [];
  const missing: PageType[] = [];
  const droppedOffDomain: { pageType: PageType; url: string }[] = [];

  for (const pageType of PAGE_TYPES) {
    let url = pageMap[pageType];
    // Same-site sanity guard: reject a classified URL that belongs to a
    // different company (a scraper fell back to another site's links). Homepage
    // is the root itself, so it's always trustworthy.
    if (url && pageType !== "homepage" && !isTrustworthyPageUrl(url, rootUrl, pageType)) {
      console.warn(
        `[discovery] dropping ${pageType} for ${registrableDomain(new URL(rootUrl).hostname)}: ` +
          `"${url}" is off-domain (likely a bad scrape). Treating as not-found.`
      );
      droppedOffDomain.push({ pageType, url });
      pageMap[pageType] = null;
      url = null;
    }
    if (!url) {
      missing.push(pageType);
      continue;
    }
    found.push(pageType);
    await TrackedPage.updateOne(
      { companyId, pageType },
      {
        $set: { url, status: "discovering" },
        // Never clobber a collector already attached to this page on re-discovery.
        $setOnInsert: { collectorId: null },
      },
      { upsert: true }
    );
  }

  // Only homepage (or nothing) usable -> discovery effectively failed; the UX
  // should fall back to manual page entry. Off-domain drops make this common
  // when the collector returns sample data instead of the real site.
  const needsManualEntry = found.filter((t) => t !== "homepage").length === 0;

  return { companyId, pageMap, found, missing, droppedOffDomain, needsManualEntry };
}

/**
 * Kick off discovery for a company that already exists. Thin wrapper used by the
 * POST /api/companies route so the route stays free of business logic.
 */
export async function discoverForCompany(companyId: string): Promise<DiscoveryResult> {
  await connectDB();
  const company = await Company.findById(companyId).lean();
  if (!company) throw new Error(`Company ${companyId} not found`);
  return runDiscovery(String(company._id), company.rootUrl);
}
