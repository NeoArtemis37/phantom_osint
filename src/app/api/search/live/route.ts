import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  localeCacheKey,
  type LocaleContext,
} from '@/lib/osint-query';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

// Simple in-memory cache for live search (per-query + per-locale, short TTL)
const searchCache = new Map<string, { results: unknown[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { query, caseId } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ query, results: [] });
    }

    const q = query.trim();
    const cacheKey = localeCacheKey('live', `${q}:${caseId || 'none'}`, locale);

    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ query: q, results: cached.results, cached: true });
    }

    // Localize the query (country-name + translated keyword bias)
    const localizedQuery = locale.country || locale.language
      ? buildLocalizedQuery(q, locale, { includeSites: false })
      : q;

    // Use the rate-limited invoker (prevents 429 storms + adds built-in caching)
    const searchResults = await rateLimitedInvoke<unknown[]>('web_search', {
      query: localizedQuery,
      num: 8,
    }, { cacheTtlMs: 60_000 });

    const results = Array.isArray(searchResults) ? searchResults : [];

    // Cache the result locally too (faster than the rate-limiter cache for this hot path)
    searchCache.set(cacheKey, { results, ts: Date.now() });
    if (searchCache.size > 100) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) searchCache.delete(oldestKey);
    }

    // Audit log (lightweight, no await to keep live search fast)
    createAuditLog('live_search', 'WebSearch', {
      query: q,
      caseId: caseId || null,
      resultCount: results.length,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json({ query: q, results });
  } catch (error) {
    console.error('Live search failed:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
