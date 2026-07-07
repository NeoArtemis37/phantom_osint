import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { authenticateRequest } from '@/lib/jwt';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { query, caseId } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    // Localize the query (translates the keyword + biases toward regional
    // platforms + country). When no country is provided the behaviour is
    // identical to the legacy plain-query call (backward compatible).
    const localizedQuery = locale.country || locale.language
      ? buildLocalizedQuery(query, locale, { includeSites: false })
      : query;

    // Use the rate-limited invoker (prevents 429 storms + adds caching)
    const searchResults = await rateLimitedInvoke<unknown[]>('web_search', {
      query: localizedQuery,
      num: 10,
    }, { cacheTtlMs: 90_000 });

    await createAuditLog('search', 'WebSearch', {
      query,
      caseId: caseId || null,
      userId: payload.id,
      country: locale.country ?? null,
      language: locale.language ?? null,
    });

    // If caseId provided, create a timeline event for the search
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `OSINT Search: ${query}`,
            description: `Performed web search for: "${query}"${locale.country ? ` (locale: ${locale.country})` : ''}`,
            eventType: 'action',
            metadata: JSON.stringify({
              query,
              localizedQuery,
              country: locale.country ?? null,
              language: locale.language ?? null,
              resultCount: Array.isArray(searchResults) ? searchResults.length : 0,
            }),
          },
        });
      }
    }

    return NextResponse.json({ query, results: searchResults || [] });
  } catch (error) {
    console.error('Failed to perform search:', error);
    return NextResponse.json(
      { error: 'Failed to perform search', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
