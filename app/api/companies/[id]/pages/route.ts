import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { normalizePageUrl } from "@/lib/intel/url";
import { PAGE_TYPES, type PageType } from "@/lib/intel/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * GET /api/companies/:id/pages
 * The "confirm what discovery found" view: every TrackedPage for the company
 * with its status (discovering / active / broken) and collector binding.
 */
export async function GET(_req: Request, { params }: Ctx) {
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "invalid company id" }, { status: 400 });
  }
  await connectDB();
  const pages = await TrackedPage.find({ companyId: params.id }).lean();

  // Discovery-health summary the UX uses to prompt manual entry. Derived from
  // current DB state (discovery is fire-and-forget, so this reflects whatever
  // discovery has populated so far). `missingPageTypes` tells the UI exactly
  // which types to offer a manual "add URL" field for.
  const presentTypes = new Set(pages.map((p) => p.pageType));
  const missingPageTypes = PAGE_TYPES.filter((t) => !presentTypes.has(t));
  const nonHomepageCount = pages.filter((p) => p.pageType !== "homepage").length;
  // Weak discovery = nothing usable beyond the homepage. Common when the
  // collector returns sample data and the same-site guard drops it — the UX
  // should then ask the user to add pages by hand (POST this endpoint).
  const suggestManualEntry = nonHomepageCount === 0;

  return NextResponse.json({
    companyId: params.id,
    count: pages.length,
    discovery: {
      suggestManualEntry,
      missingPageTypes,
      message: suggestManualEntry
        ? "Automatic discovery found no usable pages beyond the homepage (the site's structure may not have scraped cleanly). Add page URLs manually via POST /api/companies/:id/pages."
        : null,
    },
    pages: pages.map((p) => ({
      trackedPageId: String(p._id),
      pageType: p.pageType,
      url: p.url,
      status: p.status,
      collectorId: p.collectorId,
      lastScrapedAt: p.lastScrapedAt,
    })),
  });
}

/**
 * POST /api/companies/:id/pages  { pageType, url }
 * Manually add or CORRECT a page URL when discovery missed or mis-guessed one —
 * the human-in-the-loop fix. Upserts on (companyId, pageType), so correcting an
 * existing page overwrites its URL and resets it to `discovering` (a corrected
 * URL needs a fresh collector, so we clear the old binding).
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "invalid company id" }, { status: 400 });
  }

  let body: { pageType?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.pageType || !(PAGE_TYPES as readonly string[]).includes(body.pageType)) {
    return NextResponse.json(
      { error: `pageType must be one of: ${PAGE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  const url = normalizePageUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json({ error: "a valid page url is required" }, { status: 400 });
  }

  await connectDB();
  const company = await Company.findById(params.id).lean();
  if (!company) {
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  }

  const page = await TrackedPage.findOneAndUpdate(
    { companyId: params.id, pageType: body.pageType as PageType },
    {
      // Correcting a URL invalidates any collector bound to the old URL.
      $set: { url, status: "discovering", collectorId: null },
      $setOnInsert: { companyId: params.id, pageType: body.pageType as PageType },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json(
    {
      trackedPageId: String(page._id),
      pageType: page.pageType,
      url: page.url,
      status: page.status,
      collectorId: page.collectorId,
    },
    { status: 200 }
  );
}
