/**
 * Real-HTTP test for the discovery-health flag (option C): GET /pages must tell
 * the UX when to prompt for manual entry and exactly which page types are still
 * missing. Uses discover:false + manual page adds (no real scrape needed).
 *
 *   npx next dev -p 3111   # then:
 *   npx tsx scripts/test-discovery-flag.ts
 */
import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Company } from "@/models/Company";
import { TrackedPage } from "@/models/TrackedPage";

const BASE = process.env.BASE ?? "http://localhost:3111";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function j(res: Response) { return { status: res.status, body: await res.json().catch(() => ({})) }; }

async function main() {
  const tag = `flag-${Date.now()}`;
  const create = await j(await fetch(`${BASE}/api/companies`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: `${tag}.example.com`, email: `${tag}@t.dev`, discover: false }),
  }));
  const id = create.body.companyId;

  console.log("\nno pages yet -> prompt manual entry:");
  let g = await j(await fetch(`${BASE}/api/companies/${id}/pages`));
  check("suggestManualEntry = true", g.body.discovery?.suggestManualEntry === true);
  check("missingPageTypes lists all 6", (g.body.discovery?.missingPageTypes ?? []).length === 6);

  console.log("\nhomepage only -> STILL prompt (homepage doesn't count):");
  await fetch(`${BASE}/api/companies/${id}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "homepage", url: `${tag}.example.com` }),
  });
  g = await j(await fetch(`${BASE}/api/companies/${id}/pages`));
  check("still suggestManualEntry = true", g.body.discovery?.suggestManualEntry === true, JSON.stringify(g.body.discovery));
  check("missingPageTypes no longer includes homepage",
    !g.body.discovery?.missingPageTypes?.includes("homepage"));

  console.log("\nadd a real page -> stop prompting:");
  await fetch(`${BASE}/api/companies/${id}/pages`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageType: "pricing", url: `${tag}.example.com/pricing` }),
  });
  g = await j(await fetch(`${BASE}/api/companies/${id}/pages`));
  check("suggestManualEntry = false", g.body.discovery?.suggestManualEntry === false, JSON.stringify(g.body.discovery));
  check("message is null when healthy", g.body.discovery?.message === null);
  check("missingPageTypes excludes homepage + pricing",
    !g.body.discovery?.missingPageTypes?.includes("pricing") && !g.body.discovery?.missingPageTypes?.includes("homepage"));

  console.log("\ncleaning up...");
  await connectDB();
  await TrackedPage.deleteMany({ companyId: id });
  await Company.deleteMany({ _id: id });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error("test-discovery-flag failed:", e); process.exit(1); });
