import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { parallelWebSearch } from '@/lib/zai-rate-limiter';
import {
  EXTERNAL_TOOLS,
  getToolsForInputType,
  getToolDescriptor,
  type ExternalTool,
  type ExternalInputType,
} from '@/lib/external-osint';

// =============================================================================
// POST /api/osint/external-lookup
// Unified External OSINT Lookup engine — integrates ALL 49 external GitHub
// OSINT projects currently tagged `phantomModule: 'External Lookup'` in the
// osint-catalog. For a given (type, value) target:
//
//   1. Resolves the matching ExternalTool list (5-15 tools depending on type)
//   2. For each tool, builds a localized `web_search` query via
//      buildLocalizedQuery + the tool's buildSearchQuery template
//   3. Fans all queries out in parallel (no rate limiting — the SDK helper
//      is a pass-through as of the latest revision)
//   4. Dedupes results by URL ACROSS all tools (a single result that
//      satisfies 3 tools only appears once, attached to the first tool that
//      surfaced it)
//   5. Returns one tool-result block per tool (deepLink + results + count),
//      plus an overall summary envelope
//
// Always returns HTTP 200 — even on partial failures — so the frontend can
// render whatever results came back. Only truly unexpected top-level errors
// bubble up as 500.
//
// author: artemis37
// =============================================================================

const ALLOWED_TYPES: ExternalInputType[] = [
  'username',
  'email',
  'phone',
  'domain',
  'ip',
  'image',
  'name',
];

// Block injection / XSS payloads in the value field
const INJECTION_PATTERN = /[<>"'`]|javascript:|data:text\/html|on\w+=/i;

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

interface ToolResult {
  tool: {
    id: string;
    name: string;
    category: string;
    url: string;
    description: string;
    githubRef?: string;
  };
  deepLink: string | null;
  results: SearchHit[];
  totalFound: number;
}

/**
 * Sanitize a raw SDK search-result item into a typed SearchHit. The SDK
 * returns `unknown` so we narrow defensively.
 */
function toSearchHit(raw: unknown): SearchHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === 'string' ? r.url : '';
  if (!url) return null;
  return {
    title: typeof r.title === 'string' ? r.title : '',
    url,
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
  };
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth (401 if no token) ---
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, value, caseId } = body as {
      type?: string;
      value?: string;
      caseId?: string;
    };

    // --- Locale (country/language/regionalOnly) ---
    const locale: LocaleContext = parseLocale(body);

    // --- Validate type ---
    if (!type || !ALLOWED_TYPES.includes(type as ExternalInputType)) {
      return NextResponse.json(
        {
          error: `Invalid type. Must be one of: ${ALLOWED_TYPES.join(', ')}`,
          validTypes: ALLOWED_TYPES,
        },
        { status: 400 }
      );
    }

    // --- Validate value (non-empty, ≥2 chars, no injection) ---
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length < 2) {
      return NextResponse.json(
        { error: 'value is required and must be at least 2 characters' },
        { status: 400 }
      );
    }
    if (INJECTION_PATTERN.test(trimmed)) {
      return NextResponse.json(
        { error: 'value contains disallowed characters (potential injection)' },
        { status: 400 }
      );
    }

    // --- Resolve matching tools ---
    const tools: ExternalTool[] = getToolsForInputType(type);
    if (tools.length === 0) {
      // Shouldn't happen given ALLOWED_TYPES covers every inputTypes slot,
      // but guard anyway so the frontend gets a clean empty envelope.
      return NextResponse.json({
        type,
        value: trimmed,
        tools: [],
        totalResults: 0,
        author: 'artemis37',
        tool: 'PHANTOM ExternalOSINT',
        generatedAt: new Date().toISOString(),
      });
    }

    // --- Build per-tool queries (locale-aware) ---
    const queries = tools.map((t) => {
      const base = t.buildSearchQuery(trimmed);
      const localized = locale.country || locale.language
        ? buildLocalizedQuery(base, locale, {
            // Don't double-append site: targets — many tools already emit a
            // `site:` clause in buildSearchQuery (e.g. site:shodan.io).
            includeSites: false,
            // Include the country name + translated keywords so the search
            // engine geotargets results.
            extraTerms: ['OSINT'],
          })
        : base;
      return { tag: t.id, query: localized, num: 8 };
    });

    // --- Fan out (no rate limiting now — parallelWebSearch fires all in
    // parallel and never throws) ---
    const settled = await parallelWebSearch(queries);

    // Map tag → results[] for quick lookup
    const byTag = new Map<string, unknown[]>();
    for (const s of settled) {
      if (s?.tag) byTag.set(s.tag, s.results);
    }

    // --- Dedupe results by URL ACROSS all tools (a URL belongs to the
    // FIRST tool that surfaced it) ---
    const seenUrls = new Set<string>();
    const toolResults: ToolResult[] = tools.map((t) => {
      const rawResults = byTag.get(t.id) ?? [];
      const hits: SearchHit[] = [];
      for (const raw of rawResults) {
        const hit = toSearchHit(raw);
        if (!hit) continue;
        if (seenUrls.has(hit.url)) continue;
        seenUrls.add(hit.url);
        hits.push(hit);
      }
      return {
        tool: getToolDescriptor(t),
        deepLink: t.buildDeepLink(trimmed),
        results: hits,
        totalFound: hits.length,
      };
    });

    const totalResults = toolResults.reduce((sum, t) => sum + t.totalFound, 0);

    // --- Audit log (always, best-effort) ---
    createAuditLog('osint_scan', 'ExternalOSINT', {
      userId: payload.id,
      type,
      value: trimmed,
      caseId: caseId ?? null,
      country: locale.country ?? null,
      language: locale.language ?? null,
      toolsQueried: tools.length,
      totalResults,
      partialFailures: settled.filter((s) => !s || s.results.length === 0).length,
    }).catch(() => { /* best-effort */ });

    // --- Timeline event (best-effort, only if caseId + case exists) ---
    if (caseId) {
      try {
        const caseExists = await db.case.findUnique({ where: { id: caseId } });
        if (caseExists) {
          await db.timelineEvent.create({
            data: {
              caseId,
              title: `External OSINT Lookup: ${type}=${trimmed}`,
              description: `Queried ${tools.length} external OSINT tools (${tools.map((t) => t.id).join(', ')}) for "${trimmed}". ${totalResults} unique results across all tools.`,
              eventType: 'action',
              metadata: JSON.stringify({
                type,
                value: trimmed,
                toolsQueried: tools.length,
                totalResults,
                toolIds: tools.map((t) => t.id),
                country: locale.country ?? null,
              }),
            },
          });
        }
      } catch {
        // ignore — best effort
      }
    }

    return NextResponse.json({
      type,
      value: trimmed,
      tools: toolResults,
      totalResults,
      author: 'artemis37',
      tool: 'PHANTOM ExternalOSINT',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('External OSINT lookup failed:', error);
    // Truly unexpected top-level error — surface a 500 with the message
    return NextResponse.json(
      {
        error: 'External OSINT lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET — quick metadata endpoint (no auth, returns the tool catalog)
// =============================================================================
export async function GET() {
  return NextResponse.json({
    author: 'artemis37',
    tool: 'PHANTOM ExternalOSINT',
    generatedAt: new Date().toISOString(),
    totalTools: EXTERNAL_TOOLS.length,
    inputTypes: ALLOWED_TYPES,
    tools: EXTERNAL_TOOLS.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      url: t.url,
      description: t.description,
      githubRef: t.githubRef,
      inputTypes: t.inputTypes,
    })),
  });
}
