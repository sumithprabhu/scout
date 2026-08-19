import "dotenv/config";
import { discoverPages } from "@/lib/scrapers/discoverPages";

// Inspect the RAW links the discovery collector returns for a given homepage,
// to confirm whether Bright Data scraped the real site or fell back to the
// collector's build-time sample (linear.app).
async function main() {
  const url = process.argv[2] ?? "https://posthog.com";
  console.log(`raw discovery for ${url}:\n`);
  const links = await discoverPages(url, { timeoutMs: 240_000 });
  console.log(`got ${links.length} links`);
  const hosts = new Map<string, number>();
  for (const l of links) {
    try { const h = new URL(l.href).hostname; hosts.set(h, (hosts.get(h) ?? 0) + 1); } catch {}
  }
  console.log(`\nhost distribution:`);
  for (const [h, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(3)}  ${h}`);
  console.log(`\nfirst 15 links:`);
  for (const l of links.slice(0, 15)) console.log(`  [${l.text.slice(0, 30).padEnd(30)}] ${l.href}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
