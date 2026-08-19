/**
 * Build specs for the four Bright Data Scraper Studio collectors.
 *
 * Each entry is fed to:  bdata scraper create <sampleUrl> "<description>"
 * which returns a collector_id we then put in .env. The `description` is
 * deliberately worded to make the AI emit the exact field names our per-source
 * normalizers (lib/scrapers/sources/*) read. Sample URLs are verified live.
 *
 * Descriptions must be <= 500 chars (a hard CLI limit).
 */
import type { JobSource } from "@/lib/types";

export interface CollectorSpec {
  source: JobSource;
  /** --name passed to `scraper create`; also the .env var stem. */
  name: string;
  envVar: string;
  /** A currently-live page with the target structure. */
  sampleUrl: string;
  /** Natural-language extraction spec (<=500 chars). */
  description: string;
}

export const COLLECTOR_SPECS: CollectorSpec[] = [
  {
    source: "greenhouse",
    name: "job-matcher-greenhouse",
    envVar: "BRIGHTDATA_COLLECTOR_GREENHOUSE",
    // Rendered board (JS). Stripe redirects off-domain, so use a company whose
    // board renders on job-boards.greenhouse.io (gitlab/discord/anthropic).
    sampleUrl: "https://job-boards.greenhouse.io/gitlab",
    description:
      "This is a JavaScript-rendered company careers board. Discover EVERY job posting listed, then for " +
      "each posting open its detail page and extract: title, location, department, description_text (the " +
      "complete job description as plain text), apply_url (the posting's detail-page URL). Output one record per job.",
  },
  {
    source: "lever",
    name: "job-matcher-lever",
    envVar: "BRIGHTDATA_COLLECTOR_LEVER",
    sampleUrl: "https://jobs.lever.co/spotify",
    description:
      "This is a JavaScript-rendered company jobs board. Discover EVERY job posting listed, then for each " +
      "posting open its detail page and extract: title, location, department, description (the complete job " +
      "description as plain text), apply_url (the posting's detail-page URL). Output one record per job.",
  },
  {
    source: "workday",
    name: "job-matcher-workday",
    envVar: "BRIGHTDATA_COLLECTOR_WORKDAY",
    // A live, well-known Workday board. Swap for any tenant you like.
    sampleUrl: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
    description:
      "This is a JavaScript-rendered Workday careers board. Scroll and paginate to load ALL jobs in the " +
      "results list. For each job, open its detail page and extract: title, location, description (the " +
      "complete job description as plain text), apply_url (the job's detail-page URL). Output one record per job.",
  },
  {
    source: "naukri",
    name: "job-matcher-naukri",
    envVar: "BRIGHTDATA_COLLECTOR_NAUKRI",
    sampleUrl: "https://www.naukri.com/backend-developer-jobs",
    description:
      "This is a Naukri job-search results page. Extract every job result card. Output one record per card " +
      "with fields: title (the role), company (employer name), location, description (the visible role " +
      "snippet), apply_url (the link to the job detail page), posted_date (e.g. '3 days ago' if shown).",
  },
];
