import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { rateLimitedInvoke, parallelWebSearch } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/osint/social-search
// Social-media search for hashtags / mentions / keywords — with proper TYPE
// VALIDATION + per-type search strategies.
//
// Previously the route accepted a `type` field ('hashtag' | 'mention' |
// 'keyword') but IGNORED it — it just prepended # or @ and ran one generic
// web_search. The user's complaint: "options youve put has not being taken in
// consideration coz; it doe'snt whetither check what i put is really a tag, or
// a mention or a word to better look for it".
//
// Now we:
//   1. AUTO-DETECT the type from the input prefix (# = hashtag, @ = mention,
//      otherwise keyword) and override the declared type if they mismatch.
//   2. NORMALIZE the input (strip leading #/@, lowercase hashtags, validate
//      username format for mentions).
//   3. Run DIFFERENT search strategies per type:
//      - hashtag : site-targeted queries on Twitter/X, Instagram, TikTok,
//                  Facebook, Reddit, Tumblr, Pinterest + a generic `#tag` query.
//      - mention  : `@username` mention search across the same platforms.
//      - keyword  : general social-media keyword search (the legacy behaviour).
//   4. Return results tagged with which platform/query they came from.
//
// Author: artemis37
// =============================================================================

type SearchType = 'hashtag' | 'mention' | 'keyword';

interface SocialResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  platform?: string;
  matchedType?: SearchType;
  confidence: number;
}

/**
 * Auto-detect + validate the search type from the input.
 * - Starts with # → hashtag (strip the #, validate alphanumeric/underscore)
 * - Starts with @ → mention  (strip the @, validate username format)
 * - Otherwise    → keyword (as-is)
 * If the declared `type` conflicts with the detected type, the detected type
 * wins (the input shape is authoritative).
 */
function detectAndValidate(input: string, declaredType?: SearchType): { type: SearchType; normalized: string; original: string; warning?: string } {
  const trimmed = input.trim();
  let detected: SearchType = declaredType || 'keyword';
  let normalized = trimmed;
  let warning: string | undefined;

  // Auto-detect from prefix
  if (trimmed.startsWith('#')) {
    detected = 'hashtag';
    normalized = trimmed.slice(1).trim();
  } else if (trimmed.startsWith('@')) {
    detected = 'mention';
    normalized = trimmed.slice(1).trim();
  }

  // Per-type validation + normalization
  if (detected === 'hashtag') {
    // Hashtags: alphanumeric + underscore, no spaces. Strip any remaining # prefixes.
    normalized = normalized.replace(/^#+/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
      warning = `Hashtag "${normalized}" contains invalid characters — stripped to alphanumeric. Hashtags can only contain letters, numbers, and underscores.`;
      normalized = normalized.replace(/[^A-Za-z0-9_]/g, '');
    }
    if (normalized.length < 2) {
      warning = `Hashtag too short (min 2 chars).`;
    }
  } else if (detected === 'mention') {
    // Mentions/usernames: alphanumeric + underscore + dot, no spaces. Strip @ prefixes.
    normalized = normalized.replace(/^@+/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9_.]+$/.test(normalized)) {
      warning = `Username "${normalized}" contains invalid characters — stripped to alphanumeric/dot/underscore. Most platforms only allow letters, numbers, dots, and underscores.`;
      normalized = normalized.replace(/[^A-Za-z0-9_.]/g, '');
    }
    if (normalized.length < 2) {
      warning = `Username too short (min 2 chars).`;
    }
  } else {
    // Keyword: allow any text but trim + collapse whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (normalized.length < 2) {
      warning = `Keyword too short (min 2 chars).`;
    }
  }

  // Warn if the declared type conflicts with the detected type
  if (declaredType && declaredType !== detected) {
    warning = `Declared type "${declaredType}" but input "${trimmed}" looks like a ${detected}. Using detected type "${detected}".`;
  }

  return { type: detected, normalized, original: trimmed, warning };
}

