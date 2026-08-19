/**
 * Seed realistic demo data through the REAL ingest pipeline (real Nova summaries,
 * real diffs) so every screen renders with authentic backend output — not mocks.
 *
 *   npx tsx scripts/seed-demo.ts
 *
 * For each scenario it creates a Company + active TrackedPage, ingests a baseline
 * snapshot, then ingests a changed snapshot — which runs the actual diff +
 * Nova classification and stores a real SignalEvent. detectedAt is then spread
 * over the last few days so the feed reads like a live timeline. Idempotent:
 * re-running clears the demo companies first. LEAVES data in place (no cleanup).
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { ingestSnapshot } from "@/lib/intel/ingest";
import { normalizeRootUrl, normalizePageUrl } from "@/lib/intel/url";
import type { PageType } from "@/lib/intel/types";

interface Scenario {
  company: string;
  rootUrl: string;
  pageType: PageType;
  agoMinutes: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

const SCENARIOS: Scenario[] = [
  {
    company: "Vercel", rootUrl: "vercel.com", pageType: "pricing", agoMinutes: 35,
    before: { plans: [{ name: "Hobby", price: "$0" }, { name: "Pro", price: "$20", billing_period: "per user/mo" }], has_free_tier: true },
    after: { plans: [{ name: "Hobby", price: "$0" }, { name: "Pro", price: "$25", billing_period: "per user/mo" }, { name: "Enterprise", price: "Contact us" }], has_free_tier: true },
  },
  {
    company: "Linear", rootUrl: "linear.app", pageType: "careers", agoMinutes: 90,
    before: { total_openings: 11, jobs: [{ title: "Product Engineer" }, { title: "Designer" }] },
    after: { total_openings: 19, jobs: [{ title: "Product Engineer" }, { title: "Designer" }, { title: "Engineering Manager" }, { title: "Account Executive" }, { title: "Solutions Engineer" }] },
  },
  {
    company: "Notion", rootUrl: "notion.so", pageType: "trust", agoMinutes: 240,
    before: { certifications: ["SOC 2 Type II", "GDPR"] },
    after: { certifications: ["SOC 2 Type II", "GDPR", "HIPAA", "ISO 27001"] },
  },
  {
    company: "Ramp", rootUrl: "ramp.com", pageType: "integrations", agoMinutes: 400,
    before: { total_integrations: 40, integrations: [{ name: "QuickBooks" }, { name: "NetSuite" }] },
    after: { total_integrations: 43, integrations: [{ name: "QuickBooks" }, { name: "NetSuite" }, { name: "Slack" }, { name: "Workday" }, { name: "Sage Intacct" }] },
  },
  {
    company: "Stripe", rootUrl: "stripe.com", pageType: "homepage", agoMinutes: 1500,
    before: { headline: "Payments infrastructure for the internet", primary_cta: "Start now" },
    after: { headline: "Financial infrastructure to grow your revenue", primary_cta: "Start with Stripe" },
  },
  {
    company: "Notion", rootUrl: "notion.so", pageType: "changelog", agoMinutes: 2600,
    before: { entries: [{ title: "Improved search", date: "May" }] },
    after: { entries: [{ title: "Notion AI Q&A", date: "Jun" }, { title: "Database automations", date: "Jun" }, { title: "Improved search", date: "May" }] },
  },
  {
    company: "Vercel", rootUrl: "vercel.com", pageType: "changelog", agoMinutes: 3400,
    before: { entries: [{ title: "Edge Config GA" }] },
    after: { entries: [{ title: "Fluid compute" }, { title: "Rolling releases" }, { title: "Edge Config GA" }] },
  },
  {
    company: "Ramp", rootUrl: "ramp.com", pageType: "pricing", agoMinutes: 5000,
    before: { plans: [{ name: "Ramp", price: "$0" }, { name: "Ramp Plus", price: "$15", billing_period: "per user/mo" }], has_free_tier: true },
    after: { plans: [{ name: "Ramp", price: "$0" }, { name: "Ramp Plus", price: "$12", billing_period: "per user/mo" }], has_free_tier: true },
  },
  {
    company: "Linear", rootUrl: "linear.app", pageType: "trust", agoMinutes: 7000,
    before: { certifications: ["SOC 2 Type II"] },
    after: { certifications: ["SOC 2 Type II", "HIPAA"] },
  },
  {
    company: "Stripe", rootUrl: "stripe.com", pageType: "careers", agoMinutes: 9000,
    before: { total_openings: 210, jobs: [{ title: "Backend Engineer" }] },
    after: { total_openings: 240, jobs: [{ title: "Backend Engineer" }, { title: "ML Engineer" }, { title: "GTM Lead" }] },
  },
];

async function main() {
  await connectDB();
  const rootUrls = [...new Set(SCENARIOS.map((s) => normalizeRootUrl(s.rootUrl)!))];

  // Idempotent reset of demo companies.
  const existing = await Company.find({ rootUrl: { $in: rootUrls } }).select("_id").lean();
  const ids = existing.map((c) => String(c._id));
  if (ids.length) {
    const pages = await TrackedPage.find({ companyId: { $in: ids } }).select("_id").lean();
    const pageIds = pages.map((p) => String(p._id));
    await Promise.all([
      SignalEvent.deleteMany({ companyId: { $in: ids } }),
      Snapshot.deleteMany({ trackedPageId: { $in: pageIds } }),
      TrackedPage.deleteMany({ companyId: { $in: ids } }),
      Company.deleteMany({ _id: { $in: ids } }),
    ]);
    console.log(`cleared ${ids.length} existing demo companies`);
  }

  const companyByRoot = new Map<string, string>();
  let created = 0;

  for (const s of SCENARIOS) {
    const rootUrl = normalizeRootUrl(s.rootUrl)!;
    let companyId = companyByRoot.get(rootUrl);
    if (!companyId) {
      const company = await Company.create({ name: s.company, rootUrl });
      companyId = String(company._id);
      companyByRoot.set(rootUrl, companyId);
    }
    const pageUrl = normalizePageUrl(`${s.rootUrl}/${s.pageType}`)!;
    const page = await TrackedPage.create({
      companyId, pageType: s.pageType, url: pageUrl,
      collectorId: `c_demo_${s.pageType}`, status: "active",
    });
    const pageId = String(page._id);

    await ingestSnapshot({ trackedPageId: pageId, extractedFields: s.before });
    const out = await ingestSnapshot({ trackedPageId: pageId, extractedFields: s.after });

    if (out.signalEventId) {
      const at = new Date(Date.now() - s.agoMinutes * 60_000);
      await SignalEvent.updateOne({ _id: out.signalEventId }, { $set: { detectedAt: at } });
      await TrackedPage.updateOne({ _id: pageId }, { $set: { lastScrapedAt: at } });
      created++;
      console.log(`  ✓ ${s.company} / ${s.pageType}: ${out.signalType}/${out.severity} — "${out.summary}"`);
    } else {
      console.log(`  ⚠ ${s.company} / ${s.pageType}: no signal (${out.reason})`);
    }
  }

  // Add a couple of pages in non-active states so the tracked-pages UI shows all
  // status pills (active/discovering/broken).
  const vercelId = companyByRoot.get(normalizeRootUrl("vercel.com")!);
  if (vercelId) {
    await TrackedPage.updateOne(
      { companyId: vercelId, pageType: "integrations" },
      { $setOnInsert: { companyId: vercelId, pageType: "integrations", url: "https://vercel.com/integrations", status: "discovering", collectorId: null } },
      { upsert: true }
    );
  }

  console.log(`\nseeded ${created} real signal events across ${companyByRoot.size} companies.\n`);
  process.exit(0);
}

main().catch((e) => { console.error("seed-demo failed:", e); process.exit(1); });
