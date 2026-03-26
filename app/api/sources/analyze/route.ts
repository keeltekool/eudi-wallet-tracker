import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  try {
    // 1. Fetch the page HTML
    const response = await fetch(url, {
      headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status} from ${url}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const truncatedHtml = html.slice(0, 50000);

    // 2. Ask Claude to generate CSS selectors
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this HTML page and generate CSS selectors to extract news/blog articles.

The page URL is: ${url}

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

    // 3. Parse the response
    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const config = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
