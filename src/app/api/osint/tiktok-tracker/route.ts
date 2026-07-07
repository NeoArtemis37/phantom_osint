import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { parseLocale, type LocaleContext } from '@/lib/osint-query';
import { getCountry, getKeywords } from '@/lib/countries';

// =============================================================================
// POST /api/osint/tiktok-tracker
// TikTok OSINT tracker — given a TikTok @handle, gathers a structured view of
// that person's TikTok activity: profile, posts, reposts, public messages,
// activity patterns, linked accounts, and risk indicators.
//
// Author:  artemis37
// Tool:    PHANTOM TikTokTracker
//
// Strategy:
//   1. Five parallel web_search queries (profile, posts, reposts/duet,
//      comments/messages, site:tiktok.com).
//   2. One best-effort page_reader on https://www.tiktok.com/@{username} —
//      TikTok bot protection will usually block this, but if it succeeds we
//      get richer profile data.
//   3. Aggregate, classify (post / repost / message), extract hashtags &
//      mentions, parse engagement counts, infer linked accounts + risk
//      indicators, and return one structured JSON report.
//
// Reference patterns: src/app/api/osint/maigret/route.ts +
//                     src/app/api/osint/sherlock/route.ts
// =============================================================================

// ---------------------------------------------------------------------------
// Types (mirrors the api-client contract)
// ---------------------------------------------------------------------------

