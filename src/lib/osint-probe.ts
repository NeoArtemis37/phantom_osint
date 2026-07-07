// =============================================================================
// OSINT Probe Engine — real HTTP verification (maigret --all --print-errors style)
// =============================================================================
// Instead of relying on web_search (unreliable + causes 429 rate-limit storms),
// this engine makes REAL HTTP requests to each platform's candidate profile URL
// and classifies the response exactly like the maigret CLI does:
//
//   - CONFIRMED  (green)  : HTTP 200, final URL still contains the username,
//                           no "not found" markers in the body.
//   - FALSE_POS  (red)    : HTTP 404, OR redirected away from the profile URL
//                           (login page / homepage / "page not found" redirect),
//                           OR body contains the platform's known error message.
//   - POSSIBLE   (yellow) : HTTP 200 but we couldn't strongly confirm (e.g. a
//                           generic landing page). Shown but flagged uncertain.
//   - ERROR      (gray)   : timeout, DNS failure, network error, CORS-blocked
//                           (server-side we don't have CORS issues, but some
//                           platforms block non-browser user-agents).
//
// Throttling: max `concurrency` requests in flight at once (default 12) to be a
// good citizen + avoid getting IP-banned. Per-request timeout (default 6s).
//
// Author: artemis37
// =============================================================================

export type ProbeStatus = 'confirmed' | 'false_positive' | 'possible' | 'error';

export interface ProbeTarget {
  platform: string;
  category: string;
  url: string;
  /** Expected username substring that MUST remain in the final URL for "confirmed" */
  username: string;
  /** Optional: known "not found" markers in the response body (sherlock errorMsg) */
  notFoundMarkers?: string[];
  /** Optional: URLs that indicate a redirect-away (login/homepage) */
  redirectAwayPatterns?: string[];
}

export interface ProbeResult {
  platform: string;
  category: string;
  url: string;
  status: ProbeStatus;
  httpStatus: number;
  finalUrl: string;
  confidence: number;        // 0-100
  reason: string;            // human-readable classification reason
  responseTimeMs?: number;
}

export interface ProbeOptions {
  concurrency?: number;      // max concurrent requests (default 12)
  timeoutMs?: number;        // per-request timeout (default 6000)
  maxTargets?: number;       // cap total targets probed (default 60)
  followRedirects?: boolean; // default true (we need the final URL to detect redirect-away)
}

// Common "not found" / "page not found" body markers across many platforms
const GENERIC_NOT_FOUND_MARKERS = [
  'page not found',
  'not found',
  "doesn't exist",
  'does not exist',
  'no longer available',
  'has been removed',
  'user not found',
  'account not found',
  'profile not found',
  'sorry, this page',
  'sorry, this content',
  'the page you requested',
  'unavailable',
  'suspended',
  'account suspended',
];

// Platforms whose 200 responses still mean "not found" only when specific markers
// appear (we keep this conservative — many platforms return 200 for everything).
const PLATFORM_NOT_FOUND_MARKERS: Record<string, string[]> = {
  'instagram.com': ['sorry, this page', 'page not found', 'content not found'],
  'facebook.com': ['this page isn\'t available', 'page not found', 'link may be broken'],
  'tiktok.com': ['couldn\'t find this account', 'page not available', 'no videos yet'],
  'twitter.com': ['this account doesn\'t exist', 'account suspended'],
  'x.com': ['this account doesn\'t exist', 'account suspended'],
  'reddit.com': ['nobody go by that name', 'page not found', 'sorry, nobody on reddit'],
  'pinterest.com': ['whoops, we couldn\'t find that page', 'page not found'],
  'tumblr.com': ['nothing found', 'there\'s nothing here'],
  'github.com': ['not found', 'page not found'],
  'vk.com': ['user not found', 'page not found', 'profile not found'],
};

// Redirect-away URL patterns — if the final URL matches any of these, the profile
// does NOT exist (platform redirected to login/homepage/search).
const REDIRECT_AWAY_PATTERNS = [
  '/login',
  '/signin',
  '/auth',
  '/signup',
  '/register',
  '/home',
  '/search',
  '/explore',
  '/404',
  '/error',
  '/disabled',
  '/suspended',
];

/**
 * Run a throttled batch of HTTP probes against candidate profile URLs.
 * Returns one ProbeResult per target, classified by status.
 */
