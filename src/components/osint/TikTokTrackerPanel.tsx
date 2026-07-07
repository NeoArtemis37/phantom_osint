'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Music2,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  BadgeCheck,
  Globe,
  Calendar,
  ShieldCheck,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  AlertTriangle,
  Hash,
  AtSign,
  Link2,
  UserCheck,
  Clock,
  TrendingUp,
  Radio,
  Zap,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// =============================================================================
// TikTokTrackerPanel — TikTok user OSINT tracker UI.
// Investigator types a TikTok @handle → live auto-search (800ms debounce) calls
// /api/osint/tiktok-tracker → structured report: profile, posts, reposts,
// messages, activity, linked accounts, risk indicators.
//
// Author:  artemis37
// Tool:    PHANTOM TikTokTracker
// Distinct from CyberWatch's TikTok threat monitoring (Task 27): this tracks a
// *person's* TikTok activity, not TikTok-related cyber threats.
// =============================================================================

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
  author: string;
  tool: string;
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
// Full OSINT Sweep — combined result of TikTok + Maigret + Sherlock
// ---------------------------------------------------------------------------

interface SweepResult {
  tiktok: TikTokReport | null;
  maigret: { totalScanned: number; totalFound: number } | null;
  sherlock: { totalScanned: number; totalFound: number; totalAvailable: number } | null;
  errors: { tiktok?: string; maigret?: string; sherlock?: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a count for compact display (1234 → "1.2K", 1_500_000 → "1.5M"). */
function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
}

/** Relative time from an ISO date, with fallback. */
function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function confidenceColor(c: number): string {
  if (c >= 75) return 'text-green-400';
  if (c >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function riskColor(level: RiskIndicator['level']): string {
  if (level === 'high') return 'bg-red-500/10 text-red-300 border-red-500/40';
  if (level === 'medium') return 'bg-amber-500/10 text-amber-300 border-amber-500/40';
  return 'bg-green-500/10 text-green-300 border-green-500/40';
}

function platformIcon(platform: string) {
  // Use a generic Globe for everything; per-platform icons can be added later.
  return Globe;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBox({ label, value, accent = 'pink' }: { label: string; value: number | string; accent?: 'pink' | 'cyan' }) {
  const valueColor = accent === 'pink' ? 'text-pink-300' : 'neon-cyan';
  const borderColor = accent === 'pink' ? 'border-pink-500/20' : 'border-cyan-500/20';
  return (
    <div className={`cyber-card rounded-md p-2.5 text-center border ${borderColor}`}>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md bg-pink-500/[0.05] border border-pink-500/20 p-2 text-center">
      <p className="text-sm font-bold text-pink-200">{formatCount(value)}</p>
      <p className="text-[8px] text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <Icon className="size-3 text-pink-400/60" />
      <span className="text-muted-foreground/70">{label}:</span>
      <span className="text-cyan-50">{value || '—'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TikTokTrackerPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<TikTokReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState('posts');
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const sweepReqId = useRef(0);

  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);

  // Live auto-search as you type (800ms debounce, race-safe)
  useEffect(() => {
    const trimmed = username.trim().replace(/^@+/, '');
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
        const data = await osintApi.tiktokTrack({ username: trimmed, caseId: currentCase?.id, country, language, regionalOnly });
        if (id === reqId.current) {
          setResult(data);
          setSearched(true);
          // Default tab logic — if no posts but there are sources, show sources
          if (data.posts.length === 0 && data.sources.length > 0) setTab('sources');
          else setTab('posts');
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
    }, 800);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username, currentCase, country, language, regionalOnly]);

  const addProfileToCase = async () => {
    if (!currentCase || !result) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: result.profile.handle,
        type: 'username',
        value: result.profileUrl,
      });
    } catch {
      // ignore
    }
  };

  const addPostToCase = async (post: PostItem) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: post.caption.slice(0, 60) || 'TikTok post',
        type: 'url',
        value: post.url,
      });
    } catch {
      // ignore
    }
  };

  // ---------------------------------------------------------------------------
  // FULL OSINT SWEEP — launch TikTok + Maigret + Sherlock in parallel.
  // Uses Promise.allSettled so partial failures don't break the UI. Stores the
  // results in component state and renders a 3-column summary card.
  // ---------------------------------------------------------------------------
  const runFullSweep = async () => {
    const trimmed = username.trim().replace(/^@+/, '');
    if (trimmed.length < 2) return;

    const id = ++sweepReqId.current;
    setSweepLoading(true);
    setSweepResult(null);
    setSweepOpen(true);

    const settled = await Promise.allSettled([
      osintApi.tiktokTrack({ username: trimmed, caseId: currentCase?.id, country, language, regionalOnly }),
      osintApi.maigret({ username: trimmed, caseId: currentCase?.id, country, language, regionalOnly }),
      osintApi.sherlock({ username: trimmed, caseId: currentCase?.id, country, language, regionalOnly }),
    ]);

    if (id !== sweepReqId.current) return; // stale

    const next: SweepResult = {
      tiktok: settled[0].status === 'fulfilled' ? settled[0].value : null,
      maigret: settled[1].status === 'fulfilled'
        ? { totalScanned: settled[1].value.totalScanned, totalFound: settled[1].value.totalFound }
        : null,
      sherlock: settled[2].status === 'fulfilled'
        ? {
            totalScanned: settled[2].value.totalScanned,
            totalFound: settled[2].value.totalFound,
            totalAvailable: settled[2].value.totalAvailable,
          }
        : null,
      errors: {
        tiktok: settled[0].status === 'rejected' ? (settled[0].reason as Error)?.message : undefined,
        maigret: settled[1].status === 'rejected' ? (settled[1].reason as Error)?.message : undefined,
        sherlock: settled[2].status === 'rejected' ? (settled[2].reason as Error)?.message : undefined,
      },
    };

    setSweepResult(next);
    setSweepLoading(false);

    // If the TikTok part succeeded, also surface it as the main result
    if (next.tiktok) {
      setResult(next.tiktok);
      setSearched(true);
      if (next.tiktok.posts.length === 0 && next.tiktok.sources.length > 0) setTab('sources');
      else setTab('posts');
    }
  };

  // ---------------------------------------------------------------------------
  // Quick pivot — set search input to a different @handle (collision or mention)
  // and the auto-search useEffect will fire.
  // ---------------------------------------------------------------------------
  const pivotToHandle = (handle: string) => {
    const stripped = handle.trim().replace(/^@+/, '');
    if (!stripped) return;
    setUsername(stripped);
  };

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-pink-500/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Music2 className="size-4 text-pink-400" style={{ filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.7))' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-pink-300 tracking-wide" style={{ textShadow: '0 0 6px rgba(236,72,153,0.4)' }}>
              TIKTOK TRACKER
            </h2>
            <p className="text-[10px] text-muted-foreground">
              OSINT · profile · posts · reposts · messages · activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="text-pink-400/70">author: artemis37 · tool: PHANTOM TikTokTracker</span>
          {loading && (
            <Badge className="bg-pink-500/10 text-pink-300 border-pink-500/30 text-[9px]">
              <Radio className="size-2.5 mr-0.5 animate-spin" />
              TRACKING
            </Badge>
          )}
          {!loading && result && (
            <Badge className={`text-[9px] border ${result.found ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
              {result.found ? `FOUND · ${result.confidence}%` : 'NOT FOUND'}
            </Badge>
          )}
        </div>
      </div>

      {/* Search input — live + FULL OSINT SWEEP */}
      <div className="p-4 pb-2 space-y-2 border-b border-pink-500/10">
        <Label className="flex items-center gap-1 text-xs tracking-wide text-pink-400/80">
          <Music2 className="size-3.5" />
          TIKTOK @HANDLE · LIVE TRACK
        </Label>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pink-400/60" />
          <Input
            placeholder="Enter TikTok @handle to track..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 pl-10 font-mono text-sm border-pink-500/30 focus:border-pink-500/60 focus-visible:ring-pink-500/20 bg-pink-500/[0.03]"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-pink-400" />
          )}
          {!loading && username.trim().replace(/^@+/, '').length >= 2 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <div className="size-2 rounded-full bg-pink-400 pulse-dot" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-1">
            <Radio className="size-2.5 text-pink-400" />
            Auto-tracks as you type · profile · posts · reposts · messages · activity · risk
          </p>
          <Button
            type="button"
            onClick={runFullSweep}
            disabled={sweepLoading || username.trim().replace(/^@+/, '').length < 2}
            className="h-8 px-3 text-[10px] font-semibold tracking-wide bg-gradient-to-r from-pink-500/90 to-fuchsia-500/90 hover:from-pink-500 hover:to-fuchsia-500 text-white border-0"
            title="Launch TikTok + Maigret + Sherlock in parallel for this handle"
          >
            {sweepLoading ? (
              <>
                <Loader2 className="size-3 mr-1 animate-spin" />
                SWEEPING
              </>
            ) : (
              <>
                <Zap className="size-3 mr-1 fill-white" />
                FULL OSINT SWEEP
              </>
            )}
          </Button>
        </div>
      </div>

      {/* FULL OSINT SWEEP progress indicator */}
      {sweepLoading && (
        <div className="px-4 py-2 border-b border-pink-500/10">
          <div className="flex items-center gap-3 text-[10px] text-pink-400/80">
            <span className="flex items-center gap-1">
              <Music2 className="size-2.5" /> TikTok
              <span className="size-1.5 rounded-full bg-pink-400 animate-pulse" />
            </span>
            <span className="flex items-center gap-1">
              <Globe className="size-2.5" /> Maigret
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </span>
            <span className="flex items-center gap-1">
              <Search className="size-2.5" /> Sherlock
              <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            </span>
            <span className="ml-auto text-muted-foreground/60">running in parallel…</span>
          </div>
        </div>
      )}

      {/* FULL OSINT SWEEP RESULTS — collapsible 3-column summary */}
      {!sweepLoading && sweepResult && (
        <div className="px-4 py-2 border-b border-pink-500/10">
          <div className="cyber-card rounded-md border border-fuchsia-500/40 bg-fuchsia-500/[0.04]" style={{ boxShadow: '0 0 14px rgba(217,70,239,0.12)' }}>
            <button
              type="button"
              onClick={() => setSweepOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              <Zap className="size-3.5 text-fuchsia-400 fill-fuchsia-400/30" />
              <span className="text-[11px] font-bold tracking-wide text-fuchsia-300" style={{ textShadow: '0 0 6px rgba(217,70,239,0.4)' }}>
                FULL OSINT SWEEP COMPLETE · @{sweepResult.tiktok?.username || username.trim().replace(/^@+/, '')}
              </span>
              <span className="ml-auto text-fuchsia-400/60">
                {sweepOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </span>
            </button>
            {sweepOpen && (
              <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* TikTok column */}
                <div className="rounded-md border border-pink-500/30 bg-pink-500/[0.05] p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Music2 className="size-3 text-pink-400" />
                    <span className="text-[10px] font-bold tracking-wide text-pink-300">TIKTOK</span>
                  </div>
                  {sweepResult.tiktok ? (
                    <>
                      <p className="text-base font-bold text-pink-200">
                        {sweepResult.tiktok.stats.verifiedPosts} <span className="text-[9px] font-normal text-muted-foreground">verified posts</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sweepResult.tiktok.stats.posts} total · {sweepResult.tiktok.confidence}% confidence
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sweepResult.tiktok.found ? '✓ account found' : '✗ not found'} · {sweepResult.tiktok.collisions.length} collisions
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-red-400">✗ {sweepResult.errors.tiktok || 'failed'}</p>
                  )}
                </div>
                {/* Maigret column */}
                <div className="rounded-md border border-cyan-500/30 bg-cyan-500/[0.05] p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Globe className="size-3 text-cyan-400" />
                    <span className="text-[10px] font-bold tracking-wide text-cyan-300">MAIGRET</span>
                  </div>
                  {sweepResult.maigret ? (
                    <>
                      <p className="text-base font-bold text-cyan-200">
                        {sweepResult.maigret.totalFound} <span className="text-[9px] font-normal text-muted-foreground">verified hits</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        probed {sweepResult.maigret.totalScanned}+ platforms
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        switch to Maigret tab and search @{sweepResult.tiktok?.username || username.trim().replace(/^@+/, '')} to view details
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-red-400">✗ {sweepResult.errors.maigret || 'failed'}</p>
                  )}
                </div>
                {/* Sherlock column */}
                <div className="rounded-md border border-blue-500/30 bg-blue-500/[0.05] p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Search className="size-3 text-blue-400" />
                    <span className="text-[10px] font-bold tracking-wide text-blue-300">SHERLOCK</span>
                  </div>
                  {sweepResult.sherlock ? (
                    <>
                      <p className="text-base font-bold text-blue-200">
                        {sweepResult.sherlock.totalFound} <span className="text-[9px] font-normal text-muted-foreground">claimed</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sweepResult.sherlock.totalScanned} sites · {sweepResult.sherlock.totalAvailable} available
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        switch to Sherlock tab and search @{sweepResult.tiktok?.username || username.trim().replace(/^@+/, '')} to view details
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-red-400">✗ {sweepResult.errors.sherlock || 'failed'}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="p-4 space-y-3">
          <div className="cyber-card rounded-md p-4 border-pink-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-full shimmer" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-32 rounded shimmer" />
                <div className="h-2 w-48 rounded shimmer" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded shimmer" />)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded shimmer" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded shimmer" />)}
          </div>
        </div>
      )}

      {/* Error banner */}
      {!loading && result?.error && (
        <div className="m-4 p-3 rounded-md bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>SDK error: {result.error}. Partial results shown below.</span>
        </div>
      )}

      {/* Empty state — before search */}
      {!loading && !result && !searched && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="relative mb-3">
            <Music2 className="size-16 opacity-30 text-pink-400" />
            <div className="absolute inset-0 blur-2xl bg-pink-500/20 rounded-full" />
          </div>
          <p className="text-sm text-pink-300" style={{ textShadow: '0 0 6px rgba(236,72,153,0.4)' }}>
            Enter a TikTok @handle to track
          </p>
          <p className="text-[10px] mt-1 text-muted-foreground/60">
            Tracks profile · posts · reposts · messages · activity
          </p>
        </div>
      )}

      {/* Searched but not found */}
      {!loading && searched && result && !result.found && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            <div className="cyber-card rounded-md p-6 text-center border-pink-500/30">
              <AlertTriangle className="size-10 mx-auto mb-2 text-pink-400/60" />
              <p className="text-sm text-pink-300">No TikTok presence found for @{result.username}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Check the handle spelling — or browse the {result.sources.length} gathered sources below.
              </p>
            </div>
            {result.sources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-pink-400/80 tracking-wide">GATHERED SOURCES ({result.sources.length})</h3>
                {result.sources.map((s, i) => (
                  <div key={i} className="cyber-card rounded-md p-3 group">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-cyan-50 truncate">{s.title || '(no title)'}</p>
                      <Badge variant="outline" className="text-[9px] h-4 text-pink-400 border-pink-500/30 shrink-0">{s.source}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1">{s.snippet}</p>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-pink-400/60 hover:text-pink-300 truncate block">
                      {s.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Result */}
      {!loading && result && result.found && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Profile card */}
          <div className="p-4 pb-2">
            <div className="cyber-card rounded-md p-4 border-pink-500/30 animate-fade-in-up" style={{ boxShadow: '0 0 16px rgba(236,72,153,0.08)' }}>
              <div className="flex items-start gap-4">
                {/* Avatar placeholder */}
                <div className="size-16 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 16px rgba(236,72,153,0.4)' }}>
                  <Music2 className="size-8 text-white" />
                </div>

                {/* Handle / display name / verified */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-pink-300" style={{ textShadow: '0 0 6px rgba(236,72,153,0.4)' }}>
                      {result.profile.handle}
                    </h3>
                    {result.profile.verified && (
                      <BadgeCheck className="size-4 text-pink-400" />
                    )}
                    <Badge variant="outline" className="text-[9px] h-4 text-pink-400 border-pink-500/30 capitalize">
                      {result.profile.accountType}
                    </Badge>
                  </div>
                  {result.profile.displayName && (
                    <p className="text-sm text-cyan-50 truncate">{result.profile.displayName}</p>
                  )}
                  {result.profile.bio && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">{result.profile.bio}</p>
                  )}

                  {/* Meta row */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                    <MetaRow icon={Globe} label="Region" value={result.profile.region} />
                    <MetaRow icon={BadgeCheck} label="Type" value={result.profile.accountType !== 'unknown' ? result.profile.accountType : null} />
                    <MetaRow icon={Calendar} label="Joined" value={result.profile.joinedEstimate} />
                    <MetaRow icon={ShieldCheck} label="Confidence" value={`${result.confidence}%`} />
                  </div>
                </div>
              </div>

              {/* Profile stats */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <ProfileStat label="FOLLOWERS" value={result.profile.followerCount} />
                <ProfileStat label="FOLLOWING" value={result.profile.followingCount} />
                <ProfileStat label="LIKES" value={result.profile.likeCount} />
                <ProfileStat label="VIDEOS" value={result.profile.videoCount} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <a
                  href={result.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300 font-mono"
                >
                  <ExternalLink className="size-3" />
                  PROFILE URL
                </a>
                {currentCase && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] border-pink-500/30 text-pink-300 hover:bg-pink-500/10 ml-auto"
                    onClick={addProfileToCase}
                  >
                    <Plus className="size-3 mr-1" />
                    ADD PROFILE TO CASE
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Collisions warning banner — TikTok URLs with different handles */}
          {result.collisions.length > 0 && (
            <div className="px-4 pb-2">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.08] p-3" style={{ boxShadow: '0 0 10px rgba(245,158,11,0.10)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="size-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold tracking-wide text-amber-300">
                    NAME COLLISIONS DETECTED
                  </span>
                  <span className="text-[9px] text-amber-400/60 ml-1">
                    · TikTok URLs with different handles were found in sources — may have caused false positives in prior runs. Click a chip to pivot.
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.collisions.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pivotToHandle(c.handle)}
                      title={`Click to track ${c.handle} on TikTok`}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50 transition-colors group"
                    >
                      <AtSign className="size-2.5" />
                      {c.handle.replace(/^@/, '')}
                      <span className="opacity-50">· {c.source}</span>
                      <ArrowUpRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats bar */}
          <div className="px-4 pb-2">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 animate-fade-in-up">
              <StatBox label="SOURCES" value={result.stats.sources} />
              <StatBox label="POSTS" value={result.stats.posts} />
              <StatBox label="REPOSTS" value={result.stats.reposts} />
              <StatBox label="MESSAGES" value={result.stats.messages} />
              <StatBox label="HASHTAGS" value={result.stats.hashtags} />
              <StatBox label="MENTIONS" value={result.stats.mentions} />
              <StatBox label="LINKED" value={result.stats.linkedAccounts} />
              <StatBox label="RISK" value={result.stats.riskIndicators} />
            </div>
          </div>

          {/* Risk indicators */}
          {result.riskIndicators.length > 0 && (
            <div className="px-4 pb-2">
              <div className="cyber-card rounded-md p-3 border-pink-500/20">
                <h3 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  RISK INDICATORS ({result.riskIndicators.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.riskIndicators.map((r, i) => (
                    <div key={i} className={`group relative rounded-md border px-2 py-1 text-[10px] ${riskColor(r.level)}`} title={r.detail}>
                      <span className="font-semibold uppercase">{r.level}</span>
                      <span className="mx-1 opacity-50">·</span>
                      <span>{r.label}</span>
                      <div className="hidden group-hover:block absolute z-20 top-full mt-1 left-0 right-0 min-w-[240px] p-2 rounded-md bg-black/95 border border-pink-500/30 text-[9px] text-muted-foreground leading-relaxed shadow-xl">
                        {r.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 px-4">
            <TabsList className="inline-flex w-auto bg-muted/30 border border-pink-500/10 self-start">
              {[
                { v: 'posts', label: 'Posts', n: result.stats.posts },
                { v: 'reposts', label: 'Reposts', n: result.stats.reposts },
                { v: 'messages', label: 'Messages', n: result.stats.messages },
                { v: 'activity', label: 'Activity', n: 0 },
                { v: 'sources', label: 'Sources', n: result.stats.sources },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="text-xs data-[state=active]:bg-pink-500/15 data-[state=active]:text-pink-300 data-[state=active]:border-pink-500/40"
                >
                  {t.label}
                  {t.n > 0 && <span className="ml-1 text-[9px] opacity-70">({t.n})</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-2">
              <TabsContent value="posts" className="m-0">
                <div className="space-y-2 pb-4">
                  {result.posts.length === 0 && (
                    <div className="cyber-card rounded-md p-6 text-center">
                      <Music2 className="size-8 mx-auto mb-2 text-pink-400/30" />
                      <p className="text-xs text-muted-foreground">No posts detected for this handle.</p>
                    </div>
                  )}
                  {result.posts.map((p) => (
                    <div key={p.id} className="cyber-card rounded-md p-3 group hover:border-pink-500/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs text-cyan-50 flex-1 line-clamp-3">{p.caption}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.verified ? (
                            <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-500/40 bg-green-500/10" title="Came from a tiktok.com/@exact-handle/video/<id> URL">
                              <BadgeCheck className="size-2.5 mr-0.5" />
                              VERIFIED
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 text-amber-400 border-amber-500/40 bg-amber-500/10" title="Could not confirm this came from the exact target handle">
                              <AlertTriangle className="size-2.5 mr-0.5" />
                              UNVERIFIED
                            </Badge>
                          )}
                          {p.isRepost && (
                            <Badge variant="outline" className="text-[9px] h-4 text-pink-400 border-pink-500/40 bg-pink-500/10">
                              <Repeat2 className="size-2.5 mr-0.5" />
                              REPOST
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Engagement */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                        <span className="flex items-center gap-1" title="Likes">
                          <Heart className="size-3 text-pink-400/70" />
                          {formatCount(p.likes)}
                        </span>
                        <span className="flex items-center gap-1" title="Comments">
                          <MessageCircle className="size-3 text-cyan-400/70" />
                          {formatCount(p.comments)}
                        </span>
                        <span className="flex items-center gap-1" title="Shares">
                          <Repeat2 className="size-3 text-purple-400/70" />
                          {formatCount(p.shares)}
                        </span>
                        <span className="flex items-center gap-1" title="Views">
                          <Eye className="size-3 text-green-400/70" />
                          {formatCount(p.views)}
                        </span>
                        <span className="ml-auto text-muted-foreground/60">{relativeTime(p.postedAt)}</span>
                      </div>

                      {/* Hashtags + mentions */}
                      {(p.hashtags.length > 0 || p.mentions.length > 0) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {p.hashtags.map((h, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                              <Hash className="size-2.5" />
                              {h.replace(/^#/, '')}
                            </span>
                          ))}
                          {p.mentions.map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              <AtSign className="size-2.5" />
                              {m.replace(/^@/, '')}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-pink-500/10">
                        <Badge variant="outline" className="text-[9px] h-4 text-pink-400/60 border-pink-500/20">{p.source}</Badge>
                        <div className="flex items-center gap-1">
                          {currentCase && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] opacity-0 group-hover:opacity-100 text-pink-400 hover:bg-pink-500/10 transition-opacity"
                              onClick={() => addPostToCase(p)}
                            >
                              <Plus className="size-3 mr-0.5" />
                              ADD TO CASE
                            </Button>
                          )}
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 h-6 px-2 text-[10px] text-pink-400 hover:bg-pink-500/10 rounded"
                          >
                            <ExternalLink className="size-3" />
                            OPEN
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reposts" className="m-0">
                <div className="space-y-2 pb-4">
                  {result.reposts.length === 0 && (
                    <div className="cyber-card rounded-md p-6 text-center">
                      <Repeat2 className="size-8 mx-auto mb-2 text-pink-400/30" />
                      <p className="text-xs text-muted-foreground">No reposts / duets / stitches detected.</p>
                    </div>
                  )}
                  {result.reposts.map((r, i) => (
                    <div key={i} className="cyber-card rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Repeat2 className="size-3.5 text-pink-400" />
                        <span className="text-[10px] text-muted-foreground">REPOSTED</span>
                        {r.originalAuthor && (
                          <span className="text-xs text-cyan-300 font-mono">{r.originalAuthor}</span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground/60">{relativeTime(r.repostedAt)}</span>
                      </div>
                      <p className="text-xs text-cyan-50 line-clamp-3 mb-2">{r.originalCaption}</p>
                      {r.comment && (
                        <blockquote className="border-l-2 border-pink-500/40 pl-2 py-1 my-2 text-[10px] text-muted-foreground italic">
                          {r.comment}
                        </blockquote>
                      )}
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300 font-mono">
                        <ExternalLink className="size-3" />
                        {r.url.replace(/^https?:\/\//, '').slice(0, 60)}
                      </a>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="messages" className="m-0">
                <div className="space-y-2 pb-4">
                  {result.messages.length === 0 && (
                    <div className="cyber-card rounded-md p-6 text-center">
                      <MessageCircle className="size-8 mx-auto mb-2 text-pink-400/30" />
                      <p className="text-xs text-muted-foreground">No public comments / messages found.</p>
                    </div>
                  )}
                  {result.messages.map((m, i) => (
                    <div key={i} className="cyber-card rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="size-3.5 text-cyan-400" />
                        <span className="text-xs text-cyan-300 font-mono">{m.fromUser || 'Unknown'}</span>
                        <Badge variant="outline" className="text-[9px] h-4 text-pink-400/60 border-pink-500/20 ml-auto">{m.source}</Badge>
                      </div>
                      <blockquote className="border-l-2 border-pink-500/40 pl-3 py-1 my-2 text-xs text-cyan-50 italic">
                        {m.text}
                      </blockquote>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {relativeTime(m.postedAt)}
                        </span>
                        {m.likes !== null && (
                          <span className="flex items-center gap-1">
                            <Heart className="size-3 text-pink-400/70" />
                            {formatCount(m.likes)}
                          </span>
                        )}
                        {m.onVideo && (
                          <a href={m.onVideo} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-pink-400 hover:text-pink-300">
                            <ExternalLink className="size-3" />
                            on video
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="m-0">
                <div className="space-y-3 pb-4">
                  {/* 2x2 grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Posting frequency */}
                    <div className="cyber-card rounded-md p-4 border-pink-500/20">
                      <h4 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        POSTING FREQUENCY
                      </h4>
                      <p className="text-xl font-bold text-pink-300">
                        {result.activity.postingFrequency || '—'}
                      </p>
                    </div>

                    {/* Peak hours */}
                    <div className="cyber-card rounded-md p-4 border-pink-500/20">
                      <h4 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                        <Clock className="size-3" />
                        PEAK HOURS
                      </h4>
                      {result.activity.peakHours.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.activity.peakHours.map((h, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">{h}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60">No peak-hour data available</p>
                      )}
                    </div>

                    {/* Top hashtags */}
                    <div className="cyber-card rounded-md p-4 border-pink-500/20">
                      <h4 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                        <Hash className="size-3" />
                        TOP HASHTAGS
                      </h4>
                      {result.activity.topHashtags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.activity.topHashtags.map((h, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                              <Hash className="size-2.5" />
                              {h.tag.replace(/^#/, '')}
                              <span className="opacity-50 ml-0.5">{h.count}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60">No hashtags detected</p>
                      )}
                    </div>

                    {/* Top mentions */}
                    <div className="cyber-card rounded-md p-4 border-pink-500/20">
                      <h4 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                        <AtSign className="size-3" />
                        TOP MENTIONS
                      </h4>
                      {result.activity.topMentions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.activity.topMentions.map((m, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => pivotToHandle(m.handle)}
                              title={`Click to track ${m.handle} on TikTok`}
                              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors group"
                            >
                              <AtSign className="size-2.5" />
                              {m.handle.replace(/^@/, '')}
                              <span className="opacity-50 ml-0.5">{m.count}</span>
                              <ArrowUpRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60">No mentions detected</p>
                      )}
                    </div>
                  </div>

                  {/* Linked accounts */}
                  <div className="cyber-card rounded-md p-4 border-pink-500/20">
                    <h4 className="text-[10px] font-semibold text-pink-400/80 tracking-wide mb-2 flex items-center gap-1">
                      <Link2 className="size-3" />
                      LINKED ACCOUNTS ({result.activity.linkedAccounts.length})
                    </h4>
                    {result.activity.linkedAccounts.length > 0 ? (
                      <div className="space-y-1.5">
                        {result.activity.linkedAccounts.map((a, i) => {
                          const Icon = platformIcon(a.platform);
                          return (
                            <div key={i} className="flex items-center gap-2 p-2 rounded bg-pink-500/[0.04] hover:bg-pink-500/8 transition-colors group">
                              <Icon className="size-3.5 text-pink-400/70 shrink-0" />
                              <span className="text-xs text-cyan-50 w-24 shrink-0">{a.platform}</span>
                              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-pink-400/70 hover:text-pink-300 truncate flex-1">
                                {a.url.replace(/^https?:\/\//, '')}
                              </a>
                              <Badge variant="outline" className="text-[9px] h-4 text-pink-400 border-pink-500/30 shrink-0">{a.confidence}%</Badge>
                              <a href={a.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 text-pink-400 hover:bg-pink-500/10 rounded size-5 inline-flex items-center justify-center transition-opacity">
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">No linked accounts discovered</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sources" className="m-0">
                <div className="space-y-2 pb-4">
                  {result.sources.length === 0 && (
                    <div className="cyber-card rounded-md p-6 text-center">
                      <Globe className="size-8 mx-auto mb-2 text-pink-400/30" />
                      <p className="text-xs text-muted-foreground">No raw sources gathered.</p>
                    </div>
                  )}
                  {result.sources.map((s, i) => (
                    <div key={i} className="cyber-card rounded-md p-3 group hover:border-pink-500/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-cyan-50 truncate flex-1">{s.title || '(no title)'}</p>
                        <Badge variant="outline" className="text-[9px] h-4 text-pink-400 border-pink-500/30 shrink-0">{s.source}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 line-clamp-2 mb-1">{s.snippet}</p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-pink-400/60 hover:text-pink-300 truncate block">
                        {s.url}
                      </a>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </div>
  );
}
