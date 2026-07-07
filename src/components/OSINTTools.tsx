'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import type { EntityType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  UserSearch,
  Users,
  Hash,
  Globe,
  Globe2,
  Phone,
  Mail,
  Loader2,
  ExternalLink,
  Plus,
  Crosshair,
  CheckCircle2,
  XCircle,
  Zap,
  Radio,
  Target,
  ScanSearch,
  Image as ImageIcon,
  Music2,
  History,
  Library,
} from 'lucide-react';
import AutoReconPanel from '@/components/osint/AutoReconPanel';
import CrawlerPanel from '@/components/osint/CrawlerPanel';
import ImageSearchPanel from '@/components/osint/ImageSearchPanel';
import TikTokTrackerPanel from '@/components/osint/TikTokTrackerPanel';
import SocialMediaPanel from '@/components/osint/SocialMediaPanel';
import WaybackPanel from '@/components/osint/WaybackPanel';
import PeopleSearchPanel from '@/components/osint/PeopleSearchPanel';
import OsintCatalogPanel from '@/components/osint/OsintCatalogPanel';
import ExternalLookupPanel from '@/components/osint/ExternalLookupPanel';
import { CountryLocaleSelector } from '@/components/CountryLocaleSelector';

// =============================================================================
// PHANTOM OSINT Tools — author: artemis37
// The Username tab is a UNIFIED enumeration panel that merges results from
// three tools (Maigret + Sherlock + UsernameSearch) into a single grid.
// All tabs use forceMount + data-[state=inactive]:hidden so switching tabs
// preserves each panel's local state (search input, results, loading) — no
// more "reset the progression" bug. Every flex-1 in the scroll chain also
// has min-h-0 so the ScrollArea can actually scroll.
// =============================================================================

interface AccountResult {
  platform: string;
  url: string;
  username: string;
  confidence: number;
}

interface ReverseResult {
  title: string;
  url: string;
  snippet: string;
  confidence: number;
}

// A merged username-enumeration hit from Maigret + Sherlock + UsernameSearch.
interface MergedUsernameResult {
  platform: string;
  url: string;
  username: string;
  confidence: number;
  category: string;
  tools: Array<'M' | 'S' | 'U'>; // M = Maigret, S = Sherlock, U = UsernameSearch
}

type ToolRunStatus = 'idle' | 'running' | 'ok' | 'error';

interface ToolState {
  status: ToolRunStatus;
  found: number;
}

interface ToolsStatus {
  maigret: ToolState;
  sherlock: ToolState;
  usernameSearch: ToolState;
}

// Platform categorization — extended to cover Maigret & Sherlock's wider set
// (Developer, Creative, Dating, Reference) so the merged grid groups every hit.
const PLATFORM_CATEGORIES = [
  {
    name: 'Social',
    platforms: ['Instagram', 'Facebook', 'Reddit', 'Twitter/X', 'TikTok', 'Pinterest', 'VK', 'Mastodon', 'X', 'Twitter', 'Snapchat', 'Telegram', 'Threads', 'Clubhouse'],
    color: 'cyan',
  },
  {
    name: 'Professional',
    platforms: ['LinkedIn', 'GitHub', 'GitLab', 'Behance', 'Slack', 'Fiverr', 'Trello', 'Upwork', 'Freelancer', 'AngelList', 'Wellfound'],
    color: 'purple',
  },
  {
    name: 'Gaming',
    platforms: ['Steam', 'Twitch', 'Chess.com', 'Lichess', 'Minecraft', 'osu!', 'Roblox', 'Xbox', 'PlayStation', 'Epic Games', 'Riot', 'Battle.net', 'Origin', 'GOG'],
    color: 'green',
  },
  {
    name: 'Media',
    platforms: ['YouTube', 'Vimeo', 'Rumble', 'Dailymotion', 'Spotify', 'SoundCloud', 'Deezer', 'Tidal', 'Apple Music', 'Bandcamp', 'Flickr', '500px'],
    color: 'orange',
  },
  {
    name: 'Blogging',
    platforms: ['Medium', 'Hashnode', 'Blogger', 'Substack', 'WordPress', 'Tumblr', 'Ghost', 'LiveJournal', 'DeviantArt'],
    color: 'cyan',
  },
  {
    name: 'Forums',
    platforms: ['Reddit', '4chan', 'Quora', 'Hacker News', 'Product Hunt', 'Stack Overflow', 'Disqus', 'Slashdot'],
    color: 'purple',
  },
  {
    name: 'Developer',
    platforms: ['GitHub', 'GitLab', 'Bitbucket', 'Stack Overflow', 'Dev.to', 'HackerEarth', 'CodePen', 'Replit', 'Kaggle', 'Codeforces', 'HackerRank'],
    color: 'green',
  },
  {
    name: 'Creative',
    platforms: ['Behance', 'Dribbble', 'DeviantArt', 'ArtStation', 'Patreon', 'Etsy', 'Storenvy', 'Redbubble', 'Teespring', 'SoundCloud'],
    color: 'purple',
  },
  {
    name: 'Dating',
    platforms: ['Tinder', 'Bumble', 'OkCupid', 'Match', 'Hinge', 'Plenty of Fish', 'Coffee Meets Bagel', 'Zoosk'],
    color: 'pink',
  },
  {
    name: 'Reference',
    platforms: ['Wikipedia', 'Wikimedia', 'Archive.org', 'IMDb', 'MusicBrainz', 'Goodreads', 'Letterboxd', 'Trakt'],
    color: 'cyan',
  },
];

