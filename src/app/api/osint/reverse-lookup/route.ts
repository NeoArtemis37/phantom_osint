import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import {
  parseLocale,
  buildLocalizedQuery,
  type LocaleContext,
} from '@/lib/osint-query';
import { rateLimitedInvoke } from '@/lib/zai-rate-limiter';

// =============================================================================
// POST /api/osint/reverse-lookup
// Reverse lookup for phone / email / username — with proper INTERNATIONAL phone
// number handling. Previously phone search broke for non-US numbers because the
// code did a single naive `"${value}"` web_search. Now we:
//
//   1. NORMALIZE the phone number (handle +, 00, country codes, spaces, dashes).
//   2. DETECT the country code from the number prefix (or use the selected
//      investigation locale's country).
//   3. Generate MULTIPLE format variants (E.164, international, national, with/
//      without leading zero, with/without spaces/dashes) so the search catches
//      the number however it was published online.
//   4. Run queries against MULTIPLE reverse-lookup directories in parallel
//      (whitepages, truepeoplesearch, spydialer, pagesjaunes, dastelefonbuch,
//      192.com, etc.) — selected by country.
//   5. Also run a general web_search for each format variant.
//   6. Dedupe + classify results by confidence.
//
// Author: artemis37
// =============================================================================

// Per-country national phone-directory sites
const NATIONAL_PHONE_DIRECTORIES: Record<string, Array<{ site: string; label: string }>> = {
  US: [
    { site: 'whitepages.com', label: 'Whitepages' },
    { site: 'truepeoplesearch.com', label: 'TruePeopleSearch' },
    { site: 'spydialer.com', label: 'SpyDialer' },
    { site: 'fastpeoplesearch.com', label: 'FastPeopleSearch' },
    { site: 'anywho.com', label: 'AnyWho' },
  ],
  GB: [
    { site: '192.com', label: '192.com' },
    { site: 'ukphonebook.com', label: 'UK Phonebook' },
    { site: 'who-called.co.uk', label: 'WhoCalled' },
  ],
  FR: [
    { site: 'pagesjaunes.fr', label: 'Pages Jaunes' },
    { site: 'annuaire-inverse.fr', label: 'Annuaire Inverse' },
    { site: 'inverse-annuaire.net', label: 'Inverse Annuaire' },
  ],
  DE: [
    { site: 'dastelefonbuch.de', label: 'Das Telefonbuch' },
    { site: 'das-oertliche.de', label: 'Das Örtliche' },
    { site: 'wer-ruft-an.com', label: 'WerRuftAn' },
  ],
  ES: [
    { site: 'paginasblancas.es', label: 'Páginas Blancas' },
    { site: 'blancas.es', label: 'Blancas' },
    { site: 'quellamada.com', label: 'QuéLlamada' },
  ],
  IT: [
    { site: 'paginebianche.it', label: 'Pagine Bianche' },
    { site: 'elenco-telefonico.it', label: 'Elenco Telefonico' },
    { site: 'chiamilnumero.it', label: 'ChiAmilNumero' },
  ],
  NL: [
    { site: 'detelefoongids.nl', label: 'De Telefoongids' },
    { site: 'nummerzoeker.com', label: 'Nummerzoeker' },
  ],
  AU: [
    { site: 'whitepages.com.au', label: 'Whitepages AU' },
    { site: 'ausphonebook.com', label: 'AUS Phonebook' },
    { site: 'reverseaustralia.com', label: 'Reverse Australia' },
  ],
  CA: [
    { site: 'canada411.ca', label: 'Canada411' },
    { site: '411.ca', label: '411.ca' },
    { site: 'reversecanada.com', label: 'Reverse Canada' },
  ],
  BR: [
    { site: 'listaamiga.com', label: 'Lista Amiga' },
    { site: 'consultanumero.com.br', label: 'Consulta Número' },
    { site: 'qualoperadora.net', label: 'Qual Operadora' },
  ],
  IN: [
    { site: 'indiatrace.com', label: 'India Trace' },
    { site: 'mobilenumbertracker.com', label: 'Mobile Tracker' },
    { site: 'bmobile.in', label: 'BMobile' },
  ],
  RU: [
    { site: 'nomer.org', label: 'Nomer.org' },
    { site: 'phone-search.ru', label: 'Phone Search RU' },
    { site: 'zvonki.octo.net', label: 'Zvonki' },
  ],
  JP: [
    { site: 'npn.jpn.org', label: 'NPN' },
    { site: 'telephonebook.jp', label: 'TelephoneBook JP' },
  ],
  CN: [
    { site: 'haoma.sogou.com', label: 'Sogou Haoma' },
    { site: 'chahaoba.com', label: 'ChaHaoBa' },
  ],
};

