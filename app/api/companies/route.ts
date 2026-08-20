import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { normalizeRootUrl } from "@/lib/intel/url";
import { checkRateLimit, resolveIdentity } from "@/lib/rateLimit";
import { discoverForCompany } from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The waitUntil'd discovery scrape below can run up to ~75s (the add-company UI
// polls that long before falling back to manual entry) — raise Vercel's default
// function timeout so it isn't killed mid-scrape. Hobby caps at 60s; Pro allows
// this in full. On Hobby, discovery will still just run until the platform cap.
export const maxDuration = 90;

/**
 * POST /api/companies  { url, name?, email?, discover? }
 * Adds (or re-adds, idempotently) a company and kicks off discovery.
 *
 * RATE LIMITED (hard requirement): this is the expensive door — it triggers a
 * discovery scrape and, after confirmation, collector builds + recurring scrape
 * cost. We reuse the job-matcher's Mongo-backed per-identity/day limiter
 * (survives restarts, shared across instances) rather than an in-memory counter.
 *
 * Discovery runs FIRE-AND-FORGET: we create the company, return immediately, and
 * let discovery populate TrackedPages in the background (poll GET .../pages to
 * watch them appear). Awaiting a multi-minute scrape would make this HTTP call
 * hang.
 *
 * Background work after `return` is unsafe on serverless (Vercel can freeze the
 * function the instant the response is sent, killing the in-flight scrape), so
 * the discovery promise is handed to @vercel/functions' `waitUntil()`, which
 * extends the function's lifetime until it settles. Off Vercel (local `next dev`,
 * a self-hosted Node server) `waitUntil` is a no-op and the promise just keeps
 * running on the long-lived process — same fire-and-forget behavior as before.
 * Pass { discover: false } to skip discovery (used by tests / manual page entry).
 */
export async function POST(req: Request) {
  let body: { url?: string; name?: string; email?: string; discover?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rootUrl = normalizeRootUrl(body.url ?? "");
  if (!rootUrl) {
    return NextResponse.json({ error: "a valid company url is required" }, { status: 400 });
  }

  const limit = Number(process.env.COMPANY_RATE_LIMIT_PER_DAY ?? 10);
  const identity = resolveIdentity(req, body.email);
  const rl = await checkRateLimit(identity, limit);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Daily company-add limit reached", limit: rl.limit, identity: rl.identity },
      { status: 429, headers: { "x-ratelimit-remaining": String(rl.remaining) } }
    );
  }

  await connectDB();
  // Derive a display name from the host if none given.
  const name = body.name?.trim() || rootUrl.replace(/^https?:\/\//, "");

  // Idempotent on rootUrl: re-adding returns the existing company.
  const company = await Company.findOneAndUpdate(
    { rootUrl },
    { $setOnInsert: { rootUrl, name, createdAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const shouldDiscover = body.discover !== false;
  if (shouldDiscover) {
    // Don't await the multi-minute discovery scrape; waitUntil keeps it alive
    // past the response on serverless (no-op, still fire-and-forget, elsewhere).
    waitUntil(
      discoverForCompany(String(company._id)).catch((err) =>
        console.error("[/api/companies] discovery failed:", err.message)
      )
    );
  }

  return NextResponse.json(
    {
      companyId: String(company._id),
      name: company.name,
      rootUrl: company.rootUrl,
      discovery: shouldDiscover ? "started" : "skipped",
      rateLimitRemaining: rl.remaining,
    },
    { status: 201 }
  );
}

/** GET /api/companies — list tracked companies (newest first). */
export async function GET() {
  await connectDB();
  const companies = await Company.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    count: companies.length,
    companies: companies.map((c) => ({
      companyId: String(c._id),
      name: c.name,
      rootUrl: c.rootUrl,
      createdAt: c.createdAt,
    })),
  });
}
