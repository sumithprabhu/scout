/**
 * Smoke test for the company-intelligence data model.
 *
 *   npx tsx scripts/smoke-intel-db.ts
 *
 * Proves, against the REAL Mongo (reusing lib/db.ts's global-cached connection):
 *   1. all 5 new schemas compile + register without OverwriteModelError
 *   2. the connection from the job-matcher build still works unchanged
 *   3. the dedup unique indexes actually fire (Company.rootUrl, Collector.url,
 *      TrackedPage companyId+pageType, Snapshot trackedPageId+versionNumber)
 *   4. a full Company -> TrackedPage -> Snapshot -> SignalEvent graph round-trips
 *
 * Writes into a throwaway namespace and cleans up after itself, so it's safe to
 * run against the dev DB repeatedly.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { Collector } from "@/models/Collector";
import { normalizeRootUrl, normalizePageUrl } from "@/lib/intel/url";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function expectDupKeyError(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(`${label} — duplicate rejected`, false);
  } catch (err: any) {
    check(`${label} — duplicate rejected`, err?.code === 11000);
  }
}

async function expectValidationError(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(`${label} — rejected`, false);
  } catch (err: any) {
    check(`${label} — rejected`, err?.name === "ValidationError");
  }
}

async function main() {
  const tag = `smoke-${Date.now()}`;
  console.log(`\nconnecting to Mongo (reusing lib/db.ts global-cached client)...`);
  await connectDB();
  console.log(`connected. running smoke checks with tag ${tag}\n`);

  // Ensure indexes exist before we test them (Mongoose builds them lazily).
  await Promise.all([
    Company.init(),
    TrackedPage.init(),
    Snapshot.init(),
    SignalEvent.init(),
    Collector.init(),
  ]);

  // --- URL normalization ---
  console.log("URL normalization:");
  check("root: bare host -> https origin", normalizeRootUrl("Acme.com/") === "https://acme.com");
  check("root: strips www + path", normalizeRootUrl("http://www.acme.com/x?y=1") === "https://acme.com");
  check("page: keeps path, drops query/slash", normalizePageUrl("acme.com/pricing/?utm=x") === "https://acme.com/pricing");
  check("invalid (spaces in host) -> null", normalizeRootUrl("not a url with spaces") === null);
  check("empty -> null", normalizeRootUrl("") === null);

  // --- Company ---
  console.log("\nCompany:");
  const rootUrl = normalizeRootUrl(`${tag}.example.com`)!;
  const company = await Company.create({ name: `Acme ${tag}`, rootUrl });
  check("created with _id", !!company._id);
  await expectDupKeyError("Company.rootUrl unique", () =>
    Company.create({ name: "dup", rootUrl })
  );

  // --- Collector registry (dedup by URL) ---
  console.log("\nCollector registry:");
  const pageUrl = normalizePageUrl(`${tag}.example.com/pricing`)!;
  await Collector.create({ url: pageUrl, collectorId: "c_test123", pageType: "pricing" });
  await expectDupKeyError("Collector.url unique (idempotency guard)", () =>
    Collector.create({ url: pageUrl, collectorId: "c_other", pageType: "pricing" })
  );

  // --- TrackedPage ---
  console.log("\nTrackedPage:");
  const page = await TrackedPage.create({
    companyId: company._id,
    pageType: "pricing",
    url: pageUrl,
    collectorId: "c_test123",
    status: "active",
  });
  check("created, defaults applied (lastScrapedAt null)", page.lastScrapedAt === null);
  await expectDupKeyError("TrackedPage companyId+pageType unique", () =>
    TrackedPage.create({ companyId: company._id, pageType: "pricing", url: pageUrl })
  );
  await expectValidationError("pageType enum rejects unknown value", () =>
    TrackedPage.create({ companyId: company._id, pageType: "docs" as any, url: "https://x.test/docs" })
  );

  // --- Snapshot versioning ---
  console.log("\nSnapshot:");
  const snap1 = await Snapshot.create({
    trackedPageId: page._id,
    rawContent: "Pro $99/mo",
    extractedFields: { plans: [{ name: "Pro", price: 99 }] },
    versionNumber: 1,
  });
  const snap2 = await Snapshot.create({
    trackedPageId: page._id,
    rawContent: "Pro $129/mo",
    extractedFields: { plans: [{ name: "Pro", price: 129 }] },
    versionNumber: 2,
  });
  check("Mixed extractedFields round-trips", (snap2.extractedFields as any).plans[0].price === 129);
  await expectDupKeyError("Snapshot trackedPageId+versionNumber unique", () =>
    Snapshot.create({ trackedPageId: page._id, rawContent: "x", versionNumber: 2 })
  );
  const latest = await Snapshot.findOne({ trackedPageId: page._id }).sort({ versionNumber: -1 });
  check("latest-snapshot query returns v2", latest?.versionNumber === 2);

  // --- SignalEvent ---
  console.log("\nSignalEvent:");
  const event = await SignalEvent.create({
    companyId: company._id,
    trackedPageId: page._id,
    signalType: "pricing_change",
    summary: "Pro plan increased from $99 to $129/mo (+30%)",
    diffDetail: { field: "plans.Pro.price", oldValue: 99, newValue: 129 },
    severity: "high",
  });
  check("created with defaults (detectedAt set)", event.detectedAt instanceof Date);
  const feed = await SignalEvent.find({ companyId: company._id }).sort({ detectedAt: -1 }).lean();
  check("per-company feed returns the event", feed.length === 1 && feed[0].signalType === "pricing_change");

  // --- Populate / ref integrity ---
  console.log("\nRefs:");
  const populated = await SignalEvent.findById(event._id).populate("companyId").lean();
  check("companyId ref populates", (populated as any)?.companyId?.name === `Acme ${tag}`);

  // --- Cleanup ---
  console.log("\ncleaning up test docs...");
  await Promise.all([
    SignalEvent.deleteMany({ companyId: company._id }),
    Snapshot.deleteMany({ trackedPageId: page._id }),
    TrackedPage.deleteMany({ companyId: company._id }),
    Collector.deleteMany({ url: pageUrl }),
    Company.deleteMany({ _id: company._id }),
  ]);
  check("cleanup left no Company rows for tag", (await Company.countDocuments({ rootUrl })) === 0);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke-intel-db failed:", e);
  process.exit(1);
});
