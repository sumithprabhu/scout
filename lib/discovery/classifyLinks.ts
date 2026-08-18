import { converseJSON } from "@/lib/nova/client";
import { PAGE_TYPES, type PageType } from "@/lib/intel/types";
import type { DiscoveredLink } from "@/lib/scrapers/discoverPages";

/**
 * Map a homepage's link list onto our page types using Nova.
 *
 * This is the classifyPageType() single-purpose Nova seam from the spec. It does
 * NOT know about Bedrock — it calls converseJSON() in lib/nova/client.ts, so
 * swapping the model is a one-file change there.
 *
 * The page types other than homepage are inferred from link text + href; the
 * homepage is always the root itself (no link needed), so we resolve it here
 * without spending a model call.
 */

/** Map of pageType -> best-guess absolute URL (or null if none found). Homepage
 *  is always present (it's the root). */
export type PageTypeMap = Record<PageType, string | null>;

// The non-homepage types Nova actually has to find from links.
const INFERRED_TYPES = PAGE_TYPES.filter((t) => t !== "homepage") as Exclude<PageType, "homepage">[];

const SYSTEM_PROMPT = `You classify a company's website navigation links into a fixed set of page types.
You are given the company's homepage URL and a list of links (text + absolute href) found in its nav and footer.
Return ONLY a single JSON object (no prose, no markdown fences) whose keys are EXACTLY these page types:
${JSON.stringify(INFERRED_TYPES)}
For each key, the value is the ONE href from the provided list that best matches that page type, or null if no link fits.

What each page type means:
- pricing: plans, pricing, "pricing", cost, "buy", subscription tiers.
- careers: jobs, careers, "we're hiring", open roles, "join us", "work with us".
- trust: security, trust center, compliance, SOC 2, privacy/security, "trust".
- integrations: integrations, apps, marketplace, connectors, "works with".
- changelog: changelog, release notes, "what's new", product updates, "changelog".

Rules:
- Choose ONLY from hrefs present in the provided list. Never invent a URL.
- Return the exact href string as given (do not modify it).
- If several links fit, pick the most specific/canonical one (e.g. prefer "/pricing" over a blog post about pricing).
- If nothing fits a type, use null. Do NOT guess.
Output the JSON object and nothing else.`;

/**
 * The Nova call, isolated. Given the links, returns a partial map of the
 * INFERRED (non-homepage) types to a chosen href or null. Never throws; returns
 * an all-null map if the model call fails, so discovery degrades gracefully to
 * "found nothing" rather than erroring the whole pipeline.
 */
export async function classifyPageType(
  rootUrl: string,
  links: DiscoveredLink[]
): Promise<Record<Exclude<PageType, "homepage">, string | null>> {
  const allNull = Object.fromEntries(INFERRED_TYPES.map((t) => [t, null])) as Record<
    Exclude<PageType, "homepage">,
    string | null
  >;

  if (links.length === 0) return allNull;

  // Compact the links to keep the prompt small: text + href only, cap the count.
  const compact = links
    .slice(0, 150)
    .map((l) => ({ text: l.text.slice(0, 80), href: l.href }));

  const parsed = await converseJSON<Record<string, unknown>>({
    system: SYSTEM_PROMPT,
    user: `Homepage: ${rootUrl}\n\nLinks:\n${JSON.stringify(compact, null, 0)}`,
    maxTokens: 500,
  });
  if (!parsed) return allNull;

  // Validate the model's output against the actual link set: only accept an href
  // the model was given (guards against hallucinated URLs despite the prompt).
  const validHrefs = new Set(links.map((l) => l.href));
  const result = { ...allNull };
  for (const type of INFERRED_TYPES) {
    const v = parsed[type];
    if (typeof v === "string" && validHrefs.has(v)) result[type] = v;
  }
  return result;
}

/**
 * Full page-type map for a company: homepage = root, the rest from Nova.
 */
export async function classifyLinks(
  rootUrl: string,
  links: DiscoveredLink[]
): Promise<PageTypeMap> {
  const inferred = await classifyPageType(rootUrl, links);
  return { homepage: rootUrl, ...inferred };
}
