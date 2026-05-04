import { db } from "@/src/db/client";
import { livingDoc, newsletterSubscribers } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  markdownToHtml,
  buildNewsletterHtml,
  sendBrevoEmail,
} from "@/src/lib/newsletter";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [latest] = await db
      .select()
      .from(livingDoc)
      .where(eq(livingDoc.section, "update"))
      .orderBy(desc(livingDoc.runDate))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ sent: 0, reason: "No update log found" });
    }

    const subscribers = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.active, true));

    if (subscribers.length === 0) {
      return NextResponse.json({ sent: 0, reason: "No active subscribers" });
    }

    const bodyHtml = markdownToHtml(latest.content);
    const updateDate = latest.runDate
      ? new Date(latest.runDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Recent";

    let sent = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscribers.length; i += 50) {
      const batch = subscribers.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map((sub) => {
          const html = buildNewsletterHtml(bodyHtml, updateDate, sub.email);
          return sendBrevoEmail(
            sub.email,
            "EUDI Tracker \u2014 New Intelligence Update",
            html
          );
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.success) {
          sent++;
        } else {
          const error =
            r.status === "fulfilled"
              ? r.value.error || "Send failed"
              : r.reason?.message || "Unknown error";
          errors.push(error);
        }
      }
    }

    return NextResponse.json({
      sent,
      total: subscribers.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 5),
      updateId: latest.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Newsletter send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
