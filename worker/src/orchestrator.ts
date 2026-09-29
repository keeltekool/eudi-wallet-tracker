import { desc, eq, gt, sql } from "drizzle-orm";
import { articles, sources, scrapeRuns } from "../../src/db/schema";
import type { ScrapeError } from "../../src/db/schema";
import type { Database } from "../../src/db/index";
import { titleKey } from "../../src/lib/title-key";
import { parseSource } from "./parsers/index";
import { deduplicateAndStore } from "./store";
import { filterPending } from "./jev-filter";

/** typesafeKey absent → articles stay pending for the routine's Stage 0 (the rollback path). */
export async function runScrape(db: Database, typesafeKey?: string): Promise<void> {
  console.log(`[scrape] Starting scrape run at ${new Date().toISOString()}`);

  // 1. Create scrape run record
  const [run] = await db
    .insert(scrapeRuns)
    .values({ status: "running" })
    .returning({ id: scrapeRuns.id });

  let totalArticles = 0;
  let sameStory = 0;
  let sourcesScraped = 0;
  const errors: ScrapeError[] = [];

  try {
    // Same-story keys of the last 4 days; newest first, so the map ends up pointing at the oldest copy
    const recentRows = await db
      .select({ id: articles.id, title: articles.title })
      .from(articles)
      .where(gt(articles.scrapedAt, new Date(Date.now() - 4 * 86_400_000)))
      .orderBy(desc(articles.id));
    const recent = new Map(recentRows.map((a) => [titleKey(a.title), a.id]));

    // 2. Load active sources; aggregators last, so a story's first (kept) copy is the publisher's own, with a body
    const activeSources = await db
      .select()
      .from(sources)
      .where(eq(sources.active, true))
      .orderBy(sql`(${sources.url} like '%news.google.com%' or ${sources.url} like '%rss.app%')`);

    console.log(`[scrape] Found ${activeSources.length} active sources`);

    // 3. Process each source sequentially (be polite to servers)
    for (const source of activeSources) {
      console.log(`[scrape] Processing: ${source.name} (${source.type})`);

      try {
        const result = await parseSource({
          type: source.type,
          url: source.url,
          config: (source.config as any) || {},
        });

        if (result.errors.length > 0) {
          console.warn(
            `[scrape] ${source.name}: ${result.errors.join(", ")}`
          );
          errors.push({
            sourceId: source.id,
            sourceName: source.name,
            error: result.errors.join("; "),
          });
        }

        if (result.articles.length > 0) {
          const storeResult = await deduplicateAndStore(
            db,
            source.id,
            result.articles,
            recent
          );
          console.log(
            `[scrape] ${source.name}: ${storeResult.inserted} new, ${storeResult.sameStory} same story, ${storeResult.duplicates} dupes, ${storeResult.invalid} invalid`
          );
          totalArticles += storeResult.inserted;
          sameStory += storeResult.sameStory;
        } else if (result.errors.length === 0) {
          console.log(`[scrape] ${source.name}: 0 articles found`);
        }

        // Update source's last scraped timestamp
        await db
          .update(sources)
          .set({
            lastScrapedAt: new Date(),
            lastArticleCount: result.articles.length,
          })
          .where(eq(sources.id, source.id));

        sourcesScraped++;

        // Polite delay between sources (1 second)
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scrape] ${source.name} FAILED: ${message}`);
        errors.push({
          sourceId: source.id,
          sourceName: source.name,
          error: message,
        });
      }
    }

    // 4. Jev sorts every pending article (never throws; failures leave articles pending)
    const jev = await filterPending(db, typesafeKey);

    // 5. Mark run as complete
    await db
      .update(scrapeRuns)
      .set({
        completedAt: new Date(),
        status:
          errors.length > 0 && sourcesScraped === 0 ? "failed" : "success",
        sourcesScraped,
        articlesFound: totalArticles,
        errors,
        jev: { ...jev, duplicates: sameStory },
      })
      .where(eq(scrapeRuns.id, run.id));

    console.log(
      `[scrape] Complete: ${sourcesScraped} sources, ${totalArticles} new articles, ${errors.length} errors`
    );
  } catch (err) {
    // Fatal error — mark run as failed
    await db
      .update(scrapeRuns)
      .set({
        completedAt: new Date(),
        status: "failed",
        sourcesScraped,
        articlesFound: totalArticles,
        errors: [
          ...errors,
          {
            sourceId: 0,
            sourceName: "orchestrator",
            error: err instanceof Error ? err.message : String(err),
          },
        ],
      })
      .where(eq(scrapeRuns.id, run.id));

    console.error(`[scrape] Fatal error: ${err}`);
    throw err;
  }
}