// Platform site-targets for hashtag + mention searches
const SOCIAL_PLATFORMS = [
  { host: 'twitter.com', name: 'Twitter', alt: ['x.com'] },
  { host: 'instagram.com', name: 'Instagram' },
  { host: 'tiktok.com', name: 'TikTok' },
  { host: 'facebook.com', name: 'Facebook' },
  { host: 'reddit.com', name: 'Reddit' },
  { host: 'tumblr.com', name: 'Tumblr' },
  { host: 'pinterest.com', name: 'Pinterest' },
  { host: 'linkedin.com', name: 'LinkedIn' },
  { host: 'youtube.com', name: 'YouTube' },
  { host: 'threads.net', name: 'Threads' },
];

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { query, caseId, type: declaredType } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!query || !caseId) {
      return NextResponse.json(
        { error: 'query and caseId are required' },
        { status: 400 }
      );
    }

    // 1. Validate + auto-detect the search type
    const { type, normalized, original, warning } = detectAndValidate(
      query,
      declaredType as SearchType | undefined
    );

    if (!normalized || normalized.length < 2) {
      return NextResponse.json(
        { error: warning || 'Query too short after validation', results: [] },
        { status: 200 }
      );
    }

    // 2. Build per-type search queries
    const queries: Array<{ query: string; tag: string; platform?: string }> = [];

    if (type === 'hashtag') {
      const tag = `#${normalized}`;
      // Hashtag-specific: search for the tag on each major social platform
      for (const platform of SOCIAL_PLATFORMS) {
        queries.push({
          query: `"${tag}" site:${platform.host}`,
          tag: platform.name,
          platform: platform.name,
        });
        // Also search alt hosts (e.g. x.com for twitter)
        if (platform.alt) {
          for (const alt of platform.alt) {
            queries.push({
              query: `"${tag}" site:${alt}`,
              tag: platform.name,
              platform: platform.name,
            });
          }
        }
      }
      // Generic hashtag search (catches platforms not in the list)
      queries.push({
        query: `"${tag}" hashtag social media posts`,
        tag: 'General',
      });
    } else if (type === 'mention') {
      const mention = `@${normalized}`;
      // Mention-specific: search for @username mentions across platforms
      for (const platform of SOCIAL_PLATFORMS) {
        queries.push({
          query: `"${mention}" site:${platform.host}`,
          tag: platform.name,
          platform: platform.name,
        });
        if (platform.alt) {
          for (const alt of platform.alt) {
            queries.push({
              query: `"${mention}" site:${alt}`,
              tag: platform.name,
              platform: platform.name,
            });
          }
        }
      }
      // Also search for the profile URL directly (catches profile pages)
      queries.push({
        query: `"${normalized}" profile account user site:twitter.com OR site:instagram.com OR site:tiktok.com OR site:reddit.com`,
        tag: 'Profile',
      });
      queries.push({
        query: `"${mention}" mention social media`,
        tag: 'General',
      });
    } else {
      // Keyword: the legacy behaviour (localized social-media search)
      const localizedQuery = locale.country || locale.language
        ? buildLocalizedQuery(normalized, locale, { keyword: 'socialMedia', includeSites: false })
        : `${normalized} social media`;
      queries.push({ query: localizedQuery, tag: 'Social' });
      // Also run platform-targeted keyword searches for better coverage
      for (const platform of SOCIAL_PLATFORMS.slice(0, 5)) {
        queries.push({
          query: `"${normalized}" site:${platform.host}`,
          tag: platform.name,
          platform: platform.name,
        });
      }
    }

    // 3. Run all queries via the rate-limited parallel invoker
    const settled = await parallelWebSearch(
      queries.map((q) => ({ query: q.query, num: 8, tag: q.tag })),
      { cacheTtlMs: 90_000 }
    );

    // 4. Aggregate + dedupe by URL, tag each result with its platform + type
    const seen = new Set<string>();
    const results: SocialResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const platform = queries[i]?.platform;
      for (const r of s.results) {
        const rr = r as { title?: string; url?: string; snippet?: string };
        const url = rr.url || '';
        if (!url || seen.has(url)) continue;
        seen.add(url);

        // Confidence scoring: 90 if the normalized term is in the title, 75 if in snippet
        let confidence = 60;
        const lowerNorm = normalized.toLowerCase();
        if (rr.title?.toLowerCase().includes(lowerNorm)) confidence = 90;
        else if (rr.snippet?.toLowerCase().includes(lowerNorm)) confidence = 75;
        else if (platform) {
          const platformHost = SOCIAL_PLATFORMS.find((p) => p.name === platform)?.host;
          if (platformHost && url.toLowerCase().includes(platformHost.toLowerCase().split('.')[0])) confidence = 70;
        }

        results.push({
          title: rr.title || '',
          url,
          snippet: rr.snippet || '',
          source: s.tag || 'social-search',
          platform,
          matchedType: type,
          confidence,
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // 5. Timeline + audit
    try {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        const typeLabel = type === 'hashtag' ? `#${normalized}` : type === 'mention' ? `@${normalized}` : `"${normalized}"`;
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Social Search: ${typeLabel}`,
            description: `Social ${type} search for ${typeLabel}${locale.country ? ` (locale: ${locale.country})` : ''}. ${results.length} results from ${queries.length} queries.${warning ? ` Warning: ${warning}` : ''}`,
            eventType: 'action',
            metadata: JSON.stringify({
              originalQuery: original,
              declaredType: declaredType || null,
              detectedType: type,
              normalized,
              warning: warning || null,
              resultCount: results.length,
              queryCount: queries.length,
              country: locale.country ?? null,
            }),
          },
        });
      }
    } catch { /* ignore */ }

    await createAuditLog('osint_scan', 'SocialSearch', {
      query: original,
      declaredType: declaredType || null,
      detectedType: type,
      normalized,
      caseId,
      warning: warning || null,
      resultCount: results.length,
      country: locale.country ?? null,
      userId: payload.id,
    }).catch(() => {});

    return NextResponse.json({
      query: original,
      type,
      normalized,
      warning,
      results,
      totalFound: results.length,
      queriesRun: queries.length,
    });
  } catch (error) {
    console.error('Social search failed:', error);
    return NextResponse.json(
      { error: 'Social search failed' },
      { status: 500 }
    );
  }
}
