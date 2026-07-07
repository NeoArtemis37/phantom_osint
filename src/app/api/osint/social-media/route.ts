import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';

// =============================================================================
// POST /api/osint/social-media
// Unified Social-Media OSINT endpoint for 6 platforms that do NOT expose open
// profile APIs (most require auth / have anti-scraping):
//   - tiktok
//   - facebook
//   - telegram
//   - slack
//   - instagram
//   - snapchat
//
// Strategy: use z-ai-web-dev-sdk's web_search + page_reader to find and extract
// PUBLIC profile information, cross-referencing with platform-specific search
// patterns. For each platform we run 2 targeted search queries in parallel
// (Promise.allSettled so one failing doesn't kill the other), dedupe results
// by URL, then sequentially (200ms apart, max 3) fetch page_reader on the top
// results to extract bio, follower counts, profile image, and recent post titles.
//
// Rate-limit safe: every z-ai call is wrapped in try/catch. If a 429 hits we
// return whatever partial results we have with `rateLimited: true` and HTTP 200
// (NEVER 500).
//
// Author: artemis37
// Tool:   PHANTOM SocialMediaOSINT
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'tiktok' | 'facebook' | 'telegram' | 'slack' | 'instagram' | 'snapchat';

interface SocialProfile {
  url: string;
  title: string;
  snippet: string;
  extractedBio?: string;
  followerCount?: string;
  profileImage?: string;
  recentPosts?: string[];
  confidence: number; // 90 if URL contains the exact username, 70 otherwise
}

