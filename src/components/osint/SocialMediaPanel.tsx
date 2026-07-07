'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Music2,
  Facebook,
  Send,
  MessageSquare,
  Instagram,
  Ghost,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Users,
  Zap,
  CheckCircle2,
  Radio,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// SocialMediaPanel — unified social-media OSINT panel for 6 platforms.
//
// Platforms supported (no open profile API — uses web_search + page_reader):
//   - TikTok     (Music2 icon, pink accent)
//   - Facebook   (Facebook icon, blue accent)
//   - Telegram   (Send icon, cyan accent)
//   - Slack      (MessageSquare icon, purple accent)
//   - Instagram  (Instagram icon, pink/purple accent)
//   - Snapchat  (Ghost icon, yellow accent)
//
// Investigator picks a platform → types a query (username / real name / keyword)
// → live auto-search (700ms debounce) calls /api/osint/social-media → returns
// structured profile cards with: extracted bio, follower count badge, profile
// image (when found), confidence %, View Profile external link, Add-to-Case
// button (creates a username entity in the case graph).
//
// Author:  artemis37
// Tool:    PHANTOM SocialMediaOSINT
// =============================================================================

type PlatformKey = 'tiktok' | 'facebook' | 'telegram' | 'slack' | 'instagram' | 'snapchat';

interface SocialProfile {
  url: string;
  title: string;
  snippet: string;
  extractedBio?: string;
  followerCount?: string;
  profileImage?: string;
  recentPosts?: string[];
  confidence: number;
}

interface SocialMediaResult {
  platform: string;
  query: string;
  profiles: SocialProfile[];
  totalFound: number;
  rateLimited: boolean;
  pagesRead: number;
  author: string;
  tool: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

interface PlatformMeta {
  key: PlatformKey;
  label: string;
  icon: typeof Music2;
  accent: string;          // active border + glow color (Tailwind)
  activeBg: string;        // active button background
  activeText: string;      // active button text color
  placeholder: string;
  queryLabel: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: Music2,
    accent: 'border-pink-500/60 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
    activeBg: 'bg-pink-500/15',
    activeText: 'text-pink-300',
    placeholder: 'TikTok @handle (e.g. charlidamelio)',
    queryLabel: 'TIKTOK @HANDLE / KEYWORD',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    accent: 'border-cyan-500/60 shadow-[0_0_10px_rgba(0,229,255,0.4)]',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-300',
    placeholder: 'Facebook username or real name',
    queryLabel: 'FACEBOOK USERNAME / NAME',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: Send,
    accent: 'border-cyan-500/60 shadow-[0_0_10px_rgba(0,229,255,0.4)]',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-300',
    placeholder: 'Telegram @channel or username',
    queryLabel: 'TELEGRAM @CHANNEL / USERNAME',
  },
  {
    key: 'slack',
    label: 'Slack',
    icon: MessageSquare,
    accent: 'border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.4)]',
    activeBg: 'bg-purple-500/15',
    activeText: 'text-purple-300',
    placeholder: 'Slack workspace, team, or community name',
    queryLabel: 'SLACK WORKSPACE / TEAM',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    accent: 'border-pink-500/60 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
    activeBg: 'bg-pink-500/15',
    activeText: 'text-pink-300',
    placeholder: 'Instagram @username',
    queryLabel: 'INSTAGRAM @USERNAME',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    icon: Ghost,
    accent: 'border-yellow-500/60 shadow-[0_0_10px_rgba(234,179,8,0.4)]',
    activeBg: 'bg-yellow-500/15',
    activeText: 'text-yellow-300',
    placeholder: 'Snapchat username',
    queryLabel: 'SNAPCHAT USERNAME',
  },
];

