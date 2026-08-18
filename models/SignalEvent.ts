import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { SIGNAL_TYPES, SEVERITIES } from "@/lib/intel/types";

/**
 * A classified change — the product's actual output. Produced when a non-trivial
 * diff between two Snapshots is run through Nova. This is what the /api/events
 * feeds read from; diffs and snapshots are plumbing, SignalEvents are the signal.
 *
 * diffDetail is intentionally Mixed: a pricing change carries {field, oldValue,
 * newValue}, a hiring spike carries {addedRoles[], removedRoles[]}, etc. The
 * classifier writes whatever shape best describes the change; the feed just
 * renders summary + severity, so no rigid schema is needed here.
 */
const SignalEventSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    trackedPageId: { type: Schema.Types.ObjectId, ref: "TrackedPage", required: true, index: true },
    signalType: { type: String, enum: SIGNAL_TYPES, required: true, index: true },
    // The LLM-written human-readable one-liner shown in the feed.
    summary: { type: String, required: true },
    diffDetail: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, default: () => new Date(), index: true },
    severity: { type: String, enum: SEVERITIES, default: "low" },
  },
  { timestamps: true }
);

// The global + per-company feeds both sort by detectedAt desc; this compound
// index serves the per-company feed without a separate sort stage.
SignalEventSchema.index({ companyId: 1, detectedAt: -1 });

export type SignalEventDoc = InferSchemaType<typeof SignalEventSchema>;

export const SignalEvent: Model<SignalEventDoc> =
  (models.SignalEvent as Model<SignalEventDoc>) ||
  model<SignalEventDoc>("SignalEvent", SignalEventSchema);
