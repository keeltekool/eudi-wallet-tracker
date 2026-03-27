import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { inArray, eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const { ids, action } = (await request.json()) as {
    ids: number[];
    action: "delete" | "pause" | "resume" | "reanalyze";
  };

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  if (action === "delete") {
    await db.delete(sources).where(inArray(sources.id, ids));
    return NextResponse.json({ ok: true, action, count: ids.length });
  }

  if (action === "pause") {
    await db
      .update(sources)
      .set({ active: false })
      .where(inArray(sources.id, ids));
    return NextResponse.json({ ok: true, action, count: ids.length });
  }

  if (action === "resume") {
    await db
      .update(sources)
      .set({ active: true })
      .where(inArray(sources.id, ids));
    return NextResponse.json({ ok: true, action, count: ids.length });
  }

  if (action === "reanalyze") {
    const toAnalyze = await db
      .select()
      .from(sources)
      .where(inArray(sources.id, ids));

    const results: { id: number; name: string; status: string; articlesFound?: number }[] = [];

    for (const source of toAnalyze) {
      if (source.type !== "css") {
        results.push({ id: source.id, name: source.name, status: "skipped-rss" });
        continue;
      }

      try {
        const response = await fetch(source.url, {
          headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)" },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          results.push({ id: source.id, name: source.name, status: `http-${response.status}` });
          continue;
        }

        const html = await response.text();
        const truncatedHtml = html.slice(0, 50000);

        const anthropic = new Anthropic();
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Analyze this HTML page and generate CSS selectors to extract news/blog articles.\n\nThe page URL is: ${source.url}\n\nReturn ONLY a JSON object with these fields:\n- articleSelector: CSS selector for each article/post container\n- titleSelector: CSS selector for the title within each article (relative to articleSelector)\n- linkSelector: CSS selector for the link within each article (relative to articleSelector)\n- dateSelector: CSS selector for the date (or null)\n- authorSelector: CSS selector for the author (or null)\n- excerptSelector: CSS selector for the excerpt (or null)\n- baseUrl: the base URL for resolving relative links\n\nAll selectors except articleSelector should be RELATIVE to the article container. Prefer stable class-based selectors. Only return JSON.\n\nHTML:\n${truncatedHtml}`,
            },
          ],
        });

        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ id: source.id, name: source.name, status: "no-json" });
          continue;
        }

        const config = JSON.parse(jsonMatch[0]);

        // Test selectors
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        let articleCount = 0;
        if (config.articleSelector) {
          $(config.articleSelector).each(() => { articleCount++; });
        }

        await db.update(sources).set({ config }).where(eq(sources.id, source.id));

        results.push({
          id: source.id,
          name: source.name,
          status: articleCount > 0 ? "success" : "no-articles",
          articlesFound: articleCount,
        });
      } catch (err) {
        results.push({
          id: source.id,
          name: source.name,
          status: "error",
        });
      }
    }

    return NextResponse.json({ ok: true, action, results });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
