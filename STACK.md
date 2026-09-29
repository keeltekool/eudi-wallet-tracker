# EUDI Wallet Tracker — Stack

> Last updated: 2026-09-29

## Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon** | Postgres DB (sources, articles, scrape_runs) | `DATABASE_URL` |
| **Vercel** | Next.js dashboard + admin hosting + Loop API | `LOOP_TOKEN` (scoped auth for `/api/loop`) |
| **GitHub Actions** | Twice-weekly scraper (Wed+Sat 06:00 UTC) + Jev filter | `DATABASE_URL`, `TYPESAFE_API_KEY` (GH secrets) |
| **Anthropic RemoteTrigger** | `EUDI Pipeline` cloud routine (`trig_01GjY2dYsjf58CnEJPNyrRK9`) — Wed 06:30 Tallinn, Opus 5.5 (`claude-opus-5-5` since 29.09), follows `loop/pipeline.md` via the Loop API | Loop + Radar-Check tokens in the routine prompt only |
| **TypeSafe AI (Jev)** | Relevance filter at scrape time (`worker/src/jev-filter.ts`, `jev-1.13.0`, cut 0.05), key `eudi-wallet-tracker` | `TYPESAFE_API_KEY` |
| **Anthropic API** | One-off CSS selector analysis, `claude-sonnet-5-5` with `thinking: between_tools` (~$0.03/source est.; Sonnet 4 retired 15.06.2026 broke it until 28.09.2026) | `ANTHROPIC_API_KEY` |
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
- Admin (`/admin`): cookie-based password gate, env var `ADMIN_PASSWORD`
- See Admin section below for full feature inventory

## Admin (`/admin`)

Password-protected via cookie gate (`ADMIN_PASSWORD` env var).

- **Source table:** filterable by status/type/category, sortable columns (name, status, last scraped, article count), external link icons
- **Bulk actions:** multi-select sources → delete, pause, resume, re-analyze CSS selectors
- **Source CRUD:** add/edit/delete sources, health status badges, dry-run preview
- **AI CSS selector analysis:** one-click analysis for HTML-scraped sources (~$0.01/source via Anthropic API)
- **"Fix with AI" banner:** prominent on broken/needs-setup source edit pages — one click to re-run AI analysis
- **YouTube auto-detect:** paste a YouTube channel URL → auto-extracts channel ID, constructs RSS feed URL
- **Bulk import:** paste multiple URLs with duplicate detection and validation preview
- **Scrape run history:** `/admin/runs` — timestamps, article counts, errors per run
- **FK constraint removed:** `articles.sourceId` has no FK — sources can be deleted without cascading to articles

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
4. Navigate to `/admin` — redirects to login
5. Login with password — source list with health badges
6. Check `/admin/runs` — scrape history visible
7. Admin source table — filter by status, sort by columns, bulk select works
8. Click a broken source → "Fix with AI" banner visible
9. Visit `/newsletter` — subscribe page renders, form works
10. **Newsletter:** the routine's `living-doc-update` response shows `newsletter.sent`; manual resend: `GET /api/newsletter/send` with `Authorization: Bearer <CRON_SECRET>`
11. **Automated:** `node ~/.claude/scripts/ship.mjs / /filtered /curated /strategy /newsletter` (runs `scripts/check-ui-flows.mjs`: admin, Jev counts, 375 px overflow, Filtered)

## Federated Admin (2026-04-17)

Admin now serves multiple projects via a cookie-based connection router:

- `selected_project_id` cookie (values: `"eudi"` | `"allekirjoitus"`, default `"eudi"`) controls which Neon database admin reads/writes.
- `src/lib/db/connections.ts` → `getDbForProject(projectId)` returns the correct Drizzle client.
- `src/lib/project-context.ts` → `getSelectedProject()` reads the cookie (server-side).
- `app/admin/components/project-switcher.tsx` — client-side dropdown in admin chrome.
- `src/db/schema-allekirjoitus.ts` — schema copy for type-safe queries against the Allekirjoitus Neon instance (separate Neon project, connection string in `DATABASE_URL_ALLEKIRJOITUS`).

**Zero changes** to EUDI's worker, filter, curate, brief-update, or newsletter code paths. Admin UI stays visually identical (plain gray Tailwind).

Projects sharing the admin:
- `eudi` — this project (EUDI Wallet Tracker). Data in `DATABASE_URL` Neon instance.
- `allekirjoitus` — Allekirjoitus Competitive Intel Tracker (separate repo `allekirjoitus-competitive-tracker`). Data in `DATABASE_URL_ALLEKIRJOITUS` Neon instance.

See `../Allekirjoitus-benchmark-agent/docs/plans/2026-04-17-allekirjoitus-competitive-intel-tracker.md` for the full plan.
