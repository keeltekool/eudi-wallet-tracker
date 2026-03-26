# Phase 4: Three-Stage Curation Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a three-stage article pipeline: Raw → Filtered (AI relevance gate) → Curated (AI scored + summarized). Each stage feeds the next. Three public dashboard tabs.

**Architecture:** Extend the article status enum with `relevant`/`irrelevant`. Two separate Claude Code loops: a fast filter loop (yes/no relevance) and a slower curation loop (scoring + summaries). Filter loop reads `pending`, curation loop reads `relevant`. Dashboard gets a third "Filtered" tab showing `relevant` articles.

**Tech Stack:** Drizzle ORM (schema migration), Node.js scripts (filter.ts, curate.ts, update-articles.ts), Claude Code loops via Loop Control Center.

---

## Pipeline Flow

```
Scraper (GitHub Actions, 2x/week)
    ↓ writes status = "pending"
Filter Loop (Claude Code, after each scrape)
    ↓ reads "pending" → marks "relevant" or "irrelevant"
Curation Loop (Claude Code, less frequent)
    ↓ reads "relevant" → scores, summarizes, categorizes → marks "accepted" or "rejected"
```

## Dashboard Tabs

| Tab | Shows | Status filter |
|-----|-------|---------------|
| All Articles | Everything scraped | `pending`, `relevant`, `irrelevant`, `accepted`, `rejected` |
| Filtered | Passed relevance gate | `relevant`, `accepted` |
| Curated | AI-scored with summaries | `accepted` only |

---

## Task 1: Update DB Schema — Add `relevant` and `irrelevant` to status enum

**Files:**
- Modify: `src/db/schema.ts:19-23`

**Step 1: Update the enum**

Change:
```typescript
export const articleStatusEnum = pgEnum("article_status", [
  "pending",
  "accepted",
  "rejected",
]);
```

To:
```typescript
export const articleStatusEnum = pgEnum("article_status", [
  "pending",
  "relevant",
  "irrelevant",
  "accepted",
  "rejected",
]);
```

**Step 2: Push schema to Neon**

```bash
npm run db:push
```

Note: Drizzle may not handle enum additions cleanly. If `db:push` fails, run raw SQL:
```sql
ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'relevant';
ALTER TYPE article_status ADD VALUE IF NOT EXISTS 'irrelevant';
```

**Step 3: Verify**

```bash
npm run db:studio
```

Check the articles table — status column should now accept 5 values.

**Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add 'relevant' and 'irrelevant' to article status enum"
```

---

## Task 2: Create Filter Script (`worker/src/filter.ts`)

Reads `pending` articles from Neon, outputs them for the filter loop. Same pattern as `curate.ts` but reads `pending`.

**Files:**
- Create: `worker/src/filter.ts`

**Step 1: Create the script**

```typescript
/**
 * Reads pending articles from Neon for the filter loop.
 * Outputs JSON to stdout — article IDs + titles + excerpts.
 */
import { config } from "dotenv";
config({ path: "../.env.local" });

import { createDb } from "../../src/db/index";
import { articles, sources } from "../../src/db/schema";
import { eq, inArray } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const db = createDb(DATABASE_URL!);

  const pending = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      fullText: articles.fullText,
      sourceId: articles.sourceId,
    })
    .from(articles)
    .where(eq(articles.status, "pending"))
    .limit(100);

  if (pending.length === 0) {
    console.log(JSON.stringify({ count: 0, articles: [] }));
    process.exit(0);
  }

  const sourceIds = [...new Set(pending.map((a) => a.sourceId))];
  const allSources = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources)
    .where(inArray(sources.id, sourceIds));
  const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));

  const output = pending.map((a) => ({
    id: a.id,
    title: a.title,
    source: sourceMap.get(a.sourceId) || "Unknown",
    excerpt: a.fullText ? a.fullText.slice(0, 300) : null,
  }));

  console.log(JSON.stringify({ count: output.length, articles: output }));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add worker/src/filter.ts
git commit -m "feat: filter script — reads pending articles for relevance check"
```

---

## Task 3: Create Filter Update Script (`worker/src/update-filter.ts`)

Takes filter decisions (relevant/irrelevant) from stdin, writes to Neon.

**Files:**
- Create: `worker/src/update-filter.ts`

**Step 1: Create the script**

```typescript
/**
 * Takes JSON filter decisions from stdin and writes to Neon.
 * Input: { "decisions": [{ "id": 1, "status": "relevant" }, { "id": 2, "status": "irrelevant" }] }
 */
import { config } from "dotenv";
config({ path: "../.env.local" });

import { createDb } from "../../src/db/index";
import { articles } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

type FilterDecision = {
  id: number;
  status: "relevant" | "irrelevant";
};

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf-8");

  let decisions: FilterDecision[];
  try {
    const parsed = JSON.parse(input);
    decisions = parsed.decisions;
  } catch {
    console.error("Invalid JSON input");
    process.exit(1);
  }

  if (!decisions || decisions.length === 0) {
    console.log("No decisions to process.");
    process.exit(0);
  }

  const db = createDb(DATABASE_URL!);
  let relevant = 0;
  let irrelevant = 0;
  let errors = 0;

  for (const d of decisions) {
    try {
      await db
        .update(articles)
        .set({ status: d.status })
        .where(eq(articles.id, d.id));
      if (d.status === "relevant") relevant++;
      else irrelevant++;
    } catch (err) {
      console.error(`Failed to update article ${d.id}:`, err);
      errors++;
    }
  }

  console.log(JSON.stringify({ relevant, irrelevant, errors, total: decisions.length }));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add worker/src/update-filter.ts
