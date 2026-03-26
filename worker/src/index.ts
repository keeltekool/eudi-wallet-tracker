import { config } from "dotenv";
config({ path: ".env.local" });

import cron from "node-cron";
import { createDb } from "../../src/db/index";
import { runScrape } from "./orchestrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

// Twice-weekly: Wednesday 06:00 UTC and Saturday 06:00 UTC
cron.schedule("0 6 * * 3,6", async () => {
  console.log("[cron] Triggered twice-weekly scrape");
  try {
    await runScrape(db);
  } catch (err) {
    console.error("[cron] Scrape failed:", err);
  }
});

console.log("[worker] EUDI Wallet Tracker worker started");
console.log("[worker] Scrape schedule: Wed + Sat at 06:00 UTC");
