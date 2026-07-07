import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, caseId } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!query || !caseId) {
      return NextResponse.json(
        { error: 'query and caseId are required' },
        { status: 400 }
      );
    }

    let results: Array<{ title: string; url: string; snippet: string; source: string }> = [];

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // Localize the deep-web query: bias toward the country name + translated
      // keywords + regional site-targets. When a country is selected we ALSO
      // bias toward that country's national search engine (Yandex for RU,
      // Baidu for CN, Naver for KR, Seznam for CZ, Qwant for FR) by including
      // it as an extra site-target via the extraSites option.
      const extraSites: string[] = [];
      if (locale.country) {
        switch (locale.country.toUpperCase()) {
          case 'RU':
          case 'BY':
          case 'KZ':
            extraSites.push('yandex.ru');
            break;
          case 'CN':
            extraSites.push('baidu.com');
            break;
          case 'KR':
            extraSites.push('naver.com');
            break;
          case 'CZ':
            extraSites.push('seznam.cz');
            break;
          case 'FR':
            extraSites.push('qwant.com');
            break;
          default:
            // No national search engine bias for other countries — fall back to
            // the country name + translated keyword bias alone.
            break;
        }
      }

      const localizedQuery = locale.country || locale.language
        ? buildLocalizedQuery(query, locale, { includeSites: extraSites.length > 0, extraSites })
        : query;

      const searchResults = await zai.functions.invoke('web_search', {
        query: localizedQuery,
        num: 15,
      });

      if (Array.isArray(searchResults)) {
        results = searchResults.map((r: { title?: string; url?: string; snippet?: string }) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.snippet || '',
          source: 'uncensored-search',
        }));
      }
    } catch {
      results = [];
    }

    // Create timeline event
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Uncensored Search: ${query}`,
            description: `Qwant/Gibiru uncensored search for: "${query}"${locale.country ? ` (locale: ${locale.country})` : ''}`,
            eventType: 'action',
            metadata: JSON.stringify({ query, resultCount: results.length, country: locale.country ?? null }),
          },
        });
      }
    }

    await createAuditLog('osint_scan', 'UncensoredSearch', { query, caseId, country: locale.country ?? null });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Uncensored search failed:', error);
    return NextResponse.json(
      { error: 'Uncensored search failed' },
      { status: 500 }
    );
  }
}
