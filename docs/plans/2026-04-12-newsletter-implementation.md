# EUDI Tracker Newsletter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email newsletter to EUDI Tracker that sends Strategy Brief intelligence updates to subscribers via Brevo.

**Architecture:** Newsletter triggered from `update-living-doc.ts` after DB insert → hits `/api/newsletter/send` → fetches latest update log → converts markdown to inline-styled HTML → sends via Brevo to all active subscribers. Subscribe/unsubscribe via dedicated API routes + `/newsletter` page.

**Tech Stack:** Next.js 16, Drizzle ORM, Neon Postgres, Brevo REST API (no SDK)

**Design doc:** `docs/plans/2026-04-12-newsletter-design.md`

---

### Task 1: Set Up Brevo API Key

**Manual step — user creates the key, Claude adds it to env files.**

**Step 1:** User creates new Brevo API key named "EUDI Tracker" at https://app.brevo.com → Settings → SMTP & API → Generate new API key

**Step 2:** Add env vars to `.env.local`:

```
BREVO_API_KEY=<new key from user>
BREVO_SENDER_EMAIL=egertv@gmail.com
CRON_SECRET=eudi-tracker-newsletter-<random>
```

**Step 3:** Add same env vars to Vercel:

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker
printf 'VALUE' | vercel env add BREVO_API_KEY production
printf 'egertv@gmail.com' | vercel env add BREVO_SENDER_EMAIL production
printf 'VALUE' | vercel env add CRON_SECRET production
```

**Step 4:** Verify:

```bash
vercel env ls
```

Expected: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `CRON_SECRET` all listed for Production.

---

### Task 2: Add `newsletter_subscribers` Table to Schema + Push to DB

**Files:**
- Modify: `src/db/schema.ts` (append after living_doc table, line ~103)

**Step 1:** Add the table schema to `src/db/schema.ts`:

```typescript
// ── Newsletter Subscribers ───────────────────────

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});
```

**Step 2:** Push schema to Neon:

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker
npm run db:push
```

Expected: `newsletter_subscribers` table created. No data loss on existing tables.

