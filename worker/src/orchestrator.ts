import { eq } from "drizzle-orm";
import { sources, scrapeRuns } from "../../src/db/schema";
import type { ScrapeError } from "../../src/db/schema";
import type { Database } from "../../src/db/index";
import { parseSource } from "./parsers/index";
import { deduplicateAndStore } from "./store";

export async function runScrape(db: Database): Promise<void> {
  console.log(`[scrape] Starting scrape run at ${new Date().toISOString()}`);

  // 1. Create scrape run record
  const [run] = await db
    .insert(scrapeRuns)
    .values({ status: "running" })
    .returning({ id: scrapeRuns.id });

  let totalArticles = 0;
  let sourcesScraped = 0;
  const errors: ScrapeError[] = [];

  try {
    // 2. Load active sources
    const activeSources = await db
      .select()
      .from(sources)
      .where(eq(sources.active, true));

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
            result.articles
          );
          console.log(
            `[scrape] ${source.name}: ${storeResult.inserted} new, ${storeResult.duplicates} dupes, ${storeResult.invalid} invalid`
          );
          totalArticles += storeResult.inserted;
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

    // 4. Mark run as complete
    await db
      .update(scrapeRuns)
      .set({
        completedAt: new Date(),
        status:
          errors.length > 0 && sourcesScraped === 0 ? "failed" : "success",
        sourcesScraped,
        articlesFound: totalArticles,
        errors,
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
