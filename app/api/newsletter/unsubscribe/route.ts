import { db } from "@/src/db/client";
import { newsletterSubscribers } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response("Missing email", { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  await db
    .update(newsletterSubscribers)
    .set({ active: false, unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.email, normalized));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="background:#F5F3EE;margin:0;padding:60px 20px;font-family:'DM Sans',system-ui,sans-serif">
<div style="max-width:480px;margin:0 auto;text-align:center">
<h1 style="color:#1A1A2E;font-size:24px;font-weight:700;margin:0 0 12px">Unsubscribed</h1>
<p style="color:#4A5568;font-size:14px;line-height:1.6;margin:0 0 24px">You've been removed from the EUDI Tracker newsletter. You won't receive further updates.</p>
<a href="https://eudi-wallet-tracker.vercel.app/newsletter" style="color:#6366F1;font-size:14px;text-decoration:underline">Re-subscribe</a>
</div></body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
