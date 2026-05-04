import { db } from "@/src/db/client";
import { newsletterSubscribers } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendLatestUpdateToEmail } from "@/src/lib/newsletter";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const normalized = email.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalized))
      .limit(1);

    let isNewSubscription = false;

    if (existing) {
      if (existing.active) {
        return NextResponse.json({ success: true, message: "Already subscribed" });
      }
      await db
        .update(newsletterSubscribers)
        .set({ active: true, unsubscribedAt: null })
        .where(eq(newsletterSubscribers.id, existing.id));
      isNewSubscription = true;
    } else {
      await db.insert(newsletterSubscribers).values({ email: normalized });
      isNewSubscription = true;
    }

    // Send latest intelligence update as welcome email
    let welcomeSent = false;
    if (isNewSubscription) {
      const result = await sendLatestUpdateToEmail(normalized);
      welcomeSent = result.success;
    }

    return NextResponse.json({ success: true, welcomeSent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
