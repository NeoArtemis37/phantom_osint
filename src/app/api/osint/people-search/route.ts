import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { authenticateRequest } from '@/lib/jwt';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';

// =============================================================================
// PHANTOM — People Search (idcrawl-style meta-search)
// =============================================================================
// idcrawl.com and deepfind.me offer a free people-search engine that turns a
// name into cross-platform matches (LinkedIn, Facebook, Twitter, public-
// records sites, news mentions, etc.). They are paid / closed — so instead of
// hitting their (unavailable) API we MIMIC their behaviour by fanning out
// 7 targeted z-ai-web-dev-sdk `web_search` queries in parallel via
// Promise.allSettled, deduplicating by URL, classifying each hit into a
// category (professional / social / public-records / news), and extracting
// phone / email / address patterns straight from the search snippets.
//
// Result shape mirrors the panels that already exist for Maigret / Sherlock /
// Reverse-Lookup — so the PeopleSearchPanel can re-use the same UI patterns.
//
// author: artemis37
// =============================================================================

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

type PeopleCategory = 'professional' | 'social' | 'public-records' | 'news';

interface PeopleSearchHit {
  category: PeopleCategory;
  title: string;
  url: string;
  snippet: string;
  extractedPhone?: string;
  extractedEmail?: string;
  confidence: number;
}

interface PeopleSearchResponse {
  query: string;
  results: PeopleSearchHit[];
  byCategory: Record<string, PeopleSearchHit[]>;
  totalFound: number;
  author: string;
  tool: string;
  generatedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Snippet extractors — pull phone / email out of unstructured text
// ---------------------------------------------------------------------------

// Reasonably strict phone regex — matches +1-555-123-4567, (555) 123-4567, etc.
const PHONE_RE = /(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4})/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Trim phone candidates to plausible lengths (7-15 digits) and reject pure years.
function extractPhone(text: string): string | undefined {
  if (!text) return undefined;
  const matches = text.match(PHONE_RE);
  if (!matches) return undefined;
  for (const m of matches) {
    const digits = m.replace(/\D/g, '');
    // skip 4-digit years like "2023"
    if (digits.length >= 7 && digits.length <= 15 && !/^19[5-9]\d$|^20[0-3]\d$/.test(digits)) {
      return m.trim();
    }
  }
  return undefined;
}
function extractEmail(text: string): string | undefined {
  if (!text) return undefined;
  const matches = text.match(EMAIL_RE);
  return matches ? matches[0].toLowerCase() : undefined;
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

// Base confidence per query type (LinkedIn > Facebook > news > public-records).
const BASE_CONFIDENCE: Record<string, number> = {
  linkedin: 80,
  facebook: 70,
  twitter: 70,
  instagram: 70,
  publicrecords: 55,
  directories: 65,
  news: 50,
};

function scoreFor(queryTag: string, title: string, snippet: string, query: string): number {
  const base = BASE_CONFIDENCE[queryTag] ?? 50;
  const q = query.toLowerCase();
  const titleHit = title.toLowerCase().includes(q);
  const snippetHit = snippet.toLowerCase().includes(q);
  // Bonus when the name appears verbatim in title or snippet
  let bonus = 0;
  if (titleHit) bonus += 10;
  if (snippetHit) bonus += 5;
  // Penalty for obvious false-positive markers
  if (/duplicate|missing person|obituary archive/i.test(snippet)) bonus -= 5;
  return Math.max(20, Math.min(98, base + bonus));
}

// ---------------------------------------------------------------------------
// Query templates — 7 parallel z-ai web_search calls
// ---------------------------------------------------------------------------

interface QueryTemplate {
  tag: string;
  category: PeopleCategory;
  build: (name: string, locale: LocaleContext) => string;
}

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    tag: 'linkedin',
    category: 'professional',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" site:linkedin.com/in`, locale, { includeSites: false, includeCountry: false })
        : `"${name}" site:linkedin.com/in`,
  },
  {
    tag: 'facebook',
    category: 'social',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" site:facebook.com`, locale, { includeSites: false, includeCountry: false })
        : `"${name}" site:facebook.com`,
  },
  {
    tag: 'twitter',
    category: 'social',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" site:twitter.com OR site:x.com`, locale, { includeSites: false, includeCountry: false })
        : `"${name}" site:twitter.com OR site:x.com`,
  },
  {
    tag: 'instagram',
    category: 'social',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" site:instagram.com`, locale, { includeSites: false, includeCountry: false })
        : `"${name}" site:instagram.com`,
  },
  {
    tag: 'publicrecords',
    category: 'public-records',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" "phone" OR "address" OR "email" public records`, locale, { includeSites: false })
        : `"${name}" "phone" OR "address" OR "email" public records`,
  },
  {
    tag: 'directories',
    category: 'public-records',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(
            `"${name}" site:whitepages.com OR site:truepeoplesearch.com OR site:fastpeoplesearch.com`,
            locale,
            { includeSites: false, includeCountry: false }
          )
        : `"${name}" site:whitepages.com OR site:truepeoplesearch.com OR site:fastpeoplesearch.com`,
  },
  {
    tag: 'news',
    category: 'news',
    build: (name, locale) =>
      locale.country || locale.language
        ? buildLocalizedQuery(`"${name}" obituary OR news OR arrest OR court`, locale, { includeSites: false })
        : `"${name}" obituary OR news OR arrest OR court`,
  },
];

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

type ZaiClient = {
  functions: {
    invoke: (fn: string, args: { query: string; num: number }) => Promise<unknown>;
  };
};

