# EUDI Wallet Source Research — Master Prompt

## What I'm Building

An automated monitoring system that tracks the EU Digital Identity Wallet (EUDI Wallet / eIDAS 2.0) landscape. It scrapes a list of web sources twice per week, uses AI to filter and curate relevant articles, and presents them as a curated news feed for my team at SK ID Solutions — Estonia's national trust service provider for digital identity (Smart-ID, Mobile-ID, ID-card infrastructure).

The system can consume two types of sources:
- **RSS feeds** — easiest to integrate
- **HTML pages with article/news listings** — parsed via CSS selectors

## What I Need From You

**Identify the top sources for monitoring EUDI Wallet / eIDAS 2.0 developments.** I need the most valuable, most authoritative, most actively publishing sources across the full landscape — EU institutions, standards bodies, national implementations, industry, media, expert voices, legislative tracking, and anything else you determine is critical.

I don't know what I don't know. Your job is to find what matters, including sources I wouldn't think to look for.

**Strategic context:** SK ID Solutions operates in the Baltics (Estonia, Latvia, Lithuania). National implementation developments in these three countries are of highest strategic importance, but the full EU-wide picture matters too.

## For Each Source, Provide

1. **Name** — the organization, publication, or author
2. **URL** — the specific page to monitor (the news/updates page, not just the homepage)
3. **RSS available?** — Yes (with RSS URL) / No / Unknown
4. **Category** — your own categorization of what type of source this is
5. **Why it matters** — one sentence on why this source is valuable
6. **Update frequency** — how often it publishes relevant EUDI content
7. **Signal-to-noise** — High (mostly EUDI/eIDAS), Medium (regular EUDI among other topics), Low (occasional)

## Quality Criteria

**Prioritize:**
- Actively publishing in 2025-2026
- Authoritative and credible
- Specific to EUDI Wallet / eIDAS 2.0
- Publicly accessible (no paywalls, no login required)
- Has a structured web page with articles or an RSS feed (scrapable)

**Flag but don't exclude:**
- Valuable but behind paywalls or authentication
- LinkedIn-only experts (not scrapable but worth knowing about)
- PDF-heavy sources with no web index

## Deliverables

1. **Full source list** — organized by category, as many as you can find that meet the quality bar
2. **Top 15 "must-have" sources** — if I could only start with 15, which ones and why
3. **Gaps** — areas where you know there should be a source but couldn't find one
4. **Non-scrapable but valuable** — sources worth monitoring manually
