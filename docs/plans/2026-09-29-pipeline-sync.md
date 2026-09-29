# EUDI pipeline sync — Build Plan

**Goal:** Jev sorts every new article at scrape time, one rules file drives every stage of the pipeline, and every accepted article reaches the weekly update and the Strategy Brief.
**Spec:** `docs/specs/2026-09-29-pipeline-sync.md` (D1–D7, all touchpoints).
**Stack:** next 16.2.1, react 19.2.4, drizzle-orm 0.45.1, @neondatabase/serverless 1.0.2, tsx 4.19.4, Playwright from `~/.claude/scripts`; TypeSafe API `jev-1.13.0` over fetch (no SDK).

## Global constraints
- Jev: model `jev-1.13.0`, question = test F variant B, cut `0.05`, 8 s timeout, 4 attempts, 5 workers, run-level switch after the first null. The question text, model and cut change only together, re-fitted with `Claude_Projects/jev/eval/eudi-filter.mjs`.
- Duplicate rule: normalised title (lower-case, trailing " - Source" removed, non-alphanumerics stripped, first 60 characters), same as an article scraped in the previous 4 days → `rejected`, `Duplicate of #<id>`.
- `brief-patch` guards: the heading is found exactly once; the new block is non-empty and ≥ 30% of the old block's length; `bible-prev` is written before the change.
- DB changes are additive only (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`); no `drizzle-kit push`.
- Secrets: `TYPESAFE_API_KEY` in `.env.local` and GitHub secrets, piped from `.env.local` and never printed. The Loop token stays where it is.
- The routine prompt changes through RemoteTrigger `update` only, after a `get` of the live prompt.

## Phase 1 — Jev sorts articles at scrape time
- [ ] **Task 1.1 — DB columns**
  - Files: `src/db/schema.ts` (`articles.jevScore real`, `articles.curatedAt timestamptz`, `scrapeRuns.jev jsonb $type<JevRunCounts>()`); a one-off `ALTER TABLE` run against Neon.
  - Produces: `type JevRunCounts = { relevant: number; irrelevant: number; duplicates: number; leftPending: number }`.
  - Done when: `information_schema.columns` lists `jev_score`, `curated_at`, `scrape_runs.jev`; `npx tsc --noEmit` is clean.
- [ ] **Task 1.2 — Duplicate marking in the store**
  - Files: `worker/src/store.ts`, new `src/lib/title-key.ts` (`titleKey(title: string): string`).
  - Interfaces: `deduplicateAndStore` returns `{ inserted, duplicates, invalid, sameStory }`. A new article whose `titleKey` matches one scraped in the previous 4 days is inserted as `rejected` with `Duplicate of #<id>`.
  - Proof: a unit check on `titleKey` ("Germany unveils national EUDI wallet ‘d-you’ - Biometric Update" and the Google News copy give the same key; "Global Roundup" a week apart is a different case, handled by the 4-day window).
- [ ] **Task 1.3 — Jev filter**
  - Files: `worker/src/jev-filter.ts` (drafted 2026-09-29), `worker/src/run-scrape.ts`, `worker/src/orchestrator.ts` (writes `scrapeRuns.jev`), `.github/workflows/scrape.yml` (secret into env), `worker/src/check-jev-filter.ts`.
  - Interfaces:
    - `jevScore(apiKey: string, a: { title: string; source: string | null; fullText: string | null }): Promise<number | null>`
    - `filterPending(db, apiKey?): Promise<Omit<JevRunCounts, "duplicates">>`
    - `runScrape(db, typesafeKey?: string)`: calls `filterPending` after the source loop and writes `scrapeRuns.jev`, adding `duplicates` from the store results.
  - Proof: `cd worker/src && npx tsx check-jev-filter.ts` → PASS bad key → null, PASS EUDI news ≥ 0.05, PASS enterprise IAM report < 0.05.
- [ ] **Task 1.4 — Key**
  - The owner creates the TypeSafe key `eudi-wallet-tracker`. It goes to `.env.local` and `gh secret set TYPESAFE_API_KEY`.

**Gate 1:** clean `tsc`. The self-check passes. A real `workflow_dispatch` of "Scrape Sources" on main: the log shows `[jev] N pending: …` with 0 left pending. Neon shows no `pending` rows, a `jev_score` on every article the run sorted, and `scrape_runs.jev` filled. Owner sees: the Filtered tab updated right after the scrape.

## Phase 2 — One set of rules, every stage reads it
- [ ] **Task 2.1 — `loop/topics.md`**
  - Content: the scope (in and out) and the curation rubric (score bands, threshold 8, reject and accept lists, summary and category rules), merged from `loop/curate-prompt.md` (the 11.09 version). A header names every reader and the Jev re-fit rule.
- [ ] **Task 2.2 — Repo loop prompts point to it**
  - Files: `loop/filter-prompt.md` (fallback only: judge what Jev left pending, by `topics.md`), `loop/curate-prompt.md` (rules replaced by "apply `loop/topics.md`"; steps unchanged).
- [ ] **Task 2.3 — Live routine prompt**
  - Tool: RemoteTrigger `get` then `update` of `trig_01GjY2dYsjf58CnEJPNyrRK9`.
  - Changes:
    - Stage 1 becomes a fallback: judge leftovers by `loop/topics.md` from the checkout.
    - Stage 2 applies `loop/topics.md` instead of its pasted lists.
    - Stage 3 uses `brief-patch` (Phase 3).
    - The setup, API calls, token handling, error handling and Radar-Check report are kept verbatim.
  - Proof: a `get` read-back contains `loop/topics.md` and no pasted topic lists.
- [ ] **Task 2.4 — LCC fallback loops**
  - Tool: the LCC API, updating `eudi-relevance`, `eudi-curation` and `eudi-livingdoc`.
  - Change: each prompt becomes "Follow `loop/<name>-prompt.md` in the repo" plus the project path.
  - Proof: GET `/api/loops` read-back.

**Gate 2:** the read-backs of the live routine and the 3 LCC loops point to the repo files, and `grep` finds the scope lists only in `loop/topics.md` and `worker/src/jev-filter.ts`.

## Phase 3 — Every accepted article reaches the update and the Brief
- [ ] **Task 3.1 — Curation time**
  - Files: `app/api/loop/route.ts` (`curation-decisions` sets `curatedAt: new Date()`; `op=living-doc` filters on `coalesce(curated_at, scraped_at) > since`), `worker/src/update-articles.ts` (sets `curated_at`), `worker/src/living-doc-articles.ts` (same filter).
- [ ] **Task 3.2 — `brief-patch` op**
  - Files: `app/api/loop/route.ts`.
  - Interface: POST `{op:"brief-patch", heading: string, content: string}` → `{patched: true, heading}` or 400 `{error}`. Saves `bible-prev` first; the guards come from Global constraints.
  - Proof: real calls against the preview/prod deployment with the Loop token:
    - A heading that doesn't exist → 400.
    - A truncated block → 400.
    - A valid no-op patch (same content) → 200; `bible` is unchanged and `bible-prev` equals it.

**Gate 3:** those three real HTTP calls on the deployed app, plus GET `op=living-doc&since=<7 days ago>` returning the 23.09 accepted articles that the old filter missed (the Estonia item among them).

## Phase 4 — Admin and header
- [ ] **Task 4.1 — Run counts on /admin/runs**
  - Files: `app/admin/runs/_components/eudi-runs-view.tsx`: columns for Jev relevant, irrelevant, duplicates, left pending (from `scrapeRuns.jev`); "—" on older runs.
- [ ] **Task 4.2 — Header at 375 px**
  - Files: `app/components/header.tsx`: no sideways scroll on `/`, `/filtered`, `/curated`, `/strategy`, `/newsletter` at 375 px. A CSS change only.
- [ ] **Task 4.3 — Flows**
  - Files: `scripts/check-ui-flows.mjs` gains three steps:
    - /admin/runs shows the Jev columns with numbers on the Gate 1 run.
    - `document.documentElement.scrollWidth <= 375` on every public tab at 375 px.
    - The Filtered tab lists an article the Gate 1 run sorted.

**Gate 4:** `node scripts/check-ui-flows.mjs <prod>` all PASS at 375 and 1440; `ship.mjs / /filtered /curated /strategy /newsletter` PASS. Owner sees: the Jev counts on /admin/runs and a header that fits on the phone.

## Phase 5 — End-to-end run and docs
- [ ] **Task 5.1 — Live routine run**
  - RemoteTrigger `run`, then `get_run_log`: Stage 1 finds 0 pending (or judges only leftovers); Stage 2 cites `loop/topics.md`; Stage 3 posts the update, and `brief-patch` when there are Brief changes; Radar-Check gets `ok`.
- [ ] **Task 5.2 — Docs**
  - `STACK.md`: pipeline, Jev, rules file, rollback.
  - Memory `project_eudi_wallet_tracker.md`, and move EUDI to Active in MEMORY.md.
  - Global `STACK.md`: TypeSafe row adds EUDI.
  - Jev `KNOWLEDGE.md`: §10, §11 live entry, §15, and the correction that subscription routines spend plan capacity rather than "$0".
  - A measure step in `jev/eval/`: per scrape run, sorted and left pending, plus accepted per routine run.

**Gate 5:** the run log shows the facts above, and Neon shows an update row dated today with `articlesProcessed` ≥ the articles accepted since the last run. Then `code-reviewer`, `/simplify`, final ship.mjs, `/wrap-up`.

## Review focus
- Jev down mid-run → articles stay pending, and the routine's Stage 1 judges them (Gate 1 is re-run with a bad key in a local dry run: 0 sorted, all left pending, warning printed).
- A backlog import of 1,000+ articles → Jev sorts them inside the 10-minute job cap (5 workers at ~0.3 s: ~1 min for 1,000).
- The routine's Stage 3 writes a broken Brief → `brief-patch` refuses short or missing blocks, and `bible-prev` allows a one-row restore.
- Two genuinely different articles with the same headline → the 4-day window limits it; they show as "Duplicate of #id" in Filtered, visible to the owner.
- The rules drift again → Gate 2's grep; the `topics.md` header names every reader.

## Out of scope
Newsletter sending from the routine; unfetchable Google News bodies; the Drive mirror of the Brief; Jev for curation, categories or summaries.