interface SocialMediaResponse {
  platform: string;
  query: string;
  profiles: SocialProfile[];
  totalFound: number;
  rateLimited: boolean;
  pagesRead: number;
  author: 'artemis37';
  tool: 'PHANTOM SocialMediaOSINT';
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Platform config — 2 targeted queries per platform
// ---------------------------------------------------------------------------

interface PlatformConfig {
  /** Build the 2 search queries for this platform given the user query + locale. */
  buildQueries: (q: string, locale: LocaleContext) => [string, string];
  /** Whether the user query is treated as a username (used for confidence scoring). */
  usernameBased: boolean;
}

function localized(locale: LocaleContext, base: string, keyword: 'profile' | 'socialMedia'): string {
  if (locale.country || locale.language) {
    return buildLocalizedQuery(base, locale, { keyword, includeSites: false });
  }
  return base;
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  tiktok: {
    usernameBased: true,
    buildQueries: (q, locale) => [
      localized(locale, `site:tiktok.com "@${q}"`, 'profile'),
      localized(locale, `tiktok.com/@${q} profile bio followers`, 'profile'),
    ],
  },
  facebook: {
    usernameBased: true,
    buildQueries: (q, locale) => [
      localized(locale, `site:facebook.com "${q}" profile`, 'profile'),
      localized(locale, `facebook.com/${q} about photos`, 'profile'),
    ],
  },
  telegram: {
    usernameBased: true,
    buildQueries: (q, locale) => [
      localized(locale, `site:t.me "${q}"`, 'profile'),
      localized(locale, `t.me/${q} channel group members`, 'profile'),
    ],
  },
  slack: {
    usernameBased: false,
    buildQueries: (q, locale) => [
      localized(locale, `site:slack.com "${q}" community`, 'socialMedia'),
      localized(locale, `"${q}" slack workspace team`, 'socialMedia'),
    ],
  },
  instagram: {
    usernameBased: true,
    buildQueries: (q, locale) => [
      localized(locale, `site:instagram.com "${q}"`, 'profile'),
      localized(locale, `instagram.com/${q} posts followers bio`, 'profile'),
    ],
  },
  snapchat: {
    usernameBased: true,
    buildQueries: (q, locale) => [
      localized(locale, `site:snapchat.com/add/${q}`, 'profile'),
      localized(locale, `"${q}" snapchat profile score`, 'profile'),
    ],
  },
};

const ALLOWED_PLATFORMS: Platform[] = ['tiktok', 'facebook', 'telegram', 'slack', 'instagram', 'snapchat'];

// ---------------------------------------------------------------------------
// Helpers — extract structured data from a fetched page
// ---------------------------------------------------------------------------

interface RawSearchHit {
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
}

interface ExtractedPage {
  bio?: string;
  followerCount?: string;
  profileImage?: string;
  recentPosts?: string[];
}

/** Pull <meta name="description" content="..."> / og:description out of HTML. */
function extractMetaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["']/i);
  return m ? m[1].trim() : null;
}

/** Pull <title>...</title> or og:title out of HTML. */
function extractHtmlTitle(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

/** Pull the first usable <img src="https://..."> URL out of HTML (profile pic heuristic). */
function extractProfileImage(html: string): string | null {
  const re = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  let fallback: string | null = null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    // Skip obvious UI icons / tracking pixels / data: URIs
    if (/\/(icon|logo|sprite|favicon|blank|pixel)/i.test(src)) continue;
    if (/\.(svg|gif)$/i.test(src)) continue;
    // Prefer images that look like avatars/profile pictures
    if (/(avatar|profile|pic|user|photo|headshot|p50|p100|p200|p320|t51|tiktokcdn|fbcdn|scontent|cdn)/i.test(src)) {
      return src;
    }
    if (!fallback) fallback = src;
  }
  return fallback;
}

/** Extract a count label near a follower/subscriber/member keyword. */
function extractFollowerCount(...texts: Array<string | undefined | null>): string | undefined {
  const labels = ['followers', 'follower', 'subscribers', 'subscriber', 'members', 'member', 'likes', 'following', 'fans', 'friends', 'connections'];
  for (const t of texts) {
    if (!t) continue;
    for (const label of labels) {
      // "1.2M followers" or "1,234 subscribers" or "followers 1.2M"
      const re = new RegExp(`([\\d.,]+\\s*[KMBkmb]?)\\s+${label}`, 'i');
      let m = t.match(re);
      if (!m) {
        const re2 = new RegExp(`${label}[\\s:]*([\\d.,]+\\s*[KMBkmb]?)`, 'i');
        m = t.match(re2);
      }
      if (m) {
        const count = m[1].trim();
        if (count) return `${count} ${label}`;
      }
    }
  }
  return undefined;
}

/** Extract <h1>, <h2>, and <title> tag contents as recent post titles. */
function extractRecentPosts(html: string): string[] {
  const posts: string[] = [];
  const seen = new Set<string>();
  const tagRe = /<h[12][^>]*>([^<]+)<\/h[12]>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null && posts.length < 8) {
    const txt = m[1].trim().replace(/\s+/g, ' ');
    if (!txt || txt.length < 3 || txt.length > 200) continue;
    if (seen.has(txt.toLowerCase())) continue;
    seen.add(txt.toLowerCase());
    posts.push(txt);
  }
  // Also include <title> as a fallback
  const titleTxt = extractHtmlTitle(html);
  if (titleTxt && posts.length === 0) posts.push(titleTxt);
  return posts;
}

/** Strip HTML tags from a string (best-effort). */
function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detect a 429 rate-limit error from a thrown exception. */
function isRateLimited(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many requests|rate.?limit/i.test(msg);
}

