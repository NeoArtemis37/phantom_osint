import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildImageSearchArgs,
  type LocaleContext,
} from '@/lib/osint-query';
import { getRegionalPlatforms } from '@/lib/countries';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/osint/image-recon
// Reverse image search / image recon — investigator uploads their own picture
// and the system runs VLM analysis (faces, objects, OCR text, location
// estimate, logos, keywords) + similar-image search + web appearances +
// PLATFORM MATCHES (Facebook / LinkedIn / Instagram / Yandex Images targeted
// site queries — hunts for the uploaded image / person across social & work
// platforms so the investigator can find profile-picture matches and photo
// appearances on those specific sites).
//
// Author:  artemis37
// Tool:    PHANTOM ImageRecon
//
// Strategy:
//   1. Receive a base64 image (data URL OR raw base64).
//   2. Run z-ai VLM (chat.completions.createVision) with a STRICT-JSON prompt
//      that returns description, people, objects, sceneType, locationClues,
//      estimatedLocation, textDetected, logos, colors, mood, isScreenshot,
//      isDocument, isProfilePicture, searchKeywords, searchQuery, riskFlags.
//   3. IN PARALLEL (Promise.allSettled):
//      a. Similar images via zai.images.search.create({ query: searchQuery }).
//      b. Web appearances via zai.functions.invoke('web_search', ...) on
//         searchQuery + top-3 keywords.
//      c. PLATFORM MATCHES — site-targeted web searches for
//         site:facebook.com, site:linkedin.com, site:instagram.com, and a
//         Yandex-image-targeted query. Each platform search is wrapped in its
//         own try/catch so a 429 on one platform doesn't kill the others.
//   4. Return one structured JSON report with platformMatches + per-platform
//      counts in the audit log + timeline event.
//
// Reference patterns: src/app/api/osint/tiktok-tracker/route.ts +
//                     src/app/api/search/image/route.ts
// =============================================================================

// ---------------------------------------------------------------------------
// Types (mirrors the api-client contract)
// ---------------------------------------------------------------------------

interface VLMAnalysis {
  description: string;
  people: Array<{ count: number; gender: string; ageRange: string; notableFeatures: string }>;
  objects: string[];
  sceneType: string;
  locationClues: string[];
  estimatedLocation: string;
  textDetected: string[];
  logos: string[];
  colors: string[];
  mood: string;
  isScreenshot: boolean;
  isDocument: boolean;
  isProfilePicture: boolean;
  searchKeywords: string[];
  searchQuery: string;
  riskFlags: string[];
}

interface SimilarImage {
  url: string;
  title: string;
  source: string;
  width?: number;
  height?: number;
}

