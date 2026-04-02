# Living Strategy Document — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the Living Strategy Document into the EUDI Wallet Tracker — Google Doc creation, `/strategy` page with collapsible Bible + update logs, Neon `living_doc` table, curation loop prompt update, and manual first run.

**Architecture:** Google Doc is the master ("Bible"). Neon `living_doc` table caches the Bible content + stores per-run intelligence update logs. `/strategy` page reads from Neon, renders with project design system. Curation loop gains a new Step 4 (twice-monthly) that analyzes new articles against the Bible and writes updates to both Google Doc and Neon.

**Tech Stack:** Next.js 16, Drizzle ORM, Neon Postgres, `gws docs` CLI, Tailwind CSS v4, React 19

**Design doc:** `docs/plans/2026-04-02-living-doc-integration.md`

---

## Task 1: Add `living_doc` table to Drizzle schema

**Files:**
- Modify: `src/db/schema.ts`

**Step 1: Add the table definition**

Add after the `scrapeRuns` table in `src/db/schema.ts`:

```typescript
// ── Living Doc ────────────────────────────────────

export const livingDoc = pgTable("living_doc", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(), // "bible" or "update"
  content: text("content").notNull(),
  runDate: timestamp("run_date", { withTimezone: true }),
  articlesProcessed: integer("articles_processed"),
  sectionsTouched: text("sections_touched").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

**Step 2: Push schema to Neon**

Run: `cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker && npm run db:push`
Expected: Table `living_doc` created successfully.

**Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add living_doc table for strategy document cache"
```

---

## Task 2: Seed Bible content into Neon

**Files:**
- Read: `G:\My Drive\SK_RE\EUDW\EUDW_Living_Strategy_Document.md` (Bible source)
- Create: `worker/src/seed-bible.ts`

**Step 1: Create seed script**

`worker/src/seed-bible.ts`:

```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function seedBible() {
  const content = readFileSync(process.argv[2], "utf-8");

  // Upsert: delete existing bible row, insert new one
  await sql`DELETE FROM living_doc WHERE section = 'bible'`;
  await sql`
    INSERT INTO living_doc (section, content, run_date)
    VALUES ('bible', ${content}, NOW())
  `;

  console.log(`Bible seeded: ${content.length} chars`);
}

seedBible().catch(console.error);
```

**Step 2: Run the seed**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
npx tsx src/seed-bible.ts "G:\My Drive\SK_RE\EUDW\EUDW_Living_Strategy_Document.md"
```

Expected: `Bible seeded: ~28000 chars`

**Step 3: Commit**

```bash
git add worker/src/seed-bible.ts
git commit -m "feat: add Bible seed script for living doc"
```

---

## Task 3: Create Google Doc and populate with Bible content

**No code files — uses `gws` CLI directly.**

**Step 1: Create subfolder in Google Drive**

The folder `EUDI Strategy Brief` needs to be created under `SK_RE/EUDW/` in Google Drive. Check if `gws drive` can create folders, otherwise create manually.

**Step 2: Create the Google Doc**

```bash
gws docs documents create --json '{"title": "EUDI Wallet Living Strategy Document"}'
```

Capture the `documentId` from the response.

**Step 3: Write Bible content to the doc**

Use `gws docs +write` to append the full Bible markdown. For large content, use `batchUpdate` with `insertText` requests.

```bash
gws docs +write --document <DOC_ID> --text "$(cat 'G:\My Drive\SK_RE\EUDW\EUDW_Living_Strategy_Document.md')"
```

**Step 4: Move doc to the EUDI Strategy Brief folder**

```bash
gws drive files update --file-id <DOC_ID> --params '{"addParents": "<FOLDER_ID>", "removeParents": "<ROOT_PARENT_ID>"}'
```

**Step 5: Record the Google Doc ID**

Add to `.env.local`:
```
LIVING_DOC_ID=<the-document-id>
```

Add to Vercel env vars as well.

**Step 6: Commit env example update**

No actual `.env.local` commit — just note the var name for reference.

---

## Task 4: Build `/strategy` page — server component + data fetching

**Files:**
- Create: `app/strategy/page.tsx`

**Step 1: Create the page**

`app/strategy/page.tsx`:

```typescript
import { db } from "@/src/db/client";
import { livingDoc } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { Header } from "../components/header";
import { StrategyContent } from "./strategy-content";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const bibleRow = await db
    .select()
    .from(livingDoc)
    .where(eq(livingDoc.section, "bible"))
    .limit(1);

  const updates = await db
    .select()
    .from(livingDoc)
    .where(eq(livingDoc.section, "update"))
    .orderBy(desc(livingDoc.runDate));

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        <StrategyContent
          bible={bibleRow[0]?.content || ""}
          updates={updates.map((u) => ({
            content: u.content,
            runDate: u.runDate?.toISOString() || "",
            articlesProcessed: u.articlesProcessed || 0,
            sectionsTouched: (u.sectionsTouched as string[]) || [],
          }))}
          googleDocUrl={process.env.LIVING_DOC_ID ? `https://docs.google.com/document/d/${process.env.LIVING_DOC_ID}/edit` : null}
        />
      </main>
    </div>
  );
}
```

**Step 2: Verify page loads**

Run: `cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker && npm run dev`
Navigate to `http://localhost:3000/strategy`
Expected: Page renders with header, Bible content (unstyled for now), no errors.

