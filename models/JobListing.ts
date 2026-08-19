import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { JOB_SOURCES } from "@/lib/types";

/**
 * A single raw job posting as scraped from a source board. This is the
 * "source of truth" for a job before any AI touches it — we deliberately store
 * the full raw description text so we can re-parse later with a better prompt
 * without re-scraping (which costs Bright Data credits).
 */
const JobListingSchema = new Schema(
  {
    source: { type: String, enum: JOB_SOURCES, required: true },
    companyName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    rawDescriptionText: { type: String, required: true },
    postedDate: { type: Date, default: null },
    applyUrl: { type: String, required: true, trim: true },

    // Which Bright Data collector produced this row. Kept for the demo/README
    // audit trail ("this job came from collector X") and debugging.
    collectorId: { type: String, required: true },

    scrapedAt: { type: Date, default: () => new Date() },

    // Denormalized flag so /api/parse can cheaply find work to do
    // (JobListings without a ParsedJD yet) without an expensive anti-join.
    isParsed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Dedup guard: the same posting scraped twice (same source + apply URL) should
// not create duplicate rows. Bright Data runs are idempotent-ish this way.
JobListingSchema.index({ source: 1, applyUrl: 1 }, { unique: true });

export type JobListingDoc = InferSchemaType<typeof JobListingSchema>;

// `models.X ?? model(...)` guard: in dev, hot reload re-runs this module. Calling
// model() twice for the same name throws OverwriteModelError, so we reuse the
// already-compiled model if present.
export const JobListing: Model<JobListingDoc> =
  (models.JobListing as Model<JobListingDoc>) ||
  model<JobListingDoc>("JobListing", JobListingSchema);
