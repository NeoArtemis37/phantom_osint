import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildImageSearchArgs,
  localeCacheKey,
  type LocaleContext,
} from '@/lib/osint-query';

// =============================================================================
// POST /api/search/image
// Image search via z-ai-web-dev-sdk image_search function.
// Returns a list of image URLs matching the query.
// Now passes the official `gl` (Google region) parameter when a country is
// selected so results are geotargeted to the investigator's region.
// =============================================================================

// Simple in-memory cache for repeated queries (locale-aware)
const imageCache = new Map<string, { images: unknown[]; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { query, caseId, num } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ query, images: [] });
    }

    const q = query.trim();
    const count = Math.min(Math.max(num || 12, 1), 30);
    // Cache key now includes the locale (specifically gl) so two investigators
    // in different countries don't share the same cached image results.
    const cacheKey = localeCacheKey('image', `${q}:${count}`, locale);

    // Check cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ query: q, images: cached.images, cached: true });
    }

    let images: unknown[] = [];

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // z-ai SDK: zai.images.search.create({ query, count, gl, rank }) returns
      // { success, query, count, ranked, results: [{ original_url, caption, source, original_width, original_height }] }
      // When a country is selected we pass the official `gl` param + append the
      // country name + translated "photos" keyword for better geotargeting.
      // When no country is set we use the legacy { query, num } call shape.
      const args = locale.country || locale.language
        ? buildImageSearchArgs(q, locale, count)
        : { query: q, count };

      const result = await zai.images.search.create(args);

      const res = result as unknown as { success?: boolean; results?: Array<Record<string, unknown>>; error?: string };

      if (res && res.success && Array.isArray(res.results)) {
        images = res.results.map((r) => ({
          url: (r.original_url as string) || (r.url as string) || '',
          title: (r.caption as string) || (r.title as string) || '',
          source: (r.source as string) || '',
          width: r.original_width ? parseInt(String(r.original_width), 10) || undefined : (r.width as number | undefined),
          height: r.original_height ? parseInt(String(r.original_height), 10) || undefined : (r.height as number | undefined),
          thumbnail: (r.original_url as string) || (r.url as string) || '',
        })).filter((r: { url: string }) => r.url);
      } else if (res && !res.success) {
        console.error('Image search returned failure:', res.error);
      }
    } catch (err) {
      console.error('Image search failed:', err);
      return NextResponse.json(
        { error: 'Image search failed', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 502 }
      );
    }

    // Cache the result
    imageCache.set(cacheKey, { images, ts: Date.now() });
    if (imageCache.size > 60) {
      const oldestKey = imageCache.keys().next().value;
      if (oldestKey) imageCache.delete(oldestKey);
    }

    await createAuditLog('image_search', 'ImageSearch', {
      query: q,
      caseId: caseId || null,
      resultCount: images.length,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json({ query: q, images, cached: false });
  } catch (error) {
    console.error('Image search route failed:', error);
    return NextResponse.json(
      { error: 'Image search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
