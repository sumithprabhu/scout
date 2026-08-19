/**
 * Unit test for the discovery same-site guard (pure, no network).
 *
 *   npx tsx scripts/test-domain-guard.ts
 *
 * Proves the fix for the observed cross-company contamination bug (posthog
 * discovery returned linear.app URLs): same registrable domain / subdomain is
 * trusted, a foreign domain is rejected.
 */
import { registrableDomain, sameSiteOrSubdomain } from "@/lib/intel/url";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

console.log("\nregistrableDomain:");
check("vercel.com", registrableDomain("vercel.com") === "vercel.com");
check("security.vercel.com -> vercel.com", registrableDomain("security.vercel.com") === "vercel.com");
check("www stripped", registrableDomain("www.posthog.com") === "posthog.com");

console.log("\nsameSiteOrSubdomain:");
check("root == root", sameSiteOrSubdomain("https://vercel.com/pricing", "https://vercel.com"));
check("subdomain trusted (security.vercel.com ~ vercel.com)",
  sameSiteOrSubdomain("https://security.vercel.com", "https://vercel.com"));
check("path variant trusted", sameSiteOrSubdomain("https://linear.app/pricing", "https://linear.app"));
check("FOREIGN domain rejected (the posthog bug: linear.app vs posthog.com)",
  sameSiteOrSubdomain("https://linear.app/pricing", "https://posthog.com") === false);
check("different tld rejected (acme.com vs acme.io)",
  sameSiteOrSubdomain("https://acme.io/pricing", "https://acme.com") === false);
check("garbage input rejected", sameSiteOrSubdomain("not-a-url", "https://acme.com") === false);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
