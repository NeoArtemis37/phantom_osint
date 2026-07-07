# Task ID 5 — External OSINT Lookup Engine (artemis37 line)

## Task
Build a unified External OSINT Lookup engine that integrates ALL 49 GitHub
OSINT projects currently listed as `phantomModule: null` in
`src/lib/osint-catalog.ts`. Deliver a new `ExternalTool` interface, an
`EXTERNAL_TOOLS` registry with one entry per project, a POST
`/api/osint/external-lookup` route that fans out one parallel web_search
per matching tool, a cyberpunk `ExternalLookupPanel` component, an
`osintApi.externalLookup` typed client method, an "External" tab wired into
`OSINTTools.tsx`, and a catalog flip that promotes all 49 null entries to
`phantomModule: 'External Lookup'`.

## Prior-work context used
- Read `/home/z/my-project/worklog.md` (Tasks 11+12, 34, 35) — confirmed
  cyberpunk neon-cyan/purple/green/amber theme (no indigo/blue), JWT auth
  via `authenticateRequest` from `@/lib/jwt`, `db` + `createAuditLog`
  pattern, `osintApi` client in `@/lib/api-client.ts`, `parseLocale` +
  `buildLocalizedQuery` from `@/lib/osint-query`, `parallelWebSearch` from
  `@/lib/zai-rate-limiter` (now pass-through, no throttling).
- Read `MaigretPanel.tsx`, `PeopleSearchPanel.tsx`, `OsintCatalogPanel.tsx`
  for cyberpunk UI conventions (cyber-card / neon-cyan / pulse-dot /
  custom-scroll / phantom-scroll / animate-fade-in-up / shimmer).
- Read `/api/osint/reverse-lookup/route.ts` for the
  authenticateRequest → parseLocale → buildLocalizedQuery →
  parallelWebSearch → dedupe → createAuditLog → timeline-event pattern.

## Files written / modified
1. **`src/lib/external-osint.ts`** (new, 645 lines) — defines
   `ExternalTool` interface (id, name, category, githubRef, url,
   description, inputTypes, buildDeepLink, buildSearchQuery) and
   `EXTERNAL_TOOLS` array with exactly 49 entries spanning all 12 catalog
   categories. Each tool's `buildDeepLink` returns either a pre-filled
   deep-link URL (Shodan, Censys, urlscan, SecurityTrails, ViewDNS,
   WhoisXML, isitup, HaveIBeenPwned, Intel-X, AbuseIPDB, AlienVault-OTX,
   VirusTotal, ThreatFox, WiGLE, Google Earth, emailrep, Telegram,
   Snapchat) or `null` (CLI-only tools: theHarvester, holehe, verify-email,
   disposable-email-domains, exiftool, photo-forensics, twint, instaloader,
   Instagram-OSINT, Slack-OSINT, DoppelGanger, Blackbird, OSINT-Industries,
   Duki, OSINT-Secrets, PhoneTracker, phone-number-toolkit, pwndb,
   breach-compilation-index, BertoldVdb/geolocation, pywhat, metagoofil,
   Document-Metadata, PROXY, TorBot, Hacking-Tools-Repository, deepfind.me,
   Cyber-Detect, osint-persona-search, awesome-osint, DNSDumpster — these
   have no direct query endpoint, so buildDeepLink returns the tool's home
   page or null). Exports helpers: `getToolsForInputType(type)`,
   `getExternalToolCount()`, `getToolDescriptor(tool)`.

2. **`src/app/api/osint/external-lookup/route.ts`** (new, 240 lines) —
   POST handler. `authenticateRequest` 401 if no token. `parseLocale` +
   `buildLocalizedQuery` (with `includeSites: false` to avoid double
   site: clauses since many tools already emit them). Validates `type` ∈
   the 7-value union and `value` ≥2 chars + blocks injection chars
   (`<>"'\` | javascript: | data:text/html | on\w+=`). Resolves
   `getToolsForInputType(type)` (5-15 tools depending on type). Fans out
   all queries via `parallelWebSearch` (no rate limiting — pass-through
   mode). Dedupes results by URL ACROSS all tools (a URL belongs to the
   first tool that surfaced it). Returns per-tool blocks
   `{ tool: descriptor, deepLink, results: [{title,url,snippet}], totalFound }`
   plus overall envelope
   `{ type, value, tools, totalResults, author:'artemis37', tool:'PHANTOM ExternalOSINT', generatedAt }`.
   Always returns HTTP 200 — even on partial failures — only 500 for
   truly unexpected top-level errors. `createAuditLog('osint_scan',
   'ExternalOSINT', {...})` always (best-effort .catch). Timeline event
   creation if caseId + case exists (best-effort try/catch). Also exposes
   a GET metadata endpoint returning the full tool catalog (no auth).

3. **`src/components/osint/ExternalLookupPanel.tsx`** (new, 425 lines) —
   cyberpunk 'use client' panel matching MaigretPanel/PeopleSearchPanel
   style. 7 toggle buttons (Username/Email/Phone/Domain/IP/Image/Name)
   with distinct neon colors (cyan/purple/amber/green/cyan/purple/green
   rotation). Value input with live auto-search (700ms debounce, reqId
   race-safety). Reads investigationCountry/Language/RegionalOnly from
   Zustand store + forwards locale. Stats row: TOOLS QUERIED / TOTAL
   RESULTS / DEEP LINKS (3-col grid). Results grouped by tool — each tool
   card shows tool name (neon-colored per category) + category badge +
   description, "Open tool ↗" button (opens deepLink in new tab, disabled
   if null), GitHub icon link if githubRef set, results count badge,
   scrollable list of result snippets (max-h-48 overflow-y-auto
   custom-scroll), "Add to Case" button on each result (calls
   entitiesApi.create with appropriate EntityType per type). Loading
   skeleton (6-card grid with shimmer), empty state (Globe2 icon + neon
   hint), no-results state (Radar icon + helpful copy). Author attribution
   "artemis37 · External OSINT Lookup" in header + footer.

4. **`src/lib/api-client.ts`** — added `osintApi.externalLookup` typed
   method matching the backend response shape.

5. **`src/components/OSINTTools.tsx`** — added `Globe2` to lucide-react
   imports + `ExternalLookupPanel` import, new `<TabsTrigger value="external">`
   after the Catalog tab (neon-cyan active style), new `<TabsContent
   value="external" forceMount>` rendering `<ExternalLookupPanel />` at
   the end (after Catalog).

6. **`src/lib/osint-catalog.ts`** — flipped all 49 `phantomModule: null`
   entries to `phantomModule: 'External Lookup'` via a single replace_all
   edit. The 7 already-integrated entries (Sherlock, Maigret, Reverse
   Lookup, TikTok Tracker, Image Recon, Wayback, People Search) were left
   untouched. `getCatalogStats()` now reports
   `{ total: 56, integrated: 56, available: 0 }`.

## Verification
- `bun run lint` — passes clean (0 errors, 0 warnings).
- `bunx tsc --noEmit` — ZERO new TypeScript errors introduced. The only
  remaining errors are 4 pre-existing errors in `examples/websocket/` and
  `skills/` reference folders (socket.io-client / images property /
  stock-analysis-skill) — all out of scope, all documented by prior tasks.
- Read latest 30 lines of `/home/z/my-project/dev.log` — dev server
  compiles cleanly ("✓ Compiled in 208ms" / "✓ Compiled in 378ms"), only
  `/login` requests visible (no logged-in user yet to drive the OSINT
  tab), zero errors caused by my new files.
