# Task ID: 11+12 — GitHub OSINT Catalog + People Search (idcrawl-style)

**Agent**: full-stack-developer (artemis37 line)
**Scope**: Add a curated GitHub OSINT project catalog + an idcrawl-style people
meta-search to the PHANTOM OSINT platform. Frontend-first (so the user can see
results immediately), then backend.

## Files created
- `src/lib/osint-catalog.ts` — 45 curated GitHub OSINT projects across 12
  categories (username / phone / email / domain / image / social / breach /
  geolocation / documents / threat-intel / darkweb / people), each correlated
  with the PHANTOM module that implements the same capability (or null when
  not yet integrated).
- `src/app/api/osint/people-search/route.ts` — POST handler. Auth via
  `authenticateRequest`. Locale-aware (parseLocale + buildLocalizedQuery).
  Fans out **7 parallel** z-ai `web_search` calls via `Promise.allSettled`:
  LinkedIn, Facebook, Twitter/X, Instagram, public-records (whitepages /
  truepeoplesearch / fastpeoplesearch), directories, and news/obituary.
  Aggregates + dedupes by URL, classifies into 4 categories
  (professional / social / public-records / news), extracts phone + email
  regex from snippets, scores confidence per query type. **Never returns 500**
  on rate-limits — a single 429 only suppresses that one query; on total
  failure it returns an empty-result envelope.
- `src/app/api/osint/catalog/route.ts` — Public reference endpoint (no auth —
  curated static data). `GET ?category=username` for single-category filter;
  `POST { categories?: string[] }` for multi-category. Validates category
  names, returns entries + stats + category labels.
- `src/components/osint/PeopleSearchPanel.tsx` — Cyberpunk panel matching
  MaigretPanel style. Name input with 700ms debounce, stats row
  (TOTAL MATCHES / PROFILES / PUBLIC RECORDS / NEWS MENTIONS), category-
  grouped results grid (Professional / Social / Public Records / News) with
  per-hit phone+email badges, confidence %, "Add to Case" button, external
  link. Empty + loading + no-results states. Author attribution
  "artemis37 · People Search (idcrawl-style)".
- `src/components/osint/OsintCatalogPanel.tsx` — Cyberpunk catalog panel.
  12 category filter chips with per-category counts, search box to filter by
  project name/description/language, scrollable grid (`max-h-[60vh]
  overflow-y-auto`) of catalog entry cards each showing project name,
  GitHub icon + link, description, language badge (purple), stars badge
  (amber), PHANTOM-module badge (green "Integrated: X" or gray "Not
  integrated"). Stats row (TOTAL PROJECTS / INTEGRATED / AVAILABLE TO
  INTEGRATE). Author attribution "artemis37 · OSINT Catalog".

## Files modified
- `src/lib/api-client.ts` — added `osintApi.peopleSearch(query, caseId?,
  locale?)` and `osintApi.catalog(categories?)` with full typed response
  shapes mirroring the routes' return contracts.
- `src/components/OSINTTools.tsx` — added `Library` to lucide imports; added
  imports for `PeopleSearchPanel` + `OsintCatalogPanel`; added **People** tab
  trigger (`Users` icon, after Wayback tab) and **Catalog** tab trigger
  (`Library` icon, at the end after Reverse tab); added corresponding
  `TabsContent` blocks (forceMount + `data-[state=inactive]:hidden` so
  switching tabs preserves each panel's state, matching the existing pattern).

## Design decisions
- **People tab icon**: spec suggested `UserSearch`, but that icon is already
  used by the existing Username tab — using it twice would have been visually
  ambiguous. Switched to `Users` (already imported) which is the canonical
  "people" icon and is visually distinct.
- **Catalog endpoint auth**: spec said "no auth needed — public reference
  data". Honored — neither GET nor POST calls `authenticateRequest`.
- **People-search rate-limit handling**: every per-query failure is captured
  by `Promise.allSettled`; the route returns partial results + an `error:
  'partial'` flag rather than 500. On total SDK failure it returns an empty
  envelope. The panel renders a small amber banner when `error === 'partial'`.
- **TypeScript**: my new files introduce zero new TS errors (verified via
  `bunx tsc --noEmit` + `git stash` baseline comparison). The pre-existing
  OSINTTools.tsx:464 / MaigretPanel.tsx / SherlockPanel.tsx / auth.ts errors
  (documented in Task 33-e's worklog as out-of-scope widening of the
  `byCategory.status` field) reproduce unchanged.
- **Type-narrowing trick**: `PeopleSearchPanel.tsx` defines a local
  `GroupedHit = Omit<PeopleHit, 'category'> & { category: string }` so the
  `byCategory` field mirrors the api-client's `Record<string, Array<{...
  category: string}>>` contract (Record's index signature can't preserve the
  union through).

## Verification
- `bun run lint` — passes with ZERO errors and ZERO warnings.
- `bunx tsc --noEmit` — no NEW TypeScript errors in any of my files (the 53
  pre-existing errors in sherlock-platforms.ts, MaigretPanel.tsx,
  SherlockPanel.tsx, auth.ts, OSINTTools.tsx:464, page.tsx, AlertPanel.tsx,
  AnalystNotebook.tsx, etc. reproduce identically when my changes are
  stashed — confirmed via `git stash` baseline).
- Dev server (per `dev.log`) — compiles cleanly after the OSINTTools +
  api-client edits.

## Stage summary
- 2 new OSINT tabs wired into the existing OSINTTools tab strip (People +
  Catalog), placed per spec.
- 1 new backend route (`/api/osint/people-search`) — idcrawl-style meta
  people-search, locale-aware, 7-parallel-query fan-out, never 500s.
- 1 new backend route (`/api/osint/catalog`) — public reference endpoint,
  GET (single-category filter) + POST (multi-category).
- 1 new data module (`src/lib/osint-catalog.ts`) — 45 curated GitHub OSINT
  projects across 12 categories, each correlated with its PHANTOM-module
  equivalent (8 integrated, 37 available-to-integrate).
- 1 new typed api-client method pair (`osintApi.peopleSearch`,
  `osintApi.catalog`).
- All cyberpunk theme rules honored: neon-cyan / neon-purple / neon-green /
  amber accents; no indigo or blue used anywhere in the new UI.
