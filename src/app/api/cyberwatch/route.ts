import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  localeCacheKey,
  type LocaleContext,
} from '@/lib/osint-query';
import { getCertSources, type CertSource } from '@/lib/countries';
import { parallelWebSearch } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/cyberwatch
// "Veilles Cyber" — Cyber Threat Intelligence watch feed.
//
// Fetches the latest cyber-threat intelligence from multiple open sources via
// z-ai-web-dev-sdk web_search, then categorises each item by threat category
// (Ransomware, APT, ZeroDay, Breach, Phishing, Vulnerability, Geopolitics,
//  Malware, SocialPlatform — incl. dedicated TikTok threat monitoring).
//
// Each item carries an attribution header:
//   author: "artemis37"
//   tool:   "PHANTOM CyberWatch"
//
// Returns a structured feed the frontend renders with protected code blocks
// for IOCs (hashes / IPs / CVEs / domains / URLs / TikTok handles & hashtags).
// =============================================================================

export const AUTHOR = 'artemis37';
export const TOOL = 'PHANTOM CyberWatch';

type ThreatCategory =
  | 'Ransomware'
  | 'APT'
  | 'ZeroDay'
  | 'DataBreach'
  | 'Phishing'
  | 'Vulnerability'
  | 'Geopolitics'
  | 'Malware'
  | 'SocialPlatform';

interface CyberWatchItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: ThreatCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  publishedAt: string | null;
  iocs: {
    cves: string[];
    hashes: string[];
    ips: string[];
    domains: string[];
    urls: string[];
    // TikTok / social-platform specific IOCs
    handles: string[];   // @username mentions
    hashtags: string[];  // #hashtag campaign tags
    videos: string[];    // tiktok.com/@user/video/<id> URLs
  };
  tags: string[];
}

// Feed sources — each query maps to a category.
// The TikTok block below is the dedicated "TikTok Watch" — it tracks the
// full spectrum of TikTok-borne cyber threats: stealer malware lures, fake
// TikTok apps, account-takeover scams, deepfake disinformation, geopolitical
// espionage concerns, vulnerability disclosures, crypto-fraud campaigns, and
// info-stealer distribution via TikTok direct messages.
const FEED_QUERIES: Array<{ query: string; category: ThreatCategory; severity: CyberWatchItem['severity'] }> = [
  // ── Classic cyber-threat categories ──
  { query: 'ransomware attack victim 2025 leak site', category: 'Ransomware', severity: 'critical' },
  { query: 'APT advanced persistent threat campaign 2025', category: 'APT', severity: 'high' },
  { query: 'zero-day vulnerability disclosure 2025 CVE', category: 'ZeroDay', severity: 'critical' },
  { query: 'data breach leak database 2025 exposed', category: 'DataBreach', severity: 'high' },
  { query: 'phishing campaign kit 2025 credential theft', category: 'Phishing', severity: 'medium' },
  { query: 'critical vulnerability patch CVE 2025 advisory', category: 'Vulnerability', severity: 'high' },
  { query: 'cyber geopolitics nation-state attribution 2025', category: 'Geopolitics', severity: 'medium' },
  { query: 'new malware strain loader stealer 2025', category: 'Malware', severity: 'high' },

  // ── TikTok Watch — dedicated social-platform threat monitoring ──
  // Stealer malware (e.g. Vidar, Raccoon, RedLine) lures hosted on fake
  // "TikTok video downloader" / "TikTok coins generator" landing pages.
  { query: 'TikTok stealer malware fake downloader 2025 campaign', category: 'SocialPlatform', severity: 'high' },
  // Fake TikTok Android apps / trojanised mods distributing banking trojans.
  { query: 'fake TikTok app Android trojan banking 2025', category: 'SocialPlatform', severity: 'critical' },
  // Account-takeover (ATO) scams — credential phishing kits impersonating
  // "TikTok verification" / "TikTok for Business" login pages.
  { query: 'TikTok account takeover phishing verification scam 2025', category: 'SocialPlatform', severity: 'high' },
  // Deepfake / AI-generated disinformation campaigns spreading via TikTok.
  { query: 'TikTok deepfake disinformation campaign 2025', category: 'SocialPlatform', severity: 'high' },
  // Geopolitical / data-privacy dimension — espionage concerns, bans,
  // regulator actions (a recurring CTI theme for OSINT investigators).
  { query: 'TikTok data privacy espionage regulator ban 2025', category: 'SocialPlatform', severity: 'medium' },
  // TikTok platform vulnerabilities & responsible-disclosure advisories.
  { query: 'TikTok vulnerability CVE security advisory 2025', category: 'SocialPlatform', severity: 'high' },
  // Pig-butchering / crypto-fraud campaigns recruiting via TikTok DMs.
  { query: 'TikTok crypto scam pig butchering fraud 2025', category: 'SocialPlatform', severity: 'medium' },
  // Info-stealer distribution via malicious links in TikTok comments / DMs.
  { query: 'TikTok malicious link DM comment info stealer 2025', category: 'SocialPlatform', severity: 'high' },
];

