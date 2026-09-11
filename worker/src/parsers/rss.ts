import RssParser from "rss-parser";
import https from "https";
import type { ParseResult } from "./types";

async function resolveRedirect(url: string): Promise<string> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; EUDI-Tracker/1.0; +https://eudi-wallet-tracker.vercel.app)",
        },
        timeout: 6000,
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location;
          // EU consent wall — can't resolve, keep original
          if (loc.includes("consent.google.com")) {
            resolve(url);
            return;
          }
          // Follow one more hop if it's still a Google redirect
          if (loc.includes("google.com")) {
            resolveRedirect(loc).then(resolve).catch(() => resolve(url));
            return;
          }
          resolve(loc);
        } else {
          resolve(url);
        }
      }
    );
    req.on("error", () => resolve(url));
    req.on("timeout", () => { req.destroy(); resolve(url); });
  });
}

export async function parseRss(feedUrl: string): Promise<ParseResult> {
  try {
    const parser = new RssParser({
      timeout: 15000,
      headers: {
        "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
      },
    });

    const feed = await parser.parseURL(feedUrl);
    const isGoogleNews = feedUrl.includes("news.google.com");

    const rawArticles = feed.items
      .filter((item) => item.title?.trim() && item.link)
      .map((item) => ({
        title: item.title!.trim(),
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        author: item.creator || item["dc:creator"] || undefined,
        fullText: item.contentSnippet || item.content || undefined,
      }));

    if (!isGoogleNews) {
      return { articles: rawArticles, errors: [] };
    }

    // ponytail: resolve Google News redirects to publisher URLs.
    // Works from US GitHub Actions runners (no EU consent wall).
    // Falls back to original URL if redirect can't be followed.
    const resolved = await Promise.all(
      rawArticles.map(async (a) => {
        if (a.url.includes("news.google.com/rss/articles/")) {
          const realUrl = await resolveRedirect(a.url);
          return { ...a, url: realUrl };
        }
        return a;
      })
    );

    return { articles: resolved, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { articles: [], errors: [message] };
  }
}
