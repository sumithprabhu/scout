import mongoose from "mongoose";

/**
 * MongoDB connection helper.
 *
 * WHY THIS SHAPE: In the Next.js dev server, every file save triggers a hot
 * reload that re-evaluates modules. A naive `mongoose.connect()` at import time
 * would open a brand-new connection (and leak the old one) on every reload,
 * quickly exhausting the DB's connection pool. Serverless/edge invocations have
 * the same problem at runtime — each cold start would reconnect.
 *
 * The fix is the well-known "cache the connection promise on globalThis"
 * pattern: the global object survives hot reloads, so we reuse a single
 * in-flight or resolved connection instead of dialing again.
 */

const MONGODB_URI = process.env.MONGODB_URI;

// Shape of what we stash on the global object.
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// `globalThis` is typed loosely; augment it so TypeScript knows about our cache.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};
global._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and fill it in."
    );
  }

  // Already connected — reuse it.
  if (cache.conn) return cache.conn;

  // A connection attempt is already in flight — await the same promise instead
  // of starting a second one. This is what makes concurrent requests safe.
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        // Fail fast if the DB is unreachable rather than hanging a request.
        serverSelectionTimeoutMS: 8000,
        // Mongoose buffers queries before the connection opens; disabling it
        // surfaces connection problems immediately instead of silently queuing.
        bufferCommands: false,
      })
      .then((m) => m);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset so the next request can retry instead of being stuck on a rejected
    // promise forever.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