// IOC extractors — used to populate the protected code-block payload
const CVE_RE = /CVE-\d{4}-\d{4,7}/gi;
const SHA256_RE = /\b[a-fA-F0-9]{64}\b/g;
const SHA1_RE = /\b[a-fA-F0-9]{40}\b/g;
const MD5_RE = /\b[a-fA-F0-9]{32}\b/g;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ru|cn|ir|kp|info|biz|co|xyz|top|site|online|me)\b/gi;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

// TikTok / social-platform specific IOC patterns
const TIKTOK_VIDEO_RE = /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/\w+|\w+)\b[^\s<>"']*/gi;
const HANDLE_RE = /(?:^|\s)@([A-Za-z0-9_.]{2,30})\b/g;
const HASHTAG_RE = /(?:^|\s)#([A-Za-z0-9_\u00C0-\u017F]{2,60})\b/g;

function extractIocs(text: string, sourceUrl: string): CyberWatchItem['iocs'] {
  // Combine the snippet text with the source URL so we also catch IOCs
  // mentioned in the article URL path (e.g. /CVE-2025-1234/, /ip/1.2.3.4/).
  const combined = `${text}\n${sourceUrl}`;
  const cves = Array.from(new Set((combined.match(CVE_RE) || [])));
  const hashes = Array.from(new Set([
    ...(combined.match(SHA256_RE) || []),
    ...(combined.match(SHA1_RE) || []),
    ...(combined.match(MD5_RE) || []),
  ]));
  const ips = Array.from(new Set((combined.match(IPV4_RE) || []))).filter(
    (ip) => !ip.endsWith('.0.0.0') && !ip.startsWith('0.0.0.0') && !ip.startsWith('127.') && !ip.startsWith('0.')
  );
  const urls = Array.from(new Set((combined.match(URL_RE) || [])));
  // Always include the source URL itself as a tracked URL IOC
  if (sourceUrl && !urls.includes(sourceUrl)) urls.push(sourceUrl);

  // Extract the source domain as a tracked domain IOC
  const sourceDomain = sourceFromUrl(sourceUrl);
  const domains = Array.from(new Set((combined.match(DOMAIN_RE) || [])))
    .filter((d) => !d.startsWith('example.'));
  if (sourceDomain && sourceDomain !== 'unknown' && !domains.includes(sourceDomain)) {
    domains.push(sourceDomain);
  }

  // ── TikTok / social IOCs ──
  // Capture TikTok video URLs (incl. short vm./vt. links) separately so the
  // analyst can pivot straight to the offending post.
  const videos = Array.from(new Set(
    (combined.match(TIKTOK_VIDEO_RE) || []).map((u) => u.trim())
  ));
  // @handles — require a leading whitespace or string start so we don't grab
  // the local part of email addresses. Store WITH the @ for verbatim display.
  const handleMatches = Array.from(combined.matchAll(HANDLE_RE));
  const handles = Array.from(new Set(
    handleMatches.map((m) => `@${m[1]}`)
      .filter((h) => !h.endsWith('.com') && !h.endsWith('.net') && !h.endsWith('.org'))
  ));
  // #hashtags — campaign tags (e.g. #TikTokScam, #FreeCoins, #CryptoGiveaway)
  const hashtagMatches = Array.from(combined.matchAll(HASHTAG_RE));
  const hashtags = Array.from(new Set(
    hashtagMatches.map((m) => `#${m[1]}`)
  ));

  return { cves, hashes, ips, domains, urls, handles, hashtags, videos };
}

function inferSeverity(title: string, snippet: string, base: CyberWatchItem['severity']): CyberWatchItem['severity'] {
  const t = (title + ' ' + snippet).toLowerCase();
  if (/critical|actively exploited|in the wild|emergency|patch now|0-day|zero.?day/.test(t)) return 'critical';
  if (/high|severe|urgent|major breach|millions of/.test(t)) return 'high';
  if (/medium|moderate|limited/.test(t)) return 'medium';
  return base;
}

function sourceFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

// Simple in-memory cache (5 min TTL) so we don't hammer the search API.
// Per-locale caching (GAP-12): a Map keyed by locale so refreshing for FR
// doesn't wipe the global/US feed and vice-versa.
const cache = new Map<string, { ts: number; data: CyberWatchItem[] }>();
const CACHE_TTL = 5 * 60 * 1000;

// Regional CTI topic keywords used to expand each CERT source's query
// templates. These are paired with the CERT's site-targeted queries (e.g.,
// `site:ssi.gouv.fr ransomware`, `ANSSI data breach`) to surface regionally
// scoped advisories alongside the global feed.
const REGIONAL_CTI_TOPICS = [
  'ransomware',
  'vulnerability CVE',
  'data breach',
  'phishing',
  'malware',
];

/**
 * Build the additional per-CERT regional queries for the selected country.
 * Each CERT in `getCertSources(country)` contributes one query per template ×
 * topic. Returns [] when no country is selected (backward compatible).
 */
function buildRegionalCertQueries(
  certSources: CertSource[]
): Array<{ query: string; category: ThreatCategory; severity: CyberWatchItem['severity'] }> {
  const out: Array<{ query: string; category: ThreatCategory; severity: CyberWatchItem['severity'] }> = [];
  for (const cert of certSources) {
    for (const template of cert.queries) {
      for (const topic of REGIONAL_CTI_TOPICS) {
        if (!template.includes('{topic}')) {
          // Static query (no {topic} placeholder) — use as-is, once.
          out.push({ query: template, category: 'Geopolitics', severity: 'medium' });
          break;
        }
        out.push({ query: template.replace(/\{topic\}/g, topic), category: 'Vulnerability', severity: 'high' });
      }
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { refresh } = body as { refresh?: boolean };
    const locale: LocaleContext = parseLocale(body);

    const cacheKey = localeCacheKey('cyberwatch', 'feed', locale);

    // Return cache if fresh
    if (!refresh) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({
          author: AUTHOR,
          tool: TOOL,
          cached: true,
          generatedAt: new Date(cached.ts).toISOString(),
          totalItems: cached.data.length,
          items: cached.data,
        });
      }
    }

    // Build the regional CERT queries for the selected country (empty when no
    // country is set — preserves the legacy 16-query behaviour).
    const regionalQueries = locale.country
      ? buildRegionalCertQueries(getCertSources(locale.country))
      : [];
    const allQueries = [...FEED_QUERIES, ...regionalQueries];

    // Run all feed queries via the rate-limited parallel invoker (prevents 429 storms)
    const settled = await parallelWebSearch(
      allQueries.map((q) => ({ query: q.query, num: 6, tag: `${q.category}|${q.severity}` })),
      { cacheTtlMs: 180_000 }
    );

    const items: CyberWatchItem[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const meta = allQueries[i];

      for (const r of s.results) {
        const rr = r as { url?: string; name?: string; title?: string; snippet?: string; date?: string };
        const url: string = rr.url || '';
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const title: string = rr.name || rr.title || '';
        const snippet: string = rr.snippet || '';
        const text = `${title}\n${snippet}`;
        const iocs = extractIocs(text, url);

        const item: CyberWatchItem = {
          id: `cw_${Math.abs(hashCode(url)).toString(36)}`,
          title: title.slice(0, 200),
          summary: snippet.slice(0, 400),
          url,
          source: sourceFromUrl(url),
          category: meta.category,
          severity: inferSeverity(title, snippet, meta.severity),
          publishedAt: rr.date || null,
          iocs,
          tags: [meta.category.toLowerCase()],
        };
        items.push(item);
      }
    }

    // Sort: critical first, then by recency
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => {
      if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
      return 0;
    });

    cache.set(cacheKey, { ts: Date.now(), data: items });
    // Cap cache size — drop oldest entry when full.
    if (cache.size > 20) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    // Aggregate stats
    const stats = {
      total: items.length,
      critical: items.filter((i) => i.severity === 'critical').length,
      high: items.filter((i) => i.severity === 'high').length,
      cves: items.reduce((n, i) => n + i.iocs.cves.length, 0),
      hashes: items.reduce((n, i) => n + i.iocs.hashes.length, 0),
      ips: items.reduce((n, i) => n + i.iocs.ips.length, 0),
      domains: items.reduce((n, i) => n + i.iocs.domains.length, 0),
      // TikTok / social-platform stats
      tiktok: items.filter((i) => i.category === 'SocialPlatform').length,
      handles: items.reduce((n, i) => n + i.iocs.handles.length, 0),
      hashtags: items.reduce((n, i) => n + i.iocs.hashtags.length, 0),
      videos: items.reduce((n, i) => n + i.iocs.videos.length, 0),
    };

    await createAuditLog('cyberwatch_refresh', 'CyberWatch', {
      userId: payload.id,
      itemsFetched: items.length,
      critical: stats.critical,
      country: locale.country ?? null,
      regionalQueries: regionalQueries.length,
    }).catch(() => {});

    return NextResponse.json({
      author: AUTHOR,
      tool: TOOL,
      cached: false,
      generatedAt: new Date().toISOString(),
      totalItems: items.length,
      stats,
      items,
    });
  } catch (error) {
    console.error('CyberWatch feed failed:', error);
    return NextResponse.json(
      { error: 'CyberWatch feed failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Tiny deterministic hash for IDs
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// =============================================================================
// GET /api/cyberwatch — return the cached feed if available (no refetch)
// Returns the most recently refreshed entry across all locales.
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Pick the freshest cached entry across all locales (global feed by default).
    let freshest: { ts: number; data: CyberWatchItem[] } | null = null;
    for (const entry of cache.values()) {
      if (!freshest || entry.ts > freshest.ts) freshest = entry;
    }

    if (freshest) {
      return NextResponse.json({
        author: AUTHOR,
        tool: TOOL,
        cached: true,
        generatedAt: new Date(freshest.ts).toISOString(),
        totalItems: freshest.data.length,
        items: freshest.data,
      });
    }

    return NextResponse.json({
      author: AUTHOR,
      tool: TOOL,
      cached: false,
      totalItems: 0,
      items: [],
      message: 'No feed loaded yet. POST /api/cyberwatch to refresh.',
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
