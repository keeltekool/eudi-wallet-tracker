# Section 12: Qualified Signing & Sealing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a living Section 12 to the EUDI Wallet Tracker Strategy Brief, seeded with the PT2 competitive intelligence, and expand the source base with 24 signing/sealing/QSCD-relevant feeds.

**Architecture:** The existing 3-stage AI pipeline (filter → curate → living-doc update) already handles sectioned Strategy Brief updates. Section 12 is inserted into the Neon `living_doc` bible entry. Curation and filter prompts are updated to recognize signing/sealing content as high-relevance. No new infrastructure — all changes are data and prompt edits.

**Tech Stack:** Neon PostgreSQL (Drizzle), tsx scripts, markdown prompts, cloud routine (Opus 5)

---

### Phase 1: Sources (24 new + 2 fixes)

**Task 1: Batch-insert 24 new sources**

Files: `scripts/add-section12-sources.ts` (temp, delete after)

24 sources: 11 Tier 1 (Ascertia, Futurex, PQShield, Wultra, DigiCert, A-Trust, Evrotrust, KuppingerCole, Certum, LuxTrust, Authada) + 12 Tier 2 (Securosys, IDEMIA, GlobalSign, Sectigo, LVRTC, DVV Finland, Skribble, Docaposte, Procivis, ValidSign, SandboxAQ, Traficom)

**Task 2: Fix CSC Consortium feed (id exists, returning 0)**

Verify feed URL works, update source record if needed.

**Task 3: Fix Cryptomathic feed (id 69, returning 0)**

Check if CSS selectors need updating via admin AI analysis.

### Phase 2: Strategy Brief Section 12

**Task 4: Convert PT2 amended output to Section 12 markdown**

Convert the artifact HTML to markdown format matching the existing Strategy Brief section structure (## heading, ### subsections, tables, open questions).

**Task 5: Insert Section 12 into Neon living_doc bible**

Read current bible → append Section 12 before Changelog → write back.

**Task 6: Sync to Google Drive mirror**

Overwrite `G:\My Drive\SK_RE\EUDW\EUDI_Wallet_Strategy_Brief_Clean.md`

### Phase 3: Pipeline Updates

**Task 7: Update filter prompt**

Add signing/sealing keywords to the "mark as relevant" list.

**Task 8: Update curation prompt**

Add signing/sealing content to the 9-10 relevance tier and the ACCEPT list.

**Task 9: Verify cloud routine covers Section 12**

Check that the cloud routine's prompt (EUDI Pipeline) doesn't need changes — the living-doc step reads the full bible, so Section 12 should be picked up automatically.

### Phase 4: Bookkeeping

**Task 10: Update project memory**

Update `project_eudi_wallet_tracker.md` with Section 12 addition, new source count, and prompt changes.
