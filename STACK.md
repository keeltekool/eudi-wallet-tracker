# EUDI Wallet Tracker — Stack

> Last updated: 2026-09-29

## Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon** | Postgres DB (sources, articles, scrape_runs) | `DATABASE_URL` |
| **Vercel** | Next.js dashboard + Loop API | `LOOP_TOKEN` (scoped auth for `/api/loop`) |
| **GitHub Actions** | Twice-weekly scraper (Wed+Sat 06:00 UTC) + Jev filter | `DATABASE_URL`, `TYPESAFE_API_KEY` (GH secrets) |
| **Anthropic RemoteTrigger** | `EUDI Pipeline` cloud routine (`trig_01GjY2dYsjf58CnEJPNyrRK9`) — Wed 06:30 Tallinn, Opus 5.5 (`claude-opus-5-5` since 29.09), follows `loop/pipeline.md` via the Loop API | Loop + Radar-Check tokens in the routine prompt only |
| **TypeSafe AI (Jev)** | Relevance filter at scrape time (`worker/src/jev-filter.ts`, `jev-1.13.0`, cut 0.05), key `eudi-wallet-tracker` | `TYPESAFE_API_KEY` |
| **Resend** | Newsletter: sent by `living-doc-update` after each weekly update (1 subscriber) | `RESEND_API_KEY`, `CRON_SECRET` (manual send) |
| **Google Fonts** | Fraunces, DM Sans, Epilogue, JetBrains Mono | — |

## Brand

- **Background:** `#F5F3EE` (warm parchment, SÕEL-inspired)
- **Text:** `#1A1A2E` (ink black)
- **Accent:** `#FFD166` (amber, for high relevance scores)
- **Borders:** `#E3E0D9`
- **Display font:** Fraunces (serif) · **Body:** DM Sans · **Labels:** Epilogue · **Mono:** JetBrains Mono

## Auth