// Guess a category for a hit that came without one (e.g., from UsernameSearch).
function guessCategory(platform: string): string {
  const p = platform.toLowerCase();
  for (const cat of PLATFORM_CATEGORIES) {
    if (cat.platforms.some((cp) => p.includes(cp.toLowerCase().split('/')[0]))) {
      return cat.name;
    }
  }
  return 'Other';
}

export default function OSINTTools() {
  const currentCase = usePhantomStore((s) => s.currentCase);

  // ===== INVESTIGATION LOCALE (set via the CountryLocaleSelector in the toolbar) =====
  const investigationCountry = usePhantomStore((s) => s.investigationCountry);
  const investigationLanguage = usePhantomStore((s) => s.investigationLanguage);
  const investigationRegionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const locale = {
    country: investigationCountry,
    language: investigationLanguage,
    regionalOnly: investigationRegionalOnly,
  };

  // ===== UNIFIED USERNAME SCANNER (merged Maigret + Sherlock + UsernameSearch) =====
  const [username, setUsername] = useState('');
  const [mergedResults, setMergedResults] = useState<MergedUsernameResult[]>([]);
  const [usernameSearching, setUsernameSearching] = useState(false);
  const [usernameSearched, setUsernameSearched] = useState(false);
  const [toolsStatus, setToolsStatus] = useState<ToolsStatus>({
    maigret: { status: 'idle', found: 0 },
    sherlock: { status: 'idle', found: 0 },
    usernameSearch: { status: 'idle', found: 0 },
  });
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameReqId = useRef(0);

  // Social Monitor — LIVE search
  const [socialQuery, setSocialQuery] = useState('');
  const [socialType, setSocialType] = useState<'hashtag' | 'mention' | 'keyword'>('keyword');
  const [socialResults, setSocialResults] = useState<Array<{ title: string; url: string; snippet: string; source: string }>>([]);
  const [socialSearching, setSocialSearching] = useState(false);
  const socialDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialReqId = useRef(0);

  // Uncensored Search — LIVE search
  const [uncensoredQuery, setUncensoredQuery] = useState('');
  const [uncensoredResults, setUncensoredResults] = useState<Array<{ title: string; url: string; snippet: string; source: string }>>([]);
  const [uncensoredSearching, setUncensoredSearching] = useState(false);
  const uncensoredDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uncensoredReqId = useRef(0);

  // Reverse Lookup — LIVE search
  const [reverseType, setReverseType] = useState<'phone' | 'email' | 'username'>('username');
  const [reverseValue, setReverseValue] = useState('');
  const [reverseResults, setReverseResults] = useState<ReverseResult[]>([]);
  const [reverseSearching, setReverseSearching] = useState(false);
  const reverseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseReqId = useRef(0);

  // ===== LIVE UNIFIED USERNAME SEARCH (auto-fires Maigret+Sherlock+UsernameSearch in parallel) =====
  useEffect(() => {
    if (!currentCase) return;
    const trimmed = username.trim();

    if (trimmed.length < 2) {
      setMergedResults([]);
      setUsernameSearched(false);
      setToolsStatus({
        maigret: { status: 'idle', found: 0 },
        sherlock: { status: 'idle', found: 0 },
        usernameSearch: { status: 'idle', found: 0 },
      });
      return;
    }

    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);

    usernameDebounce.current = setTimeout(async () => {
      const reqId = ++usernameReqId.current;
      setUsernameSearching(true);
      setMergedResults([]);
      setToolsStatus({
        maigret: { status: 'running', found: 0 },
        sherlock: { status: 'running', found: 0 },
        usernameSearch: { status: 'running', found: 0 },
      });

      const settled = await Promise.allSettled([
        osintApi.maigret({ username: trimmed, caseId: currentCase.id, ...locale }),
        osintApi.sherlock({ username: trimmed, caseId: currentCase.id, ...locale }),
        osintApi.usernameSearch({ username: trimmed, caseId: currentCase.id, platforms: [], ...locale }),
      ]);

      if (reqId !== usernameReqId.current) return;

      const merged = new Map<string, MergedUsernameResult>();
      const nextStatus: ToolsStatus = {
        maigret: { status: 'error', found: 0 },
        sherlock: { status: 'error', found: 0 },
        usernameSearch: { status: 'error', found: 0 },
      };

      // --- Maigret ---
      if (settled[0].status === 'fulfilled') {
        const d = settled[0].value;
        const all = [...(d.found || []), ...(d.possible || [])];
        let foundCount = 0;
        for (const h of all) {
          if (!h.url) continue;
          const key = h.url;
          const existing = merged.get(key);
          if (existing) {
            if (!existing.tools.includes('M')) existing.tools.push('M');
            existing.confidence = Math.max(existing.confidence, h.confidence);
            if (!existing.category || existing.category === 'Other') {
              existing.category = h.category || existing.category;
            }
          } else {
            merged.set(key, {
              platform: h.platform,
              url: h.url,
              username: trimmed,
              confidence: h.confidence,
              category: h.category || guessCategory(h.platform),
              tools: ['M'],
            });
          }
          if (h.status === 'confirmed') foundCount++;
        }
        nextStatus.maigret = { status: 'ok', found: d.totalFound ?? foundCount };
      }

      // --- Sherlock ---
      if (settled[1].status === 'fulfilled') {
        const d = settled[1].value;
        const all = [...(d.found || []), ...(d.available || [])];
        for (const h of all) {
          if (!h.url) continue;
          const key = h.url;
          const existing = merged.get(key);
          if (existing) {
            if (!existing.tools.includes('S')) existing.tools.push('S');
            existing.confidence = Math.max(existing.confidence, h.confidence);
            if ((!existing.category || existing.category === 'Other') && h.category) {
              existing.category = h.category;
            }
          } else {
            merged.set(key, {
              platform: h.platform,
              url: h.url,
              username: trimmed,
              confidence: h.confidence,
              category: h.category || guessCategory(h.platform),
              tools: ['S'],
            });
          }
        }
        nextStatus.sherlock = { status: 'ok', found: d.totalFound ?? (d.found?.length || 0) };
      }

      // --- UsernameSearch (3000+ platform grid) ---
      if (settled[2].status === 'fulfilled') {
        const d = settled[2].value;
        const all = (d.discovered || []) as AccountResult[];
        for (const h of all) {
          if (!h.url) continue;
          const key = h.url;
          const existing = merged.get(key);
          if (existing) {
            if (!existing.tools.includes('U')) existing.tools.push('U');
            existing.confidence = Math.max(existing.confidence, h.confidence);
          } else {
            merged.set(key, {
              platform: h.platform,
              url: h.url,
              username: h.username || trimmed,
              confidence: h.confidence,
              category: guessCategory(h.platform),
              tools: ['U'],
            });
          }
        }
        nextStatus.usernameSearch = { status: 'ok', found: all.length };
      }

      const sorted = Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
      setMergedResults(sorted);
      setToolsStatus(nextStatus);
      setUsernameSearched(true);
      setUsernameSearching(false);
    }, 700);

    return () => {
      if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    };
  }, [username, currentCase, investigationCountry, investigationLanguage, investigationRegionalOnly]);

  // ===== LIVE SOCIAL SEARCH =====
  useEffect(() => {
    if (!currentCase) return;
    const trimmed = socialQuery.trim();

    if (trimmed.length < 2) {
      setSocialResults([]);
      return;
    }

    if (socialDebounce.current) clearTimeout(socialDebounce.current);

    socialDebounce.current = setTimeout(async () => {
      const reqId = ++socialReqId.current;
      setSocialSearching(true);
      setSocialResults([]);

      try {
        const data = await osintApi.socialSearch({
          query: trimmed,
          caseId: currentCase.id,
          type: socialType,
          ...locale,
        });
        if (reqId === socialReqId.current) {
          setSocialResults(data.results || []);
        }
      } catch {
        if (reqId === socialReqId.current) {
          setSocialResults([]);
        }
      } finally {
        if (reqId === socialReqId.current) {
          setSocialSearching(false);
        }
      }
    }, 700);

    return () => {
      if (socialDebounce.current) clearTimeout(socialDebounce.current);
    };
  }, [socialQuery, socialType, currentCase, investigationCountry, investigationLanguage, investigationRegionalOnly]);

  // ===== LIVE UNCENSORED SEARCH =====
  useEffect(() => {
    if (!currentCase) return;
    const trimmed = uncensoredQuery.trim();

    if (trimmed.length < 2) {
      setUncensoredResults([]);
      return;
    }

    if (uncensoredDebounce.current) clearTimeout(uncensoredDebounce.current);

    uncensoredDebounce.current = setTimeout(async () => {
      const reqId = ++uncensoredReqId.current;
      setUncensoredSearching(true);
      setUncensoredResults([]);

      try {
        const data = await osintApi.uncensoredSearch({
          query: trimmed,
          caseId: currentCase.id,
          ...locale,
        });
        if (reqId === uncensoredReqId.current) {
          setUncensoredResults(data.results || []);
        }
      } catch {
        if (reqId === uncensoredReqId.current) {
          setUncensoredResults([]);
        }
      } finally {
        if (reqId === uncensoredReqId.current) {
          setUncensoredSearching(false);
        }
      }
    }, 700);

    return () => {
      if (uncensoredDebounce.current) clearTimeout(uncensoredDebounce.current);
    };
  }, [uncensoredQuery, currentCase, investigationCountry, investigationLanguage, investigationRegionalOnly]);

  // ===== LIVE REVERSE LOOKUP =====
  useEffect(() => {
    if (!currentCase) return;
    const trimmed = reverseValue.trim();

    if (trimmed.length < 2) {
      setReverseResults([]);
      return;
    }

    if (reverseDebounce.current) clearTimeout(reverseDebounce.current);

    reverseDebounce.current = setTimeout(async () => {
      const reqId = ++reverseReqId.current;
      setReverseSearching(true);
      setReverseResults([]);

      try {
        const data = await osintApi.reverseLookup({
          type: reverseType,
          value: trimmed,
          caseId: currentCase.id,
          ...locale,
        });
        if (reqId === reverseReqId.current) {
          setReverseResults(data.results || []);
        }
      } catch {
        if (reqId === reverseReqId.current) {
          setReverseResults([]);
        }
      } finally {
        if (reqId === reverseReqId.current) {
          setReverseSearching(false);
        }
      }
    }, 700);

    return () => {
      if (reverseDebounce.current) clearTimeout(reverseDebounce.current);
    };
  }, [reverseValue, reverseType, currentCase, investigationCountry, investigationLanguage, investigationRegionalOnly]);

  const addAsEntity = async (name: string, type: EntityType, value: string) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name,
        type,
        value,
      });
    } catch {
      // ignore
    }
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Crosshair className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to use OSINT tools</p>
        </div>
      </div>
    );
  }

  // Group merged username results by category
  const groupedResults = PLATFORM_CATEGORIES.map((cat) => {
    const matches = mergedResults.filter((r) =>
      cat.platforms.some((p) => r.platform.toLowerCase().includes(p.toLowerCase().split('/')[0]))
    );
    return { ...cat, matches };
  }).filter((c) => c.matches.length > 0);

  // Results that didn't match any known category
  const unclassifiedResults = mergedResults.filter(
    (r) => !PLATFORM_CATEGORIES.some((cat) =>
      cat.platforms.some((p) => r.platform.toLowerCase().includes(p.toLowerCase().split('/')[0]))
    )
  );

  const toolsRunCount =
    (toolsStatus.maigret.status === 'ok' ? 1 : 0) +
    (toolsStatus.sherlock.status === 'ok' ? 1 : 0) +
    (toolsStatus.usernameSearch.status === 'ok' ? 1 : 0);
  const highMatchCount = mergedResults.filter((r) => r.confidence > 80).length;

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Crosshair className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">OSINT TOOLS</h2>
            <p className="text-[10px] text-muted-foreground">Live intelligence gathering · auto-scan as you type</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Global investigation locale — sets the country / language / regional-only
              flag that every OSINT/search/recon panel reads from the shared store. */}
          <CountryLocaleSelector compact />
          {usernameSearching && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
              <Zap className="size-2.5 mr-0.5 animate-pulse" />
              SCANNING
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs — forceMount on every TabsContent so switching tabs preserves state */}
      <Tabs defaultValue="autorecon" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 border-b border-cyan-500/10">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-auto bg-muted/30 border border-cyan-500/10">
              <TabsTrigger value="autorecon" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Crosshair className="size-3.5 mr-1" />
                Auto Recon
              </TabsTrigger>
              <TabsTrigger value="username" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40">
                <UserSearch className="size-3.5 mr-1" />
                Username
              </TabsTrigger>
              <TabsTrigger value="tiktok" className="text-xs data-[state=active]:bg-pink-500/15 data-[state=active]:text-pink-300 data-[state=active]:border-pink-500/40">
                <Music2 className="size-3.5 mr-1" />
                TikTok
              </TabsTrigger>
              <TabsTrigger value="socialmedia" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40">
                <Users className="size-3.5 mr-1" />
                Social Media
              </TabsTrigger>
              <TabsTrigger value="crawl" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <ScanSearch className="size-3.5 mr-1" />
                Crawler
              </TabsTrigger>
              <TabsTrigger value="wayback" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <History className="size-3.5 mr-1" />
                Wayback
              </TabsTrigger>
              <TabsTrigger value="people" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Users className="size-3.5 mr-1" />
                People
              </TabsTrigger>
              <TabsTrigger value="images" className="text-xs data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
                <ImageIcon className="size-3.5 mr-1" />
                Images
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Hash className="size-3.5 mr-1" />
                Social
              </TabsTrigger>
              <TabsTrigger value="uncensored" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Globe className="size-3.5 mr-1" />
                Deep Web
              </TabsTrigger>
              <TabsTrigger value="reverse" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Phone className="size-3.5 mr-1" />
                Reverse
              </TabsTrigger>
              <TabsTrigger value="catalog" className="text-xs data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Library className="size-3.5 mr-1" />
                Catalog
              </TabsTrigger>
              <TabsTrigger value="external" className="text-xs data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40">
                <Globe2 className="size-3.5 mr-1" />
                External
              </TabsTrigger>
            </TabsList>
          </ScrollArea>
        </div>

        {/* ===== AUTO RECON — one-click parallel scanners ===== */}
        <TabsContent value="autorecon" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <AutoReconPanel />
        </TabsContent>

        {/* ===== USERNAME — UNIFIED Maigret + Sherlock + UsernameSearch ===== */}
        <TabsContent value="username" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* Live search bar */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
                  <UserSearch className="size-3.5" />
                  USERNAME SCANNER · UNIFIED (MAIGRET + SHERLOCK + 3000+ PLATFORMS) · LIVE
                </Label>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                  <Input
                    placeholder="Type a username to auto-merge results from Maigret + Sherlock + 3000+ platforms..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="cyber-input h-11 pl-10 font-mono text-sm"
                  />
                  {usernameSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
                  )}
                  {!usernameSearching && username.length >= 2 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <div className="size-2 rounded-full bg-green-400 pulse-dot" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5 text-cyan-400" />
                  Runs 3 tools in parallel · merges & dedupes by URL · {mergedResults.length} unique hits
                </p>
              </div>

              {/* Tools status row */}
              {usernameSearched && (
                <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
                  {([
                    { key: 'maigret' as const, label: 'MAIGRET', letter: 'M', color: 'cyan', status: toolsStatus.maigret },
                    { key: 'sherlock' as const, label: 'SHERLOCK', letter: 'S', color: 'blue', status: toolsStatus.sherlock },
                    { key: 'usernameSearch' as const, label: 'USERNAME SCAN', letter: 'U', color: 'purple', status: toolsStatus.usernameSearch },
                  ]).map((t) => (
                    <div
                      key={t.key}
                      className={
                        'cyber-card rounded-md p-2.5 flex items-center gap-2 ' +
                        (t.status.status === 'ok'
                          ? 'border-green-500/30'
                          : t.status.status === 'error'
                            ? 'border-red-500/30'
                            : 'border-cyan-500/20')
                      }
                    >
                      <div
                        className={
                          'size-6 shrink-0 rounded flex items-center justify-center text-[10px] font-mono font-bold ' +
                          (t.color === 'cyan'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : t.color === 'blue'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30')
                        }
                        title={t.label}
                      >
                        {t.letter}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-mono tracking-wider text-muted-foreground truncate">{t.label}</p>
                        <p
                          className={
                            'text-[11px] font-mono font-semibold ' +
                            (t.status.status === 'ok'
                              ? 'text-green-400'
                              : t.status.status === 'error'
                                ? 'text-red-400'
                                : t.status.status === 'running'
                                  ? 'text-amber-400'
                                  : 'text-muted-foreground')
                          }
                        >
                          {t.status.status === 'ok' && (
                            <>
                              <CheckCircle2 className="size-2.5 inline mr-0.5" />
                              {t.status.found} FOUND
                            </>
                          )}
                          {t.status.status === 'error' && (
                            <>
                              <XCircle className="size-2.5 inline mr-0.5" />
                              FAILED
                            </>
                          )}
                          {t.status.status === 'running' && (
                            <>
                              <Loader2 className="size-2.5 inline mr-0.5 animate-spin" />
                              RUNNING
                            </>
                          )}
                          {t.status.status === 'idle' && 'IDLE'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats bar — TOTAL · HIGH MATCH · TOOLS RUN */}
              {usernameSearched && mergedResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
                  <div className="cyber-card rounded-md p-3 text-center">
                    <p className="text-xl font-bold neon-cyan">{mergedResults.length}</p>
                    <p className="text-[9px] text-muted-foreground tracking-wide">PLATFORMS FOUND</p>
                  </div>
                  <div className="cyber-card rounded-md p-3 text-center">
                    <p className="text-xl font-bold neon-green">{highMatchCount}</p>
                    <p className="text-[9px] text-muted-foreground tracking-wide">HIGH MATCH</p>
                  </div>
                  <div className="cyber-card rounded-md p-3 text-center">
                    <p className="text-xl font-bold neon-purple">{toolsRunCount}/3</p>
                    <p className="text-[9px] text-muted-foreground tracking-wide">TOOLS RUN</p>
                  </div>
                </div>
              )}

              {/* Category grid — merged results grouped */}
              {groupedResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupedResults.map((cat) => (
                    <div key={cat.name} className="cyber-card rounded-md p-3 animate-fade-in-up">
                      <h3 className="text-xs font-semibold mb-2 tracking-wide neon-cyan flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-cyan-400" />
                        {cat.name.toUpperCase()}
                        <span className="text-[9px] text-muted-foreground ml-auto">{cat.matches.length}</span>
                      </h3>
                      <div className="space-y-1.5">
                        {cat.matches.map((result, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 p-2 rounded bg-cyan-500/[0.02] hover:bg-cyan-500/5 transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {result.confidence > 80 ? (
                                <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />
                              ) : result.confidence > 50 ? (
                                <div className="size-3.5 rounded-full border border-amber-400/50 shrink-0" />
                              ) : (
                                <XCircle className="size-3.5 text-muted-foreground/40 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium truncate">{result.platform}</p>
                                  {/* Tools badges — which tools found this hit */}
                                  <div className="flex items-center gap-0.5">
                                    {result.tools.map((t) => (
                                      <span
                                        key={t}
                                        className={
                                          'text-[8px] font-mono font-bold px-1 rounded leading-none h-3 inline-flex items-center ' +
                                          (t === 'M'
                                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                            : t === 'S'
                                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30')
                                        }
                                        title={t === 'M' ? 'Maigret' : t === 'S' ? 'Sherlock' : 'UsernameSearch'}
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-cyan-400/50 hover:text-cyan-400 truncate block font-mono"
                                >
                                  {result.url.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[9px] h-4 px-1 ${
                                  result.confidence > 80
                                    ? 'text-green-400 border-green-400/30 bg-green-500/5'
                                    : result.confidence > 50
                                    ? 'text-amber-400 border-amber-400/30 bg-amber-500/5'
                                    : 'text-muted-foreground border-muted-foreground/30'
                                }`}
                              >
                                {result.confidence}%
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-opacity"
                                onClick={() =>
                                  addAsEntity(
                                    `${result.username}@${result.platform}`,
                                    'username',
                                    result.url
                                  )
                                }
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unclassified results */}
              {usernameSearched && groupedResults.length === 0 && unclassifiedResults.length > 0 && (
                <div className="space-y-2">
                  {unclassifiedResults.map((result, i) => (
                    <Card key={i} className="cyber-card rounded-md animate-fade-in-up">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium">{result.platform}</h4>
                              <div className="flex items-center gap-0.5">
                                {result.tools.map((t) => (
                                  <span
                                    key={t}
                                    className={
                                      'text-[8px] font-mono font-bold px-1 rounded leading-none h-3 inline-flex items-center ' +
                                      (t === 'M'
                                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                        : t === 'S'
                                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                          : 'bg-purple-500/15 text-purple-300 border border-purple-500/30')
                                    }
                                    title={t === 'M' ? 'Maigret' : t === 'S' ? 'Sherlock' : 'UsernameSearch'}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-4 ${
                                  result.confidence > 80
                                    ? 'text-green-400 border-green-400/30'
                                    : result.confidence > 50
                                    ? 'text-amber-400 border-amber-400/30'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {result.confidence}%
                              </Badge>
                            </div>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400/60 hover:text-cyan-400 flex items-center gap-1 mt-0.5 font-mono"
                            >
                              <ExternalLink className="size-2.5" />
                              {result.url.length > 50 ? `${result.url.slice(0, 50)}...` : result.url}
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs shrink-0 text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() =>
                              addAsEntity(
                                `${result.username}@${result.platform}`,
                                'username',
                                result.url
                              )
                            }
                          >
                            <Plus className="size-3 mr-0.5" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!usernameSearching && !usernameSearched && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="relative mb-3">
                    <UserSearch className="size-10 opacity-20" />
                    <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
                  </div>
                  <p className="text-sm neon-cyan">Start typing a username</p>
                  <p className="text-[10px] mt-1 text-muted-foreground/60">
                    Auto-runs Maigret + Sherlock + 3000+ platform grid as you type
                  </p>
                </div>
              )}

              {/* Loading skeleton */}
              {usernameSearching && mergedResults.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="cyber-card rounded-md p-3">
                      <div className="h-3 w-20 rounded shimmer mb-2" />
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="flex items-center gap-2 py-1.5">
                          <div className="size-3.5 rounded-full shimmer" />
                          <div className="h-2 flex-1 rounded shimmer" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== TIKTOK TRACKER — track a person's TikTok activity ===== */}
        <TabsContent value="tiktok" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <TikTokTrackerPanel />
        </TabsContent>

        {/* ===== SOCIAL MEDIA OSINT — 6 platforms (tiktok/facebook/telegram/slack/instagram/snapchat) ===== */}
        <TabsContent value="socialmedia" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <SocialMediaPanel />
        </TabsContent>

        {/* ===== ACTIVE CRAWLER ===== */}
        <TabsContent value="crawl" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <CrawlerPanel />
        </TabsContent>

        {/* ===== WAYBACK MACHINE — past → now timeline ===== */}
        <TabsContent value="wayback" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <WaybackPanel />
        </TabsContent>

        {/* ===== PEOPLE SEARCH — idcrawl-style meta people search (artemis37) ===== */}
        <TabsContent value="people" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <PeopleSearchPanel />
        </TabsContent>

        {/* ===== IMAGE SEARCH ===== */}
        <TabsContent value="images" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ImageSearchPanel />
        </TabsContent>

        {/* ===== SOCIAL MONITOR — LIVE ===== */}
        <TabsContent value="social" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
                  <Radio className="size-3.5" />
                  SOCIAL MONITOR · LIVE
                </Label>
                <div className="flex gap-2">
                  <Select value={socialType} onValueChange={(v) => setSocialType(v as typeof socialType)}>
                    <SelectTrigger className="w-32 cyber-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hashtag">Hashtag</SelectItem>
                      <SelectItem value="mention">Mention</SelectItem>
                      <SelectItem value="keyword">Keyword</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                    <Input
                      placeholder="Type to search social..."
                      value={socialQuery}
                      onChange={(e) => setSocialQuery(e.target.value)}
                      className="cyber-input h-10 pl-10 font-mono text-sm"
                    />
                    {socialSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5 text-cyan-400" />
                  Auto-searches as you type
                </p>
              </div>

              {socialSearching && socialResults.length === 0 && (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3 rounded-md cyber-card">
                      <div className="h-3 w-3/4 rounded shimmer mb-2" />
                      <div className="h-2 w-full rounded shimmer" />
                    </div>
                  ))}
                </div>
              )}

              {socialResults.length > 0 && (
                <div className="space-y-2">
                  {socialResults.map((result, i) => (
                    <Card key={i} className="cyber-card rounded-md animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                      <CardContent className="p-3">
                        <h4 className="text-sm font-medium text-cyan-50">{result.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.snippet}</p>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5 mt-1 font-mono"
                        >
                          <ExternalLink className="size-2.5" />
                          {result.source}
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!socialSearching && socialQuery.length >= 2 && socialResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Radio className="size-6 mb-2 opacity-30" />
                  <p className="text-xs">No social results for &quot;{socialQuery}&quot;</p>
                </div>
              )}

              {!socialSearching && socialQuery.length < 2 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="relative mb-3">
                    <Radio className="size-8 opacity-20" />
                    <div className="absolute inset-0 blur-xl bg-purple-500/10 rounded-full" />
                  </div>
                  <p className="text-sm neon-purple">Type to monitor social</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== UNCENSORED SEARCH — LIVE ===== */}
        <TabsContent value="uncensored" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
                  <Globe className="size-3.5" />
                  DEEP WEB SEARCH · LIVE
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                  <Input
                    placeholder="Type to search uncensored web..."
                    value={uncensoredQuery}
                    onChange={(e) => setUncensoredQuery(e.target.value)}
                    className="cyber-input h-11 pl-10 font-mono text-sm"
                  />
                  {uncensoredSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5 text-cyan-400" />
                  Uncensored indexing via Qwant/Gibiru · auto-search as you type
                </p>
              </div>

              {uncensoredSearching && uncensoredResults.length === 0 && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-3 rounded-md cyber-card">
                      <div className="h-3 w-3/4 rounded shimmer mb-2" />
                      <div className="h-2 w-full rounded shimmer mb-1" />
                      <div className="h-2 w-2/3 rounded shimmer" />
                    </div>
                  ))}
                </div>
              )}

              {uncensoredResults.length > 0 && (
                <div className="space-y-2">
                  {uncensoredResults.map((result, i) => (
                    <Card key={i} className="cyber-card rounded-md animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-cyan-50">{result.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.snippet}</p>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5 mt-1 font-mono"
                            >
                              <ExternalLink className="size-2.5" />
                              {result.url.length > 50 ? `${result.url.slice(0, 50)}...` : result.url}
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs shrink-0 text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() => addAsEntity(result.title, 'url', result.url)}
                          >
                            <Plus className="size-3 mr-0.5" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!uncensoredSearching && uncensoredQuery.length < 2 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="relative mb-3">
                    <Globe className="size-8 opacity-20" />
                    <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
                  </div>
                  <p className="text-sm neon-cyan">Type to search the deep web</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== REVERSE LOOKUP — LIVE ===== */}
        <TabsContent value="reverse" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
                  <Target className="size-3.5" />
                  REVERSE LOOKUP · LIVE
                </Label>
                <div className="flex gap-2">
                  <Select value={reverseType} onValueChange={(v) => setReverseType(v as typeof reverseType)}>
                    <SelectTrigger className="w-32 cyber-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">
                        <span className="flex items-center gap-1"><Phone className="size-3" /> Phone</span>
                      </SelectItem>
                      <SelectItem value="email">
                        <span className="flex items-center gap-1"><Mail className="size-3" /> Email</span>
                      </SelectItem>
                      <SelectItem value="username">
                        <span className="flex items-center gap-1"><UserSearch className="size-3" /> Username</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                    <Input
                      placeholder={reverseType === 'phone' ? '+1-555-...' : reverseType === 'email' ? 'email@...' : 'username'}
                      value={reverseValue}
                      onChange={(e) => setReverseValue(e.target.value)}
                      className="cyber-input h-10 pl-10 font-mono text-sm"
                    />
                    {reverseSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5 text-cyan-400" />
                  Auto-lookup as you type
                </p>
              </div>

              {reverseSearching && reverseResults.length === 0 && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-3 rounded-md cyber-card">
                      <div className="h-3 w-1/2 rounded shimmer mb-2" />
                      <div className="h-2 w-3/4 rounded shimmer" />
                    </div>
                  ))}
                </div>
              )}

              {reverseResults.length > 0 && (
                <div className="space-y-2">
                  {reverseResults.map((result, i) => (
                    <Card key={i} className="cyber-card rounded-md animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-cyan-50 truncate">{result.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-4 shrink-0 ${
                                  result.confidence > 80
                                    ? 'text-green-400 border-green-400/30'
                                    : result.confidence > 50
                                    ? 'text-amber-400 border-amber-400/30'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {result.confidence}%
                              </Badge>
                            </div>
                            {result.snippet && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                {result.snippet}
                              </p>
                            )}
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-cyan-400/70 hover:text-cyan-300 truncate block mt-0.5"
                            >
                              {result.url}
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs shrink-0 text-cyan-400 hover:bg-cyan-500/10 ml-2"
                            onClick={() => addAsEntity(result.title, 'person', result.url)}
                          >
                            <Plus className="size-3 mr-0.5" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!reverseSearching && reverseValue.length < 2 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="relative mb-3">
                    <Target className="size-8 opacity-20" />
                    <div className="absolute inset-0 blur-xl bg-purple-500/10 rounded-full" />
                  </div>
                  <p className="text-sm neon-purple">Type to reverse lookup</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== OSINT CATALOG — curated GitHub OSINT project directory (artemis37) ===== */}
        <TabsContent value="catalog" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <OsintCatalogPanel />
        </TabsContent>

        {/* ===== EXTERNAL LOOKUP — 49-tool deep-link + parallel search (artemis37) ===== */}
        <TabsContent value="external" forceMount className="flex flex-col flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <ExternalLookupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