**Step 3: Commit**

```bash
git add app/strategy/page.tsx
git commit -m "feat: add /strategy page server component with Neon data fetching"
```

---

## Task 5: Build strategy page client component — collapsible Bible + update log rendering

**Files:**
- Create: `app/strategy/strategy-content.tsx`

**Step 1: Create the client component**

This is the main rendering component. It must:
- Parse Bible markdown into sections (split on `## Section N:` headings)
- Render each section as a collapsible block (click header to expand/collapse, default: all collapsed)
- Render update logs below, always open, reverse chronological
- Style with project design system (Fraunces headings, DM Sans body, `#F5F3EE` bg, `#E3E0D9` borders)

`app/strategy/strategy-content.tsx`:

```typescript
"use client";

import { useState } from "react";

type Update = {
  content: string;
  runDate: string;
  articlesProcessed: number;
  sectionsTouched: string[];
};

type Props = {
  bible: string;
  updates: Update[];
  googleDocUrl: string | null;
};

// Parse Bible markdown into sections by splitting on ## Section N: headers
function parseBibleSections(markdown: string): { title: string; content: string }[] {
  const lines = markdown.split("\n");
  const sections: { title: string; content: string }[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];
  let inSection = false;

  for (const line of lines) {
    // Match ## Section N: Title or ## Executive Summary or ## Changelog
    if (line.match(/^## /)) {
      if (inSection) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = line.replace(/^## /, "").trim();
      currentLines = [];
      inSection = true;
    } else if (inSection) {
      currentLines.push(line);
    }
  }
  if (inSection) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }

  return sections;
}

// Simple markdown-to-JSX renderer for section content
function MarkdownBlock({ content }: { content: string }) {
  // Process line by line — handles ###, **, -, |table|, plain text
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-[#1A1A2E] mt-5 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {line.replace(/^### /, "")}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("  - ")) {
      const indent = line.startsWith("  - ");
      const text = line.replace(/^\s*- /, "");
      elements.push(
        <li key={i} className={`text-sm text-[#4A5568] leading-relaxed ${indent ? "ml-5" : ""}`}>
          <InlineMarkdown text={text} />
        </li>
      );
    } else if (line.startsWith("|") && line.includes("|")) {
      // Table row — collect all contiguous table rows
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      i--; // Back up one since the outer loop will increment
      elements.push(<MarkdownTable key={i} lines={tableLines} />);
    } else if (line.trim() === "" || line.startsWith("---")) {
      // Skip blanks and dividers
    } else if (line.startsWith("**") && line.endsWith("**")) {
      // Bold standalone line
      elements.push(
        <p key={i} className="text-sm font-semibold text-[#1A1A2E] mt-3 mb-1">
          {line.replace(/\*\*/g, "")}
        </p>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-[#4A5568] leading-relaxed mb-1">
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

// Inline markdown: **bold**, [link](url), `code`
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Link
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
    // Code
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find earliest match
    const matches = [
      boldMatch ? { type: "bold", index: remaining.indexOf(boldMatch[0]), match: boldMatch } : null,
      linkMatch ? { type: "link", index: remaining.indexOf(linkMatch[0]), match: linkMatch } : null,
      codeMatch ? { type: "code", index: remaining.indexOf(codeMatch[0]), match: codeMatch } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches[0]!;
    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>);
    }

    if (first.type === "bold") {
      parts.push(<strong key={key++} className="font-semibold text-[#1A1A2E]">{first.match![1]}</strong>);
    } else if (first.type === "link") {
      parts.push(
        <a key={key++} href={first.match![2]} target="_blank" rel="noopener noreferrer" className="text-[#6366F1] underline hover:text-[#4338CA]">
          {first.match![1]}
        </a>
      );
    } else if (first.type === "code") {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-[#E3E0D9] rounded text-xs" style={{ fontFamily: "var(--font-mono)" }}>
          {first.match![1]}
        </code>
      );
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return <>{parts}</>;
}

// Simple table renderer
function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.match(/^\|[\s-|]+\|$/)) // Remove separator rows
    .map((l) =>
      l.split("|").filter((cell) => cell.trim() !== "").map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-[#1A1A2E] bg-[#E3E0D9]/50 border-b border-[#E3E0D9]" style={{ fontFamily: "var(--font-label)" }}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-[#4A5568] border-b border-[#E3E0D9]/50">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Classification badge colors
const CLASSIFICATION_COLORS: Record<string, { text: string; bg: string }> = {
  NEW_FACT: { text: "#065F46", bg: "#ECFDF5" },
  UPDATED_FACT: { text: "#7B3F00", bg: "#FFF4E6" },
  RESOLVED_QUESTION: { text: "#3730A3", bg: "#EEF2FF" },
  DEEPENED_INSIGHT: { text: "#374151", bg: "#F3F4F6" },
};

export function StrategyContent({ bible, updates, googleDocUrl }: Props) {
  const sections = parseBibleSections(bible);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());

  const toggleSection = (index: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold text-[#1A1A2E] mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          EUDI Wallet Strategy Brief
        </h1>
        <p className="text-sm text-[#4A5568] mb-3">
          AI-maintained intelligence reference · Updated twice monthly
        </p>
        {googleDocUrl && (
          <a
            href={googleDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:text-[#4338CA] transition-colors"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Open in Google Docs →
          </a>
        )}
      </div>

      {/* Bible — collapsible sections */}
      <div className="space-y-2 mb-12">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3"
          style={{ fontFamily: "var(--font-label)" }}
        >
          Strategic Reference
        </h2>

        {sections.map((section, i) => (
          <div key={i} className="bg-white border border-[#E3E0D9] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection(i)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#F9F8F5] transition-colors"
            >
              <span
                className="text-sm font-bold text-[#1A1A2E]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {section.title}
              </span>
              <span className="text-[#94A3B8] text-xs ml-2 shrink-0">
                {openSections.has(i) ? "▲" : "▼"}
              </span>
            </button>
            {openSections.has(i) && (
              <div className="px-5 pb-4 border-t border-[#E3E0D9]">
                <MarkdownBlock content={section.content} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t-2 border-[#E3E0D9] mb-10" />

      {/* Intelligence Updates */}
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-6"
          style={{ fontFamily: "var(--font-label)" }}
        >
          Intelligence Updates
        </h2>

        {updates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#94A3B8]">
              No intelligence updates yet. The first update will appear after the curation loop processes new articles.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {updates.map((update, i) => (
              <div key={i} className="bg-white border border-[#E3E0D9] rounded-xl px-5 py-4">
                {/* Update header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E0D9]">
                  <span
                    className="text-sm font-bold text-[#1A1A2E]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Update: {new Date(update.runDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span
                    className="text-[10px] text-[#94A3B8] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-label)" }}
                  >
                    {update.articlesProcessed} articles reviewed
                  </span>
                </div>

                {/* Sections touched badges */}
                {update.sectionsTouched.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {update.sectionsTouched.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#E8E8F4] text-[#1A1A2E]"
                        style={{ fontFamily: "var(--font-label)" }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Update content — rendered as markdown */}
                <MarkdownBlock content={update.content} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run dev server and verify**

Run: `npm run dev`
Navigate to `http://localhost:3000/strategy`
Expected: Bible sections render as collapsible cards (all collapsed by default). Clicking a section expands it with styled markdown content. Update section shows "No intelligence updates yet."

**Step 3: Commit**

```bash
git add app/strategy/strategy-content.tsx
git commit -m "feat: add strategy page client component with collapsible Bible + update log"
```

---

## Task 6: Update header — wire "Living Doc" link to `/strategy`

**Files:**
- Modify: `app/components/header.tsx:53-61`

**Step 1: Change the Living Doc link**

Replace the `<a href="#">` with a Next.js Link to `/strategy`:

```typescript
// Old:
<a
  href="#"
  className="text-xs font-semibold uppercase tracking-wider text-[#4A5568] hover:text-[#1A1A2E] transition-colors"
  style={{ fontFamily: "var(--font-label)" }}
>
  Living Doc
</a>

// New:
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
```

**Step 2: Verify**

Navigate to `http://localhost:3000` → click "Strategy Brief" → lands on `/strategy` page. Link shows active state when on the page.

**Step 3: Commit**

```bash
git add app/components/header.tsx
git commit -m "feat: wire Living Doc header link to /strategy page"
```

---

## Task 7: Create worker script to read accepted articles for living doc analysis

**Files:**
- Create: `worker/src/living-doc-articles.ts`

**Step 1: Create the script**

This script reads accepted articles since a given date (or all if no date). Used by both the manual first run and the loop.

`worker/src/living-doc-articles.ts`:

```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function getArticles() {
  const sinceArg = process.argv[2]; // Optional ISO date string

  let rows;
  if (sinceArg) {
    rows = await sql`
      SELECT id, title, url, summary, categories, relevance_score, published_at, source_id
      FROM articles
      WHERE status = 'accepted' AND scraped_at > ${sinceArg}::timestamptz
      ORDER BY published_at DESC
    `;
  } else {
    rows = await sql`
      SELECT id, title, url, summary, categories, relevance_score, published_at, source_id
      FROM articles
      WHERE status = 'accepted'
      ORDER BY published_at DESC
    `;
  }

  // Get source names
  const sourceIds = [...new Set(rows.map((r: any) => r.source_id))];
  let sourceMap: Record<number, string> = {};
  if (sourceIds.length > 0) {
    const sources = await sql`SELECT id, name FROM sources WHERE id = ANY(${sourceIds})`;
    sourceMap = Object.fromEntries(sources.map((s: any) => [s.id, s.name]));
  }

  const articles = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    summary: r.summary,
    categories: r.categories,
    relevanceScore: r.relevance_score,
    publishedAt: r.published_at,
    source: sourceMap[r.source_id] || "Unknown",
  }));

  console.log(JSON.stringify({ count: articles.length, articles }, null, 2));
}

getArticles().catch(console.error);
```

**Step 2: Test it**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
npx tsx src/living-doc-articles.ts
```

Expected: JSON output with `count: 77` and all accepted articles.

**Step 3: Commit**

```bash
git add worker/src/living-doc-articles.ts
git commit -m "feat: add worker script to fetch accepted articles for living doc analysis"
```

---

## Task 8: Create worker script to write living doc updates to Neon

**Files:**
- Create: `worker/src/update-living-doc.ts`

**Step 1: Create the script**

Reads JSON from stdin. Handles two operations: overwrite Bible row, insert update row.

`worker/src/update-living-doc.ts`:

```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function updateLivingDoc() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const data = JSON.parse(input);

  // Update Bible if changed
  if (data.bible) {
    await sql`DELETE FROM living_doc WHERE section = 'bible'`;
    await sql`
      INSERT INTO living_doc (section, content, run_date)
      VALUES ('bible', ${data.bible}, NOW())
    `;
    console.log("Bible updated in Neon");
  }

  // Insert update log entry
  if (data.update) {
    await sql`
      INSERT INTO living_doc (section, content, run_date, articles_processed, sections_touched)
      VALUES (
        'update',
        ${data.update.content},
        ${data.update.runDate}::timestamptz,
        ${data.update.articlesProcessed},
        ${data.update.sectionsTouched}
      )
    `;
    console.log(`Update log inserted: ${data.update.sectionsTouched.length} sections touched`);
  }
}

updateLivingDoc().catch(console.error);
```

**Step 2: Commit**

```bash
git add worker/src/update-living-doc.ts
git commit -m "feat: add worker script to write living doc updates to Neon"
```

---

## Task 9: Update curation loop prompt with Step 4 — Living Doc intelligence analysis

**Files:**
- Modify: `loop/curate-prompt.md`

**Step 1: Add Step 4 after existing Step 3**

Append to `loop/curate-prompt.md` after the "## Step 3: Write Decisions Back" section:

```markdown
## Step 4: Living Document Update (Twice Monthly)

**Check if this step should run:**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT run_date FROM living_doc WHERE section = 'update' ORDER BY run_date DESC LIMIT 1\`.then(r => {
  if (r.length === 0) { console.log('NEVER'); return; }
  const days = (Date.now() - new Date(r[0].run_date).getTime()) / 86400000;
  console.log(days >= 12 ? 'RUN' : 'SKIP (' + Math.round(days) + ' days since last)');
}).catch(e => console.error(e));
"
```

If output is `SKIP` → stop here, you're done for this run.
If output is `RUN` or `NEVER` → continue.

### 4a: Read the Bible

```bash
gws docs documents get --params '{"documentId": "<LIVING_DOC_ID>"}' --format json
```

Also read from Neon as fallback:
```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT content FROM living_doc WHERE section = 'bible' LIMIT 1\`.then(r => console.log(r[0]?.content || 'NO BIBLE')).catch(console.error);
"
```

### 4b: Read new accepted articles

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
npx tsx src/living-doc-articles.ts <LAST_UPDATE_DATE_ISO>
```

Use the date from the cadence check. If `NEVER`, omit the date argument to get all articles.

### 4c: Intelligence Analysis

For each article, test against the Bible using these 4 criteria — IN THIS ORDER:

1. **NEW_FACT** — Does this article contain a fact the Bible doesn't mention at all? (new deadline, new country decision, new spec version, new company, new pilot result)
2. **UPDATED_FACT** — Does this article contradict or update an existing Bible fact? (deadline moved, country changed approach, spec superseded)
3. **RESOLVED_QUESTION** — Does this article answer an Open Question listed in the Bible?
4. **DEEPENED_INSIGHT** — Does this add meaningful new detail to a known topic? (concrete numbers, implementation specifics)

**If NO to all 4 → skip the article.** Confirmation of known information is NOT worth reporting.

**Quality bar:** Would an SK product strategist learn something genuinely new from this item? If not, cut it.

For each qualifying article, record:
- Classification: `NEW_FACT`, `UPDATED_FACT`, `RESOLVED_QUESTION`, or `DEEPENED_INSIGHT`
- Which Bible section it relates to
- What the new information is
- For UPDATED_FACT: what the old fact was
- For RESOLVED_QUESTION: which Open Question is answered
- Source: article title + URL

### 4d: Compose the update log

Format:

```
## Update: YYYY-MM-DD
Articles reviewed: N | New intelligence: N | Bible changes: N

### [Bible Section Name]
- [CLASSIFICATION] Description of new intelligence
  → Context: how this relates to what the Bible currently says
  → Source: [Article title](url)

### No new intelligence:
[List sections with nothing new]
```

If zero articles qualify → write: "No actionable new intelligence this cycle."
A short update with 1-2 genuine items beats a padded update with 8 weak ones.

### 4e: Apply Bible changes

If any items classified as `NEW_FACT`, `UPDATED_FACT`, or `RESOLVED_QUESTION`:
- Mentally note the specific text changes needed in the Bible
- For UPDATED_FACT: the old text to replace and new text
- For RESOLVED_QUESTION: remove from Open Questions, add answer to section body
- For NEW_FACT: where in which section to add the new fact

Read the current full Bible, apply changes, write back.

### 4f: Write to Google Doc

Update Bible text in the Google Doc (if Bible changes were made):
```bash
# This requires batchUpdate with deleteContentRange + insertText
# Use gws docs documents batchUpdate to replace doc content
```

Append the update log entry:
```bash
gws docs +write --document <LIVING_DOC_ID> --text '<the update log entry>'
```

### 4g: Write to Neon

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
cat > "$LOCALAPPDATA/Temp/eudi-living-doc.json" << 'LIVINGDOC_EOF'
{
  "bible": "<full updated Bible markdown — only include if Bible was changed>",
  "update": {
    "content": "<the update log markdown>",
    "runDate": "<ISO date>",
    "articlesProcessed": <number>,
    "sectionsTouched": ["Section Name 1", "Section Name 2"]
  }
}
LIVINGDOC_EOF
cat "$LOCALAPPDATA/Temp/eudi-living-doc.json" | npx tsx src/update-living-doc.ts
```

### 4h: Report

After completing the living doc update, add to your run report:
- Living Doc: Updated / Skipped (N days since last)
- If updated: sections touched, Bible changes count, new intel count
```

**Step 2: Update the Rules section**

Add to the Rules section at the bottom of `curate-prompt.md`:

```markdown
- The Living Doc ID is stored in `.env.local` as `LIVING_DOC_ID`. Read it before Step 4.
- Step 4 only runs if 12+ days since last update. Don't force it.
- Bible changes are surgical. Never rewrite a section that has no new information.
- An empty update ("No actionable new intelligence") is a valid outcome. Don't manufacture insights.
```

**Step 3: Commit**

```bash
git add loop/curate-prompt.md
git commit -m "feat: add Step 4 to curation loop — living doc intelligence analysis (twice monthly)"
```

---

## Task 10: Manual first run — analyze 77 accepted articles against Bible

**No code files — this is a manual conversation task.**

**Step 1: Read all accepted articles**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
npx tsx src/living-doc-articles.ts
```

**Step 2: Read the Bible**

Read from Neon (seeded in Task 2) or from the markdown file.

**Step 3: Perform intelligence analysis**

Go through the 77 articles. For each, test against the 4 criteria. Most will be skipped (the Bible was written from comprehensive research — these articles are likely already reflected). Focus on finding any articles that contain:
- Specific dates/deadlines not in the Bible
- Country announcements more specific than what the Bible states
- Pilot results with concrete numbers
- Competitive moves not mentioned

**Step 4: Write the first update log entry**

Compose the update following the format from Step 4d.

**Step 5: Write to Google Doc**

```bash
gws docs +write --document <LIVING_DOC_ID> --text '<first update log entry>'
```

**Step 6: Write to Neon**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
cat > "$LOCALAPPDATA/Temp/eudi-living-doc.json" << 'LIVINGDOC_EOF'
{
  "update": {
    "content": "<first update log>",
    "runDate": "2026-04-02T00:00:00Z",
    "articlesProcessed": 77,
    "sectionsTouched": [<sections>]
  }
}
LIVINGDOC_EOF
cat "$LOCALAPPDATA/Temp/eudi-living-doc.json" | npx tsx src/update-living-doc.ts
```

**Step 7: Verify on `/strategy` page**

Navigate to `http://localhost:3000/strategy`
Expected: Bible sections collapsible, first update log entry visible below.

**Step 8: Commit any adjustments**

```bash
git add -A
git commit -m "chore: first manual living doc run — initial intelligence update"
```

---

## Task 11: Deploy and verify

**Step 1: Add `LIVING_DOC_ID` to Vercel env vars**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker
# Add via Vercel CLI or dashboard
```

**Step 2: Push to master**

```bash
git push origin master
```

**Step 3: Verify production**

Navigate to the live Vercel URL `/strategy`
Expected: Bible sections render, update log visible, "Strategy Brief" header link works, "Open in Google Docs" link opens the doc.

---

## Checkpoint Summary

| After Task | What's Verified |
|-----------|----------------|
| 1-2 | DB schema + Bible content in Neon |
| 3 | Google Doc exists with Bible content |
| 4-5 | `/strategy` page renders Bible + updates from Neon |
| 6 | Header link works |
| 7-8 | Worker scripts for reading articles + writing updates |
| 9 | Loop prompt has Step 4 intelligence analysis |
| 10 | First manual run complete, update visible on page |
| 11 | Production deployment verified |
