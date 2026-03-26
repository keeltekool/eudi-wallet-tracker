/**
 * Reads pending articles from Neon and outputs them as structured text
 * for Claude Code loop to analyze. Outputs JSON to stdout.
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
      author: articles.author,
      publishedAt: articles.publishedAt,
      sourceId: articles.sourceId,
    })
    .from(articles)
    .where(eq(articles.status, "pending"))
    .limit(50);

  if (pending.length === 0) {
    console.log(JSON.stringify({ count: 0, articles: [] }));
    process.exit(0);
  }

  // Get source names
  const sourceIds = [...new Set(pending.map((a) => a.sourceId))];
  const allSources = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources)
    .where(inArray(sources.id, sourceIds));

  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const output = pending.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    source: sourceMap.get(a.sourceId) || "Unknown",
    author: a.author || null,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    excerpt: a.fullText ? a.fullText.slice(0, 500) : null,
  }));

  console.log(JSON.stringify({ count: output.length, articles: output }));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
