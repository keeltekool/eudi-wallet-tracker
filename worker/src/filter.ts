/**
 * Reads pending articles from Neon for the filter loop.
 * Outputs JSON to stdout — article IDs + titles + excerpts.
 */
import { config } from "dotenv";
config({ path: "../.env.local" });

import { createDb } from "../../src/db/index";
import { articles, sources } from "../../src/db/schema";
import { eq, inArray } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const db = createDb(DATABASE_URL!);

  const pending = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      fullText: articles.fullText,
      sourceId: articles.sourceId,
    })
    .from(articles)
    .where(eq(articles.status, "pending"))
    .limit(100);

  if (pending.length === 0) {
    console.log(JSON.stringify({ count: 0, articles: [] }));
    process.exit(0);
  }

  const sourceIds = [...new Set(pending.map((a) => a.sourceId))];
  const allSources = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources)
    .where(inArray(sources.id, sourceIds));
  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const output = pending.map((a) => ({
    id: a.id,
    title: a.title,
    source: sourceMap.get(a.sourceId) || "Unknown",
    excerpt: a.fullText ? a.fullText.slice(0, 300) : null,
  }));

  console.log(JSON.stringify({ count: output.length, articles: output }));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
