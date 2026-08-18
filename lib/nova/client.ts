import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * The single seam between our app and the LLM.
 *
 * WHY THIS EXISTS: the spec requires every Nova call to sit behind a
 * single-purpose function (classifyPageType, classifyDiff, summarizeDiff) "so
 * the model can be swapped later without touching calling code". Those functions
 * live in their own domains (lib/discovery, lib/classify), but they ALL call
 * `converseJSON()` here. That makes this file the one place that knows about
 * Bedrock/Nova: swapping to Claude, or to a different provider, is an edit to
 * this file alone — the single-purpose functions and their callers don't change.
 *
 * This is the same Converse-API + defensive-JSON approach proven in
 * lib/jdParser.ts (Nova's forced tool-calling is inconsistent, so we prompt for
 * strict JSON and parse tolerantly), lifted into a reusable helper instead of
 * being copy-pasted per call site.
 *
 * Requires AWS creds (standard AWS_* env vars) with bedrock:InvokeModel and Nova
 * model access enabled in the Bedrock console for BEDROCK_REGION.
 */

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";

// Lazily create and reuse one client (picks up AWS creds from the environment).
let _client: BedrockRuntimeClient | null = null;
function client(): BedrockRuntimeClient {
  if (!_client) _client = new BedrockRuntimeClient({ region: REGION });
  return _client;
}

/** Pull a JSON value out of the model's text, tolerating code fences and any
 *  stray preamble the model adds despite instructions. Handles both object and
 *  array top-level shapes. */
export function extractJson<T = unknown>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first balanced-looking {...} or [...] block.
    const m = cleaned.match(/[\{\[][\s\S]*[\}\]]/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface ConverseOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Send one system+user turn to Nova and return the parsed JSON of type T, or
 * null on ANY failure (bad JSON, throttling, access denied, model not enabled).
 *
 * NEVER THROWS — the same discipline as parseJD: one bad model call must not
 * break the batch/pipeline that called it. Callers decide the fallback for null.
 */
export async function converseJSON<T = unknown>(opts: ConverseOpts): Promise<T | null> {
  try {
    const response = await client().send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: opts.system }],
        // Cap user input so one giant page can't blow the token budget.
        messages: [{ role: "user", content: [{ text: opts.user.slice(0, 24_000) }] }],
        inferenceConfig: {
          maxTokens: opts.maxTokens ?? 800,
          temperature: opts.temperature ?? 0,
        },
      })
    );
    const blocks = response.output?.message?.content ?? [];
    const textOut = blocks.map((b) => b.text ?? "").join("").trim();
    return extractJson<T>(textOut);
  } catch (err) {
    console.error("[nova] converse failed:", (err as Error).message);
    return null;
  }
}

/** Which model is answering — handy for logging/audit in the demo. */
export function activeModelId(): string {
  return MODEL_ID;
}
