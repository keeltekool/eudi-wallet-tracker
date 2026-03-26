import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { type, url, config } = await request.json();

  try {
    let articles;

    if (type === "rss") {
      const RssParser = (await import("rss-parser")).default;
      const parser = new RssParser({
        timeout: 15000,
        headers: {
          "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
        },
      });
      const feedUrl = config.feedUrl || url;
      const feed = await parser.parseURL(feedUrl);
      articles = feed.items
        .filter((item: any) => item.title?.trim() && item.link)
        .slice(0, 10)
        .map((item: any) => ({
          title: item.title?.trim(),
          url: item.link,
          publishedAt: item.pubDate || null,
          author: item.creator || item["dc:creator"] || null,
        }));
    } else if (type === "css") {
      const cheerio = await import("cheerio");
      const response = await fetch(url, {
        headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      if (!config.articleSelector) {
        throw new Error("No articleSelector in config");
      }

      articles = [];
      $(config.articleSelector).each((_: number, el: any) => {
        const $el = $(el);
        const titleEl = config.titleSelector
          ? $el.find(config.titleSelector)
          : $el;
        const title = titleEl.text().trim();
        const linkEl = config.linkSelector
          ? $el.find(config.linkSelector)
          : titleEl;
        const href = linkEl.attr("href") || "";

        if (!title || !href) return;
        const resolvedUrl = new URL(href, config.baseUrl || url).toString();

        articles.push({
          title,
          url: resolvedUrl,
          publishedAt: config.dateSelector
            ? $el.find(config.dateSelector).text().trim() || null
            : null,
          author: config.authorSelector
            ? $el.find(config.authorSelector).text().trim() || null
            : null,
        });
      });

      articles = articles.slice(0, 10);
    } else {
      throw new Error(`Unknown type: ${type}`);
    }

    return NextResponse.json({ articles, count: articles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, articles: [] }, { status: 400 });
  }
}
