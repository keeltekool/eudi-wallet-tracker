import * as cheerio from "cheerio";
import type { ParseResult, ParserConfig } from "./types";

export async function parseCss(
  pageUrl: string,
  config: ParserConfig
): Promise<ParseResult> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        articles: [],
        errors: [`HTTP ${response.status} from ${pageUrl}`],
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    if (!config.articleSelector) {
      return { articles: [], errors: ["No articleSelector configured"] };
    }

    const articles: ParseResult["articles"] = [];

    $(config.articleSelector).each((_, el) => {
      const $el = $(el);

      const titleEl = config.titleSelector
        ? $el.find(config.titleSelector)
        : $el;
      const title = titleEl.text().trim();

      const linkEl = config.linkSelector
        ? $el.find(config.linkSelector)
        : titleEl;
      const rawHref = linkEl.attr("href") || "";

      if (!title || !rawHref) return;

      const url = resolveUrl(rawHref, config.baseUrl || pageUrl);

      const dateText = config.dateSelector
        ? $el.find(config.dateSelector).text().trim()
        : undefined;
      const publishedAt = dateText ? parseDate(dateText) : undefined;

      const author = config.authorSelector
        ? $el.find(config.authorSelector).text().trim() || undefined
        : undefined;

      const fullText = config.excerptSelector
        ? $el.find(config.excerptSelector).text().trim() || undefined
        : undefined;

      articles.push({ title, url, publishedAt, author, fullText });
    });

    return { articles, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { articles: [], errors: [message] };
  }
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseDate(dateStr: string): Date | undefined {
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
