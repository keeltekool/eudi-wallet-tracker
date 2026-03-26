import { db } from "@/src/db/client";
import { articles, sources } from "@/src/db/schema";
import { desc, inArray } from "drizzle-orm";
import { Feed } from "../components/feed";
import { Header } from "../components/header";

export const dynamic = "force-dynamic";

export default async function FilteredPage() {
  // Show articles that passed the relevance filter (relevant + accepted)
  const filteredArticles = await db
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
    .where(inArray(articles.status, ["relevant", "accepted", "rejected"]))
    .orderBy(desc(articles.publishedAt), desc(articles.scrapedAt))
    .limit(200);

  // Get source names
  const sourceIds = [...new Set(filteredArticles.map((a) => a.sourceId))];
  const allSources =
    sourceIds.length > 0
      ? await db
          .select({ id: sources.id, name: sources.name })
          .from(sources)
          .where(inArray(sources.id, sourceIds))
      : [];

  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const articlesWithSource = filteredArticles.map((a) => ({
    ...a,
    sourceName: sourceMap.get(a.sourceId) || "Unknown",
  }));

  const allCategories = [
    ...new Set(
      filteredArticles.flatMap((a) => (a.categories as string[]) || [])
    ),
  ].sort();

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-16">
            <h2
              className="text-xl font-bold text-[#1A1A2E] mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No filtered articles yet
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
              The relevance filter hasn&apos;t run yet. Once it does, articles
              related to the EU Digital Identity Wallet will appear here —
              with the noise removed.
            </p>
          </div>
        ) : (
          <Feed articles={articlesWithSource} categories={allCategories} />
        )}
      </main>
    </div>
  );
}
