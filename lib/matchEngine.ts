import type { SeniorityLevel } from "@/lib/types";

/**
 * Match engine — the product's core. Given a user's skills and a parsed JD,
 * compute how well they fit and, crucially, EXACTLY which required skills they
 * are missing. The missing-skills list is the thing that makes this app useful,
 * so it's computed explicitly and returned in the JD's own wording.
 *
 * Scoring is deliberately simple + explainable (no ML): required-skill overlap
 * dominates, nice-to-haves add a small bonus. You can defend every number to a
 * judge by pointing at the two sets.
 *
 * >>> REVIEW: canonicalizeSkill (alias handling) and the weighting. <<<
 */

export interface ParsedJDInput {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  seniorityLevel?: SeniorityLevel;
}

export interface MatchOutcome {
  fitPercentage: number; // 0–100, rounded
  matchedSkills: string[]; // required skills the user HAS (JD wording)
  missingSkills: string[]; // required skills the user LACKS (JD wording) — the money shot
  matchedNiceToHave: string[]; // bonus skills the user has
  requiredCount: number;
  matchedCount: number;
}

// Required overlap is 85% of the score; nice-to-haves 15%. This keeps the number
// driven by hard requirements — a user missing core skills can't be rescued to a
// high fit by matching a few "nice to haves".
const REQUIRED_WEIGHT = 0.85;
const NICE_WEIGHT = 0.15;

/**
 * A small alias table so "React.js", "reactjs", and "react" all compare equal.
 * Intentionally short and hand-curated — over-aliasing would create false
 * matches and undermine the accuracy that's the whole point. Extend as real
 * scraped data reveals more variants.
 */
const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  golang: "go",
  postgres: "postgresql",
  postgre: "postgresql",
  "node": "nodejs",
  "node.js": "nodejs",
  "react.js": "react",
  reactjs: "react",
  "vue.js": "vue",
  vuejs: "vue",
  "next.js": "nextjs",
  k8s: "kubernetes",
  gcp: "googlecloud",
  "google cloud": "googlecloud",
  "amazon web services": "aws",
  "c sharp": "csharp",
  "c#": "csharp",
  "c++": "cplusplus",
};

/**
 * Reduce a skill to a comparison key: lowercase, trim, strip surrounding
 * punctuation/whitespace, collapse internal spaces, then apply the alias map.
 * We compare on this key but always DISPLAY the JD's original string.
 */
export function canonicalizeSkill(skill: string): string {
  let s = skill.toLowerCase().trim();
  // Check alias table on the raw-ish form first (handles "react.js", "c#", etc.)
  if (ALIASES[s]) return ALIASES[s];
  // Strip dots/plus/hash and spaces for a normalized key.
  const stripped = s.replace(/[.\s]+/g, "");
  if (ALIASES[stripped]) return ALIASES[stripped];
  return stripped;
}

function toKeySet(skills: string[]): Set<string> {
  const set = new Set<string>();
  for (const s of skills) {
    const key = canonicalizeSkill(s);
    if (key) set.add(key);
  }
  return set;
}

/**
 * Compute the match. `userSkills` and the JD skill arrays are compared on
 * canonical keys; results are returned using the JD's display strings so the
 * user sees the role's own terminology.
 */
export function computeMatch(
  userSkills: string[],
  jd: ParsedJDInput
): MatchOutcome {
  const userKeys = toKeySet(userSkills);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  // Dedupe required skills by canonical key while preserving display wording.
  const seenRequired = new Set<string>();
  for (const skill of jd.requiredSkills) {
    const key = canonicalizeSkill(skill);
    if (!key || seenRequired.has(key)) continue;
    seenRequired.add(key);
    if (userKeys.has(key)) matchedSkills.push(skill);
    else missingSkills.push(skill);
  }

  const matchedNiceToHave: string[] = [];
  const seenNice = new Set<string>();
  for (const skill of jd.niceToHaveSkills) {
    const key = canonicalizeSkill(skill);
    if (!key || seenNice.has(key)) continue;
    seenNice.add(key);
    if (userKeys.has(key)) matchedNiceToHave.push(skill);
  }

  const requiredCount = seenRequired.size;
  const niceCount = seenNice.size;
  const matchedCount = matchedSkills.length;

  // Scoring. If a JD lists no required skills (e.g. a low-confidence parse),
  // we can't meaningfully score required overlap — fall back to the nice-to-have
  // ratio alone rather than dividing by zero or claiming a perfect fit.
  const requiredRatio = requiredCount > 0 ? matchedCount / requiredCount : 0;
  const niceRatio = niceCount > 0 ? matchedNiceToHave.length / niceCount : 0;

  // Renormalize the weights over only the components that actually exist, so a
  // missing component never dilutes the score. A perfect required match with no
  // nice-to-haves must be 100 (not 85); nice-to-haves only matter when present.
  let fit: number;
  if (requiredCount > 0 && niceCount > 0) {
    fit = (requiredRatio * REQUIRED_WEIGHT + niceRatio * NICE_WEIGHT) * 100;
  } else if (requiredCount > 0) {
    fit = requiredRatio * 100; // no nice-to-haves — required overlap is the whole score
  } else if (niceCount > 0) {
    fit = niceRatio * 100; // no hard requirements to score against
  } else {
    fit = 0; // nothing to score
  }

  return {
    fitPercentage: Math.round(fit),
    matchedSkills,
    missingSkills,
    matchedNiceToHave,
    requiredCount,
    matchedCount,
  };
}
