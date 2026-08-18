import { Schema, model, models, type Model } from "mongoose";
import { connectDB } from "@/lib/db";

/**
 * MongoDB-based per-identity daily rate limiter.
 *
 * WHY MONGO (not in-memory): the beta will be usage-gated, and an in-memory
 * counter resets on every dev hot-reload / serverless cold start and isn't
 * shared across instances — useless for actually protecting Bright Data credits.
 * A tiny Mongo collection keyed by (identity, day) with an atomic increment is
 * correct across restarts and instances, and a TTL index auto-cleans old rows.
 *
 * This gates /api/scrape specifically, since that's what spends credits.
 */

const RateLimitSchema = new Schema({
  // e.g. "email:foo@bar.com:2026-08-17" or "ip:1.2.3.4:2026-08-17"
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  // Row auto-deletes ~2 days after creation via the TTL index below.
  createdAt: { type: Date, default: () => new Date() },
});

// TTL: expire buckets 2 days after creation (well past their 1-day window).
RateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 48 });

type RateLimitDoc = { key: string; count: number; createdAt: Date };
const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) ||
  model<RateLimitDoc>("RateLimit", RateLimitSchema);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  identity: string;
}

/** Today's UTC date bucket, e.g. "2026-08-17". */
function dayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derive a stable identity for rate limiting. Prefers an explicit email (so a
 * user is limited consistently regardless of IP), else falls back to client IP.
 */
export function resolveIdentity(req: Request, email?: string): string {
  if (email && email.trim()) return `email:${email.trim().toLowerCase()}`;
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : "") || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip.trim()}`;
}

/**
 * Atomically increment the identity's daily counter and decide if this request
 * is allowed. The increment + read is a single findOneAndUpdate so concurrent
 * requests can't race past the limit.
 */
export async function checkRateLimit(
  identity: string,
  limit: number
): Promise<RateLimitResult> {
  await connectDB();
  const key = `${identity}:${dayBucket()}`;

  const doc = await RateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const count = doc?.count ?? 1;
  const remaining = Math.max(0, limit - count);
  return { allowed: count <= limit, limit, remaining, identity };
}
