import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

// POST: Analyze a single CSS source and update its config
// Body: { sourceId: number }
export async function POST(request: NextRequest) {
  const { sourceId } = await request.json();

  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId));

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (source.type !== "css") {
    return NextResponse.json(
      { error: "Only CSS sources need selector setup" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the page
    const response = await fetch(source.url, {
      headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({
        sourceId,
        sourceName: source.name,
        status: "failed",
        error: `HTTP ${response.status}`,
      });
    }

    const html = await response.text();
    const truncatedHtml = html.slice(0, 50000);

    // 2. Claude AI analysis
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this HTML page and generate CSS selectors to extract news/blog articles.

The page URL is: ${source.url}

Return ONLY a JSON object with these fields:
- articleSelector: CSS selector for each article/post container
- titleSelector: CSS selector for the title within each article (relative to articleSelector)
- linkSelector: CSS selector for the link within each article (relative to articleSelector)
- dateSelector: CSS selector for the date within each article (or null if not available)
- authorSelector: CSS selector for the author within each article (or null if not available)
- excerptSelector: CSS selector for the excerpt/summary within each article (or null if not available)
- baseUrl: the base URL for resolving relative links (usually the origin of the page URL)

Important:
- All selectors except articleSelector should be RELATIVE to the article container
- Prefer selectors that are stable (class-based over position-based)
- Only return the JSON, no explanation

HTML:
${truncatedHtml}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        sourceId,
        sourceName: source.name,
        status: "failed",
        error: "No JSON in AI response",
      });
    }

    const config = JSON.parse(jsonMatch[0]);

    // 3. Test the selectors with a dry-run
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    let articleCount = 0;

    if (config.articleSelector) {
      $(config.articleSelector).each(() => {
        articleCount++;
      });
    }

    // 4. Update the source config in DB
    await db
      .update(sources)
      .set({ config })
      .where(eq(sources.id, sourceId));

    return NextResponse.json({
      sourceId,
      sourceName: source.name,
      status: articleCount > 0 ? "success" : "no-articles",
      config,
      articlesFound: articleCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      sourceId,
      sourceName: source.name,
      status: "failed",
      error: message,
    });
  }
}

// GET: List all CSS sources that need setup
export async function GET() {
  const cssSources = await db
    .select()
    .from(sources)
    .where(and(eq(sources.type, "css"), eq(sources.active, true)));

  const needsSetup = cssSources.filter((s) => {
    const config = s.config as Record<string, unknown> | null;
    return !config || !config.articleSelector;
  });

  return NextResponse.json({
    total: cssSources.length,
    needsSetup: needsSetup.length,
    sources: needsSetup.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
    })),
  });
}