interface WebAppearance {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Platform-tag type. Widened to `string` in Task 33-b so regional platforms
// (VK, Weibo, Pixiv, Line, etc.) can be returned in the platformMatches array
// when a country is selected. The 4 baseline tags ('facebook' | 'linkedin' |
// 'instagram' | 'yandex') are always present; additional regional platform
// keys are appended dynamically based on the locale.
type PlatformTag = 'facebook' | 'linkedin' | 'instagram' | 'yandex' | string;
type MatchType = 'profile' | 'photo' | 'mention' | 'image-search';

interface PlatformMatch {
  platform: PlatformTag;
  title: string;
  url: string;
  snippet: string;
  source: string;
  matchType: MatchType;
  confidence: number;
}

interface ReverseSearchEngine {
  name: string;
  url: string;
  description: string;
}

interface ImageReconReport {
  author: 'artemis37';
  tool: 'PHANTOM ImageRecon';
  generatedAt: string;
  imageProvided: boolean;
  analysis: VLMAnalysis;
  similarImages: SimilarImage[];
  webAppearances: WebAppearance[];
  platformMatches: PlatformMatch[];
  reverseSearchEngines: ReverseSearchEngine[];
  stats: {
    objects: number;
    people: number;
    textDetected: number;
    logos: number;
    similarImages: number;
    webAppearances: number;
    platformMatches: number;
    riskFlags: number;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hostname helper (mirrors tiktok-tracker route). */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Build an empty VLM analysis block (used on hard failure). */
function emptyAnalysis(): VLMAnalysis {
  return {
    description: '',
    people: [],
    objects: [],
    sceneType: 'other',
    locationClues: [],
    estimatedLocation: 'unknown',
    textDetected: [],
    logos: [],
    colors: [],
    mood: 'unknown',
    isScreenshot: false,
    isDocument: false,
    isProfilePicture: false,
    searchKeywords: [],
    searchQuery: '',
    riskFlags: [],
  };
}

/**
 * Coerce an unknown VLM-parsed value into a string[].
 * Accepts: string[], string (split by comma/newline), or numbers/unknown
 * (returned as []).
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

/**
 * Normalise the VLM's JSON-parsed object into our strict VLMAnalysis shape.
 * Tolerates missing keys, wrong types, and string-instead-of-array mistakes.
 */
function normaliseAnalysis(raw: unknown): VLMAnalysis {
  if (!raw || typeof raw !== 'object') return emptyAnalysis();
  const r = raw as Record<string, unknown>;

  const people: VLMAnalysis['people'] = Array.isArray(r.people)
    ? (r.people as Array<Record<string, unknown>>).map((p) => ({
        count: toNumber(p?.count, 1),
        gender: toStr(p?.gender, 'unknown'),
        ageRange: toStr(p?.ageRange, 'unknown'),
        notableFeatures: toStr(p?.notableFeatures, 'none'),
      }))
    : [];

  return {
    description: toStr(r.description),
    people,
    objects: toStringArray(r.objects),
    sceneType: toStr(r.sceneType, 'other') || 'other',
    locationClues: toStringArray(r.locationClues),
    estimatedLocation: toStr(r.estimatedLocation, 'unknown') || 'unknown',
    textDetected: toStringArray(r.textDetected),
    logos: toStringArray(r.logos),
    colors: toStringArray(r.colors),
    mood: toStr(r.mood, 'unknown') || 'unknown',
    isScreenshot: toBool(r.isScreenshot),
    isDocument: toBool(r.isDocument),
    isProfilePicture: toBool(r.isProfilePicture),
    searchKeywords: toStringArray(r.searchKeywords),
    searchQuery: toStr(r.searchQuery),
    riskFlags: toStringArray(r.riskFlags),
  };
}

/**
 * Strip markdown fences (```json ... ``` or ``` ... ```) from the VLM's
 * response so JSON.parse can succeed.
 */
function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Build a person-targeted query string from the first people entry.
 * Used when isProfilePicture=true OR people[] is non-empty so the platform
 * searches target the person rather than the scene.
 */
function buildPersonQuery(analysis: VLMAnalysis): string {
  const p = analysis.people[0];
  if (!p) return '';
  const parts: string[] = [];
  if (p.gender && p.gender !== 'unknown') parts.push(p.gender);
  if (p.ageRange && p.ageRange !== 'unknown') parts.push(p.ageRange);
  if (p.notableFeatures && p.notableFeatures !== 'none') parts.push(p.notableFeatures);
  return parts.join(' ').trim();
}

/**
 * Decide matchType for a platform search hit. LinkedIn hits with /in/ or
 * /pub/ paths are 'profile'; Facebook hits with /profile.php or a username
 * path are 'profile'; Instagram /<username> is 'profile'; otherwise 'mention'
 * (the platform mentions the query but isn't a profile URL). Yandex image
 * hits are 'image-search'.
 */
function classifyMatch(
  platform: PlatformTag,
  url: string,
  title: string,
  snippet: string
): MatchType {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (platform === 'yandex') return 'image-search';
    if (platform === 'linkedin') {
      if (path.startsWith('/in/') || path.startsWith('/pub/')) return 'profile';
      return 'mention';
    }
    if (platform === 'facebook') {
      if (path.startsWith('/profile.php') || /^\/[^/]+$/.test(path.replace(/\/$/, ''))) return 'profile';
      return 'mention';
    }
    if (platform === 'instagram') {
      if (/^\/[^/]+\/?$/.test(path) && !path.startsWith('/p/') && !path.startsWith('/reel/')) return 'profile';
      if (path.startsWith('/p/') || path.startsWith('/reel/')) return 'photo';
      return 'mention';
    }
  } catch {
    // fall through
  }
  // Snippet/title heuristic — if both mention the query, call it a mention.
  if (title || snippet) return 'mention';
  return 'mention';
}

/**
 * Score a platform match. Higher when the URL path or title contains the
 * searchQuery keyword verbatim (an "exact" hit). LinkedIn /in/ profiles and
 * Instagram /username/ profiles start at 80; mentions start at 55.
 */
function scoreMatch(
  platform: PlatformTag,
  url: string,
  title: string,
  snippet: string,
  searchQuery: string,
  personQuery: string
): number {
  let base = 55;
  if (platform === 'linkedin') base = 60;
  if (platform === 'instagram') base = 60;
  if (platform === 'facebook') base = 58;
  if (platform === 'yandex') base = 50;

  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (platform === 'linkedin' && (path.startsWith('/in/') || path.startsWith('/pub/'))) base = 85;
    if (platform === 'instagram' && /^\/[^/]+\/?$/.test(path)) base = 85;
    if (platform === 'facebook' && path.startsWith('/profile.php')) base = 80;
  } catch {
    // ignore
  }

