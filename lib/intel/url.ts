/**
 * URL normalization for dedup. The unique indexes on Company.rootUrl and
 * Collector.url only dedupe if we canonicalize before insert — otherwise
 * "Acme.com", "https://acme.com/", and "http://www.acme.com" become three rows.
 *
 * Kept tiny and pure so it's trivially unit-testable and reusable by discovery,
 * collector creation, and the API routes.
 */

/**
 * Canonicalize a root/site URL:
 *  - assume https:// if no scheme given (users type "acme.com")
 *  - lowercase the host, strip a leading "www."
 *  - drop the trailing slash, query, and hash on the origin form
 * Returns null if the input can't be parsed into an http(s) URL.
 */
export function normalizeRootUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    // Origin only for a root URL: no path/query/hash.
    return `https://${host}`;
  } catch {
    return null;
  }
}

/**
 * Approximate registrable domain (eTLD+1) via the last two labels. Good enough
 * for the common .com/.io/.app cases we hit; multi-part suffixes (.co.uk) are a
 * known limitation, acceptable for the MVP (documented). Used by the discovery
 * same-site guard.
 */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  return labels.slice(-2).join(".");
}

/**
 * True if `candidateUrl` is on the SAME registrable domain as `rootUrl` (or a
 * subdomain of it). e.g. security.vercel.com is same-site as vercel.com; but
 * linear.app is NOT same-site as posthog.com.
 *
 * This is the guard against cross-company contamination in discovery: a scraper
 * that falls back to another site's links (observed with Bright Data returning
 * build-time sample data on a scrape miss) would otherwise attribute a
 * competitor's pages to the company. Returns false on unparseable input.
 */
export function sameSiteOrSubdomain(candidateUrl: string, rootUrl: string): boolean {
  try {
    const c = registrableDomain(new URL(candidateUrl).hostname);
    const r = registrableDomain(new URL(rootUrl).hostname);
    return !!c && c === r;
  } catch {
    return false;
  }
}

/**
 * Canonicalize a specific page URL (keeps the path, drops query/hash and a
 * trailing slash). Used as the dedup key for collectors, since two pages that
 * differ only by "?utm=..." are the same page to us.
 */
export function normalizePageUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let path = u.pathname.replace(/\/+$/, ""); // drop trailing slashes
    return `https://${host}${path}`;
  } catch {
    return null;
  }
}
