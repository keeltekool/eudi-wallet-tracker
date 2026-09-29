/**
 * Google's favicon service answers 404 (with a default globe image) for sites without a favicon, and browsers log
 * every 404 as a console error. Pass the image through with 200 instead; the CDN caches it per domain.
 */
const BLANK_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain") ?? "";
  if (!/^[a-z0-9.-]+$/i.test(domain)) return new Response("bad domain", { status: 400 });

  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`, { signal: AbortSignal.timeout(5_000) });
    if (r.status === 200 || r.status === 404) {
      return new Response(await r.arrayBuffer(), {
        headers: {
          "Content-Type": r.headers.get("content-type") ?? "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
        },
      });
    }
  } catch {
    // timeout or network error: fall through to the blank image
  }
  // Rate limit or outage upstream: a blank icon for an hour, never an error in the reader's console
  return new Response(BLANK_GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=3600" } });
}
