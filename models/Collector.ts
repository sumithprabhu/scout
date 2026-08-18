import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { PAGE_TYPES } from "@/lib/intel/types";

/**
 * Registry of Bright Data collectors keyed by the EXACT URL they scrape.
 *
 * WHY THIS EXISTS (not folded into TrackedPage): the spec requires idempotent
 * collector creation deduped *by URL, not by company* — "two companies could
 * share infra, and one company might get re-added". TrackedPage is per-company
 * (unique on companyId+pageType), so it can't be the dedup key for a URL that
 * two companies might share. This registry is the single source of truth for
 * "does a collector already exist for this URL?": createPageCollector() looks
 * here first and reuses the collectorId instead of spending another AI build.
 *
 * The unique index on url is what makes creation race-safe: two concurrent
 * discovery runs for the same URL can't both create a collector — the second
 * findOneAndUpdate reuses the first's row.
 */
const CollectorSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    collectorId: { type: String, required: true },
    // The extraction prompt is page-type-specific, so a collector is tied to the
    // page type it was built for (a pricing collector != a careers collector even
    // for the same host).
    pageType: { type: String, enum: PAGE_TYPES, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Dedup key: one collector per exact URL. This is the idempotency guard.
CollectorSchema.index({ url: 1 }, { unique: true });

export type CollectorDoc = InferSchemaType<typeof CollectorSchema>;

export const Collector: Model<CollectorDoc> =
  (models.Collector as Model<CollectorDoc>) ||
  model<CollectorDoc>("Collector", CollectorSchema);
