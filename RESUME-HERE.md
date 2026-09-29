# EUDI Wallet Tracker — RESUME HERE

> Fresh-session entry point. Read top to bottom, then the "Read next" files in order.
> Settled decisions are settled: don't re-ask them, don't re-argue them. Updated 2026-09-29.

## State
- **Live:** https://eudi-wallet-tracker.vercel.app. **Repo:** `keeltekool/eudi-wallet-tracker`, **public**, default branch `master`.
- **master:** the spec, plan and this file are pushed (docs only, no app change).
- **Branch `pipeline-sync`:** an unreviewed draft of Phase 2 code (`worker/src/jev-filter.ts`, `worker/src/check-jev-filter.ts`, plus wiring in `run-scrape.ts`, `src/db/schema.ts` and `.github/workflows/scrape.yml`). It was written before the plan existed. It is NOT merged and does NOT match the plan's interfaces yet (see "Current state").
- **Gates:** none run yet. No build phase has started.
- **Where we stopped:** spec complete and plan written. Waiting for the owner's "go" on the plan, their newsletter answer, and a TypeSafe key named `eudi-wallet-tracker`.

## What this project is (30 seconds)
A public EUDI Wallet intelligence tracker for SK ID Solutions.
- **Scrape job:** GitHub Actions scrapes ~79 sources on Wednesday and Saturday at 06:00 UTC into Neon.
- **Weekly cloud routine** "EUDI Pipeline" (claude.ai trigger `trig_01GjY2dYsjf58CnEJPNyrRK9`, Wednesday 06:30 Tallinn = 03:30 UTC, `claude-opus-5`, runs on the owner's paid Claude plan). Through the token-guarded Loop API (`/api/loop`) it filters, curates (score 1–10, accept at 8, summaries, categories) and writes a weekly intelligence update against the Strategy Brief.
- **Dashboard:** All / Filtered / Curated / Strategy / Newsletter, plus a password-protected admin. Radar-Check tracks the routine's runs.

## Current state: done / undone
**Done (2026-09-29, from the Jev session):**
- Jev test F on the last 300 judged articles. Variant B at cut 0.05 drops 43 of 73 real off-topic articles and keeps 34 of 35 that made the brief. Script: `C:\Users\Kasutaja\Claude_Projects\jev\eval\eudi-filter.mjs`; results in jev `KNOWLEDGE.md` §11.
- A diagnosis of the pipeline, all evidence in the spec:
  - The rules exist in 4 drifted copies. The live routine prompt and the 3 LCC loops carry pre-2026-09-11 rules, so signing/sealing and Business Wallet news gets dropped and Section 12 is fed nothing.
  - `op=living-doc&since=` keys on scrape time and drops accepted articles.
  - The routine can't edit the Brief (its body was last written 2026-07-08).
  - The LCC loops (last edited 2026-04-03) and 6 local scripts are dead.
  - The newsletter hasn't gone out automatically since 2026-08-16.
  - The header overflows at 375 px, so ship.mjs fails.
- Spec `docs/specs/2026-09-29-pipeline-sync.md` (**SPEC — complete**) and plan `docs/plans/2026-09-29-pipeline-sync.md` (5 phases, every task unchecked).

**Undone (the whole plan):**
1. **Phase 1, simplify.**
   - Write `loop/pipeline.md`, the one rules and procedure file, and point the live routine prompt at it.
   - Delete the 2 old prompts, the 6 local scripts, `seed-bible.ts` and `tmp-snapshot.txt` in one commit of their own.
   - Delete the 3 LCC loops, after a local JSON backup.
   - Proof: a real routine run.
2. **Phase 2, Jev in the scrape job.** DB columns, duplicate marking, `jev-filter.ts`, the key and secret. Proof: a real scrape run.
3. **Phase 3, the weekly update and the Brief.** `curated_at` and `brief-patch`. Proof: real API calls.
4. **Phase 4, admin and header.** Jev counts on /admin/runs and the header fix. Proof: Playwright at 375 and 1440, ship.mjs.
5. **Phase 5, end to end.** A routine run, then docs (EUDI STACK.md, memory incl. moving EUDI to Active in MEMORY.md, global STACK.md, jev KNOWLEDGE.md §10/§11/§15, a measure step in `jev/eval/`). Then code-reviewer, /simplify, ship.mjs, /wrap-up.
- **The draft on `pipeline-sync` vs the plan:** `filterPending` returns `void` and is called from `run-scrape.ts`. The plan wants it to return counts and be called from `runScrape`, with `scrapeRuns.jev` written. The schema edit adds only `jevScore`; the plan also needs `curatedAt` and `scrapeRuns.jev`. Rebase the branch onto Phase 1's master, then finish Phase 2 per the plan.

## Read next (in this order)
1. `docs/specs/2026-09-29-pipeline-sync.md`: why, the target pipeline, decisions D0–D7, evidence, the newsletter question.
2. `docs/plans/2026-09-29-pipeline-sync.md`: phases, tasks, interfaces, gates. Tick tasks in this file as they land.
3. The live routine prompt: RemoteTrigger `get` on `trig_01GjY2dYsjf58CnEJPNyrRK9`. It contains the Loop token and the Radar-Check token. **Never print, log or commit them; this repo is public.**
4. `C:\Users\Kasutaja\Claude_Projects\jev\KNOWLEDGE.md` §0 (the pre-flight table: what Jev can and can't do) and §11 test F.
5. `C:\Users\Kasutaja\Claude_Projects\idea-radar\worker\src\jev-gate.ts` + `pre-filter.ts`: the shipped Jev pattern this build copies.
6. `STACK.md` (this repo): services, env vars, current pipeline description (it goes stale in Phase 1; Phase 5 rewrites it).

## Critical context that must not be lost
- **Settled by the owner (2026-09-29):**
  - Jev replaces the routine's Claude filter stage and sorts articles at scrape time ("we substitute Jev at the filter level and cut out the current Claude-based filtering step"). Variant B question, cut 0.05, model pinned `jev-1.13.0`.
  - Work as a whole spec → plan → build with every touchpoint in sync ("the whole loop run and app delivery in sync").
  - Simplify before building anything new. The cleanup is Phase 1 of this plan, in its own commit.
  - Market Watch is dropped as a Jev candidate.
  - Curation, categories, summaries and the Brief analysis stay with Opus. Jev can't do "good enough?" calls (55% precision as a decider in Idea Radar).
- **The admin in this app is the shared admin for several radars** (EUDI, Athlon and Allekirjoitus sources and runs). It is used on purpose and is not leftovers. The owner corrected this on 2026-09-29. It stays untouched in this build except the EUDI runs table. The owner wants it renamed and redone as a multi-app admin **as a separate topic after this build**: propose that once this plan is shipped.
- **Needs the owner's explicit "go" first:** the plan as a whole, including permanently deleting the 3 LCC loops (eudi-relevance, eudi-curation, eudi-livingdoc) and D5 (the routine patching Brief sections through `brief-patch`, with a `bible-prev` backup and guards). Once the owner says "go" on the plan, its tasks are authorized: don't re-confirm sub-steps.
- **Newsletter:** an open owner question: leave it off, or have the routine send it after the update. There are 4 subscribers; `/api/newsletter/send` exists. Out of scope until answered.
- **Money framing:** the owner's Claude plan is paid and has usage limits. Routine work spends plan capacity. Never call it "free" or "$0".
- **Owner interaction style:**
  - Dictated, often angry messages that pack several asks: answer every ask, and the literal question first.
  - Plain "replace X, saves Y" answers with numbers. No hedged essays, no freestyling claims about Jev: check them against jev KNOWLEDGE.md §0's pre-flight table.
  - No subagent fan-outs for sweeps.
  - Stop and say so when a claim was wrong.
- **Keys and secrets:**
  - TypeSafe key `eudi-wallet-tracker`: the owner creates it and pastes it in chat. It goes into `.env.local` (read `.env*` only with Grep count or files_with_matches mode) and into `gh secret set TYPESAFE_API_KEY`, piped, never printed.
  - `DATABASE_URL` is in `.env.local` and GitHub secrets. `LOOP_TOKEN` is in Vercel and the routine prompt.
- **Schedules:**
  - The routine's next run is 2026-09-30 03:36 UTC. It will run the old prompt unless Phase 1 lands first; that's harmless, same as every week.
  - Scrapes run Wednesday and Saturday at 06:00 UTC. Wednesday's scrape lands after the routine, which is one reason for Jev at scrape time.
- **The scrape job has a 10-minute cap.** Jev at 5 workers takes ~1 minute per 1,000 articles.

## Gotchas from this session
- The rules drifted because the 2026-09-11 plan (`docs/plans/2026-09-11-section12-signing-sealing.md`, task 9) assumed the cloud routine would pick up repo prompt changes. It carries its own pasted copy. After changing any rule, read the live prompt back.
- Opus's Stage 1 writes relevant ids per 100-article batch, so unlisted ids default to irrelevant: quiet drops and quiet dedupe. Don't treat those labels as ground truth.
- The 11–12.09 source import (1,354 articles) was bulk-marked irrelevant without being read: bookkeeping, not judgments.
- `op=living-doc&since=` filters on `scraped_at`; the 23.09 run itself flagged the missing Estonia item.
- Bash one-liners with JS template literals get mangled. Write scripts with the Write tool, and patch with split/join.
- The auto-mode classifier sometimes gives no verdict: retry once as-is. It blocks edits to settings.json; hand those to the owner.
- `process.loadEnvFile` fails on `.env.local` files with a BOM; use dotenv. Worker scripts resolve `../.env.local` from the cwd (run them from `worker/`).
- `verify-deploy.mjs` / ship.mjs write `deploy-verify-*.png` into the current folder. Two are lying in this repo's root (untracked; Phase 1 deletes them).

## Pending owner items
- [ ] "Go" on `docs/plans/2026-09-29-pipeline-sync.md` (incl. deleting the 3 LCC loops, and D5).
- [ ] The newsletter: off, or sent by the routine after each weekly update?
- [ ] Create the TypeSafe key `eudi-wallet-tracker` in console.typesafe.ai and paste it (needed from Phase 2).
- [ ] Next topic after this build: rename and redo the shared radar admin (EUDI, Athlon, Allekirjoitus) as a multi-app admin.
- [ ] (Jev project) Add `"cleanupPeriodDays": 365` at the top level of `C:\Users\Kasutaja\.claude\settings.json`, before 2026-10-26.

## The continuation prompt (paste into the fresh window)
```
Continue the EUDI Wallet Tracker pipeline build. Read C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\RESUME-HERE.md first and follow it exactly. Settled decisions are settled; don't re-ask them.

Mission: build docs/plans/2026-09-29-pipeline-sync.md phase by phase (spec: docs/specs/2026-09-29-pipeline-sync.md, SPEC — complete).
1. First get the owner's explicit "go" on the plan (it includes permanently deleting the 3 LCC loops and D5 brief-patch) and their newsletter answer, if they haven't given them in this window. Ask both in one short message.
2. Phase 1 (simplify: loop/pipeline.md, live routine prompt pointer, delete dead prompts, scripts and LCC loops with local backups first, proof = a real routine run) needs no key. Start it right after the go.
3. Phase 2 needs the TypeSafe key "eudi-wallet-tracker" from the owner. The draft code on branch pipeline-sync is a starting point; rebase it on Phase 1's master and make it match the plan's interfaces.
Tick each task in the plan file as it lands and commit the ticks with the code; run every gate through the real entry point and show the evidence.

Sources: C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\docs\specs\2026-09-29-pipeline-sync.md, ...\docs\plans\2026-09-29-pipeline-sync.md, C:\Users\Kasutaja\Claude_Projects\jev\KNOWLEDGE.md (§0 pre-flight, §11 test F), C:\Users\Kasutaja\Claude_Projects\jev\eval\eudi-filter.mjs, C:\Users\Kasutaja\Claude_Projects\idea-radar\worker\src\jev-gate.ts.
Rules: the admin in this app is the shared admin for several radars (EUDI, Athlon, Allekirjoitus). It is in use; don't touch it except the EUDI runs table (renaming it is a separate topic after this build). The repo is public, so never print or commit the routine's tokens or any key. The routine prompt changes only via RemoteTrigger get then update. Plain answers with numbers; check every Jev claim against KNOWLEDGE.md §0. A deviation changes the plan file before the code. After Phase 5: code-reviewer, /simplify, ship.mjs, /wrap-up. Go.
```
