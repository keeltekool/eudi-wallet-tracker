# Strategy Brief v2 — Full Swap, Pipeline Update & Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 8-section Strategy Brief with the new 11-section version. Decommission Google Docs as master source — master now lives as `.md` file in Google Drive, injected directly into Neon. Update the curation loop to stop writing to Google Docs. Update all documentation. Clean up dead env vars.

**Architecture:** The Strategy Brief is stored as a markdown blob in Neon (`living_doc` table, `section = 'bible'`). `seed-bible.ts` reads a local `.md` file and replaces the DB row. The `strategy-content.tsx` client component parses `##` headings into collapsible accordion sections dynamically — no hardcoded section list. The curation loop (`curate-prompt.md`) currently writes updates to both Neon AND Google Docs — the Google Docs write path must be removed. One new markdown pattern (`>` blockquotes) needs rendering support.

**Tech Stack:** Next.js 16, React 19, Neon Postgres, Drizzle ORM, Tailwind 4

**Source file:** `G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md` (730 lines, 73 KB, 14 `##` headings, 108 markdown links, clean markdown)

**Changelog:** Deliberately emptied in new brief — fresh start.

---

## Pre-flight

### Task 1: Validate source file markdown structure

**Files:**
- Read: `G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md`

**Step 1: Confirm heading structure matches expected 11-section layout**

Run:
```bash
grep "^## " "G:/My Drive/SK_RE/EUDW/EUDI_Wallet_Strategy_Brief_Clean.md"
```

Expected output (14 lines):
```
## SK ID Solutions - Strategic Intelligence Reference
## Executive Summary
## Section 1: Regulatory Foundation
## Section 2: Wallet Architecture and Design
## Section 3: Ecosystem Roles and Trust Model
## Section 4: QTSP Roles and Business Opportunities in the Wallet Ecosystem
## Section 5: Use Cases
## Section 6: Large-Scale Pilots
## Section 7: European Business Wallet
## Section 8: Business Models and Commercial Viability
## Section 9: European QTSPs - Current Actions and Market Positioning
## Section 10: National Implementations and Rollout - Baltic Focus
## Section 11: User Adoption, UX and Digital Divide
## Changelog
```

Parser filters out "SK ID Solutions" subtitle (existing filter). Remaining = Executive Summary + 11 numbered sections + Changelog = **13 accordion items**.

**Step 2: Confirm no Google Docs escaping artifacts**

Run:
```bash
grep '\\#' "G:/My Drive/SK_RE/EUDW/EUDI_Wallet_Strategy_Brief_Clean.md" | head -3
```

Expected: no output.

---

## Phase 1: Frontend changes

### Task 2: Add blockquote rendering to MarkdownBlock

**Files:**
- Modify: `app/strategy/strategy-content.tsx` (inside `MarkdownBlock` function, around line 213-221)

**Context:** Line 411 of the new brief has a `> "The signature creation..."` blockquote. Current parser doesn't handle `>` lines — they'd render as plain text with the `>` character visible.

**Step 1: Add blockquote handling to MarkdownBlock parser**

In `app/strategy/strategy-content.tsx`, inside the `MarkdownBlock` component's `while` loop, add a new condition for blockquote lines. Insert BEFORE the generic text paragraph handler (the `else if (line.trim())` block near line 221):

```tsx
    } else if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^> /, ""));
        i++;
      }
      i--;
      elements.push(
        <blockquote
          key={i}
          className="border-l-3 border-[#E3E0D9] pl-4 py-1 my-3 italic text-sm text-[#4A5568]"
        >
          <InlineMarkdown text={quoteLines.join(" ")} />
        </blockquote>
      );
```

---

### Task 3: Remove Google Docs link from strategy page

**Files:**
- Modify: `app/strategy/strategy-content.tsx` (Props type, destructuring, link block)
- Modify: `app/strategy/page.tsx` (remove `googleDocUrl` prop)

**Step 1: In `strategy-content.tsx` — remove `googleDocUrl` from Props type**

```tsx
// BEFORE
type Props = {
  bible: string;
  updates: Update[];
  googleDocUrl: string | null;
};

// AFTER
type Props = {
  bible: string;
  updates: Update[];
};
```

**Step 2: Remove `googleDocUrl` from destructured props**

```tsx
// BEFORE
export function StrategyContent({ bible, updates, googleDocUrl }: Props) {

// AFTER
export function StrategyContent({ bible, updates }: Props) {
```

**Step 3: Delete the entire Google Docs link block (lines 295-305)**

```tsx
// DELETE THIS ENTIRE BLOCK:
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
```

**Step 4: In `page.tsx` — remove `googleDocUrl` prop**

