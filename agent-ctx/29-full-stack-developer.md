# Task 29 — Fix TikTok tracker false positives + merge OSINT tools via Full Sweep + Smart Pivot

## Task summary
artemis37 reported two issues with the TikTok tracker built in Task 28:
1. False positives (news articles, Reddit threads, unrelated TikTok videos, name collisions showing up as posts/messages).
2. Too many separate tools — they want the OSINT tools merged so the TikTok tracker can launch Maigret/Sherlock automatically.

## What was done
- Diagnosed & fixed all 6 false-positive root causes in `src/app/api/osint/tiktok-tracker/route.ts`:
  1. Post loop too permissive → now requires `tiktok.com/@<exact-handle>/video/<id>` URL (or `/video/<id>` on tiktok.com + word-bounded `@exact-handle` mention in caption).
  2. `found` caught name collisions via `mentionCount >= 2` → removed; now requires `isExactHandleUrl(s.url, uname)` for at least one source.
  3. Messages loop accepted any source with `comment|reply|dm|message|said|wrote` in text → now requires `tiktok.com/.+/video/\d+` URL + word-bounded `@exact-handle` mention.
  4. Bio grabbed first random news snippet → now only from `page_reader` content.
  5. Profile counts parsed from `allSnippets` (every source) → now from `page_reader` OR `exactHandleText` (sources whose URL passes `isExactHandleUrl`).
  6. Hashtag/mention aggregation included false-positive posts → now clean because posts are strictly filtered (no change to the aggregation loop itself).
- Added 4 new backend helpers: `extractVideoId`, `isExactHandleUrl`, `isExactHandleVideoUrl`, `findCollisions`.
- Extended `PostItem` with `verified: boolean`; extended `TikTokReport` with `collisions` array + `stats.verifiedPosts`.
- Updated timeline + audit log to include `verifiedPosts` and `collisions.length`.
- Extended `osintApi.tiktokTrack` return type in `src/lib/api-client.ts` with `verified`, `collisions`, `verifiedPosts`.
- Updated `src/components/osint/TikTokTrackerPanel.tsx`:
  - VERIFIED (green, BadgeCheck) / UNVERIFIED (amber, AlertTriangle) badges on each post card next to the REPOST badge.
  - NAME COLLISIONS banner above the stats bar — amber/pink styling, each collision is a clickable chip that pivots the tracker to that handle.
  - FULL OSINT SWEEP button below the search input (pink/fuchsia gradient, Zap icon) — launches TikTok + Maigret + Sherlock in parallel via `Promise.allSettled`. Results render in a collapsible 3-column summary panel (pink/cyan/blue) with key stats per tool + inline hints for Maigret/Sherlock "switch to <tool> tab and search @handle".
  - @mention chips in Activity tab → converted from `<span>` to `<button>` — click pivots the tracker to that handle; `ArrowUpRight` icon fades in on hover; `title` tooltip "Click to track @handle on TikTok".

## Verification
- `bun run lint` → exit 0, 0 errors, 0 warnings.
- Dev server compiles cleanly (dev.log: "✓ Compiled in 354ms/795ms/1741ms").
- End-to-end test on `@charlidamelio` → 200 in 15.9s with:
  - `found: true`, `confidence: 90`
  - `collisions: [@tringsby, @officialderekfry]` — both real name collisions correctly detected.
  - `stats: {sources: 20, posts: 11, verifiedPosts: 11, reposts: 2, messages: 3, ...}` — 11/11 posts verified, no false positives.
  - All 3 messages reference `tiktok.com/@charlidamelio/video/<id>` URLs.
  - `posts[0].verified: true` — new field present in response.
  - Audit log insert succeeded with new fields.

## Files modified
- `/home/z/my-project/src/app/api/osint/tiktok-tracker/route.ts` (backend precision + helpers + collisions + verifiedPosts + audit/timeline updates)
- `/home/z/my-project/src/lib/api-client.ts` (tiktokTrack return type extended)
- `/home/z/my-project/src/components/osint/TikTokTrackerPanel.tsx` (badges + collisions banner + FULL OSINT SWEEP button + sweep results panel + @mention click-to-pivot)
- `/home/z/my-project/worklog.md` (Task 29 entry appended)
- `/home/z/my-project/agent-ctx/29-full-stack-developer.md` (this file)

## Notes for next agent
- The new fields (`verified`, `collisions`, `verifiedPosts`) are ADDITIVE — no breaking changes to the API contract.
- The `extractTikTokVideoUrl` helper is now unused internally but kept for potential future use (ESLint `no-unused-vars` is disabled in this project's config, so it doesn't break lint).
- The `runFullSweep()` function pulls only minimal fields from Maigret/Sherlock responses (totalScanned/totalFound/totalAvailable). If you want to display more Maigret/Sherlock detail inline, extend the `SweepResult` interface and the `runFullSweep` extraction.
- The `Promise.allSettled` pattern is race-safe via `sweepReqId.current` — if the user clicks SWEEP again before the first completes, the stale response is dropped.
- All z-ai SDK 429 errors during parallel web_search are caught by `Promise.allSettled` and don't fail the request — the route returns 200 with whatever sources it could gather.