function platformMeta(key: PlatformKey): PlatformMeta {
  return PLATFORMS.find((p) => p.key === key) || PLATFORMS[0];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SocialMediaPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);

  const [platform, setPlatform] = useState<PlatformKey>('tiktok');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SocialMediaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // Live auto-search as you type (700ms debounce) — fires on every platform
  // switch + every keystroke (when query.length >= 2).
  useEffect(() => {
    const trimmed = query.trim().replace(/^@+/, '');
    if (trimmed.length < 2) {
      setResult(null);
      setSearched(false);
      return;
    }

    if (debounce.current) clearTimeout(debounce.current);

    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      setResult(null);

      try {
        const data = await osintApi.socialMedia({
          platform,
          query: trimmed,
          caseId: currentCase?.id,
          country,
          language,
          regionalOnly,
        });
        if (id === reqId.current) {
          setResult(data);
          setSearched(true);
        }
      } catch {
        if (id === reqId.current) {
          setResult(null);
          setSearched(true);
        }
      } finally {
        if (id === reqId.current) {
          setLoading(false);
        }
      }
    }, 700);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [platform, query, currentCase, country, language, regionalOnly]);

  const addAsEntity = async (profile: SocialProfile) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: `${platformMeta(platform).label}: ${profile.title.slice(0, 50)}`,
        type: 'username',
        value: profile.url,
      });
    } catch {
      // ignore — entity create may fail for dupes
    }
  };

  const meta = platformMeta(platform);
  const ActiveIcon = meta.icon;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Users className="size-4 neon-cyan" />
          </div>
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">SOCIAL MEDIA OSINT</h2>
            <p className="text-[10px] text-muted-foreground">
              6 platforms · web_search + page_reader · live
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="text-cyan-400/70">artemis37 · Social OSINT</span>
          {loading && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
              <Radio className="size-2.5 mr-0.5 animate-spin" />
              SCANNING
            </Badge>
          )}
          {!loading && result && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
              <CheckCircle2 className="size-2.5 mr-0.5" />
              {result.totalFound} FOUND
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* ===== Platform selector — 6 toggle buttons ===== */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Users className="size-3.5" />
              PLATFORM · SELECT ONE
            </Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const isActive = p.key === platform;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    aria-pressed={isActive}
                    className={`relative flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-md border transition-all duration-200 group ${
                      isActive
                        ? `${p.activeBg} ${p.activeText} ${p.accent}`
                        : 'bg-muted/20 border-cyan-500/10 text-muted-foreground hover:bg-muted/30 hover:border-cyan-500/30'
                    }`}
                  >
                    <Icon className={`size-4 ${isActive ? '' : 'opacity-70 group-hover:opacity-100'}`} />
                    <span className="text-[10px] font-medium tracking-wide">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== Query input — live ===== */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <ActiveIcon className="size-3.5" />
              {meta.queryLabel} · LIVE
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
              <Input
                placeholder={meta.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="cyber-input h-11 pl-10 font-mono text-sm"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
              )}
              {!loading && query.trim().length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="size-2 rounded-full bg-green-400 pulse-dot" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-cyan-400" />
              Auto-scans {meta.label} as you type · 2 targeted queries + page_reader
              {result && ` · ${result.totalFound} profile(s) found`}
            </p>
          </div>

          {/* ===== Stats row ===== */}
          {result && (
            <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{result.totalFound}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">PROFILES FOUND</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-purple">{result.pagesRead}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">PAGES READ</p>
              </div>
              <div className={`cyber-card rounded-md p-3 text-center ${result.rateLimited ? 'border-amber-500/40' : ''}`}>
                <p className={`text-xl font-bold ${result.rateLimited ? 'text-amber-400' : 'neon-green'}`}>
                  {result.rateLimited ? 'YES' : 'NO'}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-wide">RATE LIMITED</p>
              </div>
            </div>
          )}

          {/* Rate-limit warning banner */}
          {result?.rateLimited && (
            <div className="flex items-start gap-2 p-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 animate-fade-in-up">
              <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-amber-300 font-medium">Rate limit encountered</p>
                <p className="text-[10px] text-amber-400/70">
                  Some queries were throttled. Partial results shown — retry in a few seconds for full coverage.
                </p>
              </div>
            </div>
          )}

          {/* ===== Loading skeleton ===== */}
          {loading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="cyber-card rounded-md p-3">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full shimmer shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 rounded shimmer" />
                      <div className="h-2 w-3/4 rounded shimmer" />
                      <div className="h-2 w-full rounded shimmer" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Results — scrollable profile cards ===== */}
          {result && !loading && result.profiles.length > 0 && (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scroll">
              {result.profiles.map((profile, i) => (
                <ProfileCard
                  key={`${profile.url}-${i}`}
                  profile={profile}
                  platformLabel={meta.label}
                  onAdd={() => addAsEntity(profile)}
                  canAdd={!!currentCase}
                  delayMs={i * 50}
                />
              ))}
            </div>
          )}

          {/* ===== Empty state ===== */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Users className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Pick a platform & start typing</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                6 platforms · TikTok · Facebook · Telegram · Slack · Instagram · Snapchat
              </p>
            </div>
          )}

          {/* Searched but no results */}
          {!loading && searched && result && result.profiles.length === 0 && (
            <Card className="cyber-card rounded-md">
              <CardContent className="p-6 text-center">
                <Users className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No profiles found on {meta.label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Try a different query, switch platforms, or wait and retry if rate-limited.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile card sub-component
// ---------------------------------------------------------------------------

function ProfileCard({
  profile,
  platformLabel,
  onAdd,
  canAdd,
  delayMs = 0,
}: {
  profile: SocialProfile;
  platformLabel: string;
  onAdd: () => void;
  canAdd: boolean;
  delayMs?: number;
}) {
  const [showPosts, setShowPosts] = useState(false);

  const confidenceColor =
    profile.confidence >= 85
      ? 'text-green-400 border-green-400/30 bg-green-500/5'
      : profile.confidence >= 75
        ? 'text-amber-400 border-amber-400/30 bg-amber-500/5'
        : 'text-muted-foreground border-cyan-500/20 bg-muted/20';

  return (
    <div
      className="cyber-card rounded-md p-3 transition-all duration-300 hover:border-cyan-500/40 group animate-fade-in-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Profile image */}
        <div className="size-10 rounded-full border border-cyan-500/20 overflow-hidden shrink-0 bg-muted/40 flex items-center justify-center">
          {profile.profileImage ? (
            <img
              src={profile.profileImage}
              alt={profile.title}
              className="size-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Users className="size-4 text-cyan-400/40" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-cyan-50 truncate" title={profile.title}>
                {profile.title}
              </h4>
              <a
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-cyan-400/60 hover:text-cyan-300 truncate block font-mono"
                title={profile.url}
              >
                {profile.url.replace(/^https?:\/\//, '').slice(0, 80)}
              </a>
            </div>
            <Badge variant="outline" className={`text-[9px] h-5 shrink-0 ${confidenceColor}`}>
              {profile.confidence}%
            </Badge>
          </div>

          {/* Follower count badge */}
          {profile.followerCount && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[9px] h-5">
                <Users className="size-2.5 mr-0.5" />
                {profile.followerCount}
              </Badge>
              <span className="text-[9px] text-muted-foreground/60">· {platformLabel}</span>
            </div>
          )}

          {/* Bio / snippet */}
          {profile.extractedBio && (
            <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
              {profile.extractedBio}
            </p>
          )}
          {!profile.extractedBio && profile.snippet && (
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">
              {profile.snippet}
            </p>
          )}

          {/* Recent posts toggle */}
          {profile.recentPosts && profile.recentPosts.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowPosts((v) => !v)}
                className="text-[10px] text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1"
              >
                <Zap className="size-2.5" />
                {showPosts ? 'Hide' : 'Show'} {profile.recentPosts.length} recent post(s)
              </button>
              {showPosts && (
                <ul className="mt-1.5 space-y-1 pl-3 border-l border-cyan-500/20">
                  {profile.recentPosts.slice(0, 6).map((post, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground/80 leading-snug">
                      · {post}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-cyan-400 hover:bg-cyan-500/10 transition-colors border border-cyan-500/20"
            >
              <ExternalLink className="size-3" />
              View Profile
            </a>
            {canAdd && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdd}
                className="h-6 px-2 text-[10px] text-purple-400 hover:bg-purple-500/10"
              >
                <Plus className="size-3 mr-0.5" />
                Add to Case
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