  // Boost if the title or URL contains the searchQuery keyword.
  const haystacks = [title.toLowerCase(), url.toLowerCase(), snippet.toLowerCase()];
  const queryNeedle = searchQuery.toLowerCase().trim();
  if (queryNeedle && haystacks.some((h) => h.includes(queryNeedle))) base += 8;

  // Boost if person descriptor keywords appear.
  if (personQuery) {
    const tokens = personQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length > 0 && haystacks.some((h) => tokens.every((t) => h.includes(t)))) base += 5;
  }

  return Math.max(50, Math.min(95, base));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { image, caseId } = body as { image?: string; caseId?: string };
    const locale: LocaleContext = parseLocale(body);

    // --- Input validation ---
    if (!image || typeof image !== 'string' || image.trim().length === 0) {
      return NextResponse.json(
        { error: 'image is required (base64 data URL or plain base64)' },
        { status: 400 }
      );
    }

    // Reject oversized payloads (~8MB raw ≈ ~11M base64 chars)
    if (image.length > 11_000_000) {
      return NextResponse.json(
        { error: 'Image too large — must be under 8MB' },
        { status: 413 }
      );
    }

    // Normalise to a data URL — accept both data:image/...;base64,... and raw base64
    let imageDataUrl = image;
    let mimeType = 'image/jpeg';
    if (image.startsWith('data:')) {
      const m = image.match(/^data:([^;]+);base64,/i);
      if (m) {
        mimeType = m[1].toLowerCase();
      }
    } else {
      // Plain base64 — auto-prepend the default mime prefix
      imageDataUrl = `data:image/jpeg;base64,${image}`;
    }

    // Validate the base64 payload is decodable and big enough to be a real image
    const base64Payload = imageDataUrl.includes(',')
      ? imageDataUrl.slice(imageDataUrl.indexOf(',') + 1)
      : imageDataUrl;
    if (base64Payload.length < 1000) {
      return NextResponse.json(
        { error: 'Image data too small — must be a valid base64-encoded image' },
        { status: 400 }
      );
    }

    // Log just the first 100 chars + total length (don't dump full base64)
    console.log(
      `[ImageRecon] received image: ${imageDataUrl.slice(0, 100)}... (total ${imageDataUrl.length} chars, mime=${mimeType})`
    );

