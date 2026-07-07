import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  SHERLOCK_PLATFORMS,
  buildSherlockUrl,
  type SherlockPlatform,
} from '@/lib/sherlock-platforms';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { REGIONAL_PLATFORMS } from '@/lib/countries';
import { probePlatforms, groupProbeResults, type ProbeTarget, type ProbeResult } from '@/lib/osint-probe';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/osint/sherlock
// Sherlock-style username enumeration with REAL HTTP verification.
//
// Mirrors the real Sherlock Project (sherlock-project/sherlock): for every site
// in SHERLOCK_PLATFORMS, build the candidate profile URL, make a REAL HTTP GET,
// and classify the response using the platform's declared `errorType`:
//   - status_code : HTTP 404/410 → not found
//   - message     : body contains `errorMsg` → not found
//   - response_url : redirected away from profile URL → not found
//
// Like the maigret route, also runs a rate-limited web_search as a secondary
// signal to catch platforms that block direct HTTP probing.
//
// Author: artemis37
// Tool reference: https://github.com/sherlock-project/sherlock
// =============================================================================

function buildCandidatePlatforms(locale: LocaleContext): SherlockPlatform[] {
  const baseline = SHERLOCK_PLATFORMS;
  const baselineHosts = new Set(
    baseline.map((p) => {
      try {
        return new URL(p.urlMain).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return '';
      }
    }).filter(Boolean)
  );

  const extra: SherlockPlatform[] = [];
  let syntheticRank = 1000;
  for (const key of Object.keys(REGIONAL_PLATFORMS)) {
    const rp = REGIONAL_PLATFORMS[key];
    if (!locale.country) continue;
    if (!rp.countries.includes(locale.country.toUpperCase())) continue;
    if (rp.category === 'messaging' || rp.category === 'search') continue;
    let host = '';
    try {
      host = new URL(rp.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      continue;
    }
    if (baselineHosts.has(host)) continue;
    extra.push({
      name: rp.name,
      category: rp.category.charAt(0).toUpperCase() + rp.category.slice(1),
      url: rp.searchUrl,
      urlMain: rp.url,
      errorType: 'status_code',
      rank: syntheticRank++,
    });
  }

  return [...baseline, ...extra];
}

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { username, caseId, all } = body as { username?: string; caseId?: string; all?: boolean };
    const locale: LocaleContext = parseLocale(body);

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json(
        { error: 'username is required (min 2 chars)' },
        { status: 400 }
      );
    }

    const uname = username.trim();
    if (/[<>"'`\\]|javascript:|data:|on\w+=/i.test(uname)) {
      return NextResponse.json(
        { error: 'Invalid username: contains forbidden characters' },
        { status: 400 }
      );
    }

    // 1. Build candidate platforms (baseline + regional)
    const platforms = buildCandidatePlatforms(locale);

    // Sort by rank (most popular first) so the probe cap prioritizes popular sites
    const sortedPlatforms = [...platforms].sort((a, b) => a.rank - b.rank);

    // 2. Build probe targets — pass the platform's `errorMsg` as not-found markers
    //    so the probe engine can detect "message" errorType platforms correctly.
    const probeTargets: ProbeTarget[] = sortedPlatforms.map((p) => ({
      platform: p.name,
      category: p.category,
      url: buildSherlockUrl(p, uname),
      username: uname,
      notFoundMarkers: p.errorMsg ? [p.errorMsg] : [],
      redirectAwayPatterns: p.errorType === 'response_url' ? ['/login', '/signup', '/home', '/search'] : undefined,
    }));

    // 3. Run REAL HTTP probes (sherlock --all style)
    const probeResults = await probePlatforms(probeTargets, {
      concurrency: 12,
      timeoutMs: 6000,
      maxTargets: all === true ? 250 : 60,
      followRedirects: true,
    });

    // 4. Secondary web_search signal (rate-limited) for platforms that block HTTP
    const webSearchHits: ProbeResult[] = [];
    try {
      const profileQuery = locale.country || locale.language
        ? buildLocalizedQuery(`"${uname}"`, locale, { keyword: 'profile', includeSites: false, extraTerms: ['account'] })
        : `"${uname}" profile account`;

      const searchResults = await rateLimitedInvoke<unknown[]>('web_search', {
        query: profileQuery,
        num: 25,
      }, { cacheTtlMs: 120_000 });

      if (Array.isArray(searchResults)) {
        const lowerU = uname.toLowerCase();
        const confirmedPlatforms = new Set(probeResults.filter(r => r.status === 'confirmed').map(r => r.platform));

        for (const r of searchResults) {
          const urlStr = (r as { url?: string }).url || '';
          if (!urlStr || !urlStr.toLowerCase().includes(lowerU)) continue;

          // Match to a platform by host
          let matchedPlatform: SherlockPlatform | null = null;
          for (const p of sortedPlatforms) {
            const domain = p.urlMain.toLowerCase();
            if (urlStr.toLowerCase().includes(domain.replace('https://', '').replace('http://', ''))) {
              matchedPlatform = p;
              break;
            }
          }

          if (matchedPlatform && !confirmedPlatforms.has(matchedPlatform.name)) {
            if (!webSearchHits.find(h => h.platform === matchedPlatform!.name)) {
              webSearchHits.push({
                platform: matchedPlatform.name,
                category: matchedPlatform.category,
                url: urlStr,
                status: 'possible',
                httpStatus: 0,
                finalUrl: urlStr,
                confidence: 72,
                reason: 'Found via web search (HTTP probe inconclusive)',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Sherlock secondary web_search failed:', err);
    }

    // 5. Merge: HTTP probes + web_search possible hits
    const probedPlatforms = new Set(probeResults.map(r => r.platform));
    const merged = [...probeResults, ...webSearchHits.filter(h => !probedPlatforms.has(h.platform))];

    // 6. Group + classify
    const grouped = groupProbeResults(merged);

    // 7. Build "available" list = platforms where HTTP probe returned false_positive
    //    (sherlock's "available" = username is free on that site)
    const available = grouped.falsePositive.map(r => ({
      platform: r.platform,
      category: r.category,
      url: r.url,
      rank: sortedPlatforms.find(p => p.name === r.platform)?.rank ?? 999,
      errorType: sortedPlatforms.find(p => p.name === r.platform)?.errorType ?? 'status_code',
      status: 'available' as const,
      confidence: 90,
      reason: r.reason,
    }));
    available.sort((a, b) => a.rank - b.rank);

    // 8. byCategory for the UI
    const byCategory: Record<string, { confirmed: ProbeResult[]; false_positive: ProbeResult[]; possible: ProbeResult[]; errors: ProbeResult[] }> = {};
    const allCats = new Set<string>();
    merged.forEach(r => allCats.add(r.category));
    for (const cat of allCats) {
      byCategory[cat] = {
        confirmed: merged.filter(r => r.category === cat && r.status === 'confirmed'),
        false_positive: merged.filter(r => r.category === cat && r.status === 'false_positive'),
        possible: merged.filter(r => r.category === cat && r.status === 'possible'),
        errors: merged.filter(r => r.category === cat && r.status === 'error'),
      };
    }

    // 9. Timeline + audit
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Sherlock Scan: ${uname}`,
            description: `Sherlock HTTP-probed ${platforms.length} sites for "${uname}"${locale.country ? ` (locale: ${locale.country})` : ''}. ${grouped.stats.confirmed} confirmed, ${grouped.stats.falsePositive} available, ${grouped.stats.possible} possible.`,
            eventType: 'action',
            metadata: JSON.stringify({
              username: uname,
              tool: 'sherlock',
              totalProbed: grouped.stats.total,
              confirmed: grouped.stats.confirmed,
              available: grouped.stats.falsePositive,
              possible: grouped.stats.possible,
              errors: grouped.stats.errors,
              country: locale.country ?? null,
              mode: all === true ? 'all' : 'top',
            }),
          },
        });
      }
    }

    await createAuditLog('osint_scan', 'SherlockScan', {
      username: uname,
      caseId: caseId || null,
      totalProbed: grouped.stats.total,
      confirmed: grouped.stats.confirmed,
      available: grouped.stats.falsePositive,
      possible: grouped.stats.possible,
      errors: grouped.stats.errors,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json({
      username: uname,
      tool: 'sherlock',
      toolReference: 'sherlock-project/sherlock',
      mode: all === true ? 'all' : 'top',
      // Confirmed accounts (GREEN)
      found: grouped.confirmed,
      confirmed: grouped.confirmed,
      // Available = HTTP probe proved the profile doesn't exist (RED → recoded as "available")
      available,
      falsePositive: grouped.falsePositive,
      // Possible (YELLOW)
      possible: grouped.possible,
      // Errors (GRAY)
      errors: grouped.errors,
      byCategory,
      stats: grouped.stats,
      totalScanned: grouped.stats.total,
      totalFound: grouped.stats.confirmed,
      totalAvailable: available.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sherlock scan failed:', error);
    return NextResponse.json(
      { error: 'Sherlock scan failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
