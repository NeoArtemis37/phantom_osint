# Task 9 — Wayback Machine Integration Agent

**Agent name:** full-stack-developer
**Task ID:** 9
**Task:** Add Wayback Machine (web.archive.org) integration to PHANTOM OSINT — backend route + cyberpunk frontend panel + tab integration in OSINTTools.tsx + api-client method. Lets an investigator see how a URL/domain's web presence evolved over time (past → now).

## Context Loaded

- Read `/home/z/my-project/worklog.md` to understand prior work (auth/JWT migration, OSINT tools, global country coverage from Tasks 1–33)
- Read `/home/z/my-project/src/components/osint/MaigretPanel.tsx` for cyberpunk panel style reference
- Read `/home/z/my-project/src/components/OSINTTools.tsx` for tab structure
- Read `/home/z/my-project/src/lib/api-client.ts` for the `osintApi` object shape and `LocaleParams` type
- Read `/home/z/my-project/src/lib/osint-query.ts` for `parseLocale()` and `LocaleContext`
- Read `/home/z/my-project/src/lib/jwt.ts` for `authenticateRequest()`
- Read `/home/z/my-project/src/lib/audit.ts` for `createAuditLog()`
- Read `/home/z/my-project/src/app/api/osint/maigret/route.ts` for route handler pattern
- Read `/home/z/my-project/prisma/schema.prisma` for `TimelineEvent` model
- Confirmed `History` icon exists in lucide-react (node_modules check)

## Work Log

