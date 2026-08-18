/**
 * Shared enums/types for the company-intelligence engine.
 *
 * WHY A SEPARATE FILE (not lib/types.ts): the original job-matcher domain
 * (JOB_SOURCES, SeniorityLevel, NormalizedJob) still lives in lib/types.ts and
 * is imported by the job models/scrapers we're keeping as working infra. Rather
 * than mix two product vocabularies in one file, the intel domain gets its own
 * types module. The models below import from here; nothing job-matcher imports
 * from here. This keeps the pivot cleanly separable and makes the diff obvious.
 */

/**
 * The public page types we track per company. MVP = 6.
 *
 * EXTENSIBILITY (a hard requirement): adding a stretch page type later (docs,
 * blog, legal, community, comparison) is a one-line addition here plus one new
 * extraction prompt in lib/scrapers/pagePrompts.ts — no schema migration, no
 * changes to diff/classify/webhook logic, because everything downstream keys off
 * this enum rather than hard-coding the six values.
 */
export const PAGE_TYPES = [
  "homepage",
  "pricing",
  "careers",
  "trust",
  "integrations",
  "changelog",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** Lifecycle of a tracked page. `discovering` = found by discovery but not yet
 *  confirmed/collector-backed; `active` = has a collector and is being scraped;
 *  `broken` = collector failing or page gone. */
export const PAGE_STATUSES = ["active", "broken", "discovering"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

/**
 * The kinds of change a diff can represent. Deliberately parallel to PAGE_TYPES
 * but NOT one-to-one: a careers-page diff is usually a "hiring_spike", but a
 * homepage diff could be a "positioning_shift" OR (if a compliance badge moved
 * to the homepage) a "compliance_change". Keeping signal types decoupled from
 * page types is what lets Nova classify by *what actually changed* rather than
 * by *which page it came from*.
 *
 * `other` is the extensible catch-all so a novel signal never fails validation.
 */
export const SIGNAL_TYPES = [
  "pricing_change",
  "hiring_spike",
  "positioning_shift",
  "compliance_change",
  "new_integration",
  "changelog_entry",
  "other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];