    const generatedAt = new Date().toISOString();

    // --- VLM analysis (with RETRY + fallback for 502/timeout resilience) ---
    let analysis: VLMAnalysis = emptyAnalysis();
    let vlmError: string | undefined;
    let vlmParseError = false;

    const VLM_MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= VLM_MAX_RETRIES; attempt++) {
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const vlmResponse = await zai.chat.completions.createVision({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are an OSINT image analyst. Analyze this image and respond as STRICT JSON (no markdown fences, no prose) with this exact schema:
{
  "description": "<2-3 sentence overall description>",
  "people": [{"count": <number>, "gender": "<estimated|unknown>", "ageRange": "<estimated|unknown>", "notableFeatures": "<brief|none>"}],
  "objects": ["<object1>", "<object2>", ...],
  "sceneType": "<indoor|outdoor|urban|nature|vehicle|screen|document|food|fashion|sport|other>",
  "locationClues": ["<clue1>", "<clue2>", ...],
  "estimatedLocation": "<city/country or 'unknown'>",
  "textDetected": ["<text1>", "<text2>", ...],
  "logos": ["<logo1>", "<logo2>", ...],
  "colors": ["<hex1>", "<hex2>", ...],
  "mood": "<brief|unknown>",
  "isScreenshot": <boolean>,
  "isDocument": <boolean>,
  "isProfilePicture": <boolean>,
  "searchKeywords": ["<keyword1>", "<keyword2>", ...],
  "searchQuery": "<single best text query for finding similar images online>",
  "riskFlags": ["<flag1>", ...]
}
Respond with ONLY the JSON object, no other text.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: imageDataUrl },
                },
              ],
            },
          ],
          thinking: { type: 'disabled' },
        } as Parameters<typeof zai.chat.completions.createVision>[0]);

        const content =
          vlmResponse.choices?.[0]?.message?.content ??
          (vlmResponse as { choices?: Array<{ message?: { content?: unknown } }> })
            .choices?.[0]?.message?.content;

        const contentStr =
          typeof content === 'string' ? content : content ? JSON.stringify(content) : '';

        if (!contentStr) {
          vlmError = 'VLM returned empty content';
          analysis = emptyAnalysis();
        } else {
          try {
            const parsed = JSON.parse(stripFences(contentStr));
            analysis = normaliseAnalysis(parsed);
            vlmError = undefined;
            break; // success
          } catch (parseErr) {
            console.error('[ImageRecon] VLM JSON parse failed:', parseErr);
            vlmParseError = true;
            analysis = {
              ...emptyAnalysis(),
              description: stripFences(contentStr).slice(0, 600),
            };
            vlmError = 'VLM returned non-JSON content (description extracted from raw text)';
            break; // got a response, just non-JSON — don't retry
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[ImageRecon] VLM analysis attempt ${attempt + 1} failed:`, msg);
        vlmError = `VLM analysis failed: ${msg}`;
        analysis = emptyAnalysis();
        const isRetryable = msg.includes('502') || msg.includes('timeout') ||
                            msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') ||
                            msg.includes('socket hang up') || msg.includes('Bad Gateway') ||
                            msg.includes('fetch failed');
        if (!isRetryable || attempt === VLM_MAX_RETRIES) break;
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
      }
    }

    // FALLBACK: if VLM failed entirely, generate a minimal analysis so the
    // downstream pipeline (similar images, web appearances, platform matches)
    // still runs with a generic query. Prevents 502 on VLM = empty report.
    if (!analysis.searchQuery && !analysis.description) {
      analysis = {
        ...emptyAnalysis(),
        description: 'Image analysis unavailable (VLM service error) — running reverse-image search with generic queries.',
        searchQuery: 'person face profile photo',
        searchKeywords: ['person', 'photo', 'image'],
        sceneType: 'other',
      };
      vlmError = vlmError || 'VLM unavailable — using fallback analysis';
    }

    // ===================================================================
    // PARALLEL STEP — similar-images + web-appearances + PLATFORM MATCHES
    // Each step is wrapped in its own try/catch so partial SDK failures
    // (429/502/etc.) don't fail the whole request.
    // ===================================================================
    const searchQuery = analysis.searchQuery;
    const personQuery = buildPersonQuery(analysis);

    // --- (a) Similar-image search ---
    // Pass the official `gl` (Google region) parameter via buildImageSearchArgs
    // when a country is selected so the image results are geotargeted.
    const similarImagesPromise = (async (): Promise<SimilarImage[]> => {
      const out: SimilarImage[] = [];
      if (!searchQuery) return out;
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const imgArgs = locale.country || locale.language
          ? buildImageSearchArgs(searchQuery, locale, 12)
          : { query: searchQuery, num: 12 };
        const imgResult = await zai.images.search.create(imgArgs);
        const r = imgResult as unknown as {
          success?: boolean;
          results?: Array<Record<string, unknown>>;
        };

        if (r?.success && Array.isArray(r.results)) {
          for (const img of r.results) {
            const url = (img.original_url as string) || (img.url as string) || '';
            if (!url) continue;
            out.push({
              url,
              title: (img.caption as string) || (img.title as string) || '',
              source: (img.source as string) || '',
              width: img.original_width
                ? parseInt(String(img.original_width), 10) || undefined
                : undefined,
              height: img.original_height
                ? parseInt(String(img.original_height), 10) || undefined
                : undefined,
            });
          }
        }
      } catch (err) {
        console.error('[ImageRecon] similar-image search failed:', err);
      }
      return out;
    })();

    // --- (b) Web appearances (run searchQuery + top-3 keywords) ---
    const webAppearancesPromise = (async (): Promise<WebAppearance[]> => {
      const out: WebAppearance[] = [];
      if (!searchQuery && analysis.searchKeywords.length === 0) return out;
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const queries = [
          searchQuery,
          analysis.searchKeywords.slice(0, 3).join(' '),
        ].filter(Boolean);

        const searchSettled = await Promise.allSettled(
          queries.map((q) => rateLimitedInvoke<unknown[]>('web_search', { query: q, num: 8 }, { cacheTtlMs: 120_000 }))
        );

        const seen = new Set<string>();
        for (const s of searchSettled) {
          if (s.status !== 'fulfilled') continue;
          const results = Array.isArray(s.value) ? (s.value as unknown as Array<Record<string, unknown>>) : [];
          for (const r of results) {
            const url = (r.url as string) || (r.link as string) || '';
            if (!url || seen.has(url)) continue;
            seen.add(url);
            out.push({
              title: (r.title as string) || '',
              url,
              snippet: (r.snippet as string) || (r.description as string) || '',
              source: hostname(url),
            });
          }
        }
      } catch (err) {
        console.error('[ImageRecon] web search failed:', err);
      }
      return out;
    })();

    // --- (c) PLATFORM MATCHES — site-targeted Facebook/LinkedIn/Instagram + Yandex ---
    const platformMatchesPromise = (async (): Promise<PlatformMatch[]> => {
      const out: PlatformMatch[] = [];
      if (!searchQuery && !personQuery) return out;

      // Build per-platform queries. Prefer the person descriptor for
      // profile-picture images, but fall back to the VLM searchQuery.
      const personOrQuery = personQuery || searchQuery;
      const primary = personOrQuery; // person descriptor when available

      type PlatformQuery = { platform: PlatformTag; query: string };
      const platformQueries: PlatformQuery[] = [];

      if (primary) {
        platformQueries.push({ platform: 'facebook', query: `"${primary}" site:facebook.com` });
        platformQueries.push({
          platform: 'linkedin',
          query: `"${primary}" site:linkedin.com/in`,
        });
        platformQueries.push({
          platform: 'instagram',
          query: `"${primary}" site:instagram.com`,
        });
      }

      // Always also try the raw searchQuery against each platform (covers the
      // case where the person descriptor is too narrow).
      if (searchQuery && searchQuery !== primary) {
        platformQueries.push({ platform: 'facebook', query: `"${searchQuery}" site:facebook.com` });
        platformQueries.push({
          platform: 'linkedin',
          query: `"${searchQuery}" site:linkedin.com`,
        });
        platformQueries.push({
          platform: 'instagram',
          query: `"${searchQuery}" site:instagram.com`,
        });
      }

      // Yandex Images — best reverse-image engine. We approximate by using
      // image-search with the VLM query, plus a web search for the Yandex
      // image-result pages. When the locale is RU we use yandex.ru/images
      // (the regional Yandex), otherwise the global yandex.com/images.
      if (searchQuery) {
        const yandexHost = locale.country?.toUpperCase() === 'RU' ? 'yandex.ru' : 'yandex.com';
        platformQueries.push({
          platform: 'yandex',
          query: `"${searchQuery}" site:${yandexHost}/images`,
        });
      }

      // ── Regional platform expansion (Task 33-b) ──
      // When a country is selected, add site-targeted queries for each of that
      // country's regional platforms (VK, Weibo, Pixiv, Line, etc.). Deduplicate
      // against the 4 baseline platforms so we don't query facebook.com twice.
      if (locale.country) {
        const baselineHosts = new Set(['facebook.com', 'linkedin.com', 'instagram.com', 'yandex.com', 'yandex.ru']);
        const target = primary || searchQuery;
        if (target) {
          for (const rp of getRegionalPlatforms(locale.country)) {
            if (rp.category === 'messaging' || rp.category === 'search') continue;
            let host = '';
            try {
              host = new URL(rp.url).hostname.replace(/^www\./, '').toLowerCase();
            } catch {
              continue;
            }
            if (baselineHosts.has(host)) continue;
            baselineHosts.add(host);
            platformQueries.push({
              platform: rp.key as PlatformTag,
              query: `"${target}" site:${host}`,
            });
          }
        }
      }

      // Dedupe queries (a query could be added twice if personQuery === searchQuery).
      const seenQuery = new Set<string>();
      const uniqQueries = platformQueries.filter((q) => {
        const key = `${q.platform}|${q.query}`;
        if (seenQuery.has(key)) return false;
        seenQuery.add(key);
        return true;
      });

      // Run each platform query — each wrapped in its own try/catch so a 429
      // on one platform doesn't kill the others.
      const settled = await Promise.allSettled(
        uniqQueries.map(async (pq): Promise<PlatformMatch[]> => {
          try {
            const results = await rateLimitedInvoke<unknown[]>('web_search', {
              query: pq.query,
              num: 8,
            }, { cacheTtlMs: 120_000 });
            if (!Array.isArray(results)) return [];
            return results.map((r) => {
              const rr = r as Record<string, unknown>;
              const url = (rr.url as string) || (rr.link as string) || '';
              const title = (rr.title as string) || '';
              const snippet = (rr.snippet as string) || (rr.description as string) || '';
              return {
                platform: pq.platform,
                title,
                url,
                snippet,
                source: hostname(url),
                matchType: classifyMatch(pq.platform, url, title, snippet),
                confidence: scoreMatch(pq.platform, url, title, snippet, searchQuery, personQuery),
              } as PlatformMatch;
            });
          } catch (err) {
            console.error(`[ImageRecon] platform search ${pq.platform} failed:`, err);
            return [];
          }
        })
      );

      // Yandex image-search via zai.images.search.create (separate call, also
      // isolated). Pass `gl` when a country is selected so the image results
      // are geotargeted (e.g., gl=ru → Yandex Images RU results).
      let yandexImageMatches: PlatformMatch[] = [];
      if (searchQuery) {
        try {
          const ZAI = (await import('z-ai-web-dev-sdk')).default;
          const zai = await ZAI.create();
          const yandexImgArgs = locale.country || locale.language
            ? buildImageSearchArgs(`${searchQuery} yandex images`, locale, 8)
            : { query: `${searchQuery} yandex images`, num: 8 };
          const yandexImgResult = await zai.images.search.create(yandexImgArgs);
          const r = yandexImgResult as unknown as {
            success?: boolean;
            results?: Array<Record<string, unknown>>;
          };
          if (r?.success && Array.isArray(r.results)) {
            yandexImageMatches = r.results
              .map((img) => {
                const url = (img.original_url as string) || (img.url as string) || '';
                const title = (img.caption as string) || (img.title as string) || '';
                return {
                  platform: 'yandex' as PlatformTag,
                  title,
                  url,
                  snippet: title,
                  source: hostname(url),
                  matchType: 'image-search' as MatchType,
                  confidence: scoreMatch('yandex', url, title, title, searchQuery, personQuery),
                } as PlatformMatch;
              })
              .filter((m) => m.url);
          }
        } catch (err) {
          console.error('[ImageRecon] platform search yandex (image-search) failed:', err);
        }
      }

      // Merge + dedupe by URL across all platform searches.
      const seenUrl = new Set<string>();
      const merged: PlatformMatch[] = [];
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        for (const m of s.value) {
          if (!m.url || seenUrl.has(m.url)) continue;
          seenUrl.add(m.url);
          merged.push(m);
        }
      }
      for (const m of yandexImageMatches) {
        if (!m.url || seenUrl.has(m.url)) continue;
        seenUrl.add(m.url);
        merged.push(m);
      }

      // Sort by confidence descending.
      merged.sort((a, b) => b.confidence - a.confidence);
      return merged;
    })();

    // Await all three steps in parallel.
    const [similarImagesSettled, webAppearancesSettled, platformMatchesSettled] =
      await Promise.allSettled([
        similarImagesPromise,
        webAppearancesPromise,
        platformMatchesPromise,
      ]);

    const similarImages: SimilarImage[] =
      similarImagesSettled.status === 'fulfilled' ? similarImagesSettled.value : [];
    const webAppearances: WebAppearance[] =
      webAppearancesSettled.status === 'fulfilled' ? webAppearancesSettled.value : [];
    const platformMatches: PlatformMatch[] =
      platformMatchesSettled.status === 'fulfilled' ? platformMatchesSettled.value : [];

    // Per-platform counts (for audit log + timeline). Initialized with the 4
    // baseline platforms; regional platform keys are added dynamically when a
    // country is selected (perPlatformCounts[m.platform]++ auto-vivifies them).
    const perPlatformCounts: Record<string, number> = {
      facebook: 0,
      linkedin: 0,
      instagram: 0,
      yandex: 0,
    };
    for (const m of platformMatches) {
      perPlatformCounts[m.platform] = (perPlatformCounts[m.platform] || 0) + 1;
    }
    const platformsWithHits = Object.keys(perPlatformCounts).filter(
      (p) => perPlatformCounts[p] > 0
    );

    // --- Build multi-engine reverse-search direct links ---
    // We can't programmatically upload images to Google/TinEye/Yandex/Bing
    // (they have no public reverse-image-upload API), but we CAN give the
    // investigator one-click deep links to each engine's reverse-image-search
    // page so they can manually paste the image.
    const reverseSearchEngines: ReverseSearchEngine[] = [
      {
        name: 'Google Images',
        url: 'https://images.google.com/',
        description: 'Google reverse image search (upload or paste image URL)',
      },
      {
        name: 'Google Lens',
        url: 'https://lens.google.com/',
        description: 'Google Lens visual search — objects, text, landmarks',
      },
      {
        name: 'TinEye',
        url: 'https://tineye.com/',
        description: 'TinEye — finds exact image copies across the web',
      },
      {
        name: 'Yandex Images',
        url: locale.country?.toUpperCase() === 'RU' ? 'https://yandex.ru/images/' : 'https://yandex.com/images/',
        description: 'Yandex reverse image search — best for faces & Eastern European results',
      },
      {
        name: 'Bing Visual Search',
        url: 'https://www.bing.com/images',
        description: 'Bing visual search — good for objects & products',
      },
      {
        name: 'PimEyes',
        url: 'https://pimeyes.com/',
        description: 'PimEyes — face search across the web (premium)',
      },
      {
        name: 'FaceCheck.ID',
        url: 'https://facecheck.id/',
        description: 'FaceCheck.ID — reverse face search',
      },
    ];

    // --- Assemble report ---
    const stats: ImageReconReport['stats'] = {
      objects: analysis.objects.length,
      people: analysis.people.reduce((acc, p) => acc + (p.count || 1), 0),
      textDetected: analysis.textDetected.length,
      logos: analysis.logos.length,
      similarImages: similarImages.length,
      webAppearances: webAppearances.length,
      platformMatches: platformMatches.length,
      riskFlags: analysis.riskFlags.length,
    };

    const report: ImageReconReport = {
      author: 'artemis37',
      tool: 'PHANTOM ImageRecon',
      generatedAt,
      imageProvided: true,
      analysis,
      similarImages,
      webAppearances,
      platformMatches,
      reverseSearchEngines,
      stats,
      ...(vlmError ? { error: vlmError } : {}),
    };

    // --- Timeline event (mirror tiktok-tracker route) ---
    if (caseId) {
      try {
        const caseExists = await db.case.findUnique({ where: { id: caseId } });
        if (caseExists) {
          const descShort = analysis.description
            ? analysis.description.slice(0, 60)
            : '(no description)';
          const platformsHitStr =
            platformsWithHits.length > 0
              ? platformsWithHits.join(',')
              : 'none';
          await db.timelineEvent.create({
            data: {
              caseId,
              title: `Image Recon: ${descShort}`,
              description: `Image recon ran on an uploaded image. description="${
                analysis.description || '(none)'
              }", objects=${stats.objects}, people=${stats.people}, textDetected=${
                stats.textDetected
              }, logos=${stats.logos}, similarImages=${stats.similarImages}, webAppearances=${
                stats.webAppearances
              }, platformMatches=${stats.platformMatches} (platforms: ${platformsHitStr}), riskFlags=${
                stats.riskFlags
              }, sceneType=${analysis.sceneType}, estimatedLocation=${
                analysis.estimatedLocation
              }.`,
              eventType: 'action',
              metadata: JSON.stringify({
                tool: 'PHANTOM ImageRecon',
                vlmParseError,
                sceneType: analysis.sceneType,
                estimatedLocation: analysis.estimatedLocation,
                stats,
                perPlatformCounts,
                ...(vlmError ? { error: vlmError } : {}),
              }),
            },
          });
        }
      } catch (e) {
        console.error('[ImageRecon] timeline insert failed:', e);
      }
    }

    // --- Audit log (mirror tiktok-tracker route) ---
    await createAuditLog('osint_scan', 'ImageRecon', {
      caseId: caseId || null,
      imageProvided: true,
      mimeType,
      imageSizeBytes: Math.round(base64Payload.length * 0.75),
      vlmParseError,
      sceneType: analysis.sceneType,
      estimatedLocation: analysis.estimatedLocation,
      stats,
      perPlatformCounts,
      country: locale.country ?? null,
      ...(vlmError ? { error: vlmError } : {}),
      userId: payload.id,
    }).catch(() => {});

    return NextResponse.json(report);
  } catch (error) {
    console.error('[ImageRecon] route failed:', error);
    return NextResponse.json(
      {
        error: 'Image recon failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
