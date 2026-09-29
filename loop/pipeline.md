# EUDI Pipeline — procedure and rules

The weekly cloud routine "EUDI Pipeline" reads this file from its checkout and follows it. It is the only copy of the pipeline's rules. The routine's own prompt holds just the setup (`$API`, `$AUTH`, the Radar-Check token) and a pointer here. This repo is public: never write a token into this file, and never print the Authorization header value.

The curated feed and the Strategy Brief are read by SK ID Solutions colleagues. Quality over volume, always.

**Scope sync:** the scrape job's Jev filter (`worker/src/jev-filter.ts`) asks a question that mirrors the Scope below. Change one, change the other, and re-fit the cut with `Claude_Projects/jev/eval/eudi-filter.mjs`.

## Scope (topic in / out)

**In** — the article touches any of these, even loosely:
- EUDI, eIDAS, EU wallet, European Digital Identity; digital identity or digital wallets in an EU context
- Trust services, qualified electronic signatures, QTSPs; qualified electronic seals, e-sealing, document sealing in an EU context
- Verifiable credentials, decentralized identity in an EU context; OID4VP, OID4VCI, SD-JWT; ARF; PID issuers
- Smart-ID, Mobile-ID; any EU member state's wallet implementation or pilot
- Biometric identity verification in an EU or wallet context
- Companies and consortia working on EUDI (Signicat, walt.id, Sphereon, NOBID, DC4EU, WE BUILD, POTENTIAL, APTITUDE, etc.)
- CSC API, Cloud Signature Consortium, remote signing, remote sealing
- QSCD, QSealCD, HSM certification (EN 419241, Common Criteria) in an EU/eIDAS context
- Post-quantum cryptography for digital signatures or trust services
- European Business Wallet, corporate identity wallets
- QTSP and signing-infrastructure vendors (Buypass, primesign, Swisscom, A-Trust, Evrotrust, Zetes, Ascertia, Intesi Group, Certum, etc.) and their market moves: acquisitions, mergers, new signing/sealing products, wallet gateway launches, managed identity + signing hubs
- Signing/sealing pricing and business models, free QES implementations and their commercial impact
- National wallet signing procurements (which QTSP won, contract values, signing scope in wallet tenders); wallet-integrated signing flows and signing UX

**Out:**
- General cybersecurity with no wallet or identity connection
- Non-EU identity projects (US, Asia) with no EU relevance
- Pure marketing from unrelated companies
- General tech news (AI, cloud, etc.) with no identity angle

## Stage 0 — Safety net for pending articles

Normally the scrape job's Jev filter has already sorted every article, and this stage finds nothing.

`curl -s -H "$AUTH" "$API?op=filter"` → `{count, articles:[{id,title,source,excerpt}]}`. If `count` is 0, go to Stage 1.

Otherwise sort each article `relevant` or `irrelevant` by the Scope above. This is a loose filter that removes obvious noise; when in doubt, mark relevant. **Every article in the batch gets an explicit decision** — an id you leave out stays pending, it is not "irrelevant".

```bash
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d @/tmp/filter-decisions.json "$API"
# body: {"op":"filter-decisions","decisions":[{"id":123,"status":"relevant"},{"id":124,"status":"irrelevant"}]}
```
Check that the response `total` equals the number you sent. The API returns 100 at a time: repeat until `count` is 0, at most 3 rounds.

## Stage 1 — Curate (strict)

`curl -s -H "$AUTH" "$API?op=curate"` → articles marked relevant, 50 at a time, with `excerpt` (500 characters). If `count` is 0, go to Stage 2. After each POST, GET again until `count` is 0.

Before scoring:
1. **Collapse duplicates.** Group items covering the same story (same event, different source). Score only the best-sourced copy; reject the others with `rejectionReason` "Duplicate of #<id>". If the copies give conflicting figures, note the conflict in the kept item's summary instead of picking silently.
2. **Fetch bodies for headline-only items.** If the excerpt is empty or clearly truncated and the headline promises substance (legal analysis, risk report, procurement detail), fetch the URL with `curl -sL --max-time 20` and judge from the body. If the fetch fails or is paywalled, reject with "headline-only, body unavailable". Never accept on a headline's promise alone.

**Score 1–10:**
- **9–10:** explicitly about the EUDI Wallet, eIDAS 2.0, ARF releases, EUDI pilots, national wallet implementations, EUDI use cases; or qualified signing/sealing in an EU context: QTSP competitive moves, signing/sealing service launches, wallet QES procurements, free QES implementations, CSC API, QSCD certifications, QTSP eIDAS 2.0 certifications, QTSP acquisitions and mergers, wallet gateway launches, signing pricing and business models, European Business Wallet signing/sealing.
- **7–8:** verifiable credentials / OpenID4VP / OID4VCI / wallet protocols in the EU context with a clear EUDI connection; HSM/PKI/certificate-management vendors relevant to EU trust services; PQC migration for digital signatures.
- **5–6:** digital identity, trust services or wallets in general, with no specific EUDI, eIDAS or EU wallet regulation link.
- **1–4:** not about the EUDI Wallet.

**Threshold 8: accept only if the score is ≥ 8 and the article survives the reject list. When in doubt, reject.**

