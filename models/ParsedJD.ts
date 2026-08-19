import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";
import { SENIORITY_LEVELS } from "@/lib/types";

/**
 * The structured output of running a JobListing's raw text through Claude.
 * One ParsedJD per JobListing. Skills are stored lowercased/normalized (see
 * lib/jdParser.ts) so the match engine can do case-insensitive set overlap
 * without re-normalizing on every comparison.
 */
const ParsedJDSchema = new Schema(
  {
    jobListingId: {
      type: Schema.Types.ObjectId,
      ref: "JobListing",
      required: true,
      unique: true, // one parse per listing
      index: true,
    },
    requiredSkills: { type: [String], default: [] },
    niceToHaveSkills: { type: [String], default: [] },
    seniorityLevel: {
      type: String,
      enum: SENIORITY_LEVELS,
      default: "unknown",
    },

    // Whether the parser had to fall back / found the text too messy to trust.
    // Lets us surface low-confidence parses in the UI later instead of silently
    // matching against garbage.
    parseConfidence: {
      type: String,
      enum: ["high", "low"],
      default: "high",
    },

    extractedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export type ParsedJDDoc = InferSchemaType<typeof ParsedJDSchema> & {
  jobListingId: Types.ObjectId;
};

export const ParsedJD: Model<ParsedJDDoc> =
  (models.ParsedJD as Model<ParsedJDDoc>) ||
  model<ParsedJDDoc>("ParsedJD", ParsedJDSchema);
