# EUDI Tracker Newsletter — Design Doc

> Date: 2026-04-12
> Status: Approved

## Overview

Weekly intelligence newsletter for EUDI Wallet Tracker subscribers. Sends the Strategy Brief update log content as a styled HTML email whenever the living doc curation loop runs.

## Subscribe Page (`/newsletter`)

Dedicated lightweight page linked from the header nav.

- **Headline:** "EUDI Wallet Intelligence — Delivered to Your Inbox"
- **Subtext:** "Get notified when our AI curation pipeline discovers new developments in the European Digital Identity Wallet ecosystem. Each update includes categorized findings across regulation, technical standards, national implementations, and industry moves."
- **Email input + "Subscribe" button** — single row, amber (#FFD166) button, ink black text
- **Below form:** "You'll receive updates when new intelligence is published. Unsubscribe anytime."
- **Success state:** Input replaced with "You're subscribed. Watch your inbox."
- **Error state:** Red text below input

**Header nav:** Add "Newsletter" link to right side, next to "Strategy Brief". Same uppercase label styling.

## Email Template

- **Subject:** "EUDI Tracker — New Intelligence Update"
- **Body:** The `living_doc.content` field converted from markdown to HTML
- **Styling:** EUDI Tracker design system — parchment bg (#F5F3EE), ink black text (#1A1A2E), amber accents (#FFD166)
- **Footer:** "View full Strategy Brief" link to /strategy + unsubscribe link

No parsing, no extraction. The content field IS the email body, just styled as HTML.

## Trigger Mechanism

No Vercel cron. Newsletter fires from `update-living-doc.ts` after successful DB insert.

```
Curation loop runs (manually)
    ↓
update-living-doc.ts inserts update log into living_doc table
    ↓ success
Calls GET /api/newsletter/send with Authorization: Bearer <CRON_SECRET>
    ↓
Send route fetches latest update, converts markdown to HTML, sends via Brevo
```

If the fetch to the send endpoint fails, the update is still saved. Newsletter can be triggered manually later.

## Data

**New DB table: `newsletter_subscribers`**
- id (serial, PK)
- email (text, unique, not null)
- subscribed_at (timestamp, default now)
- unsubscribed_at (timestamp, nullable)
- active (boolean, default true)

**New API routes:**
- `POST /api/newsletter/subscribe` — upsert subscriber, set active
- `GET /api/newsletter/unsubscribe?email=...` — mark inactive, show confirmation HTML
- `GET /api/newsletter/send` — auth'd, fetches latest update, sends to active subscribers

## Email Service

- **Provider:** Brevo (separate API key from WHO DIS? project)
- **Env vars:** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `CRON_SECRET`
- **Sender name:** "EUDI Tracker"
- **Sender email:** egertv@gmail.com

## Existing Code Changes

- `worker/src/update-living-doc.ts` — add fetch call to /api/newsletter/send after successful insert
- `app/components/header.tsx` — add "Newsletter" nav link
- `src/db/schema.ts` — add newsletter_subscribers table schema

## Design System (matches app)

- Background: #F5F3EE (warm parchment)
- Text: #1A1A2E (ink black)
- Accent: #FFD166 (amber)
- Borders: #E3E0D9
- Links: #6366F1 (indigo)
- Fonts: Fraunces (display), DM Sans (body), Epilogue (labels)
