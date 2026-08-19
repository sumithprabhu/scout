import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A user's skill profile. No auth yet (out of scope), so we key the profile by
 * a free-form `identity` string — an email or a session id. This is the one
 * knob that will later become a real authenticated user id; keeping it as a
 * single indexed field now means the auth swap is localized.
 */
const UserProfileSchema = new Schema(
  {
    identity: { type: String, required: true, unique: true, index: true },

    // Normalized (lowercased) skill tokens the user claims. Stored normalized so
    // the match engine compares apples to apples with ParsedJD.requiredSkills.
    skills: { type: [String], default: [] },

    // Optional raw resume text. Not parsed today, but stored so we can later
    // derive skills from it instead of relying on manual entry.
    resumeText: { type: String, default: "" },
  },
  { timestamps: true }
);

export type UserProfileDoc = InferSchemaType<typeof UserProfileSchema>;

export const UserProfile: Model<UserProfileDoc> =
  (models.UserProfile as Model<UserProfileDoc>) ||
  model<UserProfileDoc>("UserProfile", UserProfileSchema);
