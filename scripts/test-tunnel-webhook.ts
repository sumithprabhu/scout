/**
 * End-to-end proof that inbound webhook delivery works over the PUBLIC tunnel,
 * exactly as Bright Data would deliver a scheduled run.
 *
 *   npx tsx scripts/test-tunnel-webhook.ts
 *
 * Uses PUBLIC_BASE_URL (the ngrok URL) + webhookTarget() to build the same
 * delivery URL a collector would carry, then POSTs a real Bright-Data-shaped
 * payload to it FROM OUTSIDE (through the tunnel) and confirms it reached our
 * app, passed the secret check, and drove the ingest pipeline. Also checks the
 * secret actually rejects a bad/missing secret.
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";
import { Snapshot } from "@/models/Snapshot";
import { SignalEvent } from "@/models/SignalEvent";
import { webhookTarget } from "@/lib/scrapers/createPageCollector";
import { normalizePageUrl } from "@/lib/intel/url";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function j(res: Response) { return { status: res.status, body: await res.json().catch(() => ({})) }; }

async function main() {
  const pub = process.env.PUBLIC_BASE_URL;
  if (!pub) { console.error("PUBLIC_BASE_URL not set — start the tunnel first."); process.exit(1); }
  console.log(`\nPUBLIC_BASE_URL = ${pub}\n`);

  await connectDB();
  const tag = `tunnel-${Date.now()}`;
  const pageUrl = normalizePageUrl(`${tag}.example.com/pricing`)!;
  const company = await Company.create({ name: `Tunnel ${tag}`, rootUrl: `https://${tag}.example.com` });
  const page = await TrackedPage.create({
    companyId: company._id, pageType: "pricing", url: pageUrl,
    collectorId: "c_tunnel_test", status: "active",
  });
  const pageId = String(page._id);

  // The exact delivery URL a collector built now would carry (tunnel + secret).
  const target = webhookTarget(pageUrl);
  check("webhookTarget uses the public tunnel origin", target.startsWith(pub), target.split("?")[0]);
  check("webhookTarget includes the secret param", target.includes("secret="));
  // ngrok-free adds a browser interstitial to some requests; this header opts out.
  const headers = { "content-type": "application/json", "ngrok-skip-browser-warning": "true" };
  const deliver = (fields: any) => fetch(target, { method: "POST", headers, body: JSON.stringify([{ input: { url: pageUrl }, ...fields }]) });

  console.log("delivering baseline through the tunnel:");
  const w1 = await j(await deliver({ plans: [{ name: "Pro", price: "$40" }], has_free_tier: true }));
  check("baseline delivered via public URL -> 200", w1.status === 200, `status=${w1.status} ${JSON.stringify(w1.body)}`);
  check("first-snapshot recorded", w1.body.outcomes?.[0]?.reason === "first-snapshot");

  console.log("\ndelivering a change through the tunnel:");
  const w2 = await j(await deliver({ plans: [{ name: "Pro", price: "$60" }, { name: "Max", price: "$120" }], has_free_tier: true }));
  check("change delivered -> signal produced", !!w2.body.outcomes?.[0]?.signalEventId, JSON.stringify(w2.body.outcomes));
  check("signalType = pricing_change", w2.body.outcomes?.[0]?.signalType === "pricing_change");
  console.log(`     feed summary via tunnel: "${w2.body.outcomes?.[0]?.summary}"`);

  console.log("\nsecret enforcement (through the tunnel):");
  const noSecretUrl = `${pub}/api/webhook/scrape-result?pageUrl=${encodeURIComponent(pageUrl)}`;
  const bad = await j(await fetch(noSecretUrl, { method: "POST", headers, body: JSON.stringify([{ plans: [] }]) }));
  check("missing secret -> 401 (delivery rejected)", bad.status === 401, `status=${bad.status}`);
  const wrong = await j(await fetch(`${noSecretUrl}&secret=wrong`, { method: "POST", headers, body: JSON.stringify([{ plans: [] }]) }));
  check("wrong secret -> 401", wrong.status === 401, `status=${wrong.status}`);

  console.log("\npersistence:");
  check("2 snapshots stored", (await Snapshot.countDocuments({ trackedPageId: pageId })) === 2);
  check("1 signal event stored", (await SignalEvent.countDocuments({ companyId: company._id })) === 1);

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
main().catch((e) => { console.error("test-tunnel-webhook failed:", e); process.exit(1); });
