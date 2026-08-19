/**
 * Throwaway test for the match engine. Pure logic — no DB, no API key.
 *   npx tsx scripts/test-match.ts
 * Asserts the scoring + missing-skills output on a few hand-built cases.
 */
import { computeMatch, canonicalizeSkill } from "../lib/matchEngine";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  }
}

// 1. Alias normalization
check("react.js == react", canonicalizeSkill("React.js") === canonicalizeSkill("react"));
check("golang == go", canonicalizeSkill("Golang") === canonicalizeSkill("go"));
check("postgres == postgresql", canonicalizeSkill("Postgres") === canonicalizeSkill("PostgreSQL"));
check("k8s == kubernetes", canonicalizeSkill("k8s") === canonicalizeSkill("Kubernetes"));

// 2. Perfect match
const perfect = computeMatch(
  ["go", "kubernetes", "postgresql"],
  { requiredSkills: ["Go", "Kubernetes", "PostgreSQL"], niceToHaveSkills: [] }
);
check("perfect fit is 100", perfect.fitPercentage === 100, perfect);
check("perfect has no missing", perfect.missingSkills.length === 0, perfect.missingSkills);

// 3. Near-miss: missing exactly one required skill, surfaced by display name
const nearMiss = computeMatch(
  ["Go", "Postgres", "Docker"],
  { requiredSkills: ["Go", "Kubernetes", "PostgreSQL"], niceToHaveSkills: ["gRPC"] }
);
check("near-miss matched 2 of 3", nearMiss.matchedCount === 2, nearMiss);
check(
  "near-miss missing is exactly ['Kubernetes']",
  nearMiss.missingSkills.length === 1 && nearMiss.missingSkills[0] === "Kubernetes",
  nearMiss.missingSkills
);
// 2/3 required * 0.85 + 0/1 nice * 0.15 = 0.5667 -> 57
check("near-miss fit ~57", nearMiss.fitPercentage === 57, nearMiss.fitPercentage);

// 4. Nice-to-have bonus lifts the score
const withNice = computeMatch(
  ["Go", "Postgres", "gRPC"],
  { requiredSkills: ["Go", "Kubernetes", "PostgreSQL"], niceToHaveSkills: ["gRPC"] }
);
// 2/3*0.85 + 1/1*0.15 = 0.7167 -> 72
check("nice-to-have bonus applied (~72)", withNice.fitPercentage === 72, withNice.fitPercentage);
check("matched nice-to-have reported", withNice.matchedNiceToHave.includes("gRPC"), withNice.matchedNiceToHave);

// 5. Zero required skills (low-confidence parse) doesn't divide by zero or claim 100
const noReq = computeMatch(["Go"], { requiredSkills: [], niceToHaveSkills: ["Go"] });
check("no-required falls back to nice ratio (100)", noReq.fitPercentage === 100, noReq);
const noReqNoNice = computeMatch(["Go"], { requiredSkills: [], niceToHaveSkills: [] });
check("no skills at all -> 0", noReqNoNice.fitPercentage === 0, noReqNoNice);

// 6. Empty user profile -> 0 fit, everything missing
const emptyUser = computeMatch([], { requiredSkills: ["Go", "Rust"], niceToHaveSkills: [] });
check("empty user misses all", emptyUser.missingSkills.length === 2 && emptyUser.fitPercentage === 0, emptyUser);

// 7. Case-insensitive user input still matches
const casey = computeMatch(["GO", "KuBeRnEtEs", "postgresql"], {
  requiredSkills: ["Go", "Kubernetes", "PostgreSQL"],
  niceToHaveSkills: [],
});
check("case-insensitive match is 100", casey.fitPercentage === 100, casey);

console.log(failures === 0 ? "\nALL MATCH-ENGINE TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
