# Admin Panel Refactor — Shared Intel Hub

**Date:** 2026-04-18
**Status:** Approved

## Goal
Bring Allekirjoitus admin view to parity with EUDI. Generalize naming. Establish reusable pattern for future intel projects.

## Changes

### Naming
- Login: "EUDI Admin" → "Tracker Admin"
- Page titles project-neutral, switcher handles differentiation

### Allekirjoitus Sources View
- Stats cards: Total, Active, Changed, Failed, Pending
- Filters: status, competitor, theme
- Sortable columns: Competitor, URL, Theme, Status, Last Scraped
- Bulk actions: Delete (with confirm), Pause, Resume
- Status badges: Active (green), Changed (blue), Failed (red), Pending (gray)
- Source count + Run history link, Export URLs button

### Bulk Action API
- Extend `/api/sources/bulk-action` with project detection
- Same actions: delete, pause, resume

### Runs View
- Match EUDI run history table format

## Files
- `login/page.tsx` — rename heading
- `components/admin-header.tsx` — neutral title
- `sources/_components/allekirjoitus-sources-view.tsx` — full rebuild
- `api/sources/bulk-action/route.ts` — project extension
- `runs/_components/allekirjoitus-runs-view.tsx` — polish
