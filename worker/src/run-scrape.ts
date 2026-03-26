import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb } from "../../src/db/index";
import { runScrape } from "./orchestrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const db = createDb(DATABASE_URL!);
  await runScrape(db);
  console.log("Manual scrape complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
