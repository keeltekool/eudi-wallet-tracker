# Living Strategy Document Integration — Design

> **Date:** 2026-04-02
> **Status:** APPROVED
> **Scope:** Integrate the EUDI Wallet Living Strategy Document into the tracker app

---

## Overview

The Living Strategy Document ("the Bible") is a curated strategic reference on the EUDI Wallet landscape. It lives as a Google Doc, is maintained by the curation loop, and is rendered natively in the app on a `/strategy` page. Each loop run produces an intelligence update log — the Bible text itself is only modified when genuinely new facts warrant it.

---

## 1. Data Layer

### Google Doc (Source of Truth)

- **Location:** `G:\My Drive\SK_RE\EUDW\EUDI Strategy Brief\` (new subfolder, shared with SK team via folder permissions)
- **Content:** Bible text at top, intelligence update logs appended below
- **Updated by:** Curation loop via `gws docs` API + manual first run

### Neon Table: `living_doc`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial PK | Row ID |
| `section` | text | `"bible"` or `"update"` |
| `content` | text | Full markdown content |
| `run_date` | timestamp | When this was written |
| `articles_processed` | integer | Articles reviewed this run (updates only) |
| `sections_touched` | text[] | Bible themes with new intel (updates only) |
| `created_at` | timestamp | Row creation |

- Bible = 1 row, `section = "bible"`, overwritten when Bible text changes
- Updates = 1 row per loop run, `section = "update"`, append-only
- Google Doc is master. Neon is a read cache for the `/strategy` page.

---

## 2. Intelligence Analysis Algorithm

The core logic that determines what's worth reporting. This is the brain of the system.

### Input

- Full Bible text (read from Google Doc via `gws docs`)
- Newly accepted articles since last living doc update (from Neon)

### Step 1: Bible Decomposition

Parse Bible into working memory — for each of the 8 sections:
- Key facts already stated
- Open questions listed

This is the "what I already know" baseline. Every article is tested against it.

### Step 2: Article Intelligence Extraction

For each new article, 4 questions in order:

1. **NEW FACT?** — Something the Bible doesn't mention at all
2. **UPDATED FACT?** — An existing Bible fact has changed
3. **RESOLVED QUESTION?** — An open question now has an answer
4. **DEEPENED INSIGHT?** — Known topic, but meaningfully new detail

If NO to all 4 → skip the article entirely. Confirmation of known info is not an update.

### Step 3: Bible Change Decision

- `NEW_FACT`, `UPDATED_FACT`, `RESOLVED_QUESTION` → Bible-level changes. State exactly what to add/modify in which section. For updates, note the old fact.
- `DEEPENED_INSIGHT` → Update log only. Bible already covers the topic.

### Step 4: Update Log Entry

```
## Update: 2026-04-15
Articles reviewed: 14 | New intelligence: 4 | Bible changes: 2

### Regulation
- [UPDATED_FACT] Free QES fee cap set at €2.50 by Finland's DVV
  → Bible Section 1 updated: previously "undefined per Member State"
  → Source: [Finnish DVV announcement](url)

### National Implementations — Baltic
- [RESOLVED_QUESTION] Estonia selected Cybernetica for wallet procurement
  → Bible Section 8 updated: previously "RIA coordinating procurement"
  → Open Question removed: "Which external provider will Estonia select?"
  → Source: [ERR article](url)

### No new intelligence:
Architecture, Ecosystem Roles, Use Cases, Business Models, Business Wallet
```

### Step 5: Quality Gate

- Would an SK product strategist learn something new? If not → empty log.
- Is any item just rephrasing what the Bible says? Cut it.
- 0-2 genuine items beats 8 weak ones.

---

## 3. `/strategy` Page

### Route: `/strategy`

### Layout
- Same shell: `#F5F3EE` background, Fraunces headings, DM Sans body, `max-w-4xl`, sticky header
- Header tab: existing "Living Doc" placeholder → points to `/strategy`

### Content (top to bottom)

1. **Page header** — "EUDI Wallet Strategy Brief" + subtitle + link to Google Doc
2. **Bible sections** — collapsible. Default: all collapsed. Reader sees 8 section titles as compact TOC, clicks to expand any one. This is reference material — readers don't need to scroll past 4,000 words to reach updates.
3. **Divider**
4. **Intelligence Updates** — reverse chronological, always open. Each entry: date, counts, themed breakdowns with classifications and source links.

### Data
- Server component, reads from Neon `living_doc` table
- `force-dynamic` or long revalidate (updates only twice monthly)

---

## 4. Curation Loop Update

### Existing: Steps 1-3 (unchanged)
1. Read pending/relevant articles
2. Score, summarize, categorize
3. Write decisions to Neon

### New: Step 4 — Living Doc Update (twice monthly)

**Cadence check:** Compare current date against last `run_date` in `living_doc` updates. If < 12 days → skip Step 4.

**When triggered:**
1. Read Bible from Google Doc via `gws docs documents get`
2. Read accepted articles since last living doc update from Neon
3. Run intelligence analysis algorithm (Section 2 of this design)
4. Update Google Doc: apply Bible changes + append update log entry
5. Write to Neon `living_doc` table: overwrite Bible row + insert update row

### Prompt calibration
- Written for normal incremental runs (5-15 articles per cycle)
- Not designed for the heavy initial corpus — that's the manual first run

---

## 5. First Run (Manual)

Done in conversation, not via loop:
1. Read 77 existing accepted articles from Neon
2. Compare against Bible text
3. Produce first intelligence update entry
4. Create Google Doc in `EUDI Strategy Brief` folder
5. Write Bible + first update to Google Doc
6. Write Bible + first update to Neon `living_doc` table
7. This becomes the doc's first changelog entry

---

## 6. Out of Scope

- Collapsible update log entries (add later if log grows long)
- Search/filter within strategy page
- Subscriber notifications for doc updates
- Automated Bible rewrites (Bible changes are always surgical, per-fact)