- Created `/home/z/my-project/src/app/api/osint/wayback/route.ts` (POST handler):
  - `authenticateRequest(request)` → 401 if no payload
  - Parses body, calls `parseLocale(body)` for audit logging (Wayback APIs are locale-agnostic)
  - `normalizeTarget()` validates URL — accepts both `example.com` and `https://example.com`
  - Fetches 3 public Wayback APIs in parallel-friendly sequence with try/catch around each:
    1. CDX Server API: `https://web.archive.org/cdx/search/cdx?url={url}&output=json&limit=50&fl=timestamp,original,statuscode,digest&filter=statuscode:200`
    2. Sparkline API: `https://web.archive.org/__wb/sparkline?output=json&url={url}&collection=web`
    3. Availability API: `https://archive.org/wayback/available?url={url}&timestamp={YYYYMMDD}` (today's date → closest-to-now snapshot)
  - All fetches use native `fetch` with `AbortSignal.timeout(15000)` and a custom User-Agent
  - Helper functions parse each API's specific JSON shape into typed structures:
    - `parseCdxResponse()` — array-of-arrays with header row, extracts timestamp/original/statuscode/digest
    - `parseSparklineResponse()` — `{years: {YYYY: {MM: count}}}` → flat yearly totals sorted ascending
    - `parseAvailabilityResponse()` — `{archived_snapshots: {closest: {...}}}` → latest snapshot
    - `buildTimeline()` — builds human-readable timeline: "First capture", every "Content change detected (digest diff)", "Latest capture"
    - `formatTimestamp()` — YYYYMMDDHHMMSS → "March 15, 2020"
  - Builds structured response: `{url, totalSnapshots, firstSnapshot, latestSnapshot, snapshots, yearlyCounts, timeline}` + optional `error`
  - If all 3 APIs fail → returns 200 with `error: 'Wayback API unavailable'` and empty arrays (never 500)
  - If `caseId` provided and `db.case.findUnique` succeeds → creates a `TimelineEvent` with `eventType: 'action'` and metadata JSON (url, totalSnapshots, first/latest timestamps, yearsActive, country)
  - Calls `createAuditLog('osint_scan', 'WaybackLookup', {...})` with `.catch(() => {})` so audit failures never break the route
  - Uses `unknown` + casts for all external API responses (no `any` types)

- Created `/home/z/my-project/src/components/osint/WaybackPanel.tsx` ('use client'):
  - Cyberpunk theme matching MaigretPanel: `cyber-card`, `cyber-input`, `cyber-btn`, `neon-cyan`/`neon-purple`/`neon-green`, `shimmer`, `animate-fade-in-up`, `pulse-dot`
  - Header: `History` icon + "WAYBACK MACHINE" title + subtle author attribution "artemis37 · Wayback Machine · past → now timeline"
  - URL input with `Search` icon + "Scan Archive" `cyber-btn` button (NOT live auto-search per task spec — CDX API can be slow)
  - Enter key triggers scan; button disabled while loading or when input < 4 chars
  - Stats row (4 cards): TOTAL SNAPSHOTS / FIRST CAPTURED / LATEST CAPTURED / YEARS ACTIVE
  - Yearly counts bar chart: CSS bars (gradient from `cyan-500/30` → `cyan-400/80`), height proportional to count, hover shows count, year label below (2-digit)
  - Snapshots list (max-h-96 overflow-y-auto, custom scrollbar): each card shows formatted timestamp, original URL, status code badge (green for 200, amber otherwise), "CHANGED" badge (purple) when digest differs from previous snapshot, external "View on Wayback" link button
  - Timeline of Changes section: vertical timeline with neon-cyan → neon-purple gradient connecting line, color-coded dots (green for first capture, purple for content changes, cyan for latest), each entry has date + event description + external link
  - Empty state: `History` icon with cyan glow + "Enter a URL to scan the archive" prompt
  - Loading state: neon spinner + skeleton stat cards + skeleton bar chart + skeleton snapshot rows
  - Error state: amber `FileWarning` icon + "Wayback API unavailable" message
  - "No archived snapshots found" state when scan returns 0 snapshots without error
  - Selects the three locale fields from the Zustand store (`investigationCountry`, `investigationLanguage`, `investigationRegionalOnly`) and threads them into `osintApi.wayback()`
  - Reads `currentCase` from store; shows "Select a case" prompt if no case selected

- Updated `/home/z/my-project/src/lib/api-client.ts`:
  - Added `wayback: (url: string, caseId?: string, locale?: LocaleParams) => post<{...}>('/api/osint/wayback', { url, caseId, ...locale })` to the `osintApi` object
  - Typed the response shape exactly matching the backend `WaybackResponse` interface
  - Used the existing `post<T>` helper (which handles auth headers + JSON body via the internal `request<T>()` function) — matched the existing pattern in the file rather than the alternative `authHeaders()` pattern from the task spec (which doesn't exist in this codebase)

- Updated `/home/z/my-project/src/components/OSINTTools.tsx`:
  - Added `History` to the lucide-react import list
  - Added `import WaybackPanel from '@/components/osint/WaybackPanel'` after the `TikTokTrackerPanel` import
  - Added a new `<TabsTrigger value="wayback">` with `History` icon and "Wayback" label, placed immediately after the "Crawler" tab trigger (matching task spec — "after the Crawler tab")
  - Added a new `<TabsContent value="wayback" forceMount className="...data-[state=inactive]:hidden">` rendering `<WaybackPanel />`, placed after the Crawler tab content (consistent with the forceMount + hidden pattern used by all other tabs to preserve panel state across tab switches)

- Verified `History` and `Clock` icons exist in `node_modules/lucide-react/dist/esm/icons/` (both `history.js` and `clock.js` present) — used `History` for the tab and panel header, `Clock` for the input label, plus `CalendarDays`, `Activity`, `AlertTriangle`, `FileWarning`, `Zap`, `CheckCircle2`, `ExternalLink`, `Search`, `Loader2` from lucide-react

- Verified cyberpunk CSS classes used by WaybackPanel exist in `/home/z/my-project/src/app/globals.css`: `neon-cyan`, `neon-purple`, `neon-green`, `cyber-input`, `cyber-card`, `cyber-btn`, `pulse-dot`, `animate-fade-in-up`, `shimmer` — all present. (Initial draft used `cyber-button` which doesn't exist; corrected to `cyber-btn` after grepping globals.css + matching CrawlerPanel's pattern.)

- Ran `bun run lint` from `/home/z/my-project` → **passes with exit code 0** (only 1 pre-existing warning in `SocialMediaPanel.tsx` line 473 about an unused eslint-disable directive — unrelated to my changes)

- Ran `bunx tsc --noEmit` to confirm no NEW TypeScript errors were introduced → **zero errors in my new files** (`wayback/route.ts`, `WaybackPanel.tsx`) and zero errors in the files I edited (`api-client.ts`, `OSINTTools.tsx`). All TS errors reported are pre-existing in other files (cytoscape types, EventType union gaps, etc.) and are out of scope.

- Checked `/home/z/my-project/dev.log` — dev server healthy, compiles on demand, no errors related to my new files.

## Files Touched

| File | Action | Lines |
|---|---|---|
| `src/app/api/osint/wayback/route.ts` | CREATED | 382 |
| `src/components/osint/WaybackPanel.tsx` | CREATED | 390 |
| `src/lib/api-client.ts` | EDITED | +20 (added `wayback` method to `osintApi`) |
| `src/components/OSINTTools.tsx` | EDITED | +9 (History import, Wayback tab trigger, Wayback tab content) |

## Stage Summary

- **Wayback Machine integration complete and end-to-end functional**: an investigator can open the OSINT tab → Wayback sub-tab → type any URL or bare domain → click "Scan Archive" → see a structured timeline of how that web presence evolved from its first Wayback capture to today.
- **Backend** (`/api/osint/wayback/route.ts`): queries 3 public Wayback APIs (CDX + Sparkline + Availability), wraps every external fetch in try/catch + 15s timeout, never throws 500, builds a typed response with snapshots + yearly density + human-readable timeline, records a `TimelineEvent` on the case + an `AuditLog` entry on every scan. Uses native `fetch` only — no new packages installed, no z-ai-web-dev-sdk usage (Wayback APIs are public REST).
- **Frontend** (`WaybackPanel.tsx`): cyberpunk-themed panel matching MaigretPanel style, 4-stat row, CSS bar chart of yearly snapshot density, scrollable snapshot list with digest-change detection (purple "CHANGED" badge), vertical timeline of major events with neon-cyan connecting line + color-coded dots, full empty/loading/error states, subtle "artemis37 · Wayback Machine" attribution in the header.
- **Integration**: new "Wayback" tab in OSINTTools.tsx placed immediately after "Crawler" with `History` icon, using the `forceMount` + `data-[state=inactive]:hidden` pattern so panel state survives tab switches.
- **API client**: `osintApi.wayback(url, caseId?, locale?)` method added with full TypeScript response typing matching the backend.
- **Lint passes** (exit code 0). **No new TypeScript errors** in any of my files. **Dev server compiles successfully**.
