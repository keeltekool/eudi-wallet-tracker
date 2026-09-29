import { articles } from "../../src/db/schema";
import { hashUrl, hashContent } from "../../src/lib/hash";
import { validateArticle } from "../../src/lib/validate";
import { titleKey } from "../../src/lib/title-key";
import type { Database } from "../../src/db/index";
import type { RawArticle } from "./parsers/types";

type StoreResult = {
  inserted: number;
  duplicates: number;
  invalid: number;
  sameStory: number;
};

/**
 * `recent` maps titleKey → article id for everything scraped in the last 4 days (see runScrape). A new article
 * whose key is already there is stored as `irrelevant`, "Duplicate of #<id>": final, so it never reaches Jev,
 * curation or /filtered, and All articles still lists it.
 */
export async function deduplicateAndStore(
  db: Database,
  sourceId: number,
  rawArticles: RawArticle[],
  recent: Map<string, number>
): Promise<StoreResult> {
  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;
  let sameStory = 0;

  for (const raw of rawArticles) {
    const validation = validateArticle(raw);
    if (!validation.valid) {
      invalid++;
      continue;
    }

    const urlHash = hashUrl(raw.url);
    const contentHash = hashContent(raw.title, raw.fullText);
    const key = titleKey(raw.title);
    const originalId = key ? recent.get(key) : undefined;

    try {
      const [row] = await db
        .insert(articles)
        .values({
          sourceId,
          url: raw.url,
          urlHash,
          contentHash,
          title: raw.title,
          author: raw.author,
          publishedAt: raw.publishedAt,
          fullText: raw.fullText,
          status: originalId ? "irrelevant" : "pending",
          rejectionReason: originalId ? `Duplicate of #${originalId}` : null,
        })
        .onConflictDoNothing({ target: articles.urlHash })
        .returning({ id: articles.id });

      if (!row) {
        duplicates++;
      } else if (originalId) {
        sameStory++;
      } else {
        inserted++;
        if (key) recent.set(key, row.id);
      }
    } catch {
      duplicates++;
    }
  }

  return { inserted, duplicates, invalid, sameStory };
}
