// =============================================================================
// PHANTOM — OSINT Query Localization Helpers
// =============================================================================
// The z-ai-web-dev-sdk `web_search` function accepts only {query, num,
// recency_days} — it has NO country/language parameter. To achieve global
// coverage we localize at the QUERY level: we append the country name,
// translated keywords, and regional platform site-targets to the query
// string itself. This works regardless of the underlying search backend.
//
// For `images.search.create` the SDK DOES support a `gl` (Google region)
// parameter — we pass that through directly.
//
// All /api/osint/* and /api/search/* routes use these helpers so that a
// single `country` parameter from the client produces fully-localized
// searches across every tool.
// =============================================================================

import {
  getCountry,
  getKeywords,
  getRegionalPlatforms,
  type QueryKeywords,
} from "@/lib/countries";

// ---------------------------------------------------------------------------
// Locale context (parsed from the request body or query string)
// ---------------------------------------------------------------------------
export interface LocaleContext {
  /** ISO 3166-1 alpha-2 country code (e.g. "FR", "JP", "BR") */
  country?: string;
  /** ISO 639-1 language override (if not set, derived from country) */
  language?: string;
  /** Whether to restrict searches to regional platforms only (narrower) */
  regionalOnly?: boolean;
}

/** Parse a locale context from a Request body or URL search params */
export function parseLocale(
  input: Record<string, unknown> | URLSearchParams | null | undefined
): LocaleContext {
  if (!input) return {};
  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) {
      const v = input.get(key);
      return v ?? undefined;
    }
    const v = (input as Record<string, unknown>)[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    country: get("country") ?? get("countryCode"),
    language: get("language") ?? get("lang") ?? get("hl"),
    regionalOnly: get("regionalOnly") === "true" || get("regionalOnly") === "1",
  };
}

// ---------------------------------------------------------------------------
// Query builder — produces a localized query string for web_search
// ---------------------------------------------------------------------------

/**
 * Build a localized OSINT search query.
 *
 * Example: buildQuery("john smith", { country: "FR" })
 * → "john smith profil France site:facebook.com OR site:linkedin.com OR site:viadeo.com"
 *
 * @param baseQuery  The core search term (username, email, person name, etc.)
 * @param locale     Locale context (country, language, regionalOnly)
 * @param opts       Keyword to append (e.g. "profile", "photos") and site-targets
 */
