# EUDI Wallet Tracker — Stack

> Last updated: 2026-04-14

## Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon** | Postgres DB (sources, articles, scrape_runs) | `DATABASE_URL` |
| **Vercel** | Next.js dashboard + admin hosting | — |
| **GitHub Actions** | Twice-weekly scraper (Wed+Sat 06:00 UTC) | `DATABASE_URL` (GH secret) |
| **Anthropic API** | One-off CSS selector analysis (~$0.01/source) | `ANTHROPIC_API_KEY` |
| **Loop Control Center** | Filter + curation loop management | LCC API key in LCC `.env.local` |
| **Brevo** | Newsletter email delivery (separate API key from WHO DIS?) | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` |
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
AI Pipeline (manually triggered, runs full sequence):
  1. Filter — marks relevant / irrelevant (loose topic match)
  2. Curate — scores 1-10, threshold 8, writes summaries + categories
  3. Strategy Brief update — analyzes accepted articles against Strategy Brief,
     applies surgical changes, writes to Neon + Google Drive .md file
  4. Newsletter — triggered automatically after Strategy Brief update via Brevo
User controls cadence (typically weekly). No automatic scheduling gates.
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
- **AI Pipeline:** Manually triggered by user in Claude Code session. Runs filter → curate → Strategy Brief update → newsletter sequentially.

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Neon `channel_binding=require` breaks Drizzle | Strip from connection string, use `sslmode=require` only |
| Vercel didn't auto-detect Next.js framework | Add `vercel.json` with `{"framework": "nextjs"}` |
| Worker `dotenv` path when run from `worker/` dir | Use `config({ path: "../.env.local" })` |
| Render removed free background worker tier | Switched to GitHub Actions (free for public repos) |
| Next.js 16 middleware deprecation warning | Still works, but `proxy` is the new convention |
| `npm ci` fails with workspaces in GitHub Actions | Use `npm install` instead |
| AI pipeline only runs when Claude Code is open | Manually triggered by user, runs full sequence in one session |
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
