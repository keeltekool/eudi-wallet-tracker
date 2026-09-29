# EUDI pipeline sync: Jev filter + one set of rules — Spec

Status: DRAFT, waiting for the owner's go (2026-09-29)

## Why
1. **The filter stage costs Claude plan capacity for a job Jev can do.** Every Wednesday the Opus routine reads ~280 headlines (3 rounds × 100) just to sort relevant from noise. Jev test on the last 300 judged articles (Claude_Projects/jev KNOWLEDGE.md §11 test F): it drops 43 of 73 off-topic articles and keeps 34 of 35 that made the brief, at ~0.3 s and a fraction of a cent per article.
2. **The live pipeline runs on stale rules.** The 2026-09-11 widening (signing, sealing, QTSP market, QSCD/HSM, post-quantum, European Business Wallet) reached `loop/filter-prompt.md` and `loop/curate-prompt.md` only. The live routine and the three Loop Control Center fallback loops each carry their own pasted copy of the old rules. Result: the live filter drops Business Wallet news ("European Parliament adopts position on European Business Wallet"; "EU 'business wallet' would cost Estonia €150 million", dropped in April and September), and Section 12 of the Strategy Brief is fed nothing.
3. **Accepted articles can miss the weekly update.** `op=living-doc&since=` filters on `scraped_at`, so an article scraped more than 7 days before the run but accepted in it is skipped. The 23.09 run flagged it: the Estonia wallet-partner item was accepted but left out.
4. **The routine can't update the Strategy Brief.** Since the move to the cloud (16.08) the routine only writes update logs. Brief edits happen only in the manual local loop, so `/strategy` keeps a Brief frozen apart from the logs.
5. **Deploy verification fails.** The public header overflows 141 px at 375 px on `/` and `/strategy` (open since 12.04); ship.mjs fails on it.

## What changes (user-visible)
- New articles are sorted relevant or irrelevant by the scrape job itself (Wednesday and Saturday). The Filtered tab is current right after each scrape instead of after the next Wednesday routine.
- Copies of a story already in the tracker are marked "Duplicate of #id" at scrape time, as curation marks them today.
- Signing, sealing, QTSP-market and Business Wallet news passes the filter and can be accepted by curation, so Section 12 gets fed.
- The weekly update includes every article accepted since the last run.
- The routine applies Brief changes itself, section by section, keeping the previous Brief as a backup.
- /admin/runs shows per scrape run: sorted relevant, sorted irrelevant, duplicates, left for the routine.
- The header fits at 375 px.

## Rules and decisions
- **D1 Jev filter.** One Noul (question text = test F variant B, fixed in `worker/src/jev-filter.ts`), model pinned `jev-1.13.0`, cut 0.05: `score ≥ 0.05` → relevant, else irrelevant; the score is stored in `articles.jev_score`. It runs after the scrape over every pending article. Timeout 8 s, 4 attempts; after the first failure Jev is treated as down for that run, and the rest stay pending for the routine's filter stage (fallback). Key `TYPESAFE_API_KEY` from a TypeSafe key named `eudi-wallet-tracker` (the owner creates it), in `.env.local` and as a GitHub secret. Rollback = delete the secret.
- **D2 One set of rules.** New `loop/topics.md` holds the topic scope (in and out) and the curation rubric (score bands, threshold 8, reject and accept lists, summary and category rules). It is the only copy. The repo loop prompts, the live routine prompt and the LCC loops point to it; the routine clones the repo every run, so it reads the current file. Its header says: Jev's question mirrors the scope, so change both and re-fit (`jev/eval/eudi-filter.mjs`).
- **D3 Duplicates at scrape time.** A new article whose normalised title (lower-case, trailing " - Source" removed, punctuation stripped, first 60 characters) equals one scraped in the previous 4 days → `rejected`, reason `Duplicate of #<id>`, and it isn't sent to Jev. Four days because the same story's copies land within a day or two, while weekly roundups repeat titles exactly 7 days apart.
- **D4 Curation time.** New column `articles.curated_at`, set by curation decisions (API and local script). `op=living-doc&since=` returns accepted articles with `coalesce(curated_at, scraped_at) > since`.
- **D5 Brief updates by the routine.** New Loop API op `brief-patch`: replace one `## Section …` block of the Brief by its exact heading, with the previous Brief saved as `living_doc` row `bible-prev` first. It is rejected if the heading isn't found once, or the new block is empty or under 30% of the old block's length (guards against truncation). The routine's Stage 3 applies NEW_FACT / UPDATED_FACT / RESOLVED_QUESTION changes through it. The Google Drive mirror stays a manual local sync.
- **D6 Run counts.** New `scrape_runs.jev` jsonb `{relevant, irrelevant, duplicates, leftPending}`, shown on /admin/runs.
- **D7 Header.** Fits at 375 px with no sideways scroll on every public page.

## Touchpoints (all updated in this build)
Worker (`run-scrape.ts`, new `jev-filter.ts`, dedupe in `store.ts`), `.github/workflows/scrape.yml`, DB (`articles.jev_score`, `articles.curated_at`, `scrape_runs.jev`, drizzle `schema.ts`), Loop API (`op=living-doc`, `curation-decisions`, new `brief-patch`), local scripts (`update-articles.ts`, `living-doc-articles.ts`), `loop/topics.md` + `loop/filter-prompt.md` + `loop/curate-prompt.md`, the live routine prompt (claude.ai), the 3 LCC loops (eudi-relevance, eudi-curation, eudi-livingdoc), /admin/runs, public header, docs (EUDI `STACK.md`, global `STACK.md`, memory, Jev `KNOWLEDGE.md`).

## Out of scope
- Newsletter sending from the routine (4 subscribers; the API leaves it unwired on purpose).
- Google News redirect bodies that can't be fetched (a source-quality issue).
- The Drive mirror of the Brief (stays manual).
- Jev for curation, categories or summaries (evidence against, KNOWLEDGE.md §0 pre-flight).
