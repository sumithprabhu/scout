import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { SignalEvent } from "@/models/SignalEvent";
import { Snapshot } from "@/models/Snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * DELETE /api/companies/:id — stop tracking a company and remove its data.
 *
 * Cascades to the company's TrackedPages, their Snapshots, and its SignalEvents.
 * Deliberately does NOT delete Collectors: those are deduped/shared by URL across
 * companies (models/Collector.ts), so removing one company must not orphan another
 * company's scraping. The collector simply stops being referenced.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "invalid company id" }, { status: 400 });
  }

  await connectDB();

  const company = await Company.findById(params.id).lean();
  if (!company) {
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  }

  const pages = await TrackedPage.find({ companyId: params.id }).select("_id").lean();
  const pageIds = pages.map((p) => p._id);

  const [snaps, events] = await Promise.all([
    pageIds.length ? Snapshot.deleteMany({ trackedPageId: { $in: pageIds } }) : Promise.resolve({ deletedCount: 0 }),
    SignalEvent.deleteMany({ companyId: params.id }),
  ]);
  await TrackedPage.deleteMany({ companyId: params.id });
  await Company.deleteOne({ _id: params.id });

  return NextResponse.json({
    deleted: {
      company: 1,
      trackedPages: pageIds.length,
      snapshots: snaps.deletedCount ?? 0,
      signalEvents: events.deletedCount ?? 0,
    },
  });
}
