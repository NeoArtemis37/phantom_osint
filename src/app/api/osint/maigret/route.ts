import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { OSINT_PLATFORMS, type OsintPlatform } from '@/lib/osint-platforms';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { getRegionalPlatforms, REGIONAL_PLATFORMS } from '@/lib/countries';
import { probePlatforms, groupProbeResults, type ProbeTarget, type ProbeResult } from '@/lib/osint-probe';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/osint/maigret
// Maigret-style username enumeration with REAL HTTP verification.
//
// Mirrors the maigret CLI `maigret [username] --all --print-errors` behaviour:
//   - Generates candidate profile URLs for every platform (100+ baseline + regional)
//   - Makes a REAL HTTP GET to each candidate URL (throttled, with browser UA)
//   - Classifies each response:
//       CONFIRMED (green)     : HTTP 200 + username in URL/body, no error markers
//       FALSE_POSITIVE (red)  : HTTP 404, redirect-away, or "not found" in body
//       POSSIBLE (yellow)     : HTTP 200 but ambiguous (private/protected profile)
//       ERROR (gray)          : timeout / network error / blocked
//   - Confirmed accounts are grouped by category and shown back to the analyst.
//   - Falls back to web_search (rate-limited) as a secondary signal to catch
//     platforms that block direct HTTP probing (Instagram, TikTok, etc.).
//
// Author: artemis37
// =============================================================================

/**
 * Build the augmented platform list: OSINT_PLATFORMS baseline + any regional
 * platforms for the selected country that aren't already in the baseline.
 */