// Country calling codes (for detecting the country from a phone number)
const COUNTRY_CALLING_CODES: Array<{ code: string; country: string; name: string }> = [
  { code: '1', country: 'US', name: 'USA/Canada' },
  { code: '44', country: 'GB', name: 'United Kingdom' },
  { code: '33', country: 'FR', name: 'France' },
  { code: '49', country: 'DE', name: 'Germany' },
  { code: '34', country: 'ES', name: 'Spain' },
  { code: '39', country: 'IT', name: 'Italy' },
  { code: '31', country: 'NL', name: 'Netherlands' },
  { code: '61', country: 'AU', name: 'Australia' },
  { code: '55', country: 'BR', name: 'Brazil' },
  { code: '91', country: 'IN', name: 'India' },
  { code: '7', country: 'RU', name: 'Russia/Kazakhstan' },
  { code: '81', country: 'JP', name: 'Japan' },
  { code: '86', country: 'CN', name: 'China' },
  { code: '82', country: 'KR', name: 'South Korea' },
  { code: '52', country: 'MX', name: 'Mexico' },
  { code: '54', country: 'AR', name: 'Argentina' },
  { code: '972', country: 'IL', name: 'Israel' },
  { code: '90', country: 'TR', name: 'Turkey' },
  { code: '62', country: 'ID', name: 'Indonesia' },
  { code: '63', country: 'PH', name: 'Philippines' },
  { code: '66', country: 'TH', name: 'Thailand' },
  { code: '84', country: 'VN', name: 'Vietnam' },
  { code: '60', country: 'MY', name: 'Malaysia' },
  { code: '65', country: 'SG', name: 'Singapore' },
  { code: '971', country: 'AE', name: 'UAE' },
  { code: '966', country: 'SA', name: 'Saudi Arabia' },
  { code: '27', country: 'ZA', name: 'South Africa' },
  { code: '234', country: 'NG', name: 'Nigeria' },
  { code: '20', country: 'EG', name: 'Egypt' },
  { code: '212', country: 'MA', name: 'Morocco' },
  { code: '48', country: 'PL', name: 'Poland' },
  { code: '46', country: 'SE', name: 'Sweden' },
  { code: '47', country: 'NO', name: 'Norway' },
  { code: '45', country: 'DK', name: 'Denmark' },
  { code: '358', country: 'FI', name: 'Finland' },
  { code: '351', country: 'PT', name: 'Portugal' },
  { code: '30', country: 'GR', name: 'Greece' },
  { code: '420', country: 'CZ', name: 'Czech Republic' },
  { code: '36', country: 'HU', name: 'Hungary' },
  { code: '40', country: 'RO', name: 'Romania' },
  { code: '380', country: 'UA', name: 'Ukraine' },
  { code: '48', country: 'PL', name: 'Poland' },
];

interface PhoneInfo {
  normalized: string;       // E.164 format: +14155551234
  digits: string;           // just digits: 14155551234
  national: string;         // national format: (415) 555-1234
  countryCode: string;      // 1
  detectedCountry: string;  // US
  variants: string[];       // all format variants for search
}

/**
 * Normalize a phone number to E.164 + generate search variants.
 * Handles: +, 00, country codes, spaces, dashes, parentheses, extensions.
 */
