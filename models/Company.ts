import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A company we're tracking. The root of the graph: TrackedPages, Snapshots and
 * SignalEvents all hang off a Company.
 *
 * rootUrl is normalized (origin, lowercased, no trailing slash) BEFORE insert by
 * lib/intel/url.ts so the unique index actually dedupes — "Acme.com/" and
 * "https://acme.com" must not create two companies.
 */
const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    rootUrl: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// One company per root URL. Re-adding the same company is idempotent (the POST
// route upserts on this key rather than creating a duplicate).
CompanySchema.index({ rootUrl: 1 }, { unique: true });

export type CompanyDoc = InferSchemaType<typeof CompanySchema>;

export const Company: Model<CompanyDoc> =
  (models.Company as Model<CompanyDoc>) ||
  model<CompanyDoc>("Company", CompanySchema);
