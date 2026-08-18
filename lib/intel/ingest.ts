import { connectDB } from "@/lib/db";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { Company } from "@/models/Company";
import { computeDiff } from "@/lib/diff/computeDiff";
import { classifySignal } from "@/lib/classify/classifySignal";
import type { PageType } from "@/lib/intel/types";

/**
 * The ingest pipeline: one scraped page result -> a versioned Snapshot, then
 * diff-vs-previous -> (maybe) a classified SignalEvent.
 *
 * This is deliberately its own module (not in the webhook route) so the exact
 * same pipeline can be driven by (a) the real Bright Data webhook, (b) a manual
 * "run now" trigger, or (c) a test harness feeding real scraped rows — the route
 * stays a thin HTTP shell. Never throws on classification failure; a snapshot is
 * always stored even if diffing/Nova hiccups.
 */

export interface IngestInput {
  trackedPageId: string;
  extractedFields: Record<string, unknown>;
  rawContent?: string;
}

export interface IngestOutcome {
  trackedPageId: string;
  versionNumber: number;
  /** Why no signal was produced, when applicable. */
  reason?: "first-snapshot" | "no-meaningful-change";
  signalEventId?: string;
  signalType?: string;
  severity?: string;
  summary?: string;
  changeCount?: number;
}

async function nextVersionNumber(trackedPageId: string): Promise<number> {
  const latest = await Snapshot.findOne({ trackedPageId })
    .sort({ versionNumber: -1 })
    .select("versionNumber")
    .lean();
  return (latest?.versionNumber ?? 0) + 1;
}

export async function ingestSnapshot(input: IngestInput): Promise<IngestOutcome> {
  await connectDB();

  const page = await TrackedPage.findById(input.trackedPageId).lean();
  if (!page) throw new Error(`ingestSnapshot: TrackedPage ${input.trackedPageId} not found`);

  // Previous snapshot BEFORE we insert the new one, so the diff compares N-1 vs N.
  const prev = await Snapshot.findOne({ trackedPageId: input.trackedPageId })
    .sort({ versionNumber: -1 })
    .lean();

  const version = (prev?.versionNumber ?? 0) + 1;
  await Snapshot.create({
    trackedPageId: input.trackedPageId,
    extractedFields: input.extractedFields,
    rawContent: input.rawContent ?? "",
    versionNumber: version,
  });

  await TrackedPage.updateOne(
    { _id: input.trackedPageId },
    { $set: { lastScrapedAt: new Date() } }
  );

  // First snapshot: nothing to diff against — establish the baseline, no signal.
  if (!prev) {
    return { trackedPageId: input.trackedPageId, versionNumber: version, reason: "first-snapshot" };
  }

  const diff = computeDiff(prev.extractedFields, input.extractedFields);
  if (!diff) {
    // Noise-only or identical -> no-op. This is the "same run twice" case.
    return { trackedPageId: input.trackedPageId, versionNumber: version, reason: "no-meaningful-change" };
  }

  const company = await Company.findById(page.companyId).select("name").lean();
  const companyName = company?.name ?? "Company";

  const classified = await classifySignal(page.pageType as PageType, companyName, diff);

  const event = await SignalEvent.create({
    companyId: page.companyId,
    trackedPageId: input.trackedPageId,
    signalType: classified.signalType,
    summary: classified.summary,
    diffDetail: { changes: diff.changes, counts: diff.summaryCounts },
    severity: classified.severity,
    detectedAt: new Date(),
  });

  return {
    trackedPageId: input.trackedPageId,
    versionNumber: version,
    signalEventId: String(event._id),
    signalType: classified.signalType,
    severity: classified.severity,
    summary: classified.summary,
    changeCount: diff.changes.length,
  };
}