interface SourceHit {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface ProfileBlock {
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  followerCount: number | null;
  followingCount: number | null;
  likeCount: number | null;
  videoCount: number | null;
  region: string | null;
  accountType: 'personal' | 'business' | 'creator' | 'unknown';
  joinedEstimate: string | null;
  extractedFrom: string[];
}

interface PostItem {
  id: string;
  caption: string;
  url: string;
  source: string;
  postedAt: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  hashtags: string[];
  mentions: string[];
  isRepost: boolean;
  verified: boolean;
}

interface RepostItem {
  originalAuthor: string | null;
  originalCaption: string;
  url: string;
  repostedAt: string | null;
  comment: string | null;
}

interface MessageItem {
  fromUser: string | null;
  text: string;
  onVideo: string | null;
  postedAt: string | null;
  likes: number | null;
  source: string;
}

interface ActivityBlock {
  postingFrequency: string | null;
  peakHours: string[];
  topHashtags: Array<{ tag: string; count: number }>;
  topMentions: Array<{ handle: string; count: number }>;
  linkedAccounts: Array<{ platform: string; url: string; confidence: number }>;
}

interface RiskIndicator {
  level: 'low' | 'medium' | 'high';
  label: string;
  detail: string;
}

interface TikTokReport {
  username: string;
  profileUrl: string;
  generatedAt: string;
  author: 'artemis37';
  tool: 'PHANTOM TikTokTracker';
  found: boolean;
  confidence: number;
  sources: SourceHit[];
  profile: ProfileBlock;
  posts: PostItem[];
  reposts: RepostItem[];
  messages: MessageItem[];
  activity: ActivityBlock;
  riskIndicators: RiskIndicator[];
  collisions: Array<{ handle: string; url: string; source: string }>;
  stats: {
    sources: number;
    posts: number;
    verifiedPosts: number;
    reposts: number;
    messages: number;
    hashtags: number;
    mentions: number;
    linkedAccounts: number;
    riskIndicators: number;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "1.2M followers" / "15K likes" / "1,234" → number, or null. */
function parseCount(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/([\d.,]+)\s*([KMBkmb]?)/);
  if (!m) return null;
  const numStr = m[1].replace(/,/g, '');
  const num = parseFloat(numStr);
  if (Number.isNaN(num)) return null;
  const suffix = m[2].toLowerCase();
  let mult = 1;
  if (suffix === 'k') mult = 1_000;
  else if (suffix === 'm') mult = 1_000_000;
  else if (suffix === 'b') mult = 1_000_000_000;
  return Math.round(num * mult);
}

/** Find the FIRST count mention next to a label word (e.g. "1.2M followers"). */
function parseCountNear(label: string, ...texts: Array<string | undefined | null>): number | null {
  const re = new RegExp(`([\\d.,]+\\s*[KMBkmb]?)\\s*${label}`, 'i');
  for (const t of texts) {
    if (!t) continue;
    const m = t.match(re);
    if (m) {
      const c = parseCount(m[1]);
      if (c !== null) return c;
    }
  }
  return null;
}

/** Extract #hashtags (Unicode-aware). */
function extractHashtags(text: string | undefined | null): string[] {
  if (!text) return [];
  const re = /(?:^|\s)#[\p{L}\p{N}_]+/gu;
  const out = text.match(re) || [];
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Extract @mentions (keep the @). */
function extractMentions(text: string | undefined | null): string[] {
  if (!text) return [];
  const re = /(?:^|\s)@[A-Za-z0-9._]+/g;
  const out = text.match(re) || [];
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Extract a TikTok video URL (incl. vm./vt. short links) from text. */
function extractTikTokVideoUrl(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s")']+/i);
  return m ? m[0] : null;
}

/** Stable short id (first 10 chars of sha1). */
function hashId(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
}

/** Hostname helper. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/** Try to parse a date out of a snippet — best-effort, returns ISO or null. */
function tryParseDate(text: string | undefined | null): string | null {
  if (!text) return null;
  const patterns = [
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(\d{4})\/(\d{2})\/(\d{2})\b/,
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = new Date(m[0]);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

/** Look for a region code (2-letter) near "region"/"country" in text. */
function extractRegion(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/\b(?:region|country|location)[:\s]+([A-Z]{2})\b/i);
  if (m) return m[1];
  return null;
}

/** Look for a joined estimate like "Joined 2021" / "Mar 2022" / "since 2020". */
function extractJoinedEstimate(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/\b(?:joined|member since|since|est\.?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})/i);
  return m ? m[1] : null;
}

/** Pull a display name out of a search-result title like "username (@handle) on TikTok". */
function extractDisplayName(title: string | undefined | null, handle: string): string | null {
  if (!title) return null;
  const m = title.match(/^(.+?)\s*\(@[\w.-]+\)/);
  if (m && m[1].trim().length > 0 && m[1].trim().toLowerCase() !== handle.toLowerCase()) {
    return m[1].trim();
  }
  return null;
}

/** Extract the numeric video ID from a tiktok.com/@handle/video/<id> URL. */
function extractVideoId(url: string): string | null {
  const m = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
  return m ? m[1] : null;
}

/**
 * True ONLY if the URL is tiktok.com/@<exact-handle> (case-insensitive, with
 * a word boundary after the handle so @charli doesn't match @charlidamelio).
 */
function isExactHandleUrl(url: string, handle: string): boolean {
  const lower = handle.toLowerCase();
  try {
    const u = new URL(url);
    if (!/^(www\.)?tiktok\.com$/i.test(u.hostname)) return false;
    // Path must start with /@<handle> followed by /, ?, or end
    const pathMatch = u.pathname.toLowerCase().match(/^\/@([a-z0-9._-]+)([\/\?#]|$)/);
    if (!pathMatch) return false;
    return pathMatch[1] === lower;
  } catch {
    return false;
  }
}

/** True if the URL is a tiktok.com/@<handle>/video/<id> URL (a real post). */
function isExactHandleVideoUrl(url: string, handle: string): boolean {
  return isExactHandleUrl(url, handle) && /\/video\/\d+/i.test(url);
}

/** Find name collisions — TikTok URLs with a DIFFERENT handle than the target. */
function findCollisions(sources: SourceHit[], targetHandle: string): Array<{ handle: string; url: string; source: string }> {
  const lower = targetHandle.toLowerCase();
  const seen = new Set<string>();
  const out: Array<{ handle: string; url: string; source: string }> = [];
  for (const s of sources) {
    try {
      const u = new URL(s.url);
      if (!/^(www\.)?tiktok\.com$/i.test(u.hostname)) continue;
      const pathMatch = u.pathname.toLowerCase().match(/^\/@([a-z0-9._-]+)([\/\?#]|$)/);
      if (!pathMatch) continue;
      const foundHandle = pathMatch[1];
      if (foundHandle !== lower && !seen.has(foundHandle)) {
        seen.add(foundHandle);
        out.push({ handle: `@${foundHandle}`, url: s.url, source: s.source });
      }
    } catch {
      continue;
    }
  }
  return out.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Linked-account detection
// ---------------------------------------------------------------------------

const LINKED_PLATFORM_PATTERNS: Array<{ platform: string; pattern: RegExp }> = [
  { platform: 'Instagram', pattern: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i },
  { platform: 'YouTube', pattern: /https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)?[A-Za-z0-9._-]+/i },
  { platform: 'Twitter/X', pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i },
  { platform: 'Facebook', pattern: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/i },
  { platform: 'Snapchat', pattern: /https?:\/\/(?:www\.)?snapchat\.com\/add\/[A-Za-z0-9._-]+/i },
  { platform: 'Telegram', pattern: /https?:\/\/(?:www\.)?telegram\.me\/[A-Za-z0-9_]+|t\.me\/[A-Za-z0-9_]+/i },
  { platform: 'OnlyFans', pattern: /https?:\/\/(?:www\.)?onlyfans\.com\/[A-Za-z0-9._-]+/i },
  { platform: 'Linktree', pattern: /https?:\/\/(?:www\.)?linktr\.ee\/[A-Za-z0-9._-]+/i },
];

function findLinkedAccounts(...texts: Array<string | undefined | null>): Array<{ platform: string; url: string; confidence: number }> {
  const seen = new Set<string>();
  const out: Array<{ platform: string; url: string; confidence: number }> = [];
  for (const text of texts) {
    if (!text) continue;
    for (const { platform, pattern } of LINKED_PLATFORM_PATTERNS) {
      const m = text.match(pattern);
      if (m && !seen.has(m[0])) {
        seen.add(m[0]);
        out.push({ platform, url: m[0], confidence: 75 });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Risk heuristics
// ---------------------------------------------------------------------------

const SCAM_KEYWORDS = /\b(crypto|giveaway|dm me|invest|bitcoin|double your|free coins|whatsapp|btc|ethereum|airdrop|trading signals|guaranteed profit)\b/i;
const PIG_BUTCHERING_KEYWORDS = /\b(pig[ -]?butchering|romance scam|love bombing|sugar daddy|sugar baby)\b/i;
const SCAM_HASHTAGS = /\b#(crypto|invest|giveaway|money|btc|forex|trading|airdrop|binance|millionaire)\b/i;

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { username, caseId } = body as { username?: string; caseId?: string };
    const locale: LocaleContext = parseLocale(body);

    // --- Input validation (mirror sherlock route) ---
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json(
        { error: 'username is required (min 2 chars)' },
        { status: 400 }
      );
    }

    // Strip leading @, reject spaces / slashes
    const uname = username.trim().replace(/^@+/, '');
    if (/[<>"'`\\]|javascript:|data:|on\w+=/i.test(uname)) {
      return NextResponse.json(
        { error: 'Invalid username: contains forbidden characters' },
        { status: 400 }
      );
    }
    if (/\s|\//.test(uname)) {
      return NextResponse.json(
        { error: 'Invalid username: cannot contain spaces or slashes' },
        { status: 400 }
      );
    }

    const profileUrl = `https://www.tiktok.com/@${uname}`;
    const generatedAt = new Date().toISOString();
    const lowerU = uname.toLowerCase();

    // --- Default empty report ---
    const emptyProfile: ProfileBlock = {
      handle: `@${uname}`,
      displayName: null,
      bio: null,
      avatarUrl: null,
      verified: false,
      followerCount: null,
      followingCount: null,
      likeCount: null,
      videoCount: null,
      region: null,
      accountType: 'unknown',
      joinedEstimate: null,
      extractedFrom: [],
    };

    const emptyReport: TikTokReport = {
      username: uname,
      profileUrl,
      generatedAt,
      author: 'artemis37',
      tool: 'PHANTOM TikTokTracker',
      found: false,
      confidence: 10,
      sources: [],
      profile: emptyProfile,
      posts: [],
      reposts: [],
      messages: [],
      activity: {
        postingFrequency: null,
        peakHours: [],
        topHashtags: [],
        topMentions: [],
        linkedAccounts: [],
      },
      riskIndicators: [],
      collisions: [],
      stats: {
        sources: 0,
        posts: 0,
        verifiedPosts: 0,
        reposts: 0,
        messages: 0,
        hashtags: 0,
        mentions: 0,
        linkedAccounts: 0,
        riskIndicators: 0,
      },
    };

    // --- Data gathering ---
    let sources: SourceHit[] = [];
    let profileReaderContent = '';
    let profileReaderOk = false;
    let sdkError: string | undefined;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // Build the localized query set. When a country is selected, each query
      // is augmented with the country name (for regional TikTok content bias)
      // AND the per-template English keywords ("posts", "reposts", "comments",
      // "messages") are translated to the investigator's language. When no
      // locale is set, the queries are identical to the legacy baseline.
      const country = getCountry(locale.country);
      const countryName = locale.country ? country.name : '';
      const lang = locale.language ?? country.languages[0] ?? 'en';
      const kw = getKeywords(lang);

      const queries = [
        { tag: 'profile',  q: countryName ? `tiktok.com/@${uname} ${countryName}` : `tiktok.com/@${uname}`, num: 15 },
        { tag: 'posts',    q: countryName ? `"@${uname}" tiktok ${kw.posts} ${countryName}` : `"@${uname}" tiktok posts`, num: 15 },
        { tag: 'reposts',  q: countryName ? `${uname} tiktok reposts duet ${countryName}` : `${uname} tiktok reposts duet`, num: 10 },
        { tag: 'messages', q: countryName ? `${uname} tiktok ${kw.posts} ${countryName}` : `${uname} tiktok comments messages`, num: 10 },
        { tag: 'site',     q: countryName ? `site:tiktok.com @${uname} ${countryName}` : `site:tiktok.com @${uname}`, num: 10 },
      ];

      const searchSettled = await Promise.allSettled(
        queries.map(async (q) => {
          const r = await zai.functions.invoke('web_search', { query: q.q, num: q.num });
          return { tag: q.tag, raw: Array.isArray(r) ? (r as any[]) : [] };
        })
      );

      // Also fetch the profile page in parallel — best-effort
      const readerSettled = await Promise.allSettled([
        zai.functions.invoke('page_reader', { url: profileUrl }),
      ]);

      for (const s of searchSettled) {
        if (s.status === 'fulfilled') {
          for (const r of s.value.raw) {
            const urlStr: string = r.url || r.link || '';
            if (!urlStr) continue;
            sources.push({
              title: r.title || '',
              url: urlStr,
              snippet: r.snippet || r.description || r.text || '',
              source: hostname(urlStr),
            });
          }
        }
      }

      if (readerSettled[0].status === 'fulfilled') {
        const readerRes = readerSettled[0].value as any;
        // page_reader returns {code, data: {html, title, description, content}}
        const data = readerRes?.data ?? readerRes;
        const content: string = data?.content || data?.description || data?.title || '';
        if (content && content.length > 50) {
          profileReaderContent = content;
          profileReaderOk = true;
        }
      }
    } catch (err) {
      sdkError = err instanceof Error ? err.message : 'z-ai SDK failure';
      console.error('TikTokTracker z-ai SDK failed:', err);
    }

    // --- Deduplicate sources by URL ---
    const seenUrls = new Set<string>();
    const dedupedSources: SourceHit[] = [];
    for (const s of sources) {
      const key = s.url.toLowerCase();
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      dedupedSources.push(s);
    }
    sources = dedupedSources;

    // --- Detect name collisions (TikTok URLs with a DIFFERENT handle than target) ---
    const collisions = findCollisions(sources, uname);

    // --- Determine "found" (STRICT — exact-handle URL required) ---
    // The account is "found" ONLY if at least one source URL is
    // tiktok.com/@<exact-handle>. The old mentionCount>=2 fallback caught name
    // collisions (two articles that mention @handle in text) and is removed.
    const exactHandleSources = sources.filter((s) => isExactHandleUrl(s.url, uname));
    const found = exactHandleSources.length > 0;
    const profileUrlMentioned = exactHandleSources.length > 0; // for confidence calc

    // If SDK completely failed and we have no sources, return empty report
    if (sdkError && sources.length === 0) {
      return NextResponse.json<TikTokReport>({
        ...emptyReport,
        error: sdkError,
      });
    }

    // --- Build posts from search results (STRICT — only verified videos) ---
    // A source becomes a "post" ONLY if it meets ONE of:
    //   1. isExactHandleVideoUrl(r.url, uname) → URL is tiktok.com/@<exact-handle>/video/<id>
    //   2. URL is on tiktok.com AND contains /video/ AND the combined text
    //      contains @<exact-handle> as a word-bounded match → duet/stitch where
    //      the target handle is in the caption.
    // External sources (news, Reddit, etc.) are NEVER posts.
    const handleWordRe = new RegExp(`(?<![\\w@])@${lowerU}\\b`, 'i');
    const posts: PostItem[] = [];
    const seenVideoIds = new Set<string>();
    for (const r of sources) {
      const combined = `${r.title} ${r.snippet}`;
      let verified = false;
      let includeAsPost = false;

      if (isExactHandleVideoUrl(r.url, uname)) {
        includeAsPost = true;
        verified = true;
      } else if (/tiktok\.com\/.+\/video\/\d+/i.test(r.url) && handleWordRe.test(combined)) {
        // TikTok video URL (possibly a duet/stitch) where the target handle is mentioned in caption
        includeAsPost = true;
        verified = true;
      }

      if (!includeAsPost) continue;

      // Dedupe by video ID (if extractable) else by URL hash
      const vidId = extractVideoId(r.url);
      const dedupKey = vidId || hashId(r.url);
      if (seenVideoIds.has(dedupKey)) continue;
      seenVideoIds.add(dedupKey);

      const caption = r.title || r.snippet || '(no caption)';
      const hashtags = extractHashtags(combined);
      const mentions = extractMentions(combined);
      const isRepost = /\b(repost|duet|stitch|reposting)\b/i.test(caption);

      posts.push({
        id: hashId(r.url),
        caption,
        url: r.url,
        source: r.source,
        postedAt: tryParseDate(combined),
        likes: parseCountNear('like', combined) ?? parseCountNear('heart', combined),
        comments: parseCountNear('comment', combined),
        shares: parseCountNear('share', combined),
        views: parseCountNear('view', combined) ?? parseCountNear('play', combined),
        hashtags,
        mentions,
        isRepost,
        verified,
      });
    }

    // --- Build reposts ---
    const reposts: RepostItem[] = [];
    for (const p of posts.filter((p) => p.isRepost)) {
      const authorMatch = p.caption.match(/@([A-Za-z0-9._]+)/);
      reposts.push({
        originalAuthor: authorMatch ? `@${authorMatch[1]}` : null,
        originalCaption: p.caption,
        url: p.url,
        repostedAt: p.postedAt,
        comment: null,
      });
    }

    // --- Build messages (STRICT — only TikTok video URLs mentioning @exact-handle) ---
    // External sources (news, Reddit, etc.) are NEVER messages — the old
    // \b(comment|reply|dm|message|said|wrote)\b heuristic caught random web articles.
    const messages: MessageItem[] = [];
    const seenMsgIds = new Set<string>();
    for (const r of sources) {
      if (!/tiktok\.com\/.+\/video\/\d+/i.test(r.url)) continue;
      const combined = `${r.title} ${r.snippet}`;
      if (!handleWordRe.test(combined)) continue;
      const id = hashId(r.url + combined.slice(0, 50));
      if (seenMsgIds.has(id)) continue;
      seenMsgIds.add(id);
      const fromUserMatch = combined.match(/@([A-Za-z0-9._]+)/);
      messages.push({
        fromUser: fromUserMatch ? `@${fromUserMatch[1]}` : null,
        text: r.snippet || r.title,
        onVideo: r.url,
        postedAt: tryParseDate(combined),
        likes: parseCountNear('like', combined),
        source: r.source,
      });
    }

    // --- Build profile ---
    // STRICT: parse profile counts ONLY from page_reader content OR from sources
    // whose URL is tiktok.com/@<exact-handle>. Never from random web articles.
    const allSnippets = sources.map((s) => `${s.title} ${s.snippet}`).join(' \n ');
    const exactHandleText = sources
      .filter((s) => isExactHandleUrl(s.url, uname))
      .map((s) => `${s.title} ${s.snippet}`)
      .join(' \n ');
    const profileText = profileReaderContent || exactHandleText || '';
    const verified = /\bverified\b/i.test(profileText);
    const followerCount = parseCountNear('follower', profileText);
    const followingCount = parseCountNear('following', profileText);
    const likeCount = parseCountNear('like', profileText);
    const videoCount = parseCountNear('video', profileText) ?? parseCountNear('post', profileText);
    const region = extractRegion(profileText);
    const joinedEstimate = extractJoinedEstimate(profileText);

    // Display name — prefer page_reader title, then exact-handle source titles
    let displayName: string | null = null;
    if (profileReaderOk) {
      const titleMatch = profileReaderContent.match(/^(.+?)\s*\(@[\w.-]+\)/);
      if (titleMatch) displayName = titleMatch[1].trim();
    }
    if (!displayName) {
      for (const s of sources.filter((s) => isExactHandleUrl(s.url, uname))) {
        const dn = extractDisplayName(s.title, uname);
        if (dn) { displayName = dn; break; }
      }
    }

    // Bio — STRICT: only use page_reader content. If page_reader failed, bio stays null.
    // The old loop grabbed the first random news snippet mentioning the handle and
    // labelled it as the bio.
    let bio: string | null = null;
    if (profileReaderOk && profileReaderContent) {
      // Try to find a short bio-like segment in the page content
      const bioMatch = profileReaderContent.match(/(?:bio|about|signature)[:\s]+([^\n]{10,200})/i);
      if (bioMatch) bio = bioMatch[1].trim();
      // Fallback: if page content is short enough, use it
      else if (profileReaderContent.length < 300 && profileReaderContent.toLowerCase().includes(`@${lowerU}`)) {
        bio = profileReaderContent.trim().slice(0, 280);
      }
    }

    // Account type — best-effort heuristic
    let accountType: ProfileBlock['accountType'] = 'unknown';
    if (/\bbusiness\b|brand|company|shop now|store/i.test(profileText)) accountType = 'business';
    else if (/\bcreator\b|influencer|content creator/i.test(profileText)) accountType = 'creator';
    else if (found) accountType = 'personal';

    const extractedFrom: string[] = sources
      .filter((s) => isExactHandleUrl(s.url, uname))
      .map((s) => s.url)
      .slice(0, 5);

    const profile: ProfileBlock = {
      handle: `@${uname}`,
      displayName,
      bio,
      avatarUrl: null,
      verified,
      followerCount,
      followingCount,
      likeCount,
      videoCount,
      region,
      accountType,
      joinedEstimate,
      extractedFrom,
    };

    // --- Activity aggregation ---
    const hashtagCounts = new Map<string, number>();
    const mentionCounts = new Map<string, number>();
    for (const p of posts) {
      for (const h of p.hashtags) hashtagCounts.set(h, (hashtagCounts.get(h) || 0) + 1);
      for (const m of p.mentions) mentionCounts.set(m, (mentionCounts.get(m) || 0) + 1);
    }
    const topHashtags = Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const topMentions = Array.from(mentionCounts.entries())
      .map(([handle, count]) => ({ handle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Posting frequency — rough inference from posts count vs time span
    let postingFrequency: string | null = null;
    if (posts.length >= 2) {
      const dated = posts.filter((p) => p.postedAt).map((p) => new Date(p.postedAt!).getTime()).filter((t) => !Number.isNaN(t));
      if (dated.length >= 2) {
        const span = Math.max(...dated) - Math.min(...dated);
        const days = span / (1000 * 60 * 60 * 24);
        if (days > 0) {
          const perWeek = (posts.length / days) * 7;
          postingFrequency = `${perWeek.toFixed(1)} posts/week`;
        } else {
          postingFrequency = `${posts.length} posts (same-day cluster)`;
        }
      } else {
        postingFrequency = `${posts.length} posts detected`;
      }
    } else if (posts.length === 1) {
      postingFrequency = '1 post detected';
    }

    const linkedAccounts = findLinkedAccounts(bio, profileReaderContent, allSnippets);

    const activity: ActivityBlock = {
      postingFrequency,
      peakHours: [],
      topHashtags,
      topMentions,
      linkedAccounts,
    };

    // --- Risk indicators ---
    const riskIndicators: RiskIndicator[] = [];
    const allText = `${bio || ''} ${allSnippets} ${profileReaderContent}`;
    const allHashtagText = topHashtags.map((h) => h.tag).join(' ');

    if (found && PIG_BUTCHERING_KEYWORDS.test(allText)) {
      riskIndicators.push({
        level: 'high',
        label: 'Pig-butchering / romance-scam patterns detected',
        detail: 'Search results reference romance-scam or pig-butchering terminology associated with this account.',
      });
    }
    if (found && SCAM_KEYWORDS.test(allText)) {
      riskIndicators.push({
        level: 'high',
        label: 'Scam / fraud keywords detected',
        detail: 'Profile or surrounding content mentions crypto, investment, giveaway, or DM-me language consistent with social-media fraud.',
      });
    }
    if (found && followerCount === null) {
      riskIndicators.push({
        level: 'medium',
        label: 'Sparse or new account',
        detail: 'No follower count could be verified — often a sign of a freshly created or low-activity account.',
      });
    }
    if (SCAM_HASHTAGS.test(allHashtagText)) {
      riskIndicators.push({
        level: 'medium',
        label: 'Scam-adjacent hashtags present',
        detail: 'Top hashtags include #crypto, #invest, #giveaway, #money or similar — typical of get-rich-quick schemes.',
      });
    }
    if (linkedAccounts.some((a) => a.platform === 'OnlyFans' || a.platform === 'Telegram')) {
      riskIndicators.push({
        level: 'medium',
        label: 'High-risk linked platforms',
        detail: 'Profile links to OnlyFans or Telegram — frequently used as off-ramps in romance-scam and sextortion funnels.',
      });
    }
    if (found && verified && (followerCount ?? 0) >= 100_000) {
      riskIndicators.push({
        level: 'low',
        label: 'Established verified account',
        detail: 'Verified badge with high follower count — likely a legitimate creator.',
      });
    }
    if (found && riskIndicators.length === 0) {
      riskIndicators.push({
        level: 'low',
        label: 'No red flags detected',
        detail: 'Account presence confirmed with no scam, fraud, or suspicious-activity indicators in gathered sources.',
      });
    }

    // --- Confidence ---
    let confidence = 10;
    if (!found) {
      confidence = 10;
    } else if (profileReaderOk) {
      confidence = 90;
    } else if (profileUrlMentioned) {
      confidence = 75;
    } else {
      confidence = 25;
    }

    // --- Final stats ---
    const stats = {
      sources: sources.length,
      posts: posts.length,
      verifiedPosts: posts.filter((p) => p.verified).length,
      reposts: reposts.length,
      messages: messages.length,
      hashtags: hashtagCounts.size,
      mentions: mentionCounts.size,
      linkedAccounts: linkedAccounts.length,
      riskIndicators: riskIndicators.length,
    };

    const report: TikTokReport = {
      username: uname,
      profileUrl,
      generatedAt,
      author: 'artemis37',
      tool: 'PHANTOM TikTokTracker',
      found,
      confidence,
      sources,
      profile,
      posts,
      reposts,
      messages,
      activity,
      riskIndicators,
      collisions,
      stats,
      ...(sdkError ? { error: sdkError } : {}),
    };

    // --- Timeline + audit (mirror maigret) ---
    if (caseId) {
      try {
        const caseExists = await db.case.findUnique({ where: { id: caseId } });
        if (caseExists) {
          await db.timelineEvent.create({
            data: {
              caseId,
              title: `TikTok Track: @${uname}`,
              description: `TikTok OSINT tracker ran for @${uname}. found=${found}, confidence=${confidence}%, sources=${sources.length}, posts=${posts.length}, verifiedPosts=${stats.verifiedPosts}, reposts=${reposts.length}, messages=${messages.length}, collisions=${collisions.length}.`,
              eventType: 'action',
              metadata: JSON.stringify({
                username: uname,
                tool: 'PHANTOM TikTokTracker',
                found,
                confidence,
                verifiedPosts: stats.verifiedPosts,
                collisions: collisions.length,
                stats,
              }),
            },
          });
        }
      } catch (e) {
        console.error('TikTokTracker timeline insert failed:', e);
      }
    }

    await createAuditLog('osint_scan', 'TikTokTrack', {
      username: uname,
      caseId: caseId || null,
      found,
      confidence,
      sourcesCount: sources.length,
      postsCount: posts.length,
      verifiedPosts: stats.verifiedPosts,
      collisions: collisions.length,
      userId: payload.id,
      country: locale.country ?? null,
    }).catch(() => {});

    return NextResponse.json(report);
  } catch (error) {
    console.error('TikTokTracker failed:', error);
    return NextResponse.json(
      { error: 'TikTok tracker failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