export async function probePlatforms(
  targets: ProbeTarget[],
  options: ProbeOptions = {}
): Promise<ProbeResult[]> {
  const {
    concurrency = 12,
    timeoutMs = 6000,
    maxTargets = 60,
    followRedirects = true,
  } = options;

  // Cap + deduplicate by URL
  const seen = new Set<string>();
  const queued = targets
    .filter((t) => {
      if (seen.has(t.url)) return false;
      seen.add(t.url);
      return true;
    })
    .slice(0, maxTargets);

  const results: ProbeResult[] = new Array(queued.length);
  let cursor = 0;

  async function worker() {
    while (cursor < queued.length) {
      const idx = cursor++;
      const target = queued[idx];
      results[idx] = await probeOne(target, { timeoutMs, followRedirects });
    }
  }

  // Spawn `concurrency` workers
  const workers = Array.from({ length: Math.min(concurrency, queued.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Probe a single platform URL and classify the result.
 */
async function probeOne(
  target: ProbeTarget,
  { timeoutMs, followRedirects }: { timeoutMs: number; followRedirects: boolean }
): Promise<ProbeResult> {
  const start = Date.now();
  const lowerUser = target.username.toLowerCase();

  // Per-platform not-found markers (merge generic + platform-specific)
  const host = hostname(target.url);
  const platformMarkers = PLATFORM_NOT_FOUND_MARKERS[host] || [];
  const notFoundMarkers = [
    ...(target.notFoundMarkers || []),
    ...platformMarkers,
    ...GENERIC_NOT_FOUND_MARKERS,
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(target.url, {
      method: 'GET',
      redirect: followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
      headers: {
        // Realistic browser UA — many platforms block default Node fetch UA
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'DNT': '1',
      },
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const finalUrl = res.url || target.url;
    const httpStatus = res.status;

    // --- Classification logic (mirrors maigret --print-errors) ---

    // 1. HTTP 404 / 410 → definitely not found
    if (httpStatus === 404 || httpStatus === 410) {
      return {
        platform: target.platform,
        category: target.category,
        url: target.url,
        status: 'false_positive',
        httpStatus,
        finalUrl,
        confidence: 95,
        reason: `HTTP ${httpStatus} — profile does not exist`,
        responseTimeMs,
      };
    }

    // 2. 401/403 → could be a private/protected profile — treat as possible
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        platform: target.platform,
        category: target.category,
        url: target.url,
        status: 'possible',
        httpStatus,
        finalUrl,
        confidence: 55,
        reason: `HTTP ${httpStatus} — profile may exist but is private/protected`,
        responseTimeMs,
      };
    }

    // 3. Redirect-away detection — final URL no longer contains the username,
    //    OR final URL matches a redirect-away pattern (login/homepage/etc.)
    const finalUrlLower = finalUrl.toLowerCase();
    const redirectedAway =
      !finalUrlLower.includes(lowerUser) ||
      REDIRECT_AWAY_PATTERNS.some((p) => finalUrlLower.includes(p)) ||
      (target.redirectAwayPatterns || []).some((p) => finalUrlLower.includes(p.toLowerCase()));

    if (redirectedAway && finalUrl !== target.url) {
      return {
        platform: target.platform,
        category: target.category,
        url: target.url,
        status: 'false_positive',
        httpStatus,
        finalUrl,
        confidence: 85,
        reason: `Redirected to ${finalUrl} — profile does not exist`,
        responseTimeMs,
      };
    }

    // 4. For 200 responses, read the body and check for "not found" markers
    if (httpStatus >= 200 && httpStatus < 400) {
      let body = '';
      try {
        // Read up to 200KB of the body for marker scanning (perf safeguard)
        const text = await res.text();
        body = text.slice(0, 200_000).toLowerCase();
      } catch {
        // If body read fails, skip marker check
      }

      // Check not-found markers
      const matchedMarker = notFoundMarkers.find((m) => body.includes(m.toLowerCase()));
      if (matchedMarker) {
        return {
          platform: target.platform,
          category: target.category,
          url: target.url,
          status: 'false_positive',
          httpStatus,
          finalUrl,
          confidence: 88,
          reason: `Body contains "${matchedMarker}" — false positive`,
          responseTimeMs,
        };
      }

      // 5. CONFIRMED — 200, final URL still has username, no error markers
      //    Strong confidence if the username appears in the body too.
      const usernameInBody = body.includes(lowerUser);
      const confidence = usernameInBody ? 95 : 80;
      return {
        platform: target.platform,
        category: target.category,
        url: target.url,
        status: 'confirmed',
        httpStatus,
        finalUrl,
        confidence,
        reason: usernameInBody
          ? 'HTTP 200 + username found in page body — confirmed'
          : 'HTTP 200 + no error markers — likely exists',
        responseTimeMs,
      };
    }

    // 6. Any other status (5xx, etc.) → error
    return {
      platform: target.platform,
      category: target.category,
      url: target.url,
      status: 'error',
      httpStatus,
      finalUrl,
      confidence: 0,
      reason: `HTTP ${httpStatus} — unexpected status`,
      responseTimeMs,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      platform: target.platform,
      category: target.category,
      url: target.url,
      status: 'error',
      httpStatus: 0,
      finalUrl: target.url,
      confidence: 0,
      reason: isTimeout ? `Timeout after ${timeoutMs}ms` : 'Network error / blocked',
      responseTimeMs,
    };
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Group probe results by status for the UI.
 * Returns counts + the actual result arrays.
 */
export function groupProbeResults(results: ProbeResult[]) {
  const confirmed = results.filter((r) => r.status === 'confirmed');
  const falsePositive = results.filter((r) => r.status === 'false_positive');
  const possible = results.filter((r) => r.status === 'possible');
  const errors = results.filter((r) => r.status === 'error');

  // By-category grouping for confirmed (green) — the ones the investigator cares about most
  const byCategory: Record<string, ProbeResult[]> = {};
  for (const r of confirmed) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  return {
    confirmed,
    falsePositive,
    possible,
    errors,
    byCategory,
    stats: {
      total: results.length,
      confirmed: confirmed.length,
      falsePositive: falsePositive.length,
      possible: possible.length,
      errors: errors.length,
    },
  };
}
