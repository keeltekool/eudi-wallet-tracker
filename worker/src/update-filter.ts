/**
 * Takes JSON filter decisions from stdin and writes to Neon.
 * Input: { "decisions": [{ "id": 1, "status": "relevant" }, { "id": 2, "status": "irrelevant" }] }
 */
import { config } from "dotenv";
config({ path: "../.env.local" });

import { createDb } from "../../src/db/index";
import { articles } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

type FilterDecision = {
  id: number;
  status: "relevant" | "irrelevant";
};

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf-8");

  let decisions: FilterDecision[];
  try {
    const parsed = JSON.parse(input);
    decisions = parsed.decisions;
  } catch {
    console.error("Invalid JSON input");
    process.exit(1);
  }

  if (!decisions || decisions.length === 0) {
    console.log("No decisions to process.");
    process.exit(0);
  }

  const db = createDb(DATABASE_URL!);
  let relevant = 0;
  let irrelevant = 0;
  let errors = 0;

  for (const d of decisions) {
    try {
      await db
        .update(articles)
        .set({ status: d.status })
        .where(eq(articles.id, d.id));
      if (d.status === "relevant") relevant++;
      else irrelevant++;
    } catch (err) {
      console.error(`Failed to update article ${d.id}:`, err);
      errors++;
    }
  }

  console.log(
    JSON.stringify({ relevant, irrelevant, errors, total: decisions.length })
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