**Reject, even from relevant sources:**
- General company news (awards, hiring, partnerships) with no EUDI mention
- Generic digital-identity pieces with no EUDI/eIDAS connection
- General cybersecurity, privacy or data-protection news
- SDK/library releases with no meaningful feature description; CI fixes, dependency bumps, minor patches
- Product marketing pages without EUDI-specific content; vendor thought-leadership without concrete facts
- Conference announcements or recaps without substance
- Static/reference pages and years-old items that are not news
- Passkeys, FIDO, biometrics with no EUDI connection
- General EU tech regulation (AI Act, DSA, DMA) unless it directly affects the EUDI Wallet

**Accept:**
- EUDI regulation updates, implementing acts, deadlines; national implementations; ARF releases with real changes
- Pilot programme news (NOBID, DC4EU, WE BUILD, POTENTIAL, APTITUDE, etc.)
- VC specs explicitly used by the EUDI Wallet; companies building EUDI infrastructure, with specific EUDI context
- EUDI adoption, risk or market analysis with real facts; cross-border interoperability in the EU
- Qualified signing/sealing market developments: QTSP moves (acquisitions, partnerships, new products, wallet gateway launches), remote-signing provider positioning, eIDAS 2.0 QTSP certifications (CIR 2025/1567), CSC API implementations
- National signing infrastructure decisions: which QTSP won a wallet QES contract, free QES implementations and caps, signing procurement tenders, national trust-service regulatory decisions
- Signing/sealing business intelligence: pricing models, market consolidation (e.g. Signicat/Dokobit), the wallet gateway market (Worldline, Signicat, Namirial competing for relying-party integration), managed signing hubs bundling identity and signing
- QSCD/HSM vendor developments relevant to EU trust services (Thales, Utimaco, Cryptomathic, Futurex, Securosys): certifications, PQC readiness, new products
- Post-quantum cryptography for digital signatures and seals in an EU context: algorithm adoption, migration timelines, vendor readiness
- European Business Wallet developments (signing, sealing, corporate identity, commercial pricing)

**Accepted** → `summary`: 2–3 sentences on what happened and why it matters, written for an SK ID Solutions product strategist (implications, not just facts); `categories`, one or more of `regulation`, `technical-standards`, `national-implementation`, `industry`, `security-privacy`, `interoperability`, `market-analysis`.
**Rejected** → `relevanceScore` and a one-line `rejectionReason`.

```bash
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d @/tmp/curation-decisions.json "$API"
# body: {"op":"curation-decisions","decisions":[
#   {"id":1,"status":"accepted","relevanceScore":9,"summary":"...","categories":["regulation"]},
#   {"id":2,"status":"rejected","relevanceScore":3,"rejectionReason":"..."}]}
```
Check that the response `total` equals the number you sent.

## Stage 2 — Weekly update log

```bash
SINCE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)
curl -s -H "$AUTH" "$API?op=living-doc&since=$SINCE" > /tmp/accepted.json
curl -s -H "$AUTH" "$API?op=bible" > /tmp/bible.json
```

Read the whole Strategy Brief first. Then test each accepted article against it, in this order:
1. **NEW_FACT**: something the Brief doesn't mention at all (a new deadline, country decision, spec version, company, pilot result).
2. **UPDATED_FACT**: a fact in the Brief has changed (a deadline moved, a country changed approach, a spec superseded).
3. **RESOLVED_QUESTION**: an open question in the Brief now has an answer.
4. **DEEPENED_INSIGHT**: a known topic with meaningfully new detail (concrete numbers, implementation specifics).

None of the four → skip the article. Confirmation of known information isn't news. Skip duplicates (keep the best source), vague updates and marketing. Would an SK product strategist learn something new? If not, cut it. 0–5 items is normal, and "no significant new intelligence" is a valid outcome.

Format, one block per Brief section touched, using the Brief's exact section heading:
```
### Section 7: European Business Wallet
- [NEW_FACT] One-line description
  → Context: what this adds to or changes in the Strategy Brief, and why it matters for SK.
  → Source: [Article title](URL)
```
Every item carries a `→ Source:` link. Refer to the main document as "the Strategy Brief", never "bible".
If nothing is new, the content is: `No significant new intelligence this cycle. N articles reviewed, all covered by existing Strategy Brief content.`

Write it every run, even when nothing is new:
```bash
# body: {"op":"living-doc-update","update":{"content":"<markdown>","runDate":"<ISO now>","articlesProcessed":N,"sectionsTouched":["Section 7: European Business Wallet"]}}
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d @/tmp/living-doc-update.json "$API"
```

## Stage 3 — Radar-Check report

Always the last action, including early stops and failures: the Radar-Check call from the routine prompt, `"status":"ok"` if every stage wrote its results, `"status":"failed"` otherwise. If that call fails, retry once, say so in the closing message, and end.

## Error handling
- 401, 500 or non-JSON from the setup sanity check → stop, file a GitHub issue `EUDI Pipeline ERROR — <date>` with the error (GitHub MCP tools; the sandbox has no `gh` CLI and api.github.com is blocked), then Stage 3 with `failed`.
- A POST fails → retry once. Still failing → file the same issue, stating what was written and what wasn't, then Stage 3 with `failed`.
- Everything succeeds → no issue. Silence means success.

## Closing line
`Sorted S (R relevant/I irrelevant) · curated C (A accepted/J rejected) · update: U items — all written.`