function buildCandidatePlatforms(locale: LocaleContext): OsintPlatform[] {
  const baseline = OSINT_PLATFORMS;
  const baselineHosts = new Set(
    baseline.map((p) => {
      try {
        const sample = p.url('sample');
        return new URL(sample).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return '';
      }
    }).filter(Boolean)
  );

  const extra: OsintPlatform[] = [];
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
      url: (u: string) => rp.searchUrl.replace('{}', encodeURIComponent(u)),
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
    const { username, caseId, all } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json(
        { error: 'username is required (min 2 chars)' },
        { status: 400 }
      );
    }

    const uname = username.trim();

    // 1. Build candidate platforms (baseline + regional for the selected country)
    const platforms = buildCandidatePlatforms(locale);

    // 2. Build probe targets for the HTTP probing engine
    const probeTargets: ProbeTarget[] = platforms.map((p) => ({
      platform: p.name,
      category: p.category,
      url: p.url(uname),
      username: uname,
    }));

    // 3. Run REAL HTTP probes — this is the core verification (maigret --all style)
    //    `all=true` probes every platform (slow, ~60s for 200+ sites).
    //    Default caps at 60 most-popular-first for speed.
    const probeResults = await probePlatforms(probeTargets, {
      concurrency: 12,
      timeoutMs: 6000,
      maxTargets: all === true ? 250 : 60,
      followRedirects: true,
    });

    // 4. Also run a rate-limited web_search as a SECONDARY signal — catches
    //    profiles on platforms that block direct HTTP probing (Instagram, TikTok)
    const webSearchHits: ProbeResult[] = [];
    try {
      const verifyQuery = locale.country || locale.language
        ? buildLocalizedQuery(`"${uname}"`, locale, { keyword: 'profile', includeSites: false })
        : `"${uname}" profile`;

      const searchResults = await rateLimitedInvoke<unknown[]>('web_search', {
        query: verifyQuery,
        num: 20,
      }, { cacheTtlMs: 120_000 });

      if (Array.isArray(searchResults)) {
        const lowerU = uname.toLowerCase();
        const confirmedPlatforms = new Set(probeResults.filter(r => r.status === 'confirmed').map(r => r.platform));

        for (const r of searchResults) {
          const urlStr = (r as { url?: string }).url || '';
          if (!urlStr) continue;
          if (!urlStr.toLowerCase().includes(lowerU)) continue;

          // Identify the platform from the URL
          let platform = 'Unknown';
          let category = 'Social';
          for (const p of platforms) {
            const candidateUrl = p.url(uname).toLowerCase().split('?')[0];
            if (urlStr.toLowerCase().startsWith(candidateUrl) ||
                urlStr.toLowerCase().includes(candidateUrl.replace('https://', ''))) {
              platform = p.name;
              category = p.category;
              break;
            }
          }
          // Fallback host-based detection
          if (platform === 'Unknown') {
            const hostMatchers: Array<[string[], string, string]> = [
              [['twitter.com', 'x.com'], 'Twitter/X', 'Social'],
              [['instagram.com'], 'Instagram', 'Social'],
              [['github.com'], 'GitHub', 'Developer'],
              [['reddit.com'], 'Reddit', 'Social'],
              [['tiktok.com'], 'TikTok', 'Social'],
              [['facebook.com'], 'Facebook', 'Social'],
              [['linkedin.com'], 'LinkedIn', 'Professional'],
              [['youtube.com'], 'YouTube', 'Media'],
              [['vk.com'], 'VK', 'Social'],
              [['weibo.com'], 'Weibo', 'Social'],
            ];
            for (const [hosts, name, cat] of hostMatchers) {
              if (hosts.some(h => urlStr.toLowerCase().includes(h))) {
                platform = name;
                category = cat;
                break;
              }
            }
          }

          // Only add as a "possible" hit if HTTP probing didn't already confirm it
          if (platform !== 'Unknown' && !confirmedPlatforms.has(platform)) {
            // Don't duplicate
            if (!webSearchHits.find(h => h.platform === platform)) {
              webSearchHits.push({
                platform,
                category,
                url: urlStr,
                status: 'possible',
                httpStatus: 0,
                finalUrl: urlStr,
                confidence: 75,
                reason: 'Found via web search (HTTP probe blocked or inconclusive)',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Maigret secondary web_search failed:', err);
    }

    // 5. Merge: HTTP probe results take priority; web_search hits fill in "possible" gaps
    const probedPlatforms = new Set(probeResults.map(r => r.platform));
    const merged = [...probeResults, ...webSearchHits.filter(h => !probedPlatforms.has(h.platform))];

    // 6. Group + classify (maigret --print-errors style: green/red/yellow/gray)
    const grouped = groupProbeResults(merged);

    // 7. Build byCategory for the UI (confirmed first, then possible, then errors)
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

    // 8. Timeline + audit
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Maigret Scan: ${uname}`,
            description: `Probed ${platforms.length} platforms for "${uname}"${locale.country ? ` (locale: ${locale.country})` : ''}. ${grouped.stats.confirmed} confirmed, ${grouped.stats.falsePositive} false positives, ${grouped.stats.possible} possible, ${grouped.stats.errors} errors.`,
            eventType: 'action',
            metadata: JSON.stringify({
              username: uname,
              totalProbed: grouped.stats.total,
              confirmed: grouped.stats.confirmed,
              falsePositive: grouped.stats.falsePositive,
              possible: grouped.stats.possible,
              errors: grouped.stats.errors,
              country: locale.country ?? null,
              mode: all === true ? 'all' : 'top',
            }),
          },
        });
      }
    }

    await createAuditLog('osint_scan', 'MaigretScan', {
      username: uname,
      caseId: caseId || null,
      totalProbed: grouped.stats.total,
      confirmed: grouped.stats.confirmed,
      falsePositive: grouped.stats.falsePositive,
      possible: grouped.stats.possible,
      errors: grouped.stats.errors,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json({
      username: uname,
      mode: all === true ? 'all' : 'top',
      // Primary output — confirmed accounts (GREEN) grouped by category
      confirmed: grouped.confirmed,
      // False positives (RED) — shown for transparency like --print-errors
      falsePositive: grouped.falsePositive,
      // Ambiguous (YELLOW)
      possible: grouped.possible,
      // Errors (GRAY) — timeouts / network failures
      errors: grouped.errors,
      byCategory,
      stats: grouped.stats,
      totalScanned: grouped.stats.total,
      totalFound: grouped.stats.confirmed,
    });
  } catch (error) {
    console.error('Maigret scan failed:', error);
    return NextResponse.json(
      { error: 'Maigret scan failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
