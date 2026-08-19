import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * The output of the match engine: how well one user profile fits one job.
 * This is the product's core artifact — `missingSkills` is the thing that makes
 * the app useful ("you're a 78% fit, missing: Kubernetes, gRPC"), so we store it
 * explicitly rather than recomputing on read.
 */
const MatchResultSchema = new Schema(
  {
    userProfileId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },
    jobListingId: {
      type: Schema.Types.ObjectId,
      ref: "JobListing",
      required: true,
      index: true,
    },

    // 0–100. Overlap-based score (see lib/matchEngine.ts).
    fitPercentage: { type: Number, required: true, min: 0, max: 100 },

    // Required skills the user has vs. is missing. These are the demo money shot.
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },

    computedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// One match row per (user, job). Recomputing overwrites rather than duplicates.
MatchResultSchema.index({ userProfileId: 1, jobListingId: 1 }, { unique: true });

export type MatchResultDoc = InferSchemaType<typeof MatchResultSchema> & {
  userProfileId: Types.ObjectId;
  jobListingId: Types.ObjectId;
};

export const MatchResult: Model<MatchResultDoc> =
  (models.MatchResult as Model<MatchResultDoc>) ||
  model<MatchResultDoc>("MatchResult", MatchResultSchema);