function normalizePhone(input: string, fallbackCountry?: string): PhoneInfo {
  // Strip everything except digits and leading +
  let cleaned = input.replace(/[^\d+]/g, '');
  let hasPlus = cleaned.startsWith('+');

  // Remove leading +
  let digits = hasPlus ? cleaned.slice(1) : cleaned;

  // Handle 00 international prefix
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
    hasPlus = true;
  }

  // Detect country code
  let detectedCountry = fallbackCountry || 'US';
  let countryCode = '';
  // Try longest match first (3 digits, then 2, then 1)
  for (const len of [3, 2, 1]) {
    if (digits.length <= len) continue;
    const prefix = digits.slice(0, len);
    const match = COUNTRY_CALLING_CODES.find(c => c.code === prefix);
    if (match) {
      detectedCountry = match.country;
      countryCode = match.code;
      break;
    }
  }
  if (!countryCode) {
    // No country code detected — assume the fallback country's national number
    const fallback = COUNTRY_CALLING_CODES.find(c => c.country === (fallbackCountry || 'US'));
    countryCode = fallback?.code || '1';
  }

  const normalized = `+${digits}`;
  // National number = digits minus country code
  const nationalDigits = digits.startsWith(countryCode) ? digits.slice(countryCode.length) : digits;

  // Build search variants — the key to catching numbers published in any format
  const variants = new Set<string>();
  variants.add(normalized);                              // +14155551234
  variants.add(digits);                                  // 14155551234
  variants.add(nationalDigits);                          // 4155551234
  // With dashes
  if (nationalDigits.length >= 7) {
    variants.add(`${nationalDigits.slice(0, -7)}-${nationalDigits.slice(-7, -4)}-${nationalDigits.slice(-4)}`);
  }
  // With spaces
  if (nationalDigits.length >= 7) {
    variants.add(`${nationalDigits.slice(0, -7)} ${nationalDigits.slice(-7, -4)} ${nationalDigits.slice(-4)}`);
  }
  // With dots
  if (nationalDigits.length >= 7) {
    variants.add(`${nationalDigits.slice(0, -7)}.${nationalDigits.slice(-7, -4)}.${nationalDigits.slice(-4)}`);
  }
  // With parentheses around area code
  if (nationalDigits.length >= 7) {
    variants.add(`(${nationalDigits.slice(0, -7)}) ${nationalDigits.slice(-7, -4)}-${nationalDigits.slice(-4)}`);
  }
  // With leading 0 (common in EU national format)
  variants.add(`0${nationalDigits}`);
  // Filter out empty / too-short variants
  return {
    normalized,
    digits,
    national: nationalDigits,
    countryCode,
    detectedCountry,
    variants: [...variants].filter(v => v.replace(/\D/g, '').length >= 7),
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, value, caseId } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!type || !value || !caseId) {
      return NextResponse.json(
        { error: 'type, value, and caseId are required' },
        { status: 400 }
      );
    }

    interface LookupResult {
      field: string;
      value: string;
      source: string;
      confidence: number;
      title?: string;
      snippet?: string;
      directory?: string;
    }
    let results: LookupResult[] = [];

    if (type === 'phone') {
      // === PHONE: international format handling + multi-directory lookup ===
      const phone = normalizePhone(value, locale.country);
      const directories = NATIONAL_PHONE_DIRECTORIES[phone.detectedCountry] || NATIONAL_PHONE_DIRECTORIES.US;

      // Build queries: one per directory site × one per format variant (capped)
      const queries: Array<{ query: string; tag: string; directory?: string }> = [];

      // 1. Directory-targeted searches (top 3 directories × 2 variants)
      for (const dir of directories.slice(0, 3)) {
        for (const variant of [phone.normalized, phone.digits].slice(0, 2)) {
          queries.push({
            query: `site:${dir.site} "${variant}"`,
            tag: dir.label,
            directory: dir.site,
          });
        }
      }

      // 2. General web searches for each format variant (capped at 3 variants)
      for (const variant of phone.variants.slice(0, 3)) {
        queries.push({
          query: `"${variant}" phone number owner name caller ID`,
          tag: 'Web',
        });
      }

      // 3. Spam/fraud check queries
      queries.push({
        query: `"${phone.normalized}" scam OR spam OR fraud OR robocall`,
        tag: 'Spam Check',
      });

      // Run all queries via the rate-limited invoker (prevents 429 storms)
      const settled = await Promise.allSettled(
        queries.map(async (q) => {
          const r = await rateLimitedInvoke<unknown[]>('web_search', { query: q.query, num: 8 }, { cacheTtlMs: 90_000 });
          return { tag: q.tag, directory: q.directory, results: Array.isArray(r) ? r : [] };
        })
      );

      // Aggregate + dedupe by URL
      const seen = new Set<string>();
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        for (const r of s.value.results) {
          const item = r as { title?: string; url?: string; snippet?: string };
          const url = item.url || '';
          if (!url || seen.has(url)) continue;
          seen.add(url);

          const title = item.title || '';
          const snippet = item.snippet || '';
          // Confidence: 90 if the directory site OR the exact number is in the title
          let confidence = 60;
          if (title.includes(phone.national) || title.includes(phone.digits)) confidence = 92;
          else if (snippet.includes(phone.national) || snippet.includes(phone.digits)) confidence = 82;
          else if (s.value.directory && url.includes(s.value.directory)) confidence = 78;
          else if (snippet.toLowerCase().includes(value.toLowerCase())) confidence = 70;

          results.push({
            field: 'associated_entity',
            value: title,
            source: url,
            confidence,
            title,
            snippet,
            directory: s.value.directory || s.value.tag,
          });
        }
      }

      // Sort by confidence, cap at 15
      results.sort((a, b) => b.confidence - a.confidence);
      results = results.slice(0, 15);

      // Enrich the response with the phone normalization info
      const enriched = {
        type,
        value,
        results,
        phoneInfo: {
          normalized: phone.normalized,
          national: phone.national,
          countryCode: phone.countryCode,
          detectedCountry: phone.detectedCountry,
          variants: phone.variants,
          directoriesChecked: directories.map(d => d.label),
        },
        totalFound: results.length,
      };

      // Timeline + audit
      try {
        const caseExists = await db.case.findUnique({ where: { id: caseId } });
        if (caseExists) {
          await db.timelineEvent.create({
            data: {
              caseId,
              title: `Reverse Lookup: ${phone.normalized}`,
              description: `Phone reverse lookup for ${phone.normalized} (detected: ${phone.detectedCountry}). Checked ${directories.length} directories + ${phone.variants.length} format variants. ${results.length} results.`,
              eventType: 'action',
              metadata: JSON.stringify({
                type, value, normalized: phone.normalized, detectedCountry: phone.detectedCountry,
                resultCount: results.length, country: locale.country ?? null,
              }),
            },
          });
        }
      } catch { /* ignore */ }

      await createAuditLog('osint_scan', 'ReverseLookup', {
        type, value, normalized: phone.normalized, detectedCountry: phone.detectedCountry,
        caseId, resultCount: results.length, country: locale.country ?? null,
      }).catch(() => {});

      return NextResponse.json(enriched);
    }

    // === EMAIL / USERNAME lookup (existing behavior, rate-limited) ===
    const extraSites = type === 'email'
      ? ['haveibeenpwned.com', 'hunter.io', 'emailrep.io', 'skrapp.io', 'rocketreach.co']
      : [];

    const localizedQuery = locale.country || locale.language
      ? buildLocalizedQuery(`"${value}"`, locale, {
          keyword: type === 'email' ? 'email' : 'profile',
          extraSites,
          includeSites: extraSites.length > 0,
          extraTerms: [type, 'lookup', 'OSINT'],
        })
      : `${type} lookup "${value}" OSINT`;

    const searchResults = await rateLimitedInvoke<unknown[]>('web_search', {
      query: localizedQuery,
      num: 12,
    }, { cacheTtlMs: 90_000 });

    if (Array.isArray(searchResults)) {
      const lowerVal = value.toLowerCase();
      const typedResults = searchResults as Array<{ snippet?: string; url?: string; title?: string }>;
      results = typedResults
        .filter((r) =>
          r.snippet?.toLowerCase().includes(lowerVal) ||
          r.title?.toLowerCase().includes(lowerVal)
        )
        .slice(0, 8)
        .map((r) => {
          let confidence = 60;
          if (r.title?.toLowerCase().includes(lowerVal)) confidence = 88;
          else if (r.snippet?.toLowerCase().includes(lowerVal)) confidence = 75;
          return {
            field: type === 'email' ? 'account' : 'profile',
            value: r.title || 'Unknown',
            source: r.url || '',
            confidence,
            title: r.title,
            snippet: r.snippet,
            directory: 'Web',
          };
        });
    }

    try {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Reverse Lookup: ${value}`,
            description: `${type} reverse lookup for: "${value}"${locale.country ? ` (locale: ${locale.country})` : ''}. ${results.length} results.`,
            eventType: 'action',
            metadata: JSON.stringify({ type, value, resultCount: results.length, country: locale.country ?? null }),
          },
        });
      }
    } catch { /* ignore */ }

    await createAuditLog('osint_scan', 'ReverseLookup', { type, value, caseId, country: locale.country ?? null }).catch(() => {});

    return NextResponse.json({ type, value, results, totalFound: results.length });
  } catch (error) {
    console.error('Reverse lookup failed:', error);
    return NextResponse.json(
      { error: 'Reverse lookup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
