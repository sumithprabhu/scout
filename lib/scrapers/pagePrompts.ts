import { PAGE_TYPES, type PageType } from "@/lib/intel/types";

/**
 * Per-page-type extraction specs for `bdata scraper create`.
 *
 * THIS FILE IS THE EXTENSIBILITY SEAM (a hard requirement): adding a stretch
 * page type later (docs/blog/legal/community/comparison) is (1) a new value in
 * PAGE_TYPES and (2) a new entry here. Nothing in the queue, diff, webhook, or
 * classify layers changes — they all key off the PageType enum.
 *
 * Each description MUST be <= 500 chars (a hard CLI limit, learned in the
 * job-matcher build). Descriptions are worded to produce STABLE, structured
 * field names so the diff engine can compare version-over-version reliably —
 * unstable extraction shapes would make every run look like a change.
 */

const PROMPTS: Record<PageType, string> = {
  homepage:
    "This is a company homepage. Extract: headline (the main hero heading), " +
    "subheadline (supporting hero text), primary_cta (main call-to-action button " +
    "text), value_props (array of the key feature/benefit phrases shown), " +
    "customer_logos (array of named customers/brands shown, if any). Output ONE record.",
  pricing:
    "This is a pricing page. Extract every plan as an array `plans`, each with: " +
    "name (plan/tier name), price (the displayed price as text, e.g. '$99'), " +
    "billing_period (e.g. 'per month', 'per user/mo', 'annual'), features (array of " +
    "the feature bullet strings listed under that plan). Also extract has_free_tier " +
    "(true/false). Output ONE record with the plans array.",
  careers:
    "This is a careers / jobs page. Discover EVERY open role listed and output an " +
    "array `jobs`, each with: title (role title), department (team/function if " +
    "shown), location (city/remote). Also extract total_openings (the count of roles " +
    "found). Do not open detail pages; the listing is enough. Output ONE record.",
  trust:
    "This is a security / trust / compliance page. Extract: certifications (array of " +
    "named compliance frameworks or badges shown, e.g. 'SOC 2 Type II', 'ISO 27001', " +
    "'GDPR', 'HIPAA', 'PCI DSS'), subprocessors (array of named third parties if " +
    "listed), data_regions (array of hosting regions if shown). Output ONE record.",
  integrations:
    "This is an integrations / apps / marketplace page. Extract an array " +
    "`integrations`, each with: name (the integration/partner name) and category " +
    "(the grouping it is listed under, if any). Also extract total_integrations (the " +
    "count found). Output ONE record with the integrations array.",
  changelog:
    "This is a changelog / release-notes / what's-new page. Extract an array " +
    "`entries`, each with: title (the entry/release heading), date (the entry date as " +
    "text if shown), summary (a one-line description of the change). Capture the most " +
    "recent entries listed on the page. Output ONE record with the entries array.",
};

// Fail-fast guard: every page type has a prompt, and every prompt fits the CLI.
for (const t of PAGE_TYPES) {
  const p = PROMPTS[t];
  if (!p) throw new Error(`pagePrompts: missing extraction prompt for page type "${t}"`);
  if (p.length > 500) {
    throw new Error(`pagePrompts: prompt for "${t}" is ${p.length} chars (>500 CLI limit)`);
  }
}

export function extractionPromptFor(pageType: PageType): string {
  return PROMPTS[pageType];
}
