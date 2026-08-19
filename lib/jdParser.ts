import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SENIORITY_LEVELS, type SeniorityLevel } from "@/lib/types";
import { connectDB } from "@/lib/db";
import { JobListing } from "@/models/JobListing";
import { ParsedJD } from "@/models/ParsedJD";

/**
 * JD parsing via Amazon Nova on AWS Bedrock (Converse API).
 *
 * WHY THIS SHAPE: Nova's forced tool-calling support is inconsistent across
 * variants, so instead of relying on it we prompt for a strict JSON object and
 * parse defensively. The parser NEVER throws — any failure (bad JSON, access
 * denied, throttling, model-not-enabled) yields a low-confidence empty result
 * so one bad JD can't break a batch parse. `parseJD` keeps the exact same
 * signature it had on the Anthropic path, so swapping providers is localized to
 * this file.
 *
 * >>> REVIEW: the prompt, extractJson (defensive parsing), and the fallback. <<<
 *
 * Requires AWS creds (standard AWS_* env vars or a profile) with
 * bedrock:InvokeModel, and Nova model access enabled in the Bedrock console for
 * BEDROCK_REGION.
 */

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
// nova-lite = good cost/quality for extraction. Bump to amazon.nova-pro-v1:0 for
// higher quality, or amazon.nova-micro-v1:0 for cheapest. If you hit an
// "on-demand throughput isn't supported" error, use the cross-region inference
// profile id instead (e.g. "us.amazon.nova-lite-v1:0").
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";

// Scraped text shorter than this is almost certainly a stub/snippet (or a
// scrape miss). We don't spend a model call on it — we mark it low-confidence.
const MIN_USABLE_CHARS = 120;

// Lazily create and reuse one client (picks up AWS creds from the environment).
let _client: BedrockRuntimeClient | null = null;
function client(): BedrockRuntimeClient {
  if (!_client) _client = new BedrockRuntimeClient({ region: REGION });
  return _client;
}

export interface JDParseResult {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  seniorityLevel: SeniorityLevel;
  parseConfidence: "high" | "low";
}

const SYSTEM_PROMPT = `You extract the concrete tech-stack requirements from a job description.
Return ONLY a single JSON object (no prose, no markdown fences) with exactly these keys:
  "requiredSkills":  string[]  - hard requirements: programming languages, frameworks, libraries,
                                 databases, cloud/platforms, tools the candidate MUST have.
  "niceToHaveSkills": string[] - skills framed as preferred, bonus, "a plus", or "nice to have".
  "seniorityLevel":  one of ${JSON.stringify(SENIORITY_LEVELS)}.
Rules:
- Normalize each skill to its common short name (e.g. "ReactJS" -> "React", "Golang" -> "Go",
  "Postgres"/"PostgreSQL" -> "PostgreSQL").
- Do NOT invent skills not present in the text. Do NOT include soft skills, degrees, or years of experience.
- If a skill appears as both required and preferred, put it only in requiredSkills.
- If seniority is genuinely unclear, use "unknown".
Output the JSON object and nothing else.`;

const emptyLowConfidence = (): JDParseResult => ({
  requiredSkills: [],
  niceToHaveSkills: [],
  seniorityLevel: "unknown",
  parseConfidence: "low",
});

/** Lowercase, trim, drop empties/dupes, cap runaway arrays. Stored normalized so
 *  the match engine compares case-insensitively. */
function cleanSkills(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= 40) break;
  }
  return out;
}

/** Pull a JSON object out of the model's text, tolerating code fences and any
 *  stray preamble the model adds despite instructions. */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the first balanced-looking {...} block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Pure parser: raw JD text -> structured result. No DB. Exported for unit tests.
 * Never throws.
 */
export async function parseJD(rawDescriptionText: string): Promise<JDParseResult> {
  const text = (rawDescriptionText || "").trim();
  if (text.length < MIN_USABLE_CHARS) return emptyLowConfidence();

  try {
    const response = await client().send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
          // Truncate absurdly long JDs so one giant page can't blow the token budget.
          { role: "user", content: [{ text: text.slice(0, 24_000) }] },
        ],
        inferenceConfig: { maxTokens: 800, temperature: 0 },
      })
    );

    const blocks = response.output?.message?.content ?? [];
    const textOut = blocks.map((b) => b.text ?? "").join("").trim();
    const parsed = extractJson(textOut);
    if (!parsed) return emptyLowConfidence();

    const requiredSkills = cleanSkills(parsed.requiredSkills);
    const niceToHaveSkills = cleanSkills(parsed.niceToHaveSkills).filter(
      // A skill can't be both required and nice-to-have; required wins.
      (s) => !requiredSkills.includes(s)
    );

    const rawSeniority = String(parsed.seniorityLevel ?? "").toLowerCase();
    const seniorityLevel = (SENIORITY_LEVELS as readonly string[]).includes(rawSeniority)
      ? (rawSeniority as SeniorityLevel)
      : "unknown";

    // Zero required skills on a substantial JD is a weak signal — flag low so we
    // don't confidently match against nothing.
    const parseConfidence: "high" | "low" =
      requiredSkills.length === 0 ? "low" : "high";

    return { requiredSkills, niceToHaveSkills, seniorityLevel, parseConfidence };
  } catch (err) {
    console.error("[jdParser] Bedrock/Nova parse failed:", (err as Error).message);
    return emptyLowConfidence();
  }
}

/**
 * Parse a stored JobListing and upsert its ParsedJD, marking the listing parsed.
 * Idempotent: re-running overwrites the existing ParsedJD (unique on jobListingId).
 */
export async function parseAndStore(jobListingId: string): Promise<JDParseResult> {
  await connectDB();
  const listing = await JobListing.findById(jobListingId);
  if (!listing) throw new Error(`JobListing ${jobListingId} not found`);

  const result = await parseJD(listing.rawDescriptionText);

  await ParsedJD.findOneAndUpdate(
    { jobListingId: listing._id },
    {
      jobListingId: listing._id,
      requiredSkills: result.requiredSkills,
      niceToHaveSkills: result.niceToHaveSkills,
      seniorityLevel: result.seniorityLevel,
      parseConfidence: result.parseConfidence,
      extractedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  listing.isParsed = true;
  await listing.save();

  return result;
}
