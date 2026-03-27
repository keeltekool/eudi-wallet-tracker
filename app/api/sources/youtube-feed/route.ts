import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  try {
    // Fetch the YouTube channel page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract channel_id from the page HTML
    const channelIdMatch = html.match(/channel_id=([^"&\s]+)/);
    if (!channelIdMatch) {
      // Try alternate pattern
      const altMatch = html.match(/"channelId":"(UC[^"]+)"/);
      if (!altMatch) {
        return NextResponse.json(
          { error: "Could not find channel ID" },
          { status: 400 }
        );
      }
      const channelId = altMatch[1];
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      // Try to get channel name
      const nameMatch = html.match(/<title>([^<]+)<\/title>/);
      const channelName = nameMatch
        ? nameMatch[1].replace(/ - YouTube$/, "").trim()
        : null;

      return NextResponse.json({ feedUrl, channelId, channelName });
    }

    const channelId = channelIdMatch[1];
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    // Try to get channel name
    const nameMatch = html.match(/<title>([^<]+)<\/title>/);
    const channelName = nameMatch
      ? nameMatch[1].replace(/ - YouTube$/, "").trim()
      : null;

    return NextResponse.json({ feedUrl, channelId, channelName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
