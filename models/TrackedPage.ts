import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { PAGE_TYPES, PAGE_STATUSES } from "@/lib/intel/types";

/**
 * One tracked public page of a company (its pricing page, its careers page, ...).
 * This is the unit that gets a Bright Data collector and a schedule.
 *
 * collectorId is nullable because a page exists in `discovering` status BEFORE
 * its collector is created (discovery proposes the URL; the user confirms; only
 * then do we spend the AI-build). Dedup of the underlying collector by URL lives
 * in the Collector registry model, NOT here — see models/Collector.ts.
 */
const TrackedPageSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    pageType: { type: String, enum: PAGE_TYPES, required: true },
    url: { type: String, required: true, trim: true },
    // Set once a collector is created/reused for this URL. Null while discovering.
    collectorId: { type: String, default: null },
    lastScrapedAt: { type: Date, default: null },
    status: { type: String, enum: PAGE_STATUSES, default: "discovering", index: true },
  },
  { timestamps: true }
);

// A company tracks at most one page per page type. Correcting a discovered URL
// (POST /api/companies/:id/pages) upserts on this key instead of duplicating.
TrackedPageSchema.index({ companyId: 1, pageType: 1 }, { unique: true });

export type TrackedPageDoc = InferSchemaType<typeof TrackedPageSchema>;

export const TrackedPage: Model<TrackedPageDoc> =
  (models.TrackedPage as Model<TrackedPageDoc>) ||
  model<TrackedPageDoc>("TrackedPage", TrackedPageSchema);
