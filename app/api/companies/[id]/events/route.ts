import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { SignalEvent } from "@/models/SignalEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * GET /api/companies/:id/events?limit=
 * SignalEvents for one company, newest first. Served by the
 * (companyId, detectedAt desc) compound index — no in-memory sort.
 */
export async function GET(req: Request, { params }: Ctx) {
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "invalid company id" }, { status: 400 });
  }
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50), 200);

  await connectDB();
  const events = await SignalEvent.find({ companyId: params.id })
    .sort({ detectedAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    companyId: params.id,
    count: events.length,
    events: events.map((e) => ({
      signalEventId: String(e._id),
      trackedPageId: String(e.trackedPageId),
      signalType: e.signalType,
      severity: e.severity,
      summary: e.summary,
      diffDetail: e.diffDetail,
      detectedAt: e.detectedAt,
    })),
  });
}