export async function POST(request: NextRequest) {
  try {
    // --- Auth (matches /api/search, /api/osint/maigret etc.) ---
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { query, caseId } = body as { query?: string; caseId?: string };
    const locale: LocaleContext = parseLocale(body);

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'A name (query) of at least 2 characters is required' },
        { status: 400 }
      );
    }

    const name = query.trim();

    // --- Fan out 7 parallel web_search calls via Promise.allSettled ---
    // Each query is wrapped in its own try/catch — a single 429 (or any
    // network/SDK failure) for one query never prevents the others from
    // contributing partial results. We surface whatever subset succeeds.
    let zai: ZaiClient | null = null;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      zai = (await ZAI.create()) as unknown as ZaiClient;
    } catch (sdkErr) {
      console.error('people-search: z-ai SDK unavailable, returning empty result:', sdkErr);
      await createAuditLog('osint_scan', 'PeopleSearch', {
        query: name,
        caseId: caseId ?? null,
        userId: payload.id,
        error: 'sdk_unavailable',
      });
      return NextResponse.json<PeopleSearchResponse>({
        query: name,
        results: [],
        byCategory: {},
        totalFound: 0,
        author: 'artemis37',
        tool: 'People Search (idcrawl-style)',
        generatedAt: new Date().toISOString(),
        error: 'search-engine-unavailable',
      });
    }

    const settled = await Promise.allSettled(
      QUERY_TEMPLATES.map(async (tmpl) => {
        const q = tmpl.build(name, locale);
        const r = await zai!.functions.invoke('web_search', { query: q, num: 10 });
        return { tag: tmpl.tag, category: tmpl.category, raw: Array.isArray(r) ? r : [] };
      })
    );

    // --- Aggregate + dedupe by URL ---
    const byUrl = new Map<string, PeopleSearchHit>();
    const partialErrors: string[] = [];

    settled.forEach((s, i) => {
      const tmpl = QUERY_TEMPLATES[i];
      if (s.status === 'fulfilled') {
        for (const raw of s.value.raw) {
          const r = raw as { title?: string; url?: string; snippet?: string };
          const url = r.url?.trim();
          if (!url) continue;
          // Skip noise / search-engine wrappers
          if (/google\.com\/search|bing\.com\/search|duckduckgo\.com\/search/i.test(url)) continue;

          const title = r.title?.trim() || url;
          const snippet = r.snippet?.trim() || '';

          // If we already have this URL, prefer the higher-confidence category
          const existing = byUrl.get(url);
          const confidence = scoreFor(tmpl.tag, title, snippet, name);
          if (existing) {
            if (confidence > existing.confidence) {
              existing.category = tmpl.category;
              existing.confidence = confidence;
            }
            // Fill in any extracted phone/email we may have missed
            if (!existing.extractedPhone) {
              const phone = extractPhone(`${title} ${snippet}`);
              if (phone) existing.extractedPhone = phone;
            }
            if (!existing.extractedEmail) {
              const email = extractEmail(`${title} ${snippet}`);
              if (email) existing.extractedEmail = email;
            }
            continue;
          }

          const phone = extractPhone(`${title} ${snippet}`);
          const email = extractEmail(`${title} ${snippet}`);
          byUrl.set(url, {
            category: tmpl.category,
            title,
            url,
            snippet,
            extractedPhone: phone,
            extractedEmail: email,
            confidence,
          });
        }
      } else {
        // Rejected (typically 429 / network) — record but continue
        const reason = s.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        partialErrors.push(`${tmpl.tag}:${msg.slice(0, 80)}`);
      }
    });

    const results = Array.from(byUrl.values()).sort((a, b) => b.confidence - a.confidence);

    // Group by category for the panel's grid
    const byCategory: Record<string, PeopleSearchHit[]> = {};
    for (const r of results) {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r);
    }

    // --- Timeline event ---
    if (caseId) {
      try {
        const caseExists = await db.case.findUnique({ where: { id: caseId } });
        if (caseExists) {
          await db.timelineEvent.create({
            data: {
              caseId,
              title: `People Search: ${name}`,
              description: `idcrawl-style meta people search for "${name}"${locale.country ? ` (locale: ${locale.country})` : ''} — ${results.length} hits across ${Object.keys(byCategory).length} categories`,
              eventType: 'action',
              metadata: JSON.stringify({
                query: name,
                country: locale.country ?? null,
                language: locale.language ?? null,
                totalFound: results.length,
                categories: Object.keys(byCategory),
                partialErrors: partialErrors.length > 0 ? partialErrors : undefined,
              }),
            },
          });
        }
      } catch {
        // best-effort — never block the response on a timeline write
      }
    }

    await createAuditLog('osint_scan', 'PeopleSearch', {
      query: name,
      caseId: caseId ?? null,
      userId: payload.id,
      country: locale.country ?? null,
      language: locale.language ?? null,
      totalFound: results.length,
      partialFailures: partialErrors.length,
    });

    return NextResponse.json<PeopleSearchResponse>({
      query: name,
      results,
      byCategory,
      totalFound: results.length,
      author: 'artemis37',
      tool: 'People Search (idcrawl-style)',
      generatedAt: new Date().toISOString(),
      error: partialErrors.length === 7 ? 'all-queries-failed' : partialErrors.length > 0 ? 'partial' : undefined,
    });
  } catch (error) {
    console.error('People search failed:', error);
    // Per spec: NEVER return 500 on rate-limit / upstream failure — return
    // an empty-result envelope so the panel always renders cleanly.
    return NextResponse.json<PeopleSearchResponse>({
      query: '',
      results: [],
      byCategory: {},
      totalFound: 0,
      author: 'artemis37',
      tool: 'People Search (idcrawl-style)',
      generatedAt: new Date().toISOString(),
      error: 'unexpected-error',
    });
  }
}
