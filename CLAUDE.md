# EUDI Wallet Tracker

- The shared radar admin moved to **Scrapyard** (https://scrapyard-ten.vercel.app, repo `keeltekool/scrapyard`) on 2026-09-29. Do not add admin UI here; `/admin/*` redirects there.
- Scrapyard reads and writes this database's `sources` table and reads `scrape_runs`. A schema change to those two tables must be mirrored in `scrapyard/schemas/eudi.ts`.
- Full project docs: `STACK.md`.
