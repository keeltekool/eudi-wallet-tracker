// Click-through of the public flows (CLAUDE.md §2): no sideways scroll on the public tabs, a Jev-sorted
// article on Filtered, and /admin redirecting to Scrapyard (the admin moved there 2026-09-29).
// Usage: node scripts/check-ui-flows.mjs <baseUrl>
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

const { chromium } = createRequire("C:/Users/Kasutaja/.claude/scripts/")("playwright");

config({ path: ".env.local" }); // dotenv: process.loadEnvFile fails on this file's BOM
const BASE = (process.argv[2] || process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const SCRAPYARD = "https://scrapyard-ten.vercel.app";
const PUBLIC_TABS = ["/", "/filtered", "/curated", "/strategy", "/newsletter"];
// Newest article the scrape job's Jev filter passed (scrape_runs.jev exists only since the Jev filter)
const [jevSorted] = await neon(process.env.DATABASE_URL)`
  SELECT title FROM articles WHERE jev_score IS NOT NULL AND status IN ('relevant', 'accepted', 'rejected')
  ORDER BY published_at DESC NULLS LAST, scraped_at DESC LIMIT 1`;

let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
}

await step("/admin/runs redirects permanently to Scrapyard", async () => {
  const res = await fetch(`${BASE}/admin/runs`, { redirect: "manual" });
  const to = res.headers.get("location") ?? "";
  if (res.status !== 308 || !to.startsWith(SCRAPYARD)) throw new Error(`${res.status} → ${to}`);
});

const browser = await chromium.launch();
for (const width of [375, 1440]) {
  // Tallinn, not UTC like the server: a date rendered in the runtime's zone shows up as a hydration page error
  const page = await browser.newPage({ viewport: { width, height: width === 375 ? 812 : 900 }, timezoneId: "Europe/Tallinn" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  for (const path of PUBLIC_TABS) {
    await step(`${width}: ${path} has no sideways scroll`, async () => {
      await page.goto(`${BASE}${path}`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width) throw new Error(`scrollWidth ${sw} > ${width}`);
    });
  }
  await step(`${width}: Filtered lists a Jev-sorted article`, async () => {
    if (!jevSorted) throw new Error("no Jev-sorted article in the DB yet");
    await page.goto(`${BASE}/filtered`);
    await page.getByText(jevSorted.title, { exact: true }).first().waitFor({ timeout: 15000 });
  });

  await page.screenshot({ path: join(tmpdir(), `eudi-flows-${width}.png`) });
  if (errors.length) { failed++; console.log(`FAIL ${width}: page errors: ${errors.join(" | ")}`); }
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
