# EUDI Wallet Tracker — Stack

> Last updated: 2026-08-16

## Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon** | Postgres DB (sources, articles, scrape_runs) | `DATABASE_URL` |
| **Vercel** | Next.js dashboard + admin hosting + Loop API | `LOOP_TOKEN` (scoped auth for `/api/loop`) |
| **GitHub Actions** | Twice-weekly scraper (Wed+Sat 06:00 UTC) | `DATABASE_URL` (GH secret) |
| **Anthropic RemoteTrigger** | `EUDI Pipeline` cloud routine (`trig_01GjY2dYsjf58CnEJPNyrRK9`) — Wed 06:30 Tallinn, Opus 5, runs filter→curate→living-doc via Loop API | token in routine prompt |
| **Anthropic API** | One-off CSS selector analysis (~$0.01/source) | `ANTHROPIC_API_KEY` |
| **Loop Control Center** | FALLBACK ONLY — manual loops kept intact (`run loop eudi-relevance/-curation/-livingdoc`) | LCC API key in LCC `.env.local` |
| **Resend** | Newsletter email delivery | `RESEND_API_KEY` |
| **Google Drive** | Master Strategy Brief `.md` file (`G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md`) | — |
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
Scraper (GitHub Actions, Wed+Sat 06:00 UTC)
  → pending articles in Neon
AI Pipeline — AUTONOMOUS since 2026-08-16 (cloud routine "EUDI Pipeline",
Wed 06:30 Tallinn, Opus 5, subscription-billed, via /api/loop endpoints):
  1. Filter — relevant/irrelevant, loose, 3 rounds × 100/run
  2. Curate — dedup first, fetch bodies for headline-only items, score 1-10,
     threshold 8, summaries + categories
  3. Living doc — [NEW_FACT]/[DEEPENED_INSIGHT] vs Strategy Brief → Neon
NOT migrated to cloud (stay manual/local): Google Drive master-brief surgical
updates (Drive unreachable from sandbox) and newsletter send.
Manual LCC loops remain intact as instant fallback.
```

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
cd worker && npx tsx src/filter.ts # Read pending for filter
cd worker && npx tsx src/curate.ts # Read relevant for curation
npm run db:push                    # Push schema to Neon
npm run db:studio                  # Drizzle Studio
cd worker && npx tsx src/seed-bible.ts <path>  # Re-seed Strategy Brief from .md file
```

## Deploy

- **Dashboard:** auto-deploys on push to `master` via Vercel
- **Scraper:** GitHub Actions workflow `scrape.yml` — cron or manual `workflow_dispatch`
- **AI Pipeline:** Autonomous — cloud routine `EUDI Pipeline` every Wed 06:30 Tallinn (manage via `/schedule` or claude.ai/code/routines). Manual fallback: LCC loops, unchanged.

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Neon `channel_binding=require` breaks Drizzle | Strip from connection string, use `sslmode=require` only |
| Vercel didn't auto-detect Next.js framework | Add `vercel.json` with `{"framework": "nextjs"}` |
| Worker `dotenv` path when run from `worker/` dir | Use `config({ path: "../.env.local" })` |
| Render removed free background worker tier | Switched to GitHub Actions (free for public repos) |
| Next.js 16 middleware deprecation warning | Still works, but `proxy` is the new convention |
| `npm ci` fails with workspaces in GitHub Actions | Use `npm install` instead |
| AI pipeline only runs when Claude Code is open | SOLVED 2026-08-16: cloud routine runs it Wed 06:30 unattended; manual LCC loops = fallback |
| Cloud sandbox has no `gh` CLI; raw api.github.com org-blocked | Use GitHub MCP tools in routine prompts; git clone/push still work |
| Cloud env vars are environment-WIDE and forbid secrets (UI warning) | Never put credentials there — use token-guarded app endpoints (`/api/loop` pattern, `LOOP_TOKEN` in Vercel) |
| Feed quality caps curation: ~34% of rejects were unfetchable Google News JS redirects | Add direct publisher feeds (Biometric Update, Identity Week, Mobile ID World) to recover them |
| Newsletter send route must be GET | Vercel crons (and manual triggers) send GET — never export POST |
| Deleting source with FK on articles | FK constraint removed — `articles.sourceId` is a plain integer, no cascade needed |
| Strict curation changed article counts | Threshold 8 (was looser) — curated count dropped from ~137 to ~76. Quality over quantity. |
| Google Drive `.md` file = master brief | `EUDI_Wallet_Strategy_Brief_Clean.md` in `G:\My Drive\SK_RE\EUDW\`. NOT the `_NEW` file (has escaped markdown from Docs export). Seed via `seed-bible.ts`. Google Docs decommissioned April 2026. |

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
10. **Newsletter:** Trigger manually: `GET /api/newsletter/send` with `Authorization: Bearer <CRON_SECRET>` — must return `{ sent: N }` with `errors: 0`

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
