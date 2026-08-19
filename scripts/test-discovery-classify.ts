/**
 * Verify the discovery CLASSIFICATION seam (Nova link -> page-type mapping)
 * without spending Bright Data credits.
 *
 *   npx tsx scripts/test-discovery-classify.ts
 *
 * Feeds a synthetic homepage link list (the shape discoverPages() produces) to
 * classifyLinks() and asserts Nova maps the obvious links to the right page
 * types, resolves homepage to the root, returns null for a genuinely-absent
 * type, and NEVER returns a URL that wasn't in the input (hallucination guard).
 *
 * Needs AWS creds + Nova access (same as scripts/test-parse.ts). No Bright Data.
 */
import "dotenv/config";
import { classifyLinks } from "@/lib/discovery/classifyLinks";
import { activeModelId } from "@/lib/nova/client";
import type { DiscoveredLink } from "@/lib/scrapers/discoverPages";

const ROOT = "https://acme.com";

// A realistic nav+footer for a fictional SaaS. Note: NO changelog link — we
// expect the classifier to return null for changelog, not to invent one.
const LINKS: DiscoveredLink[] = [
  { text: "Product", href: "https://acme.com/product" },
  { text: "Pricing", href: "https://acme.com/pricing" },
  { text: "Customers", href: "https://acme.com/customers" },
  { text: "Integrations", href: "https://acme.com/integrations" },
  { text: "Docs", href: "https://acme.com/docs" },
  { text: "Blog", href: "https://acme.com/blog" },
  { text: "Careers", href: "https://acme.com/company/careers" },
  { text: "Security & Trust", href: "https://acme.com/trust" },
  { text: "Contact sales", href: "https://acme.com/contact" },
  { text: "Privacy Policy", href: "https://acme.com/legal/privacy" },
  { text: "Log in", href: "https://app.acme.com/login" },
];

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`\nclassifying synthetic links with model=${activeModelId()}...\n`);
  const map = await classifyLinks(ROOT, LINKS);
  console.log("result map:", JSON.stringify(map, null, 2), "\n");

  check("homepage = root (no model call)", map.homepage === ROOT);
  check("pricing -> /pricing", map.pricing === "https://acme.com/pricing", String(map.pricing));
  check("careers -> /company/careers", map.careers === "https://acme.com/company/careers", String(map.careers));
  check("trust -> /trust", map.trust === "https://acme.com/trust", String(map.trust));
  check("integrations -> /integrations", map.integrations === "https://acme.com/integrations", String(map.integrations));
  check("changelog -> null (absent, not invented)", map.changelog === null, String(map.changelog));

  // Hallucination guard: every non-null value must be a URL we actually provided.
  const provided = new Set([ROOT, ...LINKS.map((l) => l.href)]);
  const allFromInput = Object.values(map).every((v) => v === null || provided.has(v));
  check("no invented URLs (all values came from input)", allFromInput);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test-discovery-classify failed:", e);
  process.exit(1);
});
