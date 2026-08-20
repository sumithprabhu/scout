import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Temporary beta lock: for the first few days after launch, only the landing
 * page ("/") should be reachable. Every other route bounces back to "/".
 *
 * Gated to an actual Vercel *production* deploy (VERCEL_ENV, set only by
 * Vercel's own build/runtime — never present locally), so `npm run dev`, a
 * local `next build && next start`, and Vercel *preview* deployments are all
 * unaffected and the full app keeps working there.
 *
 * API routes are exempt: the landing page's own interactive demo panel fetches
 * /api/events and /api/companies client-side, and Bright Data's scheduled
 * scrapers keep POSTing to /api/webhook/scrape-result regardless — blocking
 * either would break the landing's live data or silently drop real signals.
 */
const BETA_GATE = process.env.VERCEL_ENV === "production";

const ALLOWED_PREFIXES = ["/api", "/_next", "/icon.svg", "/favicon.ico"];

export function middleware(req: NextRequest) {
  if (!BETA_GATE) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/" || ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
