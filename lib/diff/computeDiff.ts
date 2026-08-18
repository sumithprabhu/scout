/**
 * Snapshot diff engine.
 *
 * DESIGN (defensible): the diff is GENERIC and recursive, not per-page-type.
 * pricing has plans[], careers has jobs[], trust has certifications[] — but the
 * engine never hard-codes those. It walks two `extractedFields` objects and
 * emits field-level changes. That's what makes a new page type free: no diff
 * code changes, because the engine keys off value SHAPE (scalar / scalar-array /
 * object-array), not field names.
 *
 * NOISE FILTERING is the whole point of a diff over "did the raw bytes change":
 *   - strings are normalized (trim + collapse internal whitespace) before compare,
 *     so reflow/formatting churn is invisible
 *   - empty/null/blank values are dropped, so a field appearing as "" vs missing
 *     isn't a change
 *   - arrays of objects are compared by IDENTITY (name/title/id), not by index,
 *     so re-ordered plans or jobs don't look like a mass change
 * If nothing meaningful changed, computeDiff returns null — the caller no-ops
 * (no Snapshot churn, no Nova call, no SignalEvent).
 */

export type ChangeOp = "added" | "removed" | "changed";

export interface FieldChange {
  /** Dotted path into extractedFields, e.g. "plans.Pro.price" or "certifications". */
  path: string;
  op: ChangeOp;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DiffResult {
  changes: FieldChange[];
  /** Convenience counts for severity heuristics / logging. */
  summaryCounts: { added: number; removed: number; changed: number };
}

const MAX_CHANGES = 200; // guard against a pathological full-page rewrite

// ---- normalization ---------------------------------------------------------

function normStr(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Recursively normalize a value for comparison: trim strings, drop empties,
 *  strip scraper metadata keys. Returns undefined for "nothing meaningful". */
function normalize(v: unknown): unknown {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = normStr(v);
    return s === "" ? undefined : s;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    const arr = v.map(normalize).filter((x) => x !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      // Drop Bright Data echo/metadata keys so they never count as a change.
      if (k === "input" || k === "timestamp" || k === "url" || k.startsWith("_")) continue;
      const nv = normalize(val);
      if (nv !== undefined) out[k] = nv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

const IDENTITY_KEYS = ["name", "title", "id", "key", "headline"];

function identityOf(obj: Record<string, unknown>): string | null {
  for (const k of IDENTITY_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return normStr(v).toLowerCase();
  }
  return null;
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x));
}

function scalarEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---- diff walk -------------------------------------------------------------

function walk(oldV: unknown, newV: unknown, path: string, changes: FieldChange[]) {
  if (changes.length >= MAX_CHANGES) return;

  // Presence changes.
  if (oldV === undefined && newV !== undefined) {
    changes.push({ path, op: "added", newValue: newV });
    return;
  }
  if (oldV !== undefined && newV === undefined) {
    changes.push({ path, op: "removed", oldValue: oldV });
    return;
  }
  if (oldV === undefined && newV === undefined) return;

  // Array of objects -> compare by identity key (falls back to scalar-set if no id).
  if (isObjectArray(oldV) && isObjectArray(newV)) {
    const oldHasId = oldV.every((o) => identityOf(o));
    const newHasId = newV.every((o) => identityOf(o));
    if (oldHasId && newHasId) {
      const oldMap = new Map(oldV.map((o) => [identityOf(o)!, o]));
      const newMap = new Map(newV.map((o) => [identityOf(o)!, o]));
      for (const [id, o] of oldMap) {
        if (!newMap.has(id)) changes.push({ path: `${path}.${id}`, op: "removed", oldValue: o });
      }
      for (const [id, n] of newMap) {
        const o = oldMap.get(id);
        if (!o) changes.push({ path: `${path}.${id}`, op: "added", newValue: n });
        else walk(o, n, `${path}.${id}`, changes);
      }
      return;
    }
    // no stable id -> treat as scalar set below
  }

  // Scalar arrays (or object arrays without ids) -> set comparison.
  if (Array.isArray(oldV) && Array.isArray(newV)) {
    const oldSet = new Set(oldV.map((x) => JSON.stringify(x)));
    const newSet = new Set(newV.map((x) => JSON.stringify(x)));
    const added = newV.filter((x) => !oldSet.has(JSON.stringify(x)));
    const removed = oldV.filter((x) => !newSet.has(JSON.stringify(x)));
    if (added.length) changes.push({ path, op: "added", newValue: added });
    if (removed.length) changes.push({ path, op: "removed", oldValue: removed });
    return;
  }

  // Plain objects -> recurse per key (union).
  if (oldV && newV && typeof oldV === "object" && typeof newV === "object" && !Array.isArray(oldV) && !Array.isArray(newV)) {
    const keys = new Set([...Object.keys(oldV as object), ...Object.keys(newV as object)]);
    for (const k of keys) {
      walk((oldV as any)[k], (newV as any)[k], path ? `${path}.${k}` : k, changes);
    }
    return;
  }

  // Scalars (or type mismatch).
  if (!scalarEqual(oldV, newV)) {
    changes.push({ path, op: "changed", oldValue: oldV, newValue: newV });
  }
}

/**
 * Diff two extractedFields objects. Returns null if nothing meaningful changed
 * (after normalization), otherwise the structured change list.
 */
export function computeDiff(
  oldFields: unknown,
  newFields: unknown
): DiffResult | null {
  const o = normalize(oldFields);
  const n = normalize(newFields);

  const changes: FieldChange[] = [];
  walk(o, n, "", changes);

  if (changes.length === 0) return null;

  const summaryCounts = { added: 0, removed: 0, changed: 0 };
  for (const c of changes) summaryCounts[c.op]++;
  return { changes, summaryCounts };
}
