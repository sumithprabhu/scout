/** Small presentation helpers shared across screens. */

/** Compact relative time, e.g. "3m", "5h", "2d", "Aug 12". */
export function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const days = h / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** First letter(s) for a logo tile. */
export function initials(name: string): string {
  const clean = name.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const parts = clean.split(/[\s.\-_/]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic tile color from a string (for company avatars). */
export function avatarColor(seed: string): { bg: string; text: string } {
  const palette = [
    { bg: "#EEEAFF", text: "#5B44D1" },
    { bg: "#CFF3EC", text: "#0F766E" },
    { bg: "#FFE8D6", text: "#C2410C" },
    { bg: "#DBE8FE", text: "#1D4ED8" },
    { bg: "#FBDCEC", text: "#BE185D" },
    { bg: "#FAEEC4", text: "#A16207" },
    { bg: "#D0F2E1", text: "#047857" },
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/** Render a scraped value (string | number | object) compactly for the diff view. */
export function renderValue(v: unknown): string {
  if (v == null) return "n/a";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Bare registrable host from a URL or bare domain, e.g. "vercel.com". */
export function domainOf(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Host label from a URL, e.g. "vercel.com/pricing". */
export function hostPath(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}
