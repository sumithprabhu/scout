/**
 * End-to-end ingest pipeline test: REAL Mongo + REAL Nova (Bedrock).
 * Only the scraped input is synthetic — everything else is production code.
 *
 *   npx tsx scripts/test-ingest-pipeline.ts
 *
 * Proves the Step 4 requirements against real infra:
 *  1. first snapshot establishes a baseline (no signal)
 *  2. re-ingesting IDENTICAL fields (the "run the same collector twice, nothing
 *     changed in the world" case) -> no-meaningful-change, NO SignalEvent
 *  3. ingesting a real change -> Snapshot v3, a real Nova-classified SignalEvent
 *     with the right signalType, a severity, and a human-readable summary
 *  4. version numbers increment and the SignalEvent is queryable in the feed
 *
 * Needs AWS creds + Nova access. Writes throwaway docs and cleans up.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { ingestSnapshot } from "@/lib/intel/ingest";
import { normalizeRootUrl, normalizePageUrl } from "@/lib/intel/url";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const PRICING_V1 = {
  plans: [
    { name: "Starter", price: "$0", billing_period: "free", features: ["1 seat", "community support"] },
    { name: "Pro", price: "$99", billing_period: "per month", features: ["5 seats", "email support"] },
  ],
  has_free_tier: true,
};
// Same content, different whitespace/order -> must be a NO-OP.
const PRICING_V2_NOISE = {
  has_free_tier: true,
  plans: [
    { name: "Pro", price: "$99 ", billing_period: "per month", features: ["5 seats", "email  support"] },
    { name: "Starter", price: "$0", billing_period: "free", features: ["1 seat", "community support"] },
  ],
};
// Real change: Pro price hike + a new Enterprise tier.
const PRICING_V3_CHANGED = {
  plans: [
    { name: "Starter", price: "$0", billing_period: "free", features: ["1 seat", "community support"] },
    { name: "Pro", price: "$149", billing_period: "per month", features: ["5 seats", "priority support"] },
    { name: "Enterprise", price: "Contact us", billing_period: "annual", features: ["SSO", "SLA"] },
  ],
  has_free_tier: true,
};

async function main() {
  await connectDB();
  const tag = `ingest-${Date.now()}`;
  const company = await Company.create({ name: `Acme ${tag}`, rootUrl: normalizeRootUrl(`${tag}.example.com`)! });
  const page = await TrackedPage.create({
    companyId: company._id,
    pageType: "pricing",
    url: normalizePageUrl(`${tag}.example.com/pricing`)!,
    collectorId: "c_fake_pricing",
    status: "active",
  });
  const pageId = String(page._id);

  console.log("\n1) baseline snapshot:");
  const r1 = await ingestSnapshot({ trackedPageId: pageId, extractedFields: PRICING_V1 });
  check("v1 versionNumber = 1", r1.versionNumber === 1, `v=${r1.versionNumber}`);
  check("v1 reason = first-snapshot", r1.reason === "first-snapshot");
  check("v1 produced NO signal", !r1.signalEventId);

  console.log("\n2) re-ingest identical-but-noisy fields (run twice, no real change):");
  const r2 = await ingestSnapshot({ trackedPageId: pageId, extractedFields: PRICING_V2_NOISE });
  check("v2 versionNumber = 2", r2.versionNumber === 2, `v=${r2.versionNumber}`);
  check("v2 reason = no-meaningful-change", r2.reason === "no-meaningful-change", `reason=${r2.reason}`);
  check("v2 produced NO signal (noise filtered)", !r2.signalEventId);

  console.log("\n3) ingest a real pricing change (Nova classifies):");
  const r3 = await ingestSnapshot({ trackedPageId: pageId, extractedFields: PRICING_V3_CHANGED });
  check("v3 versionNumber = 3", r3.versionNumber === 3, `v=${r3.versionNumber}`);
  check("v3 produced a SignalEvent", !!r3.signalEventId, `id=${r3.signalEventId}`);
  check("v3 signalType = pricing_change", r3.signalType === "pricing_change", `type=${r3.signalType}`);
  check("v3 has a severity", ["low", "medium", "high"].includes(r3.severity ?? ""), `sev=${r3.severity}`);
  check("v3 has a non-empty summary", !!r3.summary && r3.summary.length > 5);
  console.log(`     summary: "${r3.summary}"  [${r3.signalType}/${r3.severity}]`);

  console.log("\n4) persistence + feed:");
  const snaps = await Snapshot.countDocuments({ trackedPageId: pageId });
  check("3 snapshots stored", snaps === 3, `count=${snaps}`);
  const events = await SignalEvent.find({ companyId: company._id }).sort({ detectedAt: -1 }).lean();
  check("exactly 1 SignalEvent in feed (only the real change)", events.length === 1, `count=${events.length}`);
  check("SignalEvent.diffDetail captured changes",
    Array.isArray((events[0]?.diffDetail as any)?.changes) && (events[0].diffDetail as any).changes.length > 0);

  console.log("\ncleaning up...");
  await Promise.all([
    SignalEvent.deleteMany({ companyId: company._id }),
    Snapshot.deleteMany({ trackedPageId: pageId }),
    TrackedPage.deleteMany({ companyId: company._id }),
    Company.deleteMany({ _id: company._id }),
  ]);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test-ingest-pipeline failed:", e); process.exit(1); });