/** Sleep helper for sequential page_reader pacing. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse body + locale
    const body = await request.json();
    const { platform, query, caseId } = body as {
      platform?: string;
      query?: string;
      caseId?: string;
    };
    const locale: LocaleContext = parseLocale(body);

    // 3. Validate platform
    if (!platform || !ALLOWED_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        { error: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}` },
        { status: 400 }
      );
    }
    const plat = platform as Platform;

    // 3b. Validate query (non-empty, >= 2 chars, no injection chars)
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'query is required (min 2 chars)' },
        { status: 400 }
      );
    }
    const q = query.trim();
    if (/[<>"'`]|javascript:|data:text\/html|on\w+=/i.test(q)) {
      return NextResponse.json(
        { error: 'Invalid query: contains forbidden characters' },
        { status: 400 }
      );
    }

    const config = PLATFORM_CONFIG[plat];
    const [query1, query2] = config.buildQueries(q, locale);

    // 4. + 5. Run both search queries in parallel via Promise.allSettled
    let rateLimited = false;
    const allHits: RawSearchHit[] = [];

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const settled = await Promise.allSettled([
        zai.functions.invoke('web_search', { query: query1, num: 10 }).catch((e: unknown) => {
          if (isRateLimited(e)) rateLimited = true;
          throw e;
        }),
        zai.functions.invoke('web_search', { query: query2, num: 10 }).catch((e: unknown) => {
          if (isRateLimited(e)) rateLimited = true;
          throw e;
        }),
      ]);

      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        const r = s.value;
        if (Array.isArray(r)) {
          for (const item of r) {
            const it = item as unknown as Record<string, unknown>;
            const url = typeof it.url === 'string' ? it.url : '';
            if (!url) continue;
            allHits.push({
              url,
              title: typeof it.title === 'string' ? it.title : undefined,
              snippet: typeof it.snippet === 'string' ? it.snippet : typeof it.content === 'string' ? it.content : undefined,
              source: typeof it.source === 'string' ? it.source : undefined,
            });
          }
        }
      }
    } catch (err) {
      // web_search itself blew up entirely — record rate-limit flag, but keep going
      if (isRateLimited(err)) rateLimited = true;
      console.error('[social-media] web_search failed:', err);
    }

    // 6. Deduplicate by URL (case-insensitive), preserving best snippet/title
    const dedupedMap = new Map<string, RawSearchHit>();
    for (const hit of allHits) {
      const key = hit.url.toLowerCase();
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, hit);
      } else {
        // Prefer the hit that has both title + snippet
        const score = (h: RawSearchHit) => (h.title ? 1 : 0) + (h.snippet ? 1 : 0);
        if (score(hit) > score(existing)) dedupedMap.set(key, hit);
      }
    }
    const deduped = Array.from(dedupedMap.values());

    // 7. Pick top 3 URLs to fetch via page_reader (sequentially, 200ms apart)
    const top3 = deduped.slice(0, 3);

    // Build the base profile entries (with confidence scoring) up-front so we
    // always have something to return even if page_reader fails.
    const lowerQ = q.toLowerCase();
    const profiles: SocialProfile[] = deduped.map((hit) => {
      const urlLower = hit.url.toLowerCase();
      const exactUsernameInUrl = config.usernameBased
        ? urlLower.includes(lowerQ)
        : urlLower.includes(lowerQ);
      const confidence = exactUsernameInUrl ? 90 : 70;
      return {
        url: hit.url,
        title: hit.title || hit.source || hit.url,
        snippet: hit.snippet || '',
        confidence,
      };
    });

    // 7b. Fetch page content sequentially (max 3 calls, 200ms apart)
    let pagesRead = 0;
    if (top3.length > 0) {
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        for (let i = 0; i < top3.length; i++) {
          if (i > 0) await sleep(200);
          const hit = top3[i];
          try {
            const pageResult = await zai.functions.invoke('page_reader', { url: hit.url });
            const extracted = extractPageData(pageResult);

            // Merge extracted data into the matching profile entry
            const target = profiles.find((p) => p.url === hit.url);
            if (target && extracted) {
              if (extracted.bio) target.extractedBio = extracted.bio;
              if (extracted.followerCount) target.followerCount = extracted.followerCount;
              if (extracted.profileImage) target.profileImage = extracted.profileImage;
              if (extracted.recentPosts && extracted.recentPosts.length > 0) target.recentPosts = extracted.recentPosts;
              // If the search hit had no title but the page did, use the page title
              if (!target.title && extracted.bio) target.title = extracted.bio.slice(0, 80);
            }
            pagesRead++;
          } catch (err) {
            if (isRateLimited(err)) rateLimited = true;
            console.error(`[social-media] page_reader failed for ${hit.url}:`, err);
            // continue to next URL — one failure shouldn't block the others
          }
        }
      } catch (err) {
        if (isRateLimited(err)) rateLimited = true;
        console.error('[social-media] page_reader setup failed:', err);
      }
    }

    // Sort profiles: those with extracted data first, then by confidence desc
    profiles.sort((a, b) => {
      const aRich = (a.extractedBio ? 1 : 0) + (a.followerCount ? 1 : 0) + (a.profileImage ? 1 : 0);
      const bRich = (b.extractedBio ? 1 : 0) + (b.followerCount ? 1 : 0) + (b.profileImage ? 1 : 0);
      if (bRich !== aRich) return bRich - aRich;
      return b.confidence - a.confidence;
    });

    // 8. Build the response
    const response: SocialMediaResponse = {
      platform: plat,
      query: q,
      profiles,
      totalFound: profiles.length,
      rateLimited,
      pagesRead,
      author: 'artemis37',
      tool: 'PHANTOM SocialMediaOSINT',
      generatedAt: new Date().toISOString(),
    };

    // 9. Timeline event + audit log (only if case exists)
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } }).catch(() => null);
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Social Media OSINT: ${plat} · ${q}`,
            description: `Searched ${plat} for "${q}"${locale.country ? ` (locale: ${locale.country})` : ''}. Found ${profiles.length} profile(s), read ${pagesRead} page(s)${rateLimited ? ' · RATE LIMITED' : ''}.`,
            eventType: 'action',
            metadata: JSON.stringify({
              platform: plat,
              query: q,
              found: profiles.length,
              pagesRead,
              rateLimited,
              country: locale.country ?? null,
              tool: 'PHANTOM SocialMediaOSINT',
            }),
          },
        }).catch(() => {});
      }
    }

    await createAuditLog('osint_scan', 'SocialMediaOSINT', {
      platform: plat,
      query: q,
      caseId: caseId || null,
      foundCount: profiles.length,
      pagesRead,
      rateLimited,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    // 10. Always return 200 — even if rate-limited
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Top-level catch — but only return 500 for genuinely unexpected errors,
    // NOT for rate-limited z-ai calls (those are already handled above and
    // return 200 with partial results).
    console.error('[social-media] route failed:', error);
    return NextResponse.json(
      {
        error: 'Social media OSINT failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Page-data extractor (separated so it can be tested in isolation if needed)
// ---------------------------------------------------------------------------

function extractPageData(pageResult: unknown): ExtractedPage {
  if (!pageResult || typeof pageResult !== 'object') return {};

  const pr = pageResult as {
    code?: number;
    data?: {
      html?: string;
      description?: string;
      title?: string;
      content?: string;
      text?: string;
    };
    data_html?: string;
    data_text?: string;
  };

  // Handle both wrapped { data: {...} } and flat shapes
  const data = pr.data || {};
  const html: string = data.html || pr.data_html || '';
  const content: string = data.content || data.text || pr.data_text || '';
  const description: string = data.description || '';
  const title: string = data.title || '';

  const haystack = `${html}\n${content}`;
  const haystackText = stripTags(haystack);

  // Bio — prefer meta description, then first 200 chars of body text
  const bio =
    extractMetaDescription(html) ||
    description ||
    (haystackText.length > 0 ? haystackText.slice(0, 240) : undefined);

  // Follower count — scan both HTML text and stripped text near follower keywords
  const followerCount = extractFollowerCount(haystack, haystackText, description, content);

  // Profile image — first avatar-like <img>
  const profileImage = extractProfileImage(html) || undefined;

  // Recent posts — <h1>, <h2>, <title> tag contents
  const recentPosts = extractRecentPosts(html);
  if (recentPosts.length === 0 && title) recentPosts.push(title);

  const out: ExtractedPage = {};
  if (bio && bio.length >= 3) out.bio = bio;
  if (followerCount) out.followerCount = followerCount;
  if (profileImage) out.profileImage = profileImage;
  if (recentPosts.length > 0) out.recentPosts = recentPosts;
  return out;
}