- Dashboard: public, no auth (3 tabs: All Articles, Filtered, Curated)
- Admin: **moved to Scrapyard** (https://scrapyard-ten.vercel.app, repo `keeltekool/scrapyard`) on 2026-09-29. `/admin/*` here answers 308 to Scrapyard. Do not add admin UI to this repo.

## Admin

Sources, source health and scrape runs of this radar are managed in **Scrapyard** (the shared admin for all radars). Scrapyard reads and writes this database's `sources` table and reads `scrape_runs`, via its own `DATABASE_URL_EUDI` (same value as `DATABASE_URL` here). A `sources`/`scrape_runs` schema change here must be mirrored in `scrapyard/schemas/eudi.ts`.

## Pipeline

```
Scrape job (GitHub Actions, Wed+Sat 06:00 UTC)
  → store; a copy of a story scraped in the last 4 days → rejected "Duplicate of #id"
  → Jev sorts every pending article relevant/irrelevant (score in articles.jev_score,
    counts in scrape_runs.jev); Jev down → articles stay pending
Weekly routine "EUDI Pipeline" (Wed 06:30 Tallinn, Opus 5.5, spends plan capacity):
  prompt = tokens + "follow loop/pipeline.md" (the only copy of scope and rubric)
  0. safety net: sort anything still pending   1. curate (score >= 8, summaries)
  2. update log since the last update + brief-patch Brief sections + newsletter
  3. Radar-Check report
```
- **Rollback Jev:** `gh secret delete TYPESAFE_API_KEY`; Stage 0 sorts pending articles as before.
- **Scope change:** edit `loop/pipeline.md` Scope AND the Jev question in `jev-filter.ts`, then re-fit with `Claude_Projects/jev/eval/eudi-filter.mjs`.
- **Routine prompt:** change only via RemoteTrigger get → update; it holds tokens, the repo is public.
- **Brief restore:** `living_doc` row `bible-prev` = the Brief before the last run's first patch. Neon is the only Brief (no Drive copy since 2026-09-29).
- **Measure Jev per run:** `node Claude_Projects/jev/eval/measure-eudi-live.mjs`.

### Dashboard Tabs (public)
- **All Articles:** raw firehose, all statuses, basic cards
- **Filtered:** EUDI-relevant articles (includes rejected-by-curation — still topic-relevant)
- **Curated:** AI-scored 8+ only, enriched cards with summaries + category badges + relevance scores
- **Strategy Brief:** 13 collapsible sections (Exec Summary + 11 numbered sections + Changelog) + Intelligence Updates

## Dev

```bash
npm run dev                        # Next.js on port 3000
cd worker && npm run scrape        # Manual scrape
cd worker && npm run seed          # Re-seed sources
npm run db:push                    # Push schema to Neon
npm run db:studio                  # Drizzle Studio
```

## Deploy

- **Dashboard:** auto-deploys on push to `master` via Vercel
- **Scraper:** GitHub Actions workflow `scrape.yml` — cron or manual `workflow_dispatch`
- **AI Pipeline:** Autonomous — cloud routine `EUDI Pipeline` every Wed 06:30 Tallinn (manage via `/schedule` or claude.ai/code/routines). Run on demand: RemoteTrigger `run`. The LCC loops were deleted 2026-09-29.

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Neon `channel_binding=require` breaks Drizzle | Strip from connection string, use `sslmode=require` only |
| Vercel didn't auto-detect Next.js framework | Add `vercel.json` with `{"framework": "nextjs"}` |
| Worker `dotenv` path when run from `worker/` dir | Use `config({ path: "../.env.local" })` |
| Render removed free background worker tier | Switched to GitHub Actions (free for public repos) |
| Next.js 16 middleware deprecation warning | Still works, but `proxy` is the new convention |
| `npm ci` fails with workspaces in GitHub Actions | Use `npm install` instead |
| Routine prompt carried its own pasted copy of the rules; repo prompt edits never reached it (2026-09-11 → 29) | The prompt now only points at `loop/pipeline.md`; after a rules change, read the routine back with RemoteTrigger `get` |
| `npx tsx` in `worker/src` runs from the workspace folder | Call `../../node_modules/.bin/tsx check-jev-filter.ts` |
| `.env.local` has a BOM: `process.loadEnvFile` silently fails | Use dotenv (`config({ path })`) in every script |
| Vercel `RESEND_API_KEY` carried a BOM from 12.09 to 29.09: every send failed with "Cannot convert argument to a ByteString … 65279" | Set Vercel env vars from a no-BOM temp file with `cmd <` (memory `feedback_vercel_env_no_powershell_pipe`); check with `vercel env pull` + length |
| Google's favicon service 404s (with a globe image) for icon-less sites → console errors, ship.mjs fails | Cards load `/api/favicon?domain=`, which passes the image through with 200 |
| Cloud sandbox has no `gh` CLI; raw api.github.com org-blocked | Use GitHub MCP tools in routine prompts; git clone/push still work |
| Cloud env vars are environment-WIDE and forbid secrets (UI warning) | Never put credentials there — use token-guarded app endpoints (`/api/loop` pattern, `LOOP_TOKEN` in Vercel) |
| Feed quality caps curation: ~34% of rejects were unfetchable Google News JS redirects | Add direct publisher feeds (Biometric Update, Identity Week, Mobile ID World) to recover them |
| Newsletter send route must be GET | Vercel crons (and manual triggers) send GET — never export POST |
| Deleting source with FK on articles | FK constraint removed — `articles.sourceId` is a plain integer, no cascade needed |
| Strict curation changed article counts | Threshold 8 (was looser) — curated count dropped from ~137 to ~76. Quality over quantity. |

## Post-Deploy Smoke Tests

1. Load `/` — All Articles tab shows raw feed
2. Click "Filtered" tab — shows EUDI-relevant articles only
3. Click "Curated" tab — shows AI-scored articles with summaries
4. `/admin` answers 308 to Scrapyard
5. Visit `/newsletter` — subscribe page renders, form works
6. **Newsletter:** the routine's `living-doc-update` response shows `newsletter.sent`; manual resend: `GET /api/newsletter/send` with `Authorization: Bearer <CRON_SECRET>`
7. **Automated:** `node ~/.claude/scripts/ship.mjs / /filtered /curated /strategy /newsletter` (runs `scripts/check-ui-flows.mjs`: /admin redirect, 375 px overflow, Filtered). Jev counts on the runs page are checked in Scrapyard.

