import RssParser from "rss-parser";
import type { ParseResult } from "./types";

export async function parseRss(feedUrl: string): Promise<ParseResult> {
  try {
    const parser = new RssParser({
      timeout: 15000,
      headers: {
        "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
      },
    });

    const feed = await parser.parseURL(feedUrl);
    const articles = feed.items
      .filter((item) => item.title?.trim() && item.link)
      .map((item) => ({
        title: item.title!.trim(),
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        author: item.creator || item["dc:creator"] || undefined,
        fullText: item.contentSnippet || item.content || undefined,
      }));

    return { articles, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { articles: [], errors: [message] };
  }
}
