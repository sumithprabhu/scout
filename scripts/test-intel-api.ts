/**
 * Real-HTTP test of every company-intel API route against a running `next dev`.
 *
 *   npx next dev -p 3111           # in one shell
 *   npx tsx scripts/test-intel-api.ts   # in another (or set BASE)
 *
 * Exercises the routes end-to-end over HTTP (not function calls):
 *  - POST /api/companies (discover:false so it's fast + deterministic) + rate limit
 *  - GET  /api/companies
 *  - POST /api/companies/:id/pages  (manual page correction — the human-fix flow)
 *  - GET  /api/companies/:id/pages
 *  - POST /api/webhook/scrape-result  (real Bright-Data-shaped payload -> ingest)
 *  - GET  /api/companies/:id/events
 *  - GET  /api/events  (+ signalType filter + validation)
 *
 * The webhook calls drive the REAL ingest pipeline (diff + Nova classify), so
 * this also re-proves Step 4 over the wire. Cleans up via direct DB at the end.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { normalizePageUrl } from "@/lib/intel/url";

const BASE = process.env.BASE ?? "http://localhost:3111";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function j(res: Response) { return { status: res.status, body: await res.json().catch(() => ({})) }; }

async function main() {
  const tag = `httptest-${Date.now()}`;
  const email = `${tag}@test.dev`;
  const rootUrl = `${tag}.example.com`;
  const pricingUrl = normalizePageUrl(`${tag}.example.com/pricing`)!;

  console.log(`\nBASE=${BASE}\n`);

  // 1) POST /api/companies (discover:false to keep it fast/deterministic)
  console.log("POST /api/companies:");
  const create = await j(await fetch(`${BASE}/api/companies`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: rootUrl, name: `Acme ${tag}`, email, discover: false }),
  }));
  check("201 created", create.status === 201, `status=${create.status} ${JSON.stringify(create.body)}`);
  const companyId = create.body.companyId;
  check("returns companyId", !!companyId);
  check("rootUrl normalized to https origin", create.body.rootUrl === `https://${rootUrl}`, create.body.rootUrl);

  // Idempotency: re-POST same url -> same companyId
  const create2 = await j(await fetch(`${BASE}/api/companies`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: `https://www.${rootUrl}/`, email, discover: false }),
  }));
  check("re-add same company is idempotent (same id)", create2.body.companyId === companyId, `${create2.body.companyId}`);

  // Validation: bad url -> 400
  const bad = await j(await fetch(`${BASE}/api/companies`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "", email }),
  }));
  check("empty url -> 400", bad.status === 400);

  // 2) GET /api/companies
  console.log("\nGET /api/companies:");
  const list = await j(await fetch(`${BASE}/api/companies`));
  check("200 + our company present", list.status === 200 && list.body.companies.some((c: any) => c.companyId === companyId));

  // 3) POST /api/companies/:id/pages — MANUAL PAGE CORRECTION (human fix)
  console.log("\nPOST /api/companies/:id/pages (manual correction):");
  const addPage = await j(await fetch(`${BASE}/api/companies/${companyId}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "pricing", url: `${tag}.example.com/pricing/?utm=x` }),
  }));
  check("200 page upserted", addPage.status === 200, JSON.stringify(addPage.body));
  check("url normalized (utm dropped, trailing slash gone)", addPage.body.url === pricingUrl, addPage.body.url);
  check("status = discovering (needs a collector)", addPage.body.status === "discovering");
  const trackedPageId = addPage.body.trackedPageId;

  // correct it to a different url -> same page row, url replaced, collector cleared
  const correct = await j(await fetch(`${BASE}/api/companies/${companyId}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "pricing", url: `${tag}.example.com/plans` }),
  }));
  check("correction updates same row (same trackedPageId)", correct.body.trackedPageId === trackedPageId, `${correct.body.trackedPageId}`);
  check("corrected url applied", correct.body.url === normalizePageUrl(`${tag}.example.com/plans`));

  // put it back to /pricing and flip active so the webhook can ingest it
  await fetch(`${BASE}/api/companies/${companyId}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "pricing", url: pricingUrl }),
  });
  await connectDB();
  await TrackedPage.updateOne({ _id: trackedPageId }, { $set: { status: "active", collectorId: "c_http_test" } });

  // invalid pageType -> 400
  const badType = await j(await fetch(`${BASE}/api/companies/${companyId}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "docs", url: `${tag}.example.com/docs` }),
  }));
  check("invalid pageType -> 400", badType.status === 400);

  // 4) GET /api/companies/:id/pages
  console.log("\nGET /api/companies/:id/pages:");
  const pages = await j(await fetch(`${BASE}/api/companies/${companyId}/pages`));
  check("200 + pricing page listed active", pages.status === 200 &&
    pages.body.pages.some((p: any) => p.pageType === "pricing" && p.status === "active"));

  // 5) POST /api/webhook/scrape-result — real Bright-Data-shaped delivery
  console.log("\nPOST /api/webhook/scrape-result (baseline then change):");
  const deliver = (fields: any) => fetch(
    `${BASE}/api/webhook/scrape-result?pageUrl=${encodeURIComponent(pricingUrl)}`,
    { method: "POST", headers: { "content-type": "application/json" },
      // Bright Data delivers an array of rows, with input echo + our fields.
      body: JSON.stringify([{ input: { url: pricingUrl }, ...fields }]) }
  );
  const w1 = await j(await deliver({ plans: [{ name: "Pro", price: "$50" }], has_free_tier: false }));
  check("webhook v1 accepted (baseline)", w1.status === 200, JSON.stringify(w1.body));
  check("v1 outcome = first-snapshot", w1.body.outcomes?.[0]?.reason === "first-snapshot");

  const w2 = await j(await deliver({ plans: [{ name: "Pro", price: "$50 " }], has_free_tier: false })); // noise
  check("webhook v2 no-op (no real change)", w2.body.outcomes?.[0]?.reason === "no-meaningful-change", JSON.stringify(w2.body.outcomes));

  const w3 = await j(await deliver({ plans: [{ name: "Pro", price: "$75" }, { name: "Team", price: "$200" }], has_free_tier: false }));
  check("webhook v3 produced a signal", !!w3.body.outcomes?.[0]?.signalEventId, JSON.stringify(w3.body.outcomes));
  check("v3 signalType = pricing_change", w3.body.outcomes?.[0]?.signalType === "pricing_change");
  console.log(`     feed summary: "${w3.body.outcomes?.[0]?.summary}"`);

  // webhook with unknown pageUrl -> 404
  const w404 = await j(await fetch(`${BASE}/api/webhook/scrape-result?pageUrl=${encodeURIComponent("https://nope.example.com/x")}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ a: 1 }]) }));
  check("webhook unknown page -> 404", w404.status === 404);

  // 6) GET /api/companies/:id/events
  console.log("\nGET /api/companies/:id/events:");
  const cEvents = await j(await fetch(`${BASE}/api/companies/${companyId}/events`));
  check("200 + exactly 1 event", cEvents.status === 200 && cEvents.body.count === 1, `count=${cEvents.body.count}`);
  check("event has summary + severity", !!cEvents.body.events?.[0]?.summary && !!cEvents.body.events?.[0]?.severity);

  // 7) GET /api/events (global + filter)
  console.log("\nGET /api/events (global feed + filters):");
  const feed = await j(await fetch(`${BASE}/api/events?signalType=pricing_change&limit=100`));
  check("200 + our event present with companyName joined", feed.status === 200 &&
    feed.body.events.some((e: any) => e.companyId === companyId && e.companyName === `Acme ${tag}`));
  const feedWrong = await j(await fetch(`${BASE}/api/events?signalType=hiring_spike&limit=100`));
  check("filter excludes non-matching type", !feedWrong.body.events.some((e: any) => e.companyId === companyId));
  const feedBad = await j(await fetch(`${BASE}/api/events?signalType=not_a_type`));
  check("invalid signalType -> 400", feedBad.status === 400);

  // 8) Rate limiting on POST /api/companies
  console.log("\nRate limiting (POST /api/companies):");
  const rlEmail = `rl-${tag}@test.dev`;
  const limit = Number(process.env.COMPANY_RATE_LIMIT_PER_DAY ?? 10);
  let got429 = false, lastRemaining = -1;
  for (let i = 0; i < limit + 2; i++) {
    const r = await fetch(`${BASE}/api/companies`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: `rl-${tag}-${i}.example.com`, email: rlEmail, discover: false }),
    });
    if (r.status === 429) got429 = true;
    else lastRemaining = Number(r.headers.get("x-ratelimit-remaining") ?? lastRemaining);
  }
  check(`hits 429 after ${limit} adds/day`, got429);

  // ---- cleanup ----
  console.log("\ncleaning up...");
  await connectDB();
  const rlCompanies = await Company.find({ rootUrl: { $regex: `rl-${tag}` } }).select("_id").lean();
  const allCompanyIds = [companyId, ...rlCompanies.map((c) => String(c._id))];
  await Promise.all([
    SignalEvent.deleteMany({ companyId: { $in: allCompanyIds } }),
    Snapshot.deleteMany({ trackedPageId }),
    TrackedPage.deleteMany({ companyId: { $in: allCompanyIds } }),
    Company.deleteMany({ _id: { $in: allCompanyIds } }),
  ]);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-intel-api failed:", e); process.exit(1); });
