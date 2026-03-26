import { articles } from "../../src/db/schema";
import { hashUrl, hashContent } from "../../src/lib/hash";
import { validateArticle } from "../../src/lib/validate";
import type { Database } from "../../src/db/index";
import type { RawArticle } from "./parsers/types";

type StoreResult = {
  inserted: number;
  duplicates: number;
  invalid: number;
};

export async function deduplicateAndStore(
  db: Database,
  sourceId: number,
  rawArticles: RawArticle[]
): Promise<StoreResult> {
  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const raw of rawArticles) {
    const validation = validateArticle(raw);
    if (!validation.valid) {
      invalid++;
      continue;
    }

    const urlHash = hashUrl(raw.url);
    const contentHash = hashContent(raw.title, raw.fullText);

    try {
      const result = await db
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
          status: "pending",
        })
        .onConflictDoNothing({ target: articles.urlHash });

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        duplicates++;
      }
    } catch {
      duplicates++;
    }
  }

  return { inserted, duplicates, invalid };
}