```tsx
// BEFORE
        <StrategyContent
          bible={bibleRow[0]?.content || ""}
          updates={updates.map((u) => ({...}))}
          googleDocUrl={
            process.env.LIVING_DOC_ID
              ? `https://docs.google.com/document/d/${process.env.LIVING_DOC_ID}/edit`
              : null
          }
        />

// AFTER
        <StrategyContent
          bible={bibleRow[0]?.content || ""}
          updates={updates.map((u) => ({...}))}
        />
```

**Step 5: Verify build**

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker && npm run build
```

Expected: clean build, no TS errors.

---

## Phase 2: Curation loop — decommission Google Docs write path

### Task 4: Update curation loop prompt to remove Google Docs references

**Files:**
- Modify: `loop/curate-prompt.md` (Steps 4f and 4g)

**Context:** The curation loop currently has two write targets for Strategy Brief updates:
1. Google Docs (via `gws docs +write` and `batchUpdate`) — **REMOVE**
2. Neon (via `update-living-doc.ts`) — **KEEP**

**Step 1: Replace Step 4f (Write to Google Doc) with note about master file location**

Replace the entire "### 4f: Write to Google Doc" section (lines 155-162):

```markdown
// BEFORE (lines 155-162):
### 4f: Write to Google Doc

Append the update log entry:
\```bash
gws docs +write --document 1IjPRgPSB72Igoe0dr7Jh95N6nhg3J_NIA0dGee1JjTc --text '<the update log entry>'
\```

If Strategy Brief text was changed, the full updated text goes to Google Doc via `gws docs documents batchUpdate`.

// AFTER:
### 4f: Write updated Strategy Brief to Google Drive (if changed)

If the Strategy Brief text was changed in Step 4e, write the full updated markdown to the master file:

\```bash
cat > "G:/My Drive/SK_RE/EUDW/EUDI_Wallet_Strategy_Brief_Clean.md" << 'BRIEF_EOF'
<full updated Strategy Brief markdown>
BRIEF_EOF
\```

This file in Google Drive IS the master. No Google Docs API involved.
```

**Step 2: Rename 4g to match new flow**

The existing "### 4g: Write to Neon" section stays the same — it already writes to Neon correctly. Just renumber if needed for clarity.

**Step 3: Remove the Google Doc ID reference**

Search `curate-prompt.md` for any remaining `1IjPRgPSB72Igoe0dr7Jh95N6nhg3J_NIA0dGee1JjTc` or `gws docs` references. Remove all.

---

## Phase 3: Seed new content into Neon

### Task 5: Seed Neon with new 11-section Strategy Brief

**Files:**
- Execute: `worker/src/seed-bible.ts`
- Source: `G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md`

**Step 1: Seed the database**

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker/worker && npx tsx src/seed-bible.ts "G:/My Drive/SK_RE/EUDW/EUDI_Wallet_Strategy_Brief_Clean.md"
```

Expected output: `Bible seeded: ~73000 chars`

**Step 2: Verify DB content**

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker/worker && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '../.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT length(content) as chars, run_date FROM living_doc WHERE section = 'bible'\`.then(r => console.log(r));
"
```

Expected: one row, ~73000 chars, run_date = today.

---

## Phase 4: Clean up dead env vars

### Task 6: Remove LIVING_DOC_ID from environments

**Step 1: Remove from `.env.local`**

In `C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\.env.local`, delete the line:
```
LIVING_DOC_ID=1IjPRgPSB72Igoe0dr7Jh95N6nhg3J_NIA0dGee1JjTc
```

**Step 2: Remove from Vercel**

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker && npx vercel env rm LIVING_DOC_ID production -y
```

---

## Phase 5: Update documentation

### Task 7: Update STACK.md

**Files:**
- Modify: `STACK.md`

**Changes:**

1. **Services table:** Remove Google Docs reference. Add note about Google Drive `.md` file as master source.

2. **Pipeline section:** Update to reflect new section count and Google Docs removal:
```
Curation Loop writes:
  → Strategy Brief changes to Neon (living_doc table)
  → Updated .md file to Google Drive (G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md)
  → NO LONGER writes to Google Docs API
```

3. **Dashboard Tabs:** Add section count info:
```
- **Strategy Brief:** 13 accordion sections (Exec Summary + 11 numbered + Changelog)
```

4. **Gotchas:** Add entry:
```
| Google Drive file = master brief | `EUDI_Wallet_Strategy_Brief_Clean.md` in `G:\My Drive\SK_RE\EUDW\`. NOT the `_NEW` file (has escaped markdown from Docs export). Seed via `seed-bible.ts`. |
```

5. **Remove** any `LIVING_DOC_ID` references from the doc.

