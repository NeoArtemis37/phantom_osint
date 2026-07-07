import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { detectTargetType } from '@/lib/osint-platforms';
import {
  parseLocale,
  buildLocalizedQuery,
  buildImageSearchArgs,
  type LocaleContext,
} from '@/lib/osint-query';
import { getRegionalPlatforms } from '@/lib/countries';

// =============================================================================
// POST /api/recon/auto
// One-click automated reconnaissance. Detects the target type and runs all
// relevant scanners in parallel:
//   - username enumeration (web search for profiles)
//   - social/keyword search
//   - deep web search
//   - reverse lookup (email/phone)
//   - image search
// Aggregates everything into a single dashboard payload.
//
// Locale-aware (Task 33-b): when a country is provided, the username
// site-target list is expanded with regional platforms (VK for RU, Weibo for
// CN, Line for JP, etc.), the social-search query is translated, and the
// image-search call passes the official `gl` parameter.
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { target, caseId, autoCreate } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!target || typeof target !== 'string' || target.trim().length < 2) {
      return NextResponse.json(
        { error: 'target is required (min 2 chars)' },
        { status: 400 }
      );
    }

    const t = target.trim();
    const detectedType = detectTargetType(t);

    // Dynamically import z-ai SDK once
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Helper: run a web search with error isolation
    async function safeSearch(query: string, num = 10) {
      try {
        const results = await zai.functions.invoke('web_search', { query, num });
        return Array.isArray(results) ? results : [];
      } catch {
        return [];
      }
    }

    // Helper: run image search with error isolation. When a locale is set we
    // pass the official `gl` parameter via buildImageSearchArgs.
    async function safeImageSearch(query: string, num = 8) {
      try {
        const args = locale.country || locale.language
          ? buildImageSearchArgs(query, locale, num)
          : { query, num };
        const result = await zai.images.search.create(args);
        const res = result as unknown as { success?: boolean; results?: Array<Record<string, unknown>> };
        if (res && res.success && Array.isArray(res.results)) {
          return res.results.map((r) => ({
            url: (r.original_url as string) || (r.url as string) || '',
            title: (r.caption as string) || (r.title as string) || '',
            source: (r.source as string) || '',
          })).filter((r: { url: string }) => r.url);
        }
        return [];
      } catch {
        return [];
      }
    }

    // Build the site-target OR clause. Always include the 7 global platforms
    // (IG, X, GitHub, Reddit, TikTok, LinkedIn, YouTube). When a country is
    // selected, ALSO include the regional platforms for that country
    // (deduplicated against the global set).
    const BASE_SITES = [
      'instagram.com',
      'x.com',
      'github.com',
      'reddit.com',
      'tiktok.com',
      'linkedin.com',
      'youtube.com',
    ];
    const regionalSites: string[] = [];
    for (const p of getRegionalPlatforms(locale.country)) {
      if (p.category === 'messaging' || p.category === 'search') continue;
      try {
        const host = new URL(p.url).hostname.replace(/^www\./, '');
        if (!BASE_SITES.includes(host) && !regionalSites.includes(host)) {
          regionalSites.push(host);
        }
      } catch {
        // skip invalid URLs
      }
    }
    const allSites = [...BASE_SITES, ...regionalSites];
    const siteOrClause = allSites.map((s) => `site:${s}`).join(' OR ');

    // ---- Build the set of parallel scanners based on detected type ----
    const scanners: Promise<[string, unknown]>[] = [];

    // Username / profile enumeration — run for username or unknown.
    // Uses buildLocalizedQuery so the keyword ("profile"/"profil"/...) is
    // translated AND the country name biases results geotarget-wise. The base
    // global sites are always passed via extraSites; regional sites are added
    // automatically by buildLocalizedQuery (via getRegionalPlatforms).
    if (detectedType === 'username' || detectedType === 'unknown') {
      const usernameQuery = locale.country || locale.language
        ? buildLocalizedQuery(`"${t}"`, locale, {
            keyword: 'profile',
            extraSites: BASE_SITES,
            includeSites: true,
          })
        : `"${t}" ${siteOrClause} profile`;
      scanners.push(
        safeSearch(usernameQuery, 15)
          .then((r) => ['username', r] as [string, unknown])
      );
    }

    // Social / keyword search — always run. Translated "social media" keyword.
    const socialQuery = locale.country || locale.language
      ? buildLocalizedQuery(`"${t}"`, locale, { keyword: 'socialMedia', includeSites: false })
      : `"${t}" social media`;
    scanners.push(
      safeSearch(socialQuery, 10)
        .then((r) => ['social', r] as [string, unknown])
    );

    // Deep web / uncensored search — always run
    scanners.push(
      safeSearch(`"${t}"`, 12)
        .then((r) => ['web', r] as [string, unknown])
    );

    // Reverse lookup — run for email or phone
    if (detectedType === 'email' || detectedType === 'phone') {
      scanners.push(
        safeSearch(`"${t}"`, 10)
          .then((r) => ['reverse', r] as [string, unknown])
      );
    }

    // Image search — always run (find related images / profile pics)
    scanners.push(
      safeImageSearch(`"${t}"`, 8)
        .then((r) => ['images', r] as [string, unknown])
    );

    // ---- Run all scanners in parallel ----
    const settled = await Promise.allSettled(scanners);
    const results: Record<string, unknown[]> = {
      username: [],
      social: [],
      web: [],
      reverse: [],
      images: [],
    };

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const [key, value] = s.value;
        if (Array.isArray(value)) {
          results[key] = value;
        }
      }
    }

    // ---- Normalize the raw results into clean shapes ----
    const normalizeSearch = (arr: unknown[]) =>
      arr
        .map((r) => {
          const item = r as { title?: string; url?: string; snippet?: string; source?: string };
          return {
            title: item.title || '',
            url: item.url || '',
            snippet: item.snippet || '',
            source: item.source || new URL(item.url || 'https://unknown').hostname.replace(/^www\./, ''),
          };
        })
        .filter((r) => r.url);

    const normalizeImages = (arr: unknown[]) =>
      arr
        .map((r) => {
          const item = r as { url?: string; thumbnail?: string; title?: string; source?: string; width?: number; height?: number };
          return {
            url: item.url || item.thumbnail || '',
            title: item.title || '',
            source: item.source || '',
            width: item.width,
            height: item.height,
          };
        })
        .filter((r) => r.url);

    // Tag username results with a detected platform. Includes regional
    // platforms (VK, Weibo, etc.) so results from those platforms aren't
    // labelled 'Unknown' when a country is selected.
    const detectPlatform = (url: string): string => {
      const u = url.toLowerCase();
      if (u.includes('twitter.com') || u.includes('x.com')) return 'Twitter/X';
      if (u.includes('instagram.com')) return 'Instagram';
      if (u.includes('github.com')) return 'GitHub';
      if (u.includes('reddit.com')) return 'Reddit';
      if (u.includes('tiktok.com')) return 'TikTok';
      if (u.includes('facebook.com')) return 'Facebook';
      if (u.includes('linkedin.com')) return 'LinkedIn';
      if (u.includes('youtube.com')) return 'YouTube';
      if (u.includes('pinterest.com')) return 'Pinterest';
      if (u.includes('twitch.tv')) return 'Twitch';
      if (u.includes('steamcommunity.com')) return 'Steam';
      // ── Regional platforms (matched when the URL host is in our regional
      // site list) ──
      for (const p of getRegionalPlatforms(locale.country)) {
        try {
          const host = new URL(p.url).hostname.replace(/^www\./, '').toLowerCase();
          if (u.includes(host)) return p.name;
        } catch {
          // skip invalid URLs
        }
      }
      return 'Unknown';
    };

    const usernameResults = normalizeSearch(results.username).map((r) => ({
      ...r,
      platform: detectPlatform(r.url),
      confidence: r.url.toLowerCase().includes(t.toLowerCase()) ? 88 : 65,
    }));

    const socialResults = normalizeSearch(results.social);
    const webResults = normalizeSearch(results.web);
    const reverseResults = normalizeSearch(results.reverse);
    const imageResults = normalizeImages(results.images);

    // ---- Optionally auto-create entities in the case ----
    let entityIds: string[] = [];
    if (autoCreate && caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        const toCreate: Array<{ name: string; type: string; value: string }> = [];
        // Dedupe by URL
        const seen = new Set<string>();
        for (const u of usernameResults) {
          if (u.url && !seen.has(u.url)) {
            seen.add(u.url);
            toCreate.push({ name: `${t}@${u.platform}`, type: 'username', value: u.url });
          }
        }
        for (const w of webResults.slice(0, 5)) {
          if (w.url && !seen.has(w.url)) {
            seen.add(w.url);
            toCreate.push({ name: w.title.slice(0, 60) || w.url, type: 'url', value: w.url });
          }
        }
        for (const img of imageResults.slice(0, 3)) {
          if (img.url && !seen.has(img.url)) {
            seen.add(img.url);
            toCreate.push({ name: img.title || `Image: ${t}`, type: 'image', value: img.url });
          }
        }
        for (const e of toCreate) {
          try {
            const ent = await db.entity.create({
              data: {
                caseId,
                name: e.name,
                type: e.type as never,
                value: e.value,
                confidence: 70,
              },
            });
            entityIds.push(ent.id);
          } catch {
            // skip duplicates / errors
          }
        }
      }
    }

    // ---- Timeline + audit ----
    if (caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Auto Recon: ${t}`,
            description: `Automated reconnaissance on "${t}" (${detectedType}). Found ${usernameResults.length} profiles, ${socialResults.length} social, ${webResults.length} web, ${imageResults.length} images.${locale.country ? ` Locale: ${locale.country} (+${regionalSites.length} regional sites).` : ''}${autoCreate ? ` Auto-created ${entityIds.length} entities.` : ''}`,
            eventType: 'action',
            metadata: JSON.stringify({
              target: t,
              detectedType,
              username: usernameResults.length,
              social: socialResults.length,
              web: webResults.length,
              images: imageResults.length,
              entitiesCreated: entityIds.length,
              country: locale.country ?? null,
              regionalSites: regionalSites.length,
            }),
          },
        });
      }
    }

    await createAuditLog('recon_auto', 'AutoRecon', {
      target: t,
      detectedType,
      caseId: caseId || null,
      totalFound: usernameResults.length + socialResults.length + webResults.length + imageResults.length,
      entitiesCreated: entityIds.length,
      userId: payload.id,
      country: locale.country ?? null,
      regionalSites: regionalSites.length,
    }).catch(() => {});

    return NextResponse.json({
      target: t,
      detectedType,
      results: {
        username: usernameResults,
        social: socialResults,
        web: webResults,
        reverse: reverseResults,
        images: imageResults,
      },
      summary: {
        totalFound:
          usernameResults.length +
          socialResults.length +
          webResults.length +
          reverseResults.length +
          imageResults.length,
        sourcesScanned: 5,
        entitiesCreated: entityIds.length,
      },
      entityIds,
    });
  } catch (error) {
    console.error('Auto recon failed:', error);
    return NextResponse.json(
      { error: 'Auto recon failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
