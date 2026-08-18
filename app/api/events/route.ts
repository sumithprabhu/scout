import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SignalEvent } from "@/models/SignalEvent";
import { Company } from "@/models/Company";
import { SIGNAL_TYPES, type SignalType } from "@/lib/intel/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events?signalType=&severity=&limit=
 * The global cross-company feed, newest first, filterable by signalType (and, as
 * a bonus, severity). This is the product's headline view: "what changed across
 * everyone we track". Company name is joined in so the feed is self-describing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const signalType = url.searchParams.get("signalType");
  const severity = url.searchParams.get("severity");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const filter: Record<string, unknown> = {};
  if (signalType) {
    if (!(SIGNAL_TYPES as readonly string[]).includes(signalType)) {
      return NextResponse.json(
        { error: `signalType must be one of: ${SIGNAL_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    filter.signalType = signalType as SignalType;
  }
  if (severity) filter.severity = severity;

  await connectDB();
  const events = await SignalEvent.find(filter)
    .sort({ detectedAt: -1 })
    .limit(limit)
    .lean();

  // Join company names in one query (feed is small; avoids N populate calls).
  const companyIds = [...new Set(events.map((e) => String(e.companyId)))];
  const companies = await Company.find({ _id: { $in: companyIds } })
    .select("name rootUrl")
    .lean();
  const nameById = new Map(companies.map((c) => [String(c._id), c.name]));

  return NextResponse.json({
    count: events.length,
    filter: { signalType: signalType ?? null, severity: severity ?? null },
    events: events.map((e) => ({
      signalEventId: String(e._id),
      companyId: String(e.companyId),
      companyName: nameById.get(String(e.companyId)) ?? null,
      trackedPageId: String(e.trackedPageId),
      signalType: e.signalType,
      severity: e.severity,
      summary: e.summary,
      // Included so global-feed cards can expand into the old->new diff without a
      // second fetch. Small payload cost; the feed is capped at `limit`.
      diffDetail: e.diffDetail,
      detectedAt: e.detectedAt,
    })),
  });
}
