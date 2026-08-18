import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One scrape result for one TrackedPage at one point in time. Snapshots are
 * append-only and versioned per page, so diffing is just "compare version N
 * against version N-1 for the same trackedPageId".
 *
 * We store BOTH rawContent (the collector's raw text/HTML-ish payload) and
 * extractedFields (the structured, page-type-specific fields the collector's
 * extraction prompt produced). Keeping raw lets us re-derive extractedFields
 * later with a better prompt without re-scraping (re-scraping costs credits) —
 * the same "store raw so you can re-parse for free" discipline the job-matcher
 * used for JD text.
 */
const SnapshotSchema = new Schema(
  {
    trackedPageId: { type: Schema.Types.ObjectId, ref: "TrackedPage", required: true, index: true },
    rawContent: { type: String, default: "" },
    // Structured, per-page-type fields (Mixed: pricing has plans[], careers has
    // jobs[], trust has certifications[], etc.). Shape is enforced at the
    // extraction/diff layer, not the schema, so a new page type needs no migration.
    extractedFields: { type: Schema.Types.Mixed, default: {} },
    scrapedAt: { type: Date, default: () => new Date() },
    versionNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

// Fast "give me the latest snapshot for this page" + guards against two
// snapshots claiming the same version for the same page.
SnapshotSchema.index({ trackedPageId: 1, versionNumber: -1 }, { unique: true });

export type SnapshotDoc = InferSchemaType<typeof SnapshotSchema>;

export const Snapshot: Model<SnapshotDoc> =
  (models.Snapshot as Model<SnapshotDoc>) ||
  model<SnapshotDoc>("Snapshot", SnapshotSchema);