git commit -m "feat: filter update script — writes relevant/irrelevant to Neon"
```

---

## Task 4: Update Curate Script — Read `relevant` Instead of `pending`

**Files:**
- Modify: `worker/src/curate.ts:32`

**Step 1: Change the WHERE clause**

Change line 32 from:
```typescript
.where(eq(articles.status, "pending"))
```
To:
```typescript
.where(eq(articles.status, "relevant"))
```

**Step 2: Commit**

```bash
git add worker/src/curate.ts
git commit -m "fix: curation reads 'relevant' articles (pre-filtered pool)"
```

---

## Task 5: Create Filter Loop Prompt

**Files:**
- Create: `loop/filter-prompt.md`

**Step 1: Write the prompt**

The filter loop is simple: read each article title + excerpt, decide if it touches EUDI Wallet topic in any way. Loose matching. Yes = relevant, no = irrelevant.

Key differences from curation prompt:
- No scoring (1-10), just yes/no
- No summaries
- No categories
- Higher throughput (100 articles per batch vs 50)
- Loose keyword matching — if there's ANY connection to digital identity wallets in EU, it passes

**Step 2: Commit**

```bash
git add loop/filter-prompt.md
git commit -m "feat: filter loop prompt — yes/no EUDI relevance gate"
```

---

## Task 6: Add Filtered Tab to Dashboard

**Files:**
- Modify: `app/components/header.tsx` — add "Filtered" tab between "All Articles" and "Curated"
- Create: `app/filtered/page.tsx` — shows `relevant` + `accepted` articles

**Step 1: Update header with three tabs**

Add "Filtered" tab with path `/filtered`. Active state based on pathname.

**Step 2: Create `/filtered` page**

Server component that queries articles where status IN ('relevant', 'accepted'). Same Feed component, same card format. No summaries shown for `relevant` articles (they don't have them yet). Summaries shown for `accepted` ones if present.

**Step 3: Verify locally**

```bash
npm run dev
```

Open http://localhost:3456/filtered — should show empty state until filter loop runs.

**Step 4: Commit**

```bash
git add app/components/header.tsx app/filtered/
git commit -m "feat: Filtered tab — shows EUDI-relevant articles"
```

---

## Task 7: Register Filter Loop in LCC + Activate

**Step 1: Register loop in Loop Control Center**

POST to LCC API with:
- Project: eudi-wallet-tracker (ID: 397d02fb-8a34-449d-b46f-750eec106fcb)
- Name: "EUDI Relevance Filter"
- Schedule: Wed+Sat at 06:33 UTC (33 min after scraper, before curation)
- Prompt: wrapped with LCC pre-flight + post-run reporting

**Step 2: Update curation loop schedule**

PATCH curation loop to run at 07:33 UTC (1 hour after filter, so filter has time to complete).

**Step 3: Activate both via CronCreate**

Two CronCreate calls:
1. Filter: `33 6 * * 3,6`
2. Curation: `33 7 * * 3,6`

**Step 4: Commit**

```bash
git commit -m "feat: filter + curation loops registered in LCC"
```

---

## Task 8: Deploy + Run Filter on Current Backlog

**Step 1: Push schema + code**

```bash
git push
```

Vercel auto-redeploys with the new Filtered tab.

**Step 2: Run filter loop manually on existing ~416 pending articles**

Execute the filter prompt against the current backlog so the Filtered tab populates immediately.

**Step 3: Verify in browser**

Open live site → "Filtered" tab should show EUDI-relevant articles.
Open "Curated" tab — still shows the 2 test articles from earlier.

**Step 4: Run curation loop on filtered articles**

Execute the curation prompt against `relevant` articles.

**Step 5: Verify Curated tab populates**

---

## ── CHECKPOINT: Phase 4 Complete ──

**Verify via browser:**
- [ ] All Articles tab — shows everything (all statuses)
- [ ] Filtered tab — shows only EUDI-relevant articles (no noise)
- [ ] Curated tab — shows AI-scored articles with summaries + categories
- [ ] Filter loop registered in LCC
- [ ] Curation loop updated in LCC (reads `relevant` not `pending`)
- [ ] Both loops have correct schedules (filter before curation)

---

## File Changes Summary

```
Modified:
  src/db/schema.ts                    # Add relevant/irrelevant to enum
  worker/src/curate.ts                # Read 'relevant' instead of 'pending'
  app/components/header.tsx           # Three tabs

Created:
  worker/src/filter.ts                # Read pending articles for filter
  worker/src/update-filter.ts         # Write relevant/irrelevant decisions
  loop/filter-prompt.md               # Filter loop instructions
  app/filtered/page.tsx               # Filtered tab page
```
