/**
 * Takes JSON curation decisions from stdin and writes them to Neon.
 * Expected input format (JSON):
 * {
 *   "decisions": [
 *     { "id": 1, "status": "accepted", "relevanceScore": 8, "summary": "...", "categories": ["regulation"] },
 *     { "id": 2, "status": "rejected", "relevanceScore": 3, "rejectionReason": "Not EUDI related" }
 *   ]
 * }
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

type Decision = {
  id: number;
  status: "accepted" | "rejected";
  relevanceScore: number;
  summary?: string;
  categories?: string[];
  rejectionReason?: string;
};

async function main() {
  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf-8");

  let decisions: Decision[];
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

  let accepted = 0;
  let rejected = 0;
  let errors = 0;

  for (const d of decisions) {
    try {
      if (d.status === "accepted") {
        await db
          .update(articles)
          .set({
            status: "accepted",
            relevanceScore: d.relevanceScore,
            summary: d.summary || null,
            categories: d.categories || [],
          })
          .where(eq(articles.id, d.id));
        accepted++;
      } else {
        await db
          .update(articles)
          .set({
            status: "rejected",
            relevanceScore: d.relevanceScore,
            rejectionReason: d.rejectionReason || "Below relevance threshold",
          })
          .where(eq(articles.id, d.id));
        rejected++;
      }
    } catch (err) {
      console.error(`Failed to update article ${d.id}:`, err);
      errors++;
    }
  }

  console.log(
    JSON.stringify({ accepted, rejected, errors, total: decisions.length })
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
