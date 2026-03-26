import { db } from "@/src/db/client";
import { articles, sources } from "@/src/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { Feed } from "../components/feed";
import { Header } from "../components/header";

export const dynamic = "force-dynamic";

export default async function CuratedPage() {
  // Only show accepted articles (AI-reviewed and approved)
  const acceptedArticles = await db
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
    .where(eq(articles.status, "accepted"))
    .orderBy(desc(articles.publishedAt), desc(articles.scrapedAt))
    .limit(200);

  // Get source names
  const sourceIds = [...new Set(acceptedArticles.map((a) => a.sourceId))];
  const allSources =
    sourceIds.length > 0
      ? await db
          .select({ id: sources.id, name: sources.name })
          .from(sources)
          .where(inArray(sources.id, sourceIds))
      : [];

  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const articlesWithSource = acceptedArticles.map((a) => ({
    ...a,
    sourceName: sourceMap.get(a.sourceId) || "Unknown",
  }));

  const allCategories = [
    ...new Set(
      acceptedArticles.flatMap((a) => (a.categories as string[]) || [])
    ),
  ].sort();

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        {acceptedArticles.length === 0 ? (
          <div className="text-center py-16">
            <h2
              className="text-xl font-bold text-[#1A1A2E] mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No curated articles yet
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
              The AI curation loop hasn&apos;t run yet. Once it does, it will
              review incoming articles, score their relevance, write summaries,
              and assign categories. The best articles appear here.
            </p>
          </div>
        ) : (
          <Feed articles={articlesWithSource} categories={allCategories} />
        )}
      </main>
    </div>
  );
}