export function buildLocalizedQuery(
  baseQuery: string,
  locale: LocaleContext = {},
  opts: {
    /** Which i18n keyword to append (e.g. "profile", "socialMedia", "photos") */
    keyword?: keyof QueryKeywords;
    /** Extra site: targets to OR-chain (in addition to regional platforms) */
    extraSites?: string[];
    /** Whether to include the country name in the query (default true) */
    includeCountry?: boolean;
    /** Whether to include regional platform site-targets (default true) */
    includeSites?: boolean;
    /** Extra raw terms to append */
    extraTerms?: string[];
  } = {}
): string {
  const { keyword, extraSites = [], includeCountry = true, includeSites = true, extraTerms = [] } = opts;
  const country = getCountry(locale.country);
  const lang = locale.language ?? country.languages[0] ?? "en";
  const kw = getKeywords(lang);
  const regional = getRegionalPlatforms(locale.country);

  const parts: string[] = [baseQuery.trim()];

  // 1. Translated keyword (e.g. "profil", "perfil", "プロフィール")
  if (keyword && kw[keyword]) {
    parts.push(kw[keyword]);
  }

  // 2. Country name (helps the search engine geotarget results)
  if (includeCountry && locale.country) {
    parts.push(country.name);
  }

  // 3. Regional platform site-targets (OR-chained)
  if (includeSites) {
    const sites: string[] = [];
    for (const p of regional) {
      // Only site-target platforms that have a real domain (skip messaging apps)
      if (p.category === "messaging" || p.category === "search") continue;
      try {
        const host = new URL(p.url).hostname;
        sites.push(`site:${host}`);
      } catch {
        // skip invalid URLs
      }
    }
    for (const s of extraSites) sites.push(`site:${s}`);
    if (sites.length > 0) {
      parts.push(`(${sites.join(" OR ")})`);
    }
  }

  // 4. Extra raw terms
  if (extraTerms.length > 0) {
    parts.push(...extraTerms);
  }

  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Image search args — passes the `gl` param (officially supported by SDK)
// ---------------------------------------------------------------------------
export interface LocalizedImageSearchArgs {
  query: string;
  count?: number;
  gl?: string;
  rank?: boolean;
}

/**
 * Build args for zai.images.search.create() with country localization.
 * The SDK's CreateImageSearchBody supports `gl` (Google region code).
 */
export function buildImageSearchArgs(
  baseQuery: string,
  locale: LocaleContext = {},
  count = 12
): LocalizedImageSearchArgs {
  const country = getCountry(locale.country);
  const lang = locale.language ?? country.languages[0] ?? "en";
  const kw = getKeywords(lang);

  // Append country name + translated "photos" keyword for better localization
  const parts = [baseQuery.trim()];
  if (locale.country) parts.push(country.name);
  parts.push(kw.photos);

  return {
    query: parts.filter(Boolean).join(" "),
    count,
    gl: country.gl,
    rank: true,
  };
}

// ---------------------------------------------------------------------------
// Multi-query fan-out — generates several localized variants for broader coverage
// ---------------------------------------------------------------------------

export interface QueryVariant {
  label: string;
  query: string;
}

/**
 * Generate a set of localized query variants for a single target.
 * Used by OSINT routes that fan out multiple searches in parallel.
 *
 * @param target   The person/username/email/phone being searched
 * @param locale   Locale context
 * @returns Array of labeled query variants
 */
export function buildQueryVariants(
  target: string,
  locale: LocaleContext = {}
): QueryVariant[] {
  const country = getCountry(locale.country);
  const lang = locale.language ?? country.languages[0] ?? "en";
  const kw = getKeywords(lang);
  const regional = getRegionalPlatforms(locale.country);
  const variants: QueryVariant[] = [];

  // Variant 1: broad social-media profile search (translated keyword + country)
  variants.push({
    label: "social_profiles",
    query: buildLocalizedQuery(target, locale, { keyword: "profile" }),
  });

  // Variant 2: photos / images
  variants.push({
    label: "photos",
    query: buildLocalizedQuery(target, locale, { keyword: "photos", includeSites: false }),
  });

  // Variant 3: news mentions
  variants.push({
    label: "news",
    query: buildLocalizedQuery(target, locale, { keyword: "news", includeSites: false }),
  });

  // Variant 4: forum / community mentions
  variants.push({
    label: "forum",
    query: buildLocalizedQuery(target, locale, { keyword: "forum", includeSites: false }),
  });

  // Variant 5: leak / breach databases
  variants.push({
    label: "leaks",
    query: buildLocalizedQuery(target, locale, { keyword: "leak", includeSites: false }),
  });

  // Variant 6: per-regional-platform targeted (only if country has regional platforms)
  if (regional.length > 0 && !locale.regionalOnly) {
    for (const p of regional) {
      if (p.category === "messaging" || p.category === "search") continue;
      try {
        const host = new URL(p.url).hostname;
        variants.push({
          label: `platform_${p.key}`,
          query: `${target} ${kw.profile} site:${host}`,
        });
      } catch {
        // skip
      }
    }
  }

  // If regionalOnly is set, return ONLY the per-platform variants
  if (locale.regionalOnly) {
    return variants.filter((v) => v.label.startsWith("platform_"));
  }

  return variants;
}

// ---------------------------------------------------------------------------
// Cache key helper — include locale in cache keys to avoid cross-contamination
// ---------------------------------------------------------------------------
export function localeCacheKey(prefix: string, target: string, locale: LocaleContext = {}): string {
  const c = locale.country ?? "global";
  const l = locale.language ?? "auto";
  const r = locale.regionalOnly ? "regional" : "all";
  return `${prefix}:${target}:${c}:${l}:${r}`;
}

// ---------------------------------------------------------------------------
// Wikipedia URL builder — uses the country's Wikipedia language edition
// ---------------------------------------------------------------------------
export function buildWikipediaUrl(article: string, locale: LocaleContext = {}): string {
  const country = getCountry(locale.country);
  const lang = locale.language ?? country.wikiLang ?? "en";
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(article.replace(/\s+/g, "_"))}`;
}
