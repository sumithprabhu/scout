// Shared enums/types used across models, scrapers, and the parser.

export const JOB_SOURCES = ["greenhouse", "lever", "workday", "naukri"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "staff",
  "lead",
  "principal",
  "manager",
  "unknown",
] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

/**
 * The normalized shape every scraper collector must emit before we write it to
 * the JobListing collection. Keeping this contract in one place is what lets the
 * four very different sources (Greenhouse/Lever/Workday/Naukri) flow through the
 * same storage + parse + match pipeline.
 */
export interface NormalizedJob {
  source: JobSource;
  companyName: string;
  title: string;
  location: string;
  rawDescriptionText: string;
  applyUrl: string;
  postedDate: Date | null;
  collectorId: string;
}
