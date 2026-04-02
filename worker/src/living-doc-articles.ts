import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function getArticles() {
  const sinceArg = process.argv[2];

  let rows;
  if (sinceArg) {
    rows = await sql`
      SELECT id, title, url, summary, categories, relevance_score, published_at, source_id
      FROM articles
      WHERE status = 'accepted' AND scraped_at > ${sinceArg}::timestamptz
      ORDER BY published_at DESC
    `;
  } else {
    rows = await sql`
      SELECT id, title, url, summary, categories, relevance_score, published_at, source_id
      FROM articles
      WHERE status = 'accepted'
      ORDER BY published_at DESC
    `;
  }

  const sourceIds = [...new Set(rows.map((r: any) => r.source_id))];
  let sourceMap: Record<number, string> = {};
  if (sourceIds.length > 0) {
    const sources = await sql`SELECT id, name FROM sources WHERE id = ANY(${sourceIds})`;
    sourceMap = Object.fromEntries(sources.map((s: any) => [s.id, s.name]));
  }

  const articles = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    summary: r.summary,
    categories: r.categories,
    relevanceScore: r.relevance_score,
    publishedAt: r.published_at,
    source: sourceMap[r.source_id] || "Unknown",
  }));

  console.log(JSON.stringify({ count: articles.length, articles }, null, 2));
}

getArticles().catch(console.error);
