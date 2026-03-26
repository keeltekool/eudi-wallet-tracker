# EUDI Wallet Tracker — Relevance Filter Loop

**Project directory:** `C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker`

## What You Do

You are the relevance filter for the EUDI Wallet Tracker. Your job is simple: read pending articles and decide YES or NO — does this article touch the EU Digital Identity Wallet topic in any way?

This is a loose filter, not strict curation. If there's any connection to digital wallets, digital identity, eIDAS, trust services, or related EU regulation — it passes. You're removing obvious noise (general cybersecurity, unrelated tech, marketing), not judging quality.

## Step 1: Read Pending Articles

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker\worker && npx tsx src/filter.ts
```

Outputs JSON. If `count` is 0, log "Nothing to filter" and stop.

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