---

### Task 8: Update project memory file

**Files:**
- Modify: `C:\Users\Kasutaja\.claude\projects\C--Users-Kasutaja\memory\project_eudi_wallet_tracker.md`

**Changes:**

1. Update "Three-Stage Pipeline" section 3 to note Google Docs decommissioned
2. Update section count: "3 tabs" stays, but add note about Strategy Brief having 13 accordion sections (was 10)
3. Update "Key Architecture Decisions" — add: "Google Docs decommissioned as master source (April 2026). Master Strategy Brief lives as `.md` file in Google Drive, seeded directly to Neon."
4. Update stats: "11 strategy brief sections (was 8), ~76 curated articles"

---

## Phase 6: Deploy & verify

### Task 9: Commit and deploy

**Files committed:**
- `app/strategy/strategy-content.tsx` — blockquote rendering + Google Docs link removal
- `app/strategy/page.tsx` — Google Docs prop removal
- `loop/curate-prompt.md` — Google Docs write path → Google Drive file write
- `STACK.md` — documentation updates

**Step 1: Commit**

```bash
cd C:/Users/Kasutaja/Claude_Projects/eudi-wallet-tracker
git add app/strategy/strategy-content.tsx app/strategy/page.tsx loop/curate-prompt.md STACK.md
git commit -m "feat: strategy brief v2 — 11 sections, decommission Google Docs, direct .md injection

- Replace 8-section brief with 11-section version (3 new: QTSP Roles, European QTSPs, User Adoption)
- Remove Google Docs link from /strategy page
- Update curation loop: write to Google Drive .md file instead of Google Docs API
- Add blockquote rendering to markdown parser
- Remove LIVING_DOC_ID references
- Update STACK.md documentation"
```

**Step 2: Push**

```bash
git push origin master
```

---

### Task 10: Verify live site via chrome-devtools MCP

**Step 1: Wait for Vercel deploy (~60-90s)**

**Step 2: Navigate to `https://eudi-wallet-tracker.vercel.app/strategy`**

**Full verification checklist:**

| # | Check | Expected |
|---|-------|----------|
| 1 | Page title | "EUDI Wallet Strategy Brief" |
| 2 | Google Docs link | **GONE** — no "Open in Google Docs →" |
| 3 | Accordion count | **13 items** (was 10) |
| 4 | Executive Summary | Present, first item |
| 5 | Section 4 | "QTSP Roles and Business Opportunities in the Wallet Ecosystem" — **NEW** |
| 6 | Section 9 | "European QTSPs - Current Actions and Market Positioning" — **NEW** |
| 7 | Section 11 | "User Adoption, UX and Digital Divide" — **NEW** |
| 8 | Changelog | Present, last item, empty content |
| 9 | Section 7 table | Citizen vs Business Wallet comparison table renders |
| 10 | Section 9 links | Vendor profile links (Namirial, Signicat, etc.) clickable, indigo colored |
| 11 | Section 8 blockquote | Renders with left border + italic styling |
| 12 | Expand all | Click — all 13 sections expand |
| 13 | Console errors | None in DevTools |
| 14 | Intelligence Updates | Section visible below divider (existing entries or empty state) |

**Step 3: Spot-check content integrity**

Open Section 1 (Regulatory Foundation) — verify CIR Packages 3-6 are present (new content).
Open Section 10 (National Implementations) — verify 27 MS table is present.

---

## Full touchpoint summary

| # | Touchpoint | Action | Why |
|---|-----------|--------|-----|
| 1 | `strategy-content.tsx` | Remove `googleDocUrl` prop + link; add blockquote | UI: remove dead link, support new markdown pattern |
| 2 | `page.tsx` | Remove `googleDocUrl` prop passing | Cleanup: no more `LIVING_DOC_ID` usage |
| 3 | `curate-prompt.md` | Replace `gws docs` write with Google Drive `.md` file write | Pipeline: master source changed from Google Docs to Google Drive file |
| 4 | Neon DB (`living_doc`) | Seed new 11-section brief via `seed-bible.ts` | Data: new content |
| 5 | `.env.local` | Remove `LIVING_DOC_ID` | Cleanup: Google Docs decommissioned |
| 6 | Vercel env vars | Remove `LIVING_DOC_ID` | Cleanup: not used by any code path after Task 3 |
| 7 | `STACK.md` | Update section count, pipeline, gotchas, remove Google Docs refs | Documentation: reflect new architecture |
| 8 | Memory file | Update project state | Documentation: future conversations have correct context |
| 9 | Git + Vercel | Commit, push, auto-deploy | Deploy |
| 10 | Live site | Full visual verification via chrome-devtools MCP | Verification |
