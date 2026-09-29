/**
 * Google's favicon service answers 404 (with a default globe image) for sites without a favicon, and browsers log
 * every 404 as a console error. Pass the image through with 200 instead; the CDN caches it per domain.
 */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain") ?? "";
  if (!/^[a-z0-9.-]+$/i.test(domain)) return new Response("bad domain", { status: 400 });

  const r = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`);
  return new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
