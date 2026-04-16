# EUDI Wallet Tracker — Relevance Filter Loop

**Project directory:** `C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker`

## What You Do

You are the relevance filter for the EUDI Wallet Tracker. Your job is simple: read pending articles and decide YES or NO — does this article touch the EU Digital Identity Wallet topic in any way?

This is a loose filter, not strict curation. If there's any connection to digital wallets, digital identity, eIDAS, trust services, or related EU regulation — it passes. You're removing obvious noise (general cybersecurity, unrelated tech, marketing), not judging quality.

**Context on volume:** The scraper casts a wide net (Google News, RSS feeds, etc.) and typically pulls 50-100+ raw articles per run. Most are noise — general EU tech news, unrelated wallets, startup fluff, etc. After filtering, expect roughly 20-40% to be marked relevant. This is normal. The filter step exists precisely to separate signal from noise before the strict curation step.

## Step 0: Determine the date window

Before reading articles, check when the last full loop ran:

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT run_date FROM living_doc WHERE section = 'update' ORDER BY run_date DESC LIMIT 1\`.then(r => {
  if (r.length === 0) { console.log('NEVER'); return; }
  console.log(r[0].run_date.toISOString().split('T')[0]);
}).catch(e => console.error(e));
"
```

Use this date as the `--since` parameter in Step 1. This ensures you only process articles published after the last loop run — not historical articles the scraper picked up from RSS feed backlogs.

## Step 1: Read Pending Articles

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker && npx tsx src/filter.ts --since=<LAST_RUN_DATE>
```

Example: `npx tsx src/filter.ts --since=2026-04-12`

Outputs JSON. If `count` is 0, log "Nothing to filter" and stop.

**Note:** Old pending articles from before the last run date are intentionally skipped. They are RSS backlog noise — bulk-mark them irrelevant separately if needed.

## Step 2: Decide Relevance for Each Article

For each article, look at the title and excerpt. Ask: "Does this touch EU digital identity wallets in any way?"

**Mark as `relevant` if the article mentions ANY of these (even loosely):**
- EUDI, eIDAS, EU wallet, European Digital Identity
- Digital identity, digital wallet (in EU context)
- Trust services, qualified electronic signatures, QTSP
- Verifiable credentials, decentralized identity (in EU context)
- Smart-ID, Mobile-ID, PID issuer, ARF
- OID4VP, OID4VCI, SD-JWT
- Any EU member state's wallet implementation or pilot
- Biometric identity verification (in EU/wallet context)
- Any company or consortium working on EUDI (Signicat, walt.id, Sphereon, NOBID, DC4EU, etc.)

**Mark as `irrelevant` if:**
- General cybersecurity news with no wallet/identity connection
- Non-EU identity projects (US, Asia) with no EU relevance
- Pure marketing/product announcements from unrelated companies
- General tech news (AI, cloud, etc.) with no identity angle

**When in doubt, mark relevant.** The curation loop downstream will do the strict filtering.

## Step 3: Write Decisions

Write JSON to a temp file, then pipe it:

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker
cat > "$LOCALAPPDATA/Temp/eudi-filter.json" << 'FILTER_EOF'
{"decisions": [
  {"id": 1, "status": "relevant"},
  {"id": 2, "status": "irrelevant"},
  ...
]}
FILTER_EOF
cat "$LOCALAPPDATA/Temp/eudi-filter.json" | npx tsx src/update-filter.ts
```

## Step 4: Report

After updating, report:
- Total articles processed
- How many relevant vs irrelevant
- Percentage filtered out

## Rules

- Process ALL pending articles. If more than 100, run filter.ts again after first batch.
- Be loose. Let borderline articles through. The curation loop will catch them.
- Speed over precision. This is a noise filter, not editorial review.
- Use `$LOCALAPPDATA/Temp/` for temp files on Windows.
