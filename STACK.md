# EUDI Wallet Tracker — Stack

> Last updated: 2026-03-26

## Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon** | Postgres DB (sources, articles, scrape_runs) | `DATABASE_URL` |
| **Vercel** | Next.js dashboard + admin hosting | — |
| **GitHub Actions** | Twice-weekly scraper (Wed+Sat 06:00 UTC) | `DATABASE_URL` (GH secret) |
| **Anthropic API** | One-off CSS selector analysis (~$0.01/source) | `ANTHROPIC_API_KEY` |
| **Google Fonts** | Fraunces, DM Sans, Epilogue, JetBrains Mono | — |

## Brand

- **Background:** `#F5F3EE` (warm parchment, SÕEL-inspired)
- **Text:** `#1A1A2E` (ink black)
- **Accent:** `#FFD166` (amber, for high relevance scores)
- **Borders:** `#E3E0D9`
- **Display font:** Fraunces (serif) · **Body:** DM Sans · **Labels:** Epilogue · **Mono:** JetBrains Mono

## Auth

- Dashboard: public, no auth
- Admin (`/admin`): cookie-based password gate, env var `ADMIN_PASSWORD`

## Dev

```bash
npm run dev          # Next.js on port 3000
cd worker && npm run scrape   # Manual scrape
cd worker && npm run seed     # Re-seed sources
npm run db:push      # Push schema to Neon
npm run db:studio    # Drizzle Studio
```

## Deploy

- **Dashboard:** auto-deploys on push to `master` via Vercel
- **Scraper:** GitHub Actions workflow `scrape.yml` — runs on cron or manual `workflow_dispatch`

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Neon `channel_binding=require` breaks Drizzle | Strip from connection string, use `sslmode=require` only |
| Vercel didn't auto-detect Next.js framework | Add `vercel.json` with `{"framework": "nextjs"}` |
| Worker `dotenv` path when run from `worker/` dir | Use `config({ path: "../.env.local" })` |
| Render removed free background worker tier | Switched to GitHub Actions (free for public repos) |
| Next.js 16 middleware deprecation warning | Still works, but `proxy` is the new convention |
| `npm ci` fails with workspaces in GitHub Actions | Use `npm install` instead |

## Post-Deploy Smoke Tests

1. Load dashboard — articles render, search works
2. Click "Curated" tab — shows empty state or curated articles
3. Navigate to `/admin` — redirects to login
4. Login with password — source list loads with health badges
5. Check `/admin/runs` — scrape history visible
