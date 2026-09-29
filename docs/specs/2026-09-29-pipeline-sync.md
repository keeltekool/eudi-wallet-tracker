# EUDI pipeline: simplify, then Jev filter — Spec

**SPEC — complete (2026-09-29).** The build waits for the owner's explicit "go" on `docs/plans/2026-09-29-pipeline-sync.md`, which includes permanently deleting the 3 LCC loops and D5 (routine Brief patches). v2 added the simplification the owner asked for before any new build. The newsletter question below stays out of scope until the owner answers it.

## Evidence this spec rests on
- **Jev test F** (`Claude_Projects/jev/eval/eudi-filter.mjs`, results in jev `KNOWLEDGE.md` §11): the last 300 judged articles, the same fields the routine sees (title, source, 300-character excerpt).
  - Variant B at cut 0.05: drops 43 of 73 real off-topic articles, keeps 34 of 35 that made the brief (it loses "US launches Quantum Readiness Task Force"), and keeps 57 of 59 copies of stories passed elsewhere. $0.01 per 300 articles; p50 260 ms.
  - Opus's own filter labels are noisy. Stage 1 lists relevant ids per 100-article batch, so everything unlisted defaults to irrelevant.
- **The live routine** (RemoteTrigger `get`, 2026-09-29): its Stage 1 and Stage 2 lists are the pre-11.09 version, and its prompt holds the Loop and Radar-Check tokens.
- **The 23.09 run log** (session `cse_01P8Sw5e87HcuNsnnVfgeXJ9`): 277 filtered in 3 rounds (Stage 1 ≈ 3 of 10.5 minutes), 104 curated with 22 accepted, and 8 living-doc items. The run itself flagged that `since` keys on scrape time and dropped the Estonia item.
- **Loop Control Center:** the EUDI loop prompts were last updated 2026-04-03.
- **Neon:** the `bible` row's `run_date` is 2026-07-08, and Section 12 is present.

## Why
1. **Dead machinery confuses.** Since 2026-08-16 the weekly cloud routine runs the whole pipeline. Still present and unused:
   - the 3 Loop Control Center loops (eudi-relevance, eudi-curation, eudi-livingdoc), last edited 2026-04-03;
   - their procedures `loop/filter-prompt.md` and `loop/curate-prompt.md`;
   - 6 local scripts only those procedures call (`worker/src/filter.ts`, `update-filter.ts`, `curate.ts`, `update-articles.ts`, `living-doc-articles.ts`, `update-living-doc.ts`);
   - `seed-bible.ts` (loads the Brief from the Google Drive copy; Neon has been the operative Brief since June).
2. **Four copies of the rules, drifted.** The live routine prompt, the 2 repo prompts and the 3 LCC loops each carry their own topic and curation rules. The 2026-09-11 widening (signing, sealing, QTSP market, QSCD/HSM, post-quantum, European Business Wallet) reached only the repo prompts. So the live filter drops Business Wallet news ("European Parliament adopts position on European Business Wallet"; "EU 'business wallet' would cost Estonia €150 million", dropped in April and in September), and Section 12 of the Brief is fed nothing.
3. **The filter stage spends Claude plan capacity on a job Jev can do.** Each week the routine reads ~280 headlines in 3 rounds only to sort relevant from noise. Jev test on the last 300 judged articles (Claude_Projects/jev KNOWLEDGE.md §11 test F): it drops 43 of 73 off-topic articles and keeps 34 of 35 that made the brief.
4. **Accepted articles can miss the weekly update.** `op=living-doc&since=` filters on `scraped_at`, so the 23.09 run left the accepted Estonia wallet-partner item out.
5. **The routine can't update the Strategy Brief.** Since 16.08 it only writes update logs; `/strategy` shows a Brief body last written 2026-07-08.
6. **Deploy verification fails.** The public header overflows 141 px at 375 px on `/` and `/strategy`; ship.mjs fails on it.

## Target pipeline
- **Scrape job** (GitHub Actions, Wed + Sat 06:00 UTC): scrape → store, marking copies of a story already in the tracker as duplicates → Jev sorts every pending article relevant or irrelevant → counts saved on the run row. Articles Jev couldn't answer stay pending and are retried at the next scrape.
- **Weekly routine** (claude.ai, Wed 06:30 Tallinn, Opus): the prompt on claude.ai holds only the two tokens and "follow `loop/pipeline.md` from the checkout" (the repo is public, so tokens never go into the file).
  - `loop/pipeline.md` is the only procedure and the only copy of the rules.
  - Stage 0, safety net: if articles are still pending (Jev down), sort them with the scope in the file. Normally 0.
  - Stage 1: curate.
  - Stage 2: update log plus Brief section patches.
  - Stage 3: Radar-Check report.
- Nothing else runs the pipeline.

## Decisions
- **D0 Remove the dead machinery.** Delete the 3 LCC loops, `loop/filter-prompt.md`, `loop/curate-prompt.md`, the 6 local scripts and `seed-bible.ts`. The Google Drive copy of the Brief is no longer maintained: Neon and `/strategy` are the Brief.
- **D1 Jev filter.** One Noul (question = test F variant B, in `worker/src/jev-filter.ts`), model pinned `jev-1.13.0`, cut 0.05, score in `articles.jev_score`. Timeout 8 s, 4 attempts; after the first failure Jev is treated as down for that run. Key `TYPESAFE_API_KEY` from a TypeSafe key named `eudi-wallet-tracker` (the owner creates it), in `.env.local` and as a GitHub secret. Rollback = delete the secret; Stage 0 of the routine then sorts pending articles as before.
- **D2 One file.** `loop/pipeline.md` = scope (in and out), curation rubric (score bands, threshold 8, reject and accept lists, summaries and categories), and the routine's steps, merged from the 2026-09-11 repo prompts and the live routine's API steps. Its header says Jev's question mirrors the scope, so change both and re-fit (`jev/eval/eudi-filter.mjs`).
- **D3 Duplicates at scrape time.** A new article whose normalised title (lower-case, trailing " - Source" removed, non-alphanumerics stripped, first 60 characters) matches one scraped in the previous 4 days → `rejected`, `Duplicate of #<id>`, not sent to Jev.
- **D4 Curation time.** New `articles.curated_at`, set by `curation-decisions`; `op=living-doc&since=` returns accepted articles with `coalesce(curated_at, scraped_at) > since`.
- **D5 Brief patches.** New Loop API op `brief-patch` replaces one `## ` section of the Brief by exact heading, after saving the previous Brief as `living_doc` row `bible-prev`. It refuses a heading not found exactly once, and an empty block or one under 30% of the old block's length.
- **D6 Run counts.** New `scrape_runs.jev` jsonb `{relevant, irrelevant, duplicates, leftPending}` on /admin/runs.
- **D7 Header** fits at 375 px on every public page.

## Owner questions
- **Newsletter:** it hasn't gone out automatically since 16.08 (its only trigger was the local script). There are 4 subscribers. Leave it off, or let the routine send it after the update (`/api/newsletter/send` already exists)?

## Out of scope
- Athlon and Allekirjoitus admin views hosted in this app (a separate cleanup).
- Unfetchable Google News bodies.
- Jev for curation, categories or summaries (evidence against, KNOWLEDGE.md §0 pre-flight).
