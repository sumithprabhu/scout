// Screenshot helper for visual QA of the UI.
//   node scripts/shot.mjs <url> <outfile> [waitMs] [fullPage]
import { chromium } from "playwright-core";

const [, , url, out, waitMs = "1800", fullPage = "true"] = process.argv;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out, fullPage: fullPage === "true" });
await browser.close();
console.log("shot ->", out);