**Step 3:** Verify table exists:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const dbUrl = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const sql = neon(dbUrl);
sql\`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'newsletter_subscribers' ORDER BY ordinal_position\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Expected: 5 columns listed (id, email, subscribed_at, unsubscribed_at, active).

**Step 4:** Commit:

```bash
git add src/db/schema.ts
git commit -m "feat: add newsletter_subscribers table schema"
```

---

### Task 3: Create Subscribe API Route

**Files:**
- Create: `app/api/newsletter/subscribe/route.ts`

**Step 1:** Create the route:

```typescript
import { db } from "@/src/db/client";
import { newsletterSubscribers } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

    // Upsert: if exists but inactive, reactivate
    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalized))
      .limit(1);

    if (existing) {
      if (existing.active) {
        return NextResponse.json({ success: true, message: "Already subscribed" });
      }
      await db
        .update(newsletterSubscribers)
        .set({ active: true, unsubscribedAt: null })
        .where(eq(newsletterSubscribers.id, existing.id));
    } else {
      await db.insert(newsletterSubscribers).values({ email: normalized });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2:** Test with curl:

```bash
node -e "
fetch('http://localhost:3000/api/newsletter/subscribe', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com' })
}).then(r => r.json()).then(console.log);
"
```

Expected: `{ success: true }`

**Step 3:** Verify in DB:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const dbUrl = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const sql = neon(dbUrl);
sql\`SELECT * FROM newsletter_subscribers\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Expected: One row with `test@example.com`, `active: true`.

**Step 4:** Commit:

```bash
git add app/api/newsletter/subscribe/route.ts
git commit -m "feat: add newsletter subscribe API route"
```

---

### Task 4: Create Unsubscribe API Route

**Files:**
- Create: `app/api/newsletter/unsubscribe/route.ts`

**Step 1:** Create the route (returns HTML confirmation page):

```typescript
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
```

**Step 2:** Test by visiting `http://localhost:3000/api/newsletter/unsubscribe?email=test@example.com` in browser.

Expected: HTML page saying "Unsubscribed". DB shows `active: false`.

**Step 3:** Commit:

```bash
git add app/api/newsletter/unsubscribe/route.ts
git commit -m "feat: add newsletter unsubscribe API route"
```

---

### Task 5: Create Newsletter Send API Route

**Files:**
- Create: `app/api/newsletter/send/route.ts`

**Step 1:** Create the route. This is the core — fetches latest update log, converts markdown to HTML, sends via Brevo:

```typescript
import { db } from "@/src/db/client";
import { livingDoc, newsletterSubscribers } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BASE_URL = "https://eudi-wallet-tracker.vercel.app";

function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      // H2 headers
      if (line.startsWith("## "))
        return `<h2 style="color:#1A1A2E;font-size:18px;font-weight:700;margin:24px 0 8px 0;font-family:'Fraunces',Georgia,serif">${line.slice(3)}</h2>`;
      // H3 headers
      if (line.startsWith("### "))
        return `<h3 style="color:#1A1A2E;font-size:15px;font-weight:700;margin:20px 0 6px 0;font-family:'Fraunces',Georgia,serif">${line.slice(4)}</h3>`;
      // Sub-bullets (context/source lines starting with →)
      if (line.trim().startsWith("→"))
        return `<p style="color:#4A5568;font-size:12px;line-height:1.5;margin:2px 0 2px 24px;padding-left:8px;border-left:2px solid #E3E0D9">${convertLinks(escapeHtml(line.trim().slice(2)))}</p>`;
      // Bullet points
      if (line.trim().startsWith("- ")) {
        const text = line.trim().slice(2);
        // Highlight tags like [NEW_FACT], [UPDATED_FACT] etc
        const highlighted = text.replace(
          /\[(NEW_FACT|UPDATED_FACT|RESOLVED_QUESTION|DEEPENED_INSIGHT)\]/g,
          '<span style="background:#FFD166;color:#1A1A2E;padding:1px 6px;font-size:10px;font-weight:700;letter-spacing:0.5px;display:inline-block;margin-right:4px">$1</span>'
        );
        return `<li style="color:#1A1A2E;font-size:13px;line-height:1.5;margin:6px 0;list-style:none;padding-left:12px">${convertLinks(highlighted)}</li>`;
      }
      // Stats line (Articles reviewed: ...)
      if (line.startsWith("Articles reviewed:"))
        return `<p style="color:#94A3B8;font-size:11px;letter-spacing:0.5px;margin:4px 0 16px 0">${escapeHtml(line)}</p>`;
      // Empty lines
      if (line.trim() === "") return "";
      // Default paragraph
      return `<p style="color:#4A5568;font-size:13px;line-height:1.5;margin:4px 0">${convertLinks(escapeHtml(line))}</p>`;
    })
    .join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function convertLinks(html: string): string {
  // Convert markdown links [text](url) to HTML anchors
  return html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#6366F1;text-decoration:underline" target="_blank">$1</a>'
  );
}

async function sendBrevoEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "EUDI Tracker",
          email: process.env.BREVO_SENDER_EMAIL!,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

export async function GET(req: Request) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch latest update log
    const [latest] = await db
      .select()
      .from(livingDoc)
      .where(eq(livingDoc.section, "update"))
      .orderBy(desc(livingDoc.runDate))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ sent: 0, reason: "No update log found" });
    }

    // Fetch active subscribers
    const subscribers = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.active, true));

    if (subscribers.length === 0) {
      return NextResponse.json({ sent: 0, reason: "No active subscribers" });
    }

    // Convert update content to HTML email
    const bodyHtml = markdownToHtml(latest.content);
    const updateDate = latest.runDate
      ? new Date(latest.runDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Recent";

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#F5F3EE;margin:0;padding:0;font-family:'DM Sans',system-ui,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">
<p style="color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:0 0 4px;font-weight:600">EUDI WALLET INTELLIGENCE</p>
<p style="color:#1A1A2E;font-size:11px;text-align:center;margin:0 0 32px;opacity:0.5">${updateDate}</p>
<div style="background:#FFFFFF;border:1px solid #E3E0D9;padding:28px 24px">
${bodyHtml}
</div>
<div style="text-align:center;margin:28px 0 0">
<a href="${BASE_URL}/strategy" style="display:inline-block;background:#FFD166;color:#1A1A2E;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:12px 32px;text-decoration:none;font-family:'DM Sans',system-ui,sans-serif">View Full Strategy Brief</a>
</div>
<hr style="border:none;border-top:1px solid #E3E0D9;margin:28px 0"/>
<p style="color:#94A3B8;font-size:11px;text-align:center;line-height:1.6">You're receiving this because you subscribed to EUDI Tracker intelligence updates.</p>
<p style="text-align:center;margin:6px 0 0"><a href="${BASE_URL}/api/newsletter/unsubscribe?email=EMAIL_PLACEHOLDER" style="color:#94A3B8;font-size:11px;text-decoration:underline">Unsubscribe</a></p>
</div></body></html>`;

    // Send in batches of 50
    let sent = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscribers.length; i += 50) {
      const batch = subscribers.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map((sub) => {
          const personalHtml = fullHtml.replace(
            "EMAIL_PLACEHOLDER",
            encodeURIComponent(sub.email)
          );
          return sendBrevoEmail(
            sub.email,
            "EUDI Tracker — New Intelligence Update",
            personalHtml
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
```

**Step 2:** Test manually (requires dev server running + env vars set):

```bash
node -e "
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const cronSecret = envContent.match(/CRON_SECRET=(.+)/)?.[1]?.trim();
fetch('http://localhost:3000/api/newsletter/send', {
  headers: { 'Authorization': 'Bearer ' + cronSecret }
}).then(r => r.json()).then(console.log);
"
```

Expected: `{ sent: N, total: N, errors: 0, ... }`

**Step 3:** Commit:

```bash
git add app/api/newsletter/send/route.ts
git commit -m "feat: add newsletter send route with Brevo + markdown-to-HTML"
```

---

### Task 6: Build Newsletter Subscribe Page

**Files:**
- Create: `app/newsletter/page.tsx`

**Step 1:** Create the page:

```tsx
"use client";

import { useState } from "react";
import { Header } from "../components/header";

export default function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong, try again");
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-xl mx-auto px-4 sm:px-10 py-16">
        <h1
          className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          EUDI Wallet Intelligence — Delivered to Your Inbox
        </h1>

        <p className="text-sm text-[#4A5568] leading-relaxed mb-8">
          Get notified when our AI curation pipeline discovers new developments
          in the European Digital Identity Wallet ecosystem. Each update includes
          categorized findings across regulation, technical standards, national
          implementations, and industry moves.
        </p>

        {status === "success" ? (
          <div className="bg-white border border-[#E3E0D9] rounded-xl px-6 py-5">
            <p
              className="text-sm font-semibold text-[#1A1A2E]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You're subscribed. Watch your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-4 py-3 bg-white border border-[#E3E0D9] rounded-xl text-sm text-[#1A1A2E] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition-colors"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-6 py-3 bg-[#FFD166] text-[#1A1A2E] text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-[#FFCA4D] transition-colors disabled:opacity-50"
                style={{ fontFamily: "var(--font-label)" }}
              >
                {status === "loading" ? "..." : "Subscribe"}
              </button>
            </div>

            {status === "error" && (
              <p className="text-sm text-red-600 mt-3">{errorMsg}</p>
            )}

            <p className="text-xs text-[#94A3B8] mt-4">
              You'll receive updates when new intelligence is published.
              Unsubscribe anytime.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
```

**Step 2:** Visit `http://localhost:3000/newsletter` — verify page renders, form works.

**Step 3:** Commit:

```bash
git add app/newsletter/page.tsx
git commit -m "feat: add newsletter subscribe page"
```

---

### Task 7: Add Newsletter Link to Header Nav

**Files:**
- Modify: `app/components/header.tsx:53-65`

**Step 1:** Add "Newsletter" link next to "Strategy Brief" in the right nav section. Replace the existing right `<nav>` block:

```tsx
        <nav className="flex items-center gap-4">
          <Link
            href="/strategy"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
              pathname === "/strategy"
                ? "text-[#1A1A2E]"
                : "text-[#4A5568] hover:text-[#1A1A2E]"
            }`}
            style={{ fontFamily: "var(--font-label)" }}
          >
            Strategy Brief
          </Link>
          <Link
            href="/newsletter"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
              pathname === "/newsletter"
                ? "text-[#1A1A2E]"
                : "text-[#4A5568] hover:text-[#1A1A2E]"
            }`}
            style={{ fontFamily: "var(--font-label)" }}
          >
            Newsletter
          </Link>
        </nav>
```

**Step 2:** Visit any page — verify "Newsletter" appears in header, links to `/newsletter`.

**Step 3:** Commit:

```bash
git add app/components/header.tsx
git commit -m "feat: add Newsletter link to header nav"
```

---

### Task 8: Wire `update-living-doc.ts` to Trigger Newsletter

**Files:**
- Modify: `worker/src/update-living-doc.ts:25-39`

**Step 1:** After the successful update insert, add a fetch call to the send endpoint. Add this block after the `console.log` on line 36:

```typescript
    // Trigger newsletter send
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://eudi-wallet-tracker.vercel.app";
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      try {
        const sendRes = await fetch(`${baseUrl}/api/newsletter/send`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
        const sendData = await sendRes.json();
        console.log("Newsletter:", JSON.stringify(sendData));
      } catch (err) {
        console.error("Newsletter trigger failed (update still saved):", err);
      }
    } else {
      console.log("CRON_SECRET not set, skipping newsletter trigger");
    }
```

**Step 2:** Verify the script still loads env correctly — `CRON_SECRET` must be in `.env.local` and the `config({ path: "../.env.local" })` at top of file picks it up.

**Step 3:** Commit:

```bash
git add worker/src/update-living-doc.ts
git commit -m "feat: trigger newsletter send after living doc update"
```

---

### Task 9: End-to-End Test

**No code changes — manual verification.**

**Step 1:** Subscribe your email via the `/newsletter` page on localhost:

Visit `http://localhost:3000/newsletter`, enter `egertv@gmail.com`, click Subscribe.

**Step 2:** Verify subscription in DB:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const dbUrl = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const sql = neon(dbUrl);
sql\`SELECT * FROM newsletter_subscribers WHERE active = true\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Expected: Your email listed, `active: true`.

**Step 3:** Trigger newsletter send manually against production:

```bash
node -e "
const fs = require('fs');
const cronSecret = fs.readFileSync('.env.local', 'utf8').match(/CRON_SECRET=(.+)/)?.[1]?.trim();
fetch('https://eudi-wallet-tracker.vercel.app/api/newsletter/send', {
  headers: { 'Authorization': 'Bearer ' + cronSecret }
}).then(r => r.json()).then(console.log);
"
```

Expected: `{ sent: 1, total: 1, errors: 0, ... }`

**Step 4:** Check Gmail — email arrives with intelligence update content, styled correctly.

**Step 5:** Click unsubscribe link in email footer — verify it shows confirmation page and marks subscriber inactive.

---

### Task 10: Deploy to Production

**Step 1:** Push all commits:

```bash
git push
```

**Step 2:** Deploy:

```bash
vercel --prod
```

**Step 3:** Verify production:

- Visit `https://eudi-wallet-tracker.vercel.app/newsletter` — page loads, form works
- Header shows "Newsletter" link on all pages
- Subscribe with test email, trigger send manually, verify email arrives

**Step 4:** Clean up test subscribers:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const dbUrl = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const sql = neon(dbUrl);
sql\`DELETE FROM newsletter_subscribers WHERE email = 'test@example.com'\`.then(() => console.log('Cleaned up'));
"
```

**Step 5:** Subscribe your real email via the production page.
