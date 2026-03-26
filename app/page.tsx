import { db } from "@/src/db/client";
import { articles, sources } from "@/src/db/schema";
import { desc, inArray } from "drizzle-orm";
import { Feed } from "./components/feed";
import { Header } from "./components/header";

export const dynamic = "force-dynamic";

export default async function AllArticlesPage() {
  // ALL articles — no status filter, no enrichment displayed
  const allArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      scrapedAt: articles.scrapedAt,
      summary: articles.summary,
      relevanceScore: articles.relevanceScore,
      categories: articles.categories,
      status: articles.status,
      sourceId: articles.sourceId,
      author: articles.author,
    })
    .from(articles)
    .orderBy(desc(articles.publishedAt), desc(articles.scrapedAt))
    .limit(500);

  const sourceIds = [...new Set(allArticles.map((a) => a.sourceId))];
  const allSources =
    sourceIds.length > 0
      ? await db
          .select({ id: sources.id, name: sources.name })
          .from(sources)
          .where(inArray(sources.id, sourceIds))
      : [];
  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const articlesWithSource = allArticles.map((a) => ({
    ...a,
    sourceName: sourceMap.get(a.sourceId) || "Unknown",
  }));

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        <Feed articles={articlesWithSource} variant="raw" />
      </main>
    </div>
  );
}
