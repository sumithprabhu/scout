/**
 * Unit test for the diff engine (pure, no network / DB).
 *
 *   npx tsx scripts/test-diff.ts
 *
 * Focuses on the two things that make or break the product: (1) NOISE is
 * filtered to null so we don't spam signals, and (2) REAL changes across the
 * different page-type shapes (pricing plans, careers jobs, trust certs) are
 * detected with the right op and path.
 */
import { computeDiff } from "@/lib/diff/computeDiff";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

// ---- NOISE -> null ----
console.log("\nNoise filtering (must return null):");
check("identical objects", computeDiff({ a: 1, b: "x" }, { a: 1, b: "x" }) === null);
check(
  "whitespace/formatting-only change",
  computeDiff({ headline: "Ship  faster" }, { headline: "Ship faster " }) === null
);
check(
  "empty-string vs missing field",
  computeDiff({ headline: "Hi", cta: "" }, { headline: "Hi" }) === null
);
check(
  "Bright Data metadata keys ignored",
  computeDiff(
    { headline: "Hi", input: { url: "a" }, timestamp: 1 },
    { headline: "Hi", input: { url: "a" }, timestamp: 2 }
  ) === null
);
check(
  "reordered array of objects (identity-keyed) is not a change",
  computeDiff(
    { plans: [{ name: "Pro", price: "$99" }, { name: "Free", price: "$0" }] },
    { plans: [{ name: "Free", price: "$0" }, { name: "Pro", price: "$99" }] }
  ) === null
);
check(
  "reordered scalar array is not a change",
  computeDiff({ certifications: ["SOC 2", "ISO 27001"] }, { certifications: ["ISO 27001", "SOC 2"] }) === null
);

// ---- REAL changes -> detected ----
console.log("\nPricing changes:");
{
  const d = computeDiff(
    { plans: [{ name: "Pro", price: "$99", billing_period: "per month" }] },
    { plans: [{ name: "Pro", price: "$129", billing_period: "per month" }] }
  );
  check("price change detected", !!d);
  check("op=changed on plans.pro.price", !!d?.changes.some((c) => c.op === "changed" && c.path.includes("pro") && c.path.endsWith("price")),
    JSON.stringify(d?.changes));
  check("old $99 -> new $129 captured",
    !!d?.changes.some((c) => c.oldValue === "$99" && c.newValue === "$129"));
}
{
  const d = computeDiff(
    { plans: [{ name: "Pro", price: "$99" }] },
    { plans: [{ name: "Pro", price: "$99" }, { name: "Enterprise", price: "Contact us" }] }
  );
  check("added plan detected as added", !!d?.changes.some((c) => c.op === "added" && c.path.includes("enterprise")),
    JSON.stringify(d?.changes));
}
{
  const d = computeDiff(
    { plans: [{ name: "Pro", price: "$99" }, { name: "Starter", price: "$9" }] },
    { plans: [{ name: "Pro", price: "$99" }] }
  );
  check("removed plan detected as removed", !!d?.changes.some((c) => c.op === "removed" && c.path.includes("starter")),
    JSON.stringify(d?.changes));
}

console.log("\nCareers changes:");
{
  const d = computeDiff(
    { jobs: [{ title: "Backend Engineer" }], total_openings: 1 },
    { jobs: [{ title: "Backend Engineer" }, { title: "ML Engineer" }, { title: "PM" }], total_openings: 3 }
  );
  check("new roles detected", !!d && d.changes.length >= 2);
  check("total_openings 1 -> 3 detected",
    !!d?.changes.some((c) => c.path === "total_openings" && c.oldValue === 1 && c.newValue === 3));
}

console.log("\nTrust changes:");
{
  const d = computeDiff(
    { certifications: ["SOC 2 Type II"] },
    { certifications: ["SOC 2 Type II", "ISO 27001"] }
  );
  check("new compliance badge detected as added",
    !!d?.changes.some((c) => c.op === "added" && c.path === "certifications"),
    JSON.stringify(d?.changes));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
