import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { parseLocale, type LocaleContext } from '@/lib/osint-query';
import { getRegionalPlatforms } from '@/lib/countries';

// =============================================================================
// POST /api/recon/crawl
// Active crawler: fetches a URL via z-ai page_reader, then extracts structured
// entities from the HTML/text:
//   - emails
//   - phone numbers
//   - social profile links (Twitter, IG, FB, LinkedIn, GitHub, etc. + regional
//     platforms when a country is selected — VK for RU, Weibo for CN, etc.)
//   - images
//   - usernames (from social URLs)
// =============================================================================

// Social platform detection patterns (global / US-leaning baseline).
const SOCIAL_PATTERNS: Array<{ platform: string; re: RegExp; usernameGroup: number }> = [
  { platform: 'Twitter/X', re: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Instagram', re: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Facebook', re: /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb)\.com\/([A-Za-z0-9.]{1,50})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'LinkedIn', re: /(?:https?:\/\/)?(?:[a-z]{2}\.)?linkedin\.com\/(?:in|company|pub)\/([A-Za-z0-9_-]{1,100})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'GitHub', re: /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_-]{1,39})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'TikTok', re: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{1,24})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'YouTube', re: /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/@(?:[A-Za-z0-9_.-]{1,})(?:[/?#].*)?$/gm, usernameGroup: 0 },
  { platform: 'Reddit', re: /(?:https?:\/\/)?(?:www\.)?reddit\.com\/u(?:ser)?\/([A-Za-z0-9_-]{1,20})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Twitch', re: /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]{1,25})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Telegram', re: /(?:https?:\/\/)?t(?:elegram)?\.me\/([A-Za-z0-9_]{1,32})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Discord', re: /(?:https?:\/\/)?(?:www\.)?discord\.(?:gg|com\/invite)\/([A-Za-z0-9-]{1,10})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Pinterest', re: /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/([A-Za-z0-9_]{1,15})(?:[/?#].*)?$/gm, usernameGroup: 1 },
  { platform: 'Snapchat', re: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/([A-Za-z0-9_.]{1,15})(?:[/?#].*)?$/gm, usernameGroup: 1 },
];

/**
 * Build extra regex patterns for regional platforms (VK, Weibo, Line, etc.)
 * based on the selected country. Each pattern matches the platform's URL
 * host with an optional trailing username path segment.
 */
function buildRegionalSocialPatterns(locale: LocaleContext): Array<{ platform: string; re: RegExp; usernameGroup: number }> {
  const out: Array<{ platform: string; re: RegExp; usernameGroup: number }> = [];
  const seen = new Set<string>();
  for (const p of getRegionalPlatforms(locale.country)) {
    if (p.category === 'messaging' || p.category === 'search') continue;
    try {
      const host = new URL(p.url).hostname.replace(/^www\./, '').toLowerCase();
      if (seen.has(host)) continue;
      seen.add(host);
      // Escape dots for regex and capture a trailing /username segment.
      const escaped = host.replace(/\./g, '\\.');
      out.push({
        platform: p.name,
        re: new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${escaped}\\/([A-Za-z0-9_.\\-]{1,60})(?:[/?#].*)?$`, 'gm'),
        usernameGroup: 1,
      });
    } catch {
      // skip invalid URLs
    }
  }
  return out;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const URL_RE = /https?:\/\/[^\s"'<>\]\)]+/gi;
const IMG_RE = /<img[^>]+src=["']([^"']+)["']/gi;
const META_DESC_RE = /<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']+)["']/i;
const META_TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;
const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { url, caseId, autoCreate } = body;
    const locale: LocaleContext = parseLocale(body);

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // ---- Fetch the page via z-ai page_reader ----
    let pageTitle = '';
    let pageContent = '';
    let rawHtml = '';

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const pageResult = await zai.functions.invoke('page_reader', { url: targetUrl });

      // The SDK returns { code, data: { html, description, title, content, text, ... }, meta, status }
      if (pageResult && typeof pageResult === 'object') {
        const pr = pageResult as {
          code?: number;
          data?: { html?: string; description?: string; title?: string; content?: string; text?: string };
          data_html?: string;
          data_text?: string;
        };
        // Handle both wrapped { data: {...} } and flat shapes
        const data = pr.data || {};
        rawHtml = data.html || pr.data_html || '';
        pageContent = data.content || data.text || pr.data_text || '';
        pageTitle = data.title || '';
        if (data.description && !pageTitle) {
          pageTitle = data.description;
        }
      }
    } catch (err) {
      console.error('Page reader failed:', err);
      return NextResponse.json(
        { error: 'Failed to crawl URL. The page may be unreachable or blocked.', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 502 }
      );
    }

    // Combine html + content for extraction
    const haystack = `${rawHtml}\n${pageContent}`;

    // ---- Extract entities ----
    const emails = unique(
      (haystack.match(EMAIL_RE) || []).filter(
        (e) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.gif')
      )
    ).slice(0, 50);

    const phones = unique(
      (haystack.match(PHONE_RE) || [])
        .filter((p) => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15)
        .map((p) => p.trim())
    ).slice(0, 30);

    // Extract social links with platform + username. Merge the global baseline
    // patterns with the regional patterns for the selected country.
    const allPatterns = [...SOCIAL_PATTERNS, ...buildRegionalSocialPatterns(locale)];
    const socialLinks: Array<{ platform: string; url: string; username: string }> = [];
    const seenSocial = new Set<string>();
    for (const { platform, re, usernameGroup } of allPatterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(haystack)) !== null) {
        const matchedUrl = m[0];
        const username = usernameGroup > 0 ? m[usernameGroup] : '';
        // Normalize to a clean URL
        let cleanUrl = matchedUrl;
        if (!cleanUrl.startsWith('http')) {
          cleanUrl = `https://${cleanUrl}`;
        }
        const key = `${platform}:${cleanUrl}`;
        if (!seenSocial.has(key) && !cleanUrl.includes('share') && !cleanUrl.includes('intent')) {
          seenSocial.add(key);
          socialLinks.push({ platform, url: cleanUrl, username });
        }
        if (socialLinks.length >= 50) break;
      }
    }

    // Extract all URLs
    const allUrls = unique((haystack.match(URL_RE) || []).map((u) => u.replace(/[.,;:)]+$/, ''))).slice(0, 100);

    // Extract images
    const images: string[] = [];
    let imgMatch: RegExpExecArray | null;
    const imgRe = new RegExp(IMG_RE);
    while ((imgMatch = imgRe.exec(rawHtml)) !== null) {
      const src = imgMatch[1];
      if (src && !src.startsWith('data:')) {
        let absSrc = src;
        if (src.startsWith('//')) absSrc = `https:${src}`;
        else if (src.startsWith('/')) absSrc = `${parsedUrl.origin}${src}`;
        else if (!src.startsWith('http')) absSrc = `${parsedUrl.origin}/${src}`;
        images.push(absSrc);
      }
      if (images.length >= 30) break;
    }

    // Page metadata
    const titleMatch = rawHtml.match(OG_TITLE_RE) || rawHtml.match(META_TITLE_RE);
    const descMatch = rawHtml.match(META_DESC_RE);
    const title = titleMatch ? titleMatch[1].trim() : pageTitle || parsedUrl.hostname;
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract usernames from social links
    const usernames = unique(
      socialLinks
        .filter((s) => s.username && s.username.length >= 2)
        .map((s) => ({ platform: s.platform, username: s.username, url: s.url }))
    );

    const extracted = {
      title,
      description,
      emails,
      phones,
      socialLinks,
      usernames,
      images,
      allUrls,
    };

    // ---- Optionally auto-create entities ----
    let entityIds: string[] = [];
    if (autoCreate && caseId) {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        const toCreate: Array<{ name: string; type: string; value: string }> = [];
        const seen = new Set<string>();

        for (const e of emails) {
          if (!seen.has(e)) {
            seen.add(e);
            toCreate.push({ name: e, type: 'email', value: e });
          }
        }
        for (const p of phones.slice(0, 10)) {
          if (!seen.has(p)) {
            seen.add(p);
            toCreate.push({ name: p, type: 'phone', value: p });
          }
        }
        for (const s of socialLinks) {
          if (!seen.has(s.url)) {
            seen.add(s.url);
            toCreate.push({ name: `${s.username || 'profile'}@${s.platform}`, type: 'username', value: s.url });
          }
        }
        toCreate.push({ name: title.slice(0, 60) || parsedUrl.hostname, type: 'url', value: targetUrl });

        for (const e of toCreate) {
          try {
            const ent = await db.entity.create({
              data: {
                caseId,
                name: e.name,
                type: e.type as never,
                value: e.value,
                confidence: 75,
              },
            });
            entityIds.push(ent.id);
          } catch {
            // skip
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
            title: `Crawl: ${parsedUrl.hostname}`,
            description: `Crawled ${targetUrl}. Extracted ${emails.length} emails, ${phones.length} phones, ${socialLinks.length} social links, ${images.length} images.${autoCreate ? ` Auto-created ${entityIds.length} entities.` : ''}`,
            eventType: 'action',
            metadata: JSON.stringify({
              url: targetUrl,
              emails: emails.length,
              phones: phones.length,
              socialLinks: socialLinks.length,
              images: images.length,
              entitiesCreated: entityIds.length,
            }),
          },
        });
      }
    }

    await createAuditLog('recon_crawl', 'ActiveCrawl', {
      url: targetUrl,
      caseId: caseId || null,
      emailsFound: emails.length,
      socialFound: socialLinks.length,
      entitiesCreated: entityIds.length,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json({
      url: targetUrl,
      ...extracted,
      entitiesCreated: entityIds.length,
      entityIds,
    });
  } catch (error) {
    console.error('Crawl failed:', error);
    return NextResponse.json(
      { error: 'Crawl failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
