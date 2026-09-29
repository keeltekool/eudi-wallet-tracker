# EUDI pipeline: simplify, then Jev filter — Build Plan

**Goal:** one pipeline with one rules file, Jev sorting articles at scrape time, and every accepted article reaching the weekly update and the Strategy Brief.
**Spec:** `docs/specs/2026-09-29-pipeline-sync.md` v2 (D0–D7).
**Stack:** next 16.2.1, react 19.2.4, drizzle-orm 0.45.1, @neondatabase/serverless 1.0.2, tsx 4.19.4, Playwright from `~/.claude/scripts`; TypeSafe API `jev-1.13.0` over fetch.

## Global constraints
- Jev: model `jev-1.13.0`, question = test F variant B, cut `0.05`, 8 s timeout, 4 attempts, 5 workers, run-level switch after the first null. Question, model and cut change only together, re-fitted with `Claude_Projects/jev/eval/eudi-filter.mjs`.
- Duplicates: the normalised title (lower-case, trailing " - Source" removed, non-alphanumerics stripped, first 60 characters) equals one scraped in the previous 4 days → `rejected`, `Duplicate of #<id>`.
- `brief-patch`: the heading is found exactly once; the new block is non-empty and ≥ 30% of the old block's length; `bible-prev` is written first.
- `loop/pipeline.md` is in a public repo: no tokens in it. The claude.ai prompt holds the Loop token and the Radar-Check token, as today.
- DB changes are additive (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`); no `drizzle-kit push`.
- The routine prompt changes only through RemoteTrigger `update` after a `get`.

## Phase 1 — Simplify: one pipeline, one rules file, current rules live
- [x] **Task 1.1 — `loop/pipeline.md`**
  - Content: the header (who reads this, the Jev re-fit rule); the scope (in and out, the 2026-09-11 version); the curation rubric (score bands, threshold 8, reject and accept lists, summaries, categories).
  - The routine's steps, with the live prompt's API calls kept:
    - Stage 0: pending safety net via `op=filter` / `filter-decisions`.
    - Stage 1: curate via `op=curate` / `curation-decisions`.
    - Stage 2: update log via `op=living-doc` / `op=bible` / `living-doc-update`.
    - Stage 3: Radar-Check report, error handling and the summary line.
- [x] **Task 1.2 — Live routine prompt**
  - RemoteTrigger `get`, then `update` of `trig_01GjY2dYsjf58CnEJPNyrRK9`: keep the setup block with both tokens, the never-print rule and the Radar-Check call; everything else becomes "read and follow `loop/pipeline.md` from the checkout".
- [x] **Task 1.3 — Delete dead code and prompts**, in one commit of its own, so it reverts on its own.
  - `loop/filter-prompt.md`, `loop/curate-prompt.md`.
  - `worker/src/filter.ts`, `update-filter.ts`, `curate.ts`, `update-articles.ts`, `living-doc-articles.ts`, `update-living-doc.ts`, `seed-bible.ts`.
  - The tracked junk file `tmp-snapshot.txt`, and the untracked `deploy-verify-*.png` leftovers.
  - `STACK.md` references to all of them.
  - Before deleting: `grep` proves nothing outside `docs/plans/` history references a file. After: `tsc` and `next build` are clean.
  - The dated files in `docs/plans/` stay as history.
  - **Guard:** delete only the files listed here. The shared radar admin (`app/admin/**`, `app/api/athlon/**`, `app/api/sources/**`, `app/api/runs/**`) and the other radars' schemas and env vars (`schema-idearadar.ts`, `schema-eewatch.ts`, `DATABASE_URL_ATHLON` / `_ALLEKIRJOITUS` / `_IDEARADAR` / `_EEWATCH`) are in use and stay.
- [x] **Task 1.4 — Delete the 3 LCC loops**
  - eudi-relevance, eudi-curation, eudi-livingdoc, via the LCC API. The owner approves the delete with this plan.
  - First their full JSON is saved to a local backup file, outside the public repo.
  - The same goes for the live routine prompt before Task 1.2 changes it: it holds tokens, so its backup stays local only.
- [x] **Task 1.5 — Proof run** (2026-09-29, session cse_01PQdpfEwNHderyFnDskJRZR: 100 sorted 58/42, 58 curated 13 accepted, update #33 with 16 items in 8 sections incl. §7 and §12, Radar-Check 201)
  - RemoteTrigger `run` after 1.1–1.4 are pushed, then `get_run_log`:
    - the routine reads `loop/pipeline.md`;
    - Stage 0 sorts the pending backlog by the new scope;
    - curation runs with the 2026-09-11 rubric;
    - the update is written and Radar-Check gets `ok`.

**Gate 1:**
- `npx tsc --noEmit` and `next build` are clean.
- `grep` finds no reference to a deleted file outside `docs/plans/` history.
- The routine `get` read-back contains only the tokens plus the pointer; the LCC `/api/loops` read-back has no EUDI loops.
- The 1.5 run log shows the facts above.
- Owner sees: signing, sealing and Business Wallet articles in Filtered and Curated after the run.

## Phase 2 — Jev sorts articles at scrape time
- [x] **Task 2.1 — DB columns**
  - `src/db/schema.ts`: `articles.jevScore real`, `articles.curatedAt timestamptz`, `scrapeRuns.jev jsonb $type<JevRunCounts>()`, where `type JevRunCounts = { relevant: number; irrelevant: number; duplicates: number; leftPending: number }`.
  - Plus a one-off `ALTER TABLE` against Neon.
- [x] **Task 2.2 — Duplicate marking**
  - Files: new `src/lib/title-key.ts` (`titleKey(title: string): string`) and `worker/src/store.ts`.
  - `deduplicateAndStore` returns `{ inserted, duplicates, invalid, sameStory }`; a same-story article is inserted as `rejected`, `Duplicate of #<id>`.
  - Proof: an assert check that the Biometric Update headline and its Google News copy give the same key.
- [x] **Task 2.3 — Jev filter**
  - Files: `worker/src/jev-filter.ts` (drafted 2026-09-29), `worker/src/orchestrator.ts`, `worker/src/run-scrape.ts`, `.github/workflows/scrape.yml` (secret into env), `worker/src/check-jev-filter.ts`.
  - Interfaces:
    - `jevScore(apiKey: string, a: { title: string; source: string | null; fullText: string | null }): Promise<number | null>`
    - `filterPending(db, apiKey?): Promise<Omit<JevRunCounts, "duplicates">>`
    - `runScrape(db, typesafeKey?: string)`: calls `filterPending` after the source loop and writes `scrapeRuns.jev`.
  - Proof: `cd worker/src && ../../node_modules/.bin/tsx check-jev-filter.ts` (npx runs from the workspace folder, not the cwd) → PASS for three cases: a bad key gives null; EUDI news scores ≥ 0.05; an enterprise IAM report scores < 0.05.
- [x] **Task 2.4 — Key**
  - The owner creates the TypeSafe key `eudi-wallet-tracker`. It goes to `.env.local` and to `gh secret set TYPESAFE_API_KEY`, piped, never printed.

**Gate 2 — PASSED 2026-09-29** (self-check 3/3: bad key null, EUDI 0.99, IAM 0.03; local bad-key run 64: 58 left pending + warning; GitHub run 36612056191 / scrape run 65: 68 sorted 39/29, 0 left pending, 11 same-story duplicates):**
- A real `workflow_dispatch` of "Scrape Sources": the log shows `[jev] … 0 left pending`.
- Neon: no `pending` rows, a `jev_score` on every sorted article, `scrape_runs.jev` filled.
- A local dry run with a bad key leaves everything pending and prints the warning.

## Phase 3 — Every accepted article reaches the update and the Brief
- [x] **Task 3.1 — Curation time**
  - `app/api/loop/route.ts`: `curation-decisions` sets `curatedAt`; `op=living-doc` filters on `coalesce(curated_at, scraped_at) > since`.
- [x] **Task 3.2 — `brief-patch`**
  - `app/api/loop/route.ts`: POST `{op:"brief-patch", heading, content}` → `{patched:true, heading}` or 400 `{error}`.
  - `loop/pipeline.md` Stage 2 applies NEW_FACT, UPDATED_FACT and RESOLVED_QUESTION changes through it.
- [x] **Task 3.3 — Newsletter (D8, owner answer 2026-09-29)**
  - Neon: back up `newsletter_subscribers` to a local file outside the repo, then delete every row except `egertv@gmail.com`.
  - `src/lib/newsletter.ts`: move the send logic out of `app/api/newsletter/send/route.ts` into `sendLatestUpdate()`; the route keeps its `CRON_SECRET` auth and calls it.
  - `app/api/loop/route.ts`: `living-doc-update` calls `sendLatestUpdate()` after the insert and returns its `{sent, total, errors}`; a send failure doesn't fail the insert.

**Gate 3 — PASSED 2026-09-29** (7/7; #51973 given its 23.09 acceptance time as `curated_at`, since the column didn't exist then):** real calls to the deployed app with the Loop token:
- a missing heading → 400;
- a truncated block → 400;
- a same-content patch → 200, with `bible` unchanged and `bible-prev` saved;
- `op=living-doc&since=<7 days>` includes the 23.09 accepted articles the old filter missed.
- Neon `newsletter_subscribers` holds only `egertv@gmail.com`.
- [ ] **Task 3.4 — `since=last-update` (deviation, 2026-09-29)** — a fixed 7-day window reports the same accepted articles twice when runs are under a week apart (the Phase 1 proof run, the Phase 5 run and the 30.09 scheduled run). `op=living-doc&since=last-update` resolves to the latest update row's `run_date`; `loop/pipeline.md` Stage 2 uses it. One-off: update #33 (the Phase 1 proof run's output, backed up locally) is removed so the Phase 5 run reports its 13 accepts with Brief patches, and `curated_at` is backfilled to 2026-09-29 18:00 UTC for articles run #33 curated (scraped 23.09 05:00–29.09 17:50, status accepted/rejected).

## Phase 4 — Admin and header
- [x] **Task 4.1** — `app/admin/runs/_components/eudi-runs-view.tsx`: Jev columns (relevant, irrelevant, duplicates, left pending), "—" on older runs.
- [x] **Task 4.2** — `app/components/header.tsx`: no sideways scroll at 375 px on `/`, `/filtered`, `/curated`, `/strategy`, `/newsletter` (CSS only).
- [x] **Task 4.3** — `scripts/check-ui-flows.mjs` steps:
  - /admin/runs shows the Jev numbers of the Gate 2 run;
  - `scrollWidth <= 375` on every public tab;
  - Filtered lists an article the Gate 2 run sorted.

- [x] **Task 4.4 — Hydration fix (found by 4.3, 2026-09-29)** — `app/components/feed.tsx` and `article-card.tsx` group and format dates in the runtime's time zone (server UTC, browser Tallinn), so /filtered and /curated throw React #418 for Tallinn visitors. Pin `timeZone: "Europe/Tallinn"`. Proof: the 4.3 page-error check passes at 375 and 1440 (it failed on prod before).

**Gate 4:** `check-ui-flows.mjs <prod>` all PASS at 375 and 1440, and `ship.mjs / /filtered /curated /strategy /newsletter` PASS.

## Phase 5 — End to end and docs
- [ ] **Task 5.1** — RemoteTrigger `run` plus `get_run_log`:
  - Stage 0 finds 0 pending;
  - curation follows `loop/pipeline.md`;
  - the update includes all articles accepted since the last run;
  - `brief-patch` is used when the Brief changes;
  - the `living-doc-update` response shows `sent: 1`, and the newsletter arrives at egertv@gmail.com;
  - Radar-Check gets `ok`.
- [ ] **Task 5.2** — Docs:
  - EUDI `STACK.md` (pipeline, Jev, rollback, no Drive copy);
  - memory `project_eudi_wallet_tracker.md`, and EUDI moves to Active in MEMORY.md;
  - global `STACK.md` (TypeSafe row);
  - Jev `KNOWLEDGE.md` (§10, §11 live entry, §15, and the correction that subscription routines spend plan capacity, not "$0");
  - a per-run measure step in `jev/eval/`.

**Gate 5:** the run log facts above, plus a Neon update row dated today. Then `code-reviewer`, `/simplify`, final ship.mjs, `/wrap-up`.

## Deviations (2026-09-29, build session)
- **Order:** Phases 2–4 were coded on branch `pipeline-sync` while Gate 1's run and the TypeSafe key were pending. Gates still run in order, and a phase is ticked only after its gate. Phase 2 code without the key is the rollback path (everything stays pending, Stage 0 sorts), so it can ship before Gate 2.
- **`bible-prev`:** it holds the Brief as it was before a run's first patch (a patch within 2 hours of the last one doesn't overwrite it), so one row restores a whole run.
- **Update log format:** no `## Update:` header in the content; `/strategy` prints the date itself and every routine log since 16.08 starts at `### Section`.

## Review focus
- Jev down → articles stay pending; the next scrape retries, and the routine's Stage 0 sorts leftovers (Gate 2 dry run with a bad key).
- A 1,000+ article backlog import → Jev sorts it within the 10-minute job cap (~1 min per 1,000 at 5 workers).
- A bad Brief write → `brief-patch` refuses short or missing blocks; `bible-prev` restores in one row.
- Different articles with the same headline → the 4-day window limits it; they're visible as "Duplicate of #id" in Filtered.
- Rules drift again → only `loop/pipeline.md` and the Jev question hold the scope; Gate 1's grep.

## Out of scope
Renaming or redoing the shared radar admin (a separate topic after this build); unfetchable Google News bodies; Jev for curation, categories or summaries.
