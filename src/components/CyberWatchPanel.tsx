'use client';

import { useState, useEffect, useCallback } from 'react';
import { cyberWatchApi, entitiesApi } from '@/lib/api-client';
import { usePhantomStore } from '@/store/phantom-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock } from '@/components/ui/code-block';
import {
  Satellite,
  RefreshCw,
  Loader2,
  ExternalLink,
  Plus,
  Skull,
  Bug,
  Database,
  Fish,
  ShieldAlert,
  Globe2,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  User,
  Music2,
  AtSign,
  Hash,
  Video,
} from 'lucide-react';

// =============================================================================
// CyberWatchPanel — "Veilles Cyber" cyber-threat-intelligence feed.
// Renders the artemis37-attributed feed from /api/cyberwatch with protected
// CodeBlock IOCs (CVE / SHA / IP / domain / URL) that cannot be copied and
// are sanitised against XSS / injection.
// =============================================================================

type ThreatCategory =
  | 'Ransomware' | 'APT' | 'ZeroDay' | 'DataBreach'
  | 'Phishing' | 'Vulnerability' | 'Geopolitics' | 'Malware'
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
    handles: string[];
    hashtags: string[];
    videos: string[];
  };
  tags: string[];
}

interface CyberWatchResponse {
  author: string;
  tool: string;
  cached: boolean;
  generatedAt: string;
  totalItems: number;
  stats?: {
    total: number;
    critical: number;
    high: number;
    cves: number;
    hashes: number;
    ips: number;
    domains: number;
    // TikTok / social-platform stats
    tiktok: number;
    handles: number;
    hashtags: number;
    videos: number;
  };
  items: CyberWatchItem[];
}

const CATEGORY_META: Record<ThreatCategory, { icon: typeof Skull; color: string; ring: string }> = {
  Ransomware:     { icon: Skull,         color: 'neon-cyan',  ring: 'border-red-500/30' },
  APT:            { icon: Satellite,     color: 'neon-blue',  ring: 'border-blue-500/30' },
  ZeroDay:        { icon: AlertOctagon,  color: 'neon-cyan',  ring: 'border-cyan-500/30' },
  DataBreach:     { icon: Database,      color: 'neon-blue',  ring: 'border-blue-500/30' },
  Phishing:       { icon: Fish,          color: 'neon-cyan',  ring: 'border-cyan-500/30' },
  Vulnerability:  { icon: Bug,           color: 'neon-blue',  ring: 'border-blue-500/30' },
  Geopolitics:    { icon: Globe2,        color: 'neon-cyan',  ring: 'border-cyan-500/30' },
  Malware:        { icon: AlertTriangle, color: 'neon-blue',  ring: 'border-blue-500/30' },
  // TikTok / social-platform — distinct pink accent (TikTok brand)
  SocialPlatform: { icon: Music2,        color: 'text-pink-400',  ring: 'border-pink-500/40' },
};

const SEVERITY_BADGE: Record<CyberWatchItem['severity'], string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/40',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/40',
  medium:   'bg-amber-500/15 text-amber-400 border-amber-500/40',
  low:      'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
};

export default function CyberWatchPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector; biases the CTI feed toward the country's CERT/regional sources) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const [data, setData] = useState<CyberWatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | ThreatCategory>('all');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await cyberWatchApi.refresh(refresh, { country, language, regionalOnly });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [country, language, regionalOnly]);

  useEffect(() => {
    load(false);
  }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addThreatAsEntity = async (item: CyberWatchItem) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: item.title.slice(0, 80),
        type: 'organization',
        value: item.url,
        metadata: {
          source: item.source,
          category: item.category,
          severity: item.severity,
          iocs: item.iocs,
        },
        threatLevel: item.severity === 'critical' ? 'high' : 'medium',
      });
    } catch {
      // ignore
    }
  };

  const items = data?.items ?? [];
  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);
  const categories: ThreatCategory[] = [
    'Ransomware', 'APT', 'ZeroDay', 'DataBreach',
    'Phishing', 'Vulnerability', 'Geopolitics', 'Malware',
    'SocialPlatform',
  ];
  const tiktokCount = items.filter((i) => i.category === 'SocialPlatform').length;

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header — artemis37 attribution banner */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10 bg-gradient-to-r from-blue-950/30 via-cyan-950/20 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Satellite className="size-5 neon-blue" />
            <div className="absolute inset-0 blur-md bg-blue-500/20 rounded-full" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold neon-blue tracking-wide flex items-center gap-2">
              VEILLES CYBER · CTI FEED
              {data?.cached && (
                <Badge className="text-[8px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 h-3.5 px-1">
                  CACHED
                </Badge>
              )}
            </h2>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <User className="size-2.5" />
              author: <span className="neon-blue font-mono">{data?.author || 'artemis37'}</span>
              <span className="opacity-40">·</span>
              tool: <span className="font-mono">{data?.tool || 'PHANTOM CyberWatch'}</span>
              {data?.generatedAt && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="font-mono">{new Date(data.generatedAt).toLocaleTimeString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={loading}
          className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/50 h-8"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          REFRESH FEED
        </Button>
      </div>

      {/* Stats bar */}
      {data?.stats && (
        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-11 gap-1.5 p-3 border-b border-cyan-500/10 bg-black/20">
          <StatBox label="TOTAL" value={data.stats.total} color="cyan" />
          <StatBox label="CRITICAL" value={data.stats.critical} color="red" />
          <StatBox label="HIGH" value={data.stats.high} color="orange" />
          <StatBox label="CVEs" value={data.stats.cves} color="blue" />
          <StatBox label="HASHES" value={data.stats.hashes} color="blue" />
          <StatBox label="IPs" value={data.stats.ips} color="cyan" />
          <StatBox label="DOMAINS" value={data.stats.domains} color="cyan" />
          {/* TikTok / social-platform stats — pink accent */}
          <StatBox label="TIKTOK" value={data.stats.tiktok} color="pink" />
          <StatBox label="HANDLES" value={data.stats.handles} color="pink" />
          <StatBox label="HASHTAGS" value={data.stats.hashtags} color="pink" />
          <StatBox label="VIDEOS" value={data.stats.videos} color="pink" />
        </div>
      )}

      {/* Category filter chips — TIKTOK chip is highlighted (pink) so the
          analyst can jump straight to the dedicated TikTok Watch feed. */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-cyan-500/10 overflow-x-auto">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="ALL" />
        <button
          type="button"
          onClick={() => setFilter('SocialPlatform')}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono tracking-wide transition-colors whitespace-nowrap border ${
            filter === 'SocialPlatform'
              ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
              : 'bg-pink-500/5 text-pink-400/90 border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-300 hover:border-pink-500/50'
          }`}
        >
          <Music2 className="size-3" />
          TIKTOK WATCH
          {tiktokCount > 0 && <span className="text-[8px] opacity-70">({tiktokCount})</span>}
        </button>
        <span className="text-cyan-500/20 px-1 select-none">|</span>
        {categories.filter((c) => c !== 'SocialPlatform').map((c) => {
          const meta = CATEGORY_META[c];
          const Icon = meta.icon;
          const count = items.filter((i) => i.category === c).length;
          return (
            <FilterChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={c.toUpperCase()}
              icon={<Icon className="size-3" />}
              count={count}
            />
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="m-3 p-3 rounded border border-red-500/40 bg-red-950/30 text-xs text-red-400">
          <ShieldAlert className="size-4 inline mr-1.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin neon-blue" />
            <p className="text-xs neon-blue tracking-wide">Harvesting threat intelligence...</p>
          </div>
        </div>
      )}

      {/* Feed */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Satellite className="size-10 opacity-20 mb-2" />
              <p className="text-sm">No threats in feed</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">Click REFRESH FEED to harvest the latest CTI</p>
            </div>
          )}

          {filtered.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            const isOpen = expanded.has(item.id);
            const hasIocs =
              item.iocs.cves.length + item.iocs.hashes.length + item.iocs.ips.length +
              item.iocs.domains.length + item.iocs.urls.length +
              item.iocs.handles.length + item.iocs.hashtags.length + item.iocs.videos.length > 0;

            return (
              <div
                key={item.id}
                className={`cyber-card rounded-md overflow-hidden border ${meta.ring} animate-fade-in-up`}
              >
                {/* Item header (click to expand) */}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-cyan-500/[0.03] transition-colors"
                >
                  <div className={`shrink-0 size-7 rounded flex items-center justify-center bg-black/40 border ${meta.ring}`}>
                    <Icon className={`size-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge className={`text-[8px] h-4 px-1 border ${SEVERITY_BADGE[item.severity]}`}>
                        {item.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] h-4 px-1 text-cyan-400/70 border-cyan-500/20">
                        {item.category}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground/60 font-mono ml-auto shrink-0">{item.source}</span>
                    </div>
                    <p className="text-xs font-medium text-cyan-50 leading-snug line-clamp-2">{item.title}</p>
                    {!isOpen && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{item.summary}</p>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="size-3.5 text-cyan-400/60 shrink-0 mt-1" />
                  ) : (
                    <ChevronRight className="size-3.5 text-cyan-400/60 shrink-0 mt-1" />
                  )}
                </button>

                {/* Expanded body */}
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-cyan-500/10 bg-black/20">
                    {/* Summary */}
                    <p className="text-xs text-muted-foreground/80 leading-relaxed pt-2">{item.summary}</p>

                    {/* Source link */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="size-2.5" />
                      {item.url.replace(/^https?:\/\//, '').slice(0, 80)}
                    </a>

                    {/* IOCs — protected code blocks (anti-copy + anti-XSS) */}
                    {hasIocs && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] font-semibold neon-cyan tracking-wide flex items-center gap-1">
                          <ShieldAlert className="size-3" />
                          INDICATORS OF COMPROMISE · PROTECTED · NO-COPY
                        </p>

                        {item.iocs.cves.length > 0 && (
                          <IOCSection label="CVE" items={item.iocs.cves} variant="danger" />
                        )}
                        {item.iocs.hashes.length > 0 && (
                          <IOCSection label="HASH" items={item.iocs.hashes} variant="warning" />
                        )}
                        {item.iocs.ips.length > 0 && (
                          <IOCSection label="IP" items={item.iocs.ips} variant="danger" />
                        )}
                        {item.iocs.domains.length > 0 && (
                          <IOCSection label="DOMAIN" items={item.iocs.domains} variant="default" />
                        )}
                        {item.iocs.urls.length > 0 && (
                          <IOCSection label="URL" items={item.iocs.urls.slice(0, 3)} variant="warning" />
                        )}

                        {/* TikTok / social-platform IOCs — handles, hashtags, video URLs.
                            These are rendered with a pink-accent header to visually
                            separate them from classic IOCs and let the analyst pivot
                            directly to the offending TikTok account / post. */}
                        {(item.iocs.handles.length > 0 || item.iocs.hashtags.length > 0 || item.iocs.videos.length > 0) && (
                          <div className="pt-1 mt-1 border-t border-pink-500/15">
                            <p className="text-[10px] font-semibold text-pink-400 tracking-wide flex items-center gap-1">
                              <Music2 className="size-3" />
                              TIKTOK / SOCIAL IOCs · HANDLES · HASHTAGS · VIDEOS
                            </p>
                            {item.iocs.handles.length > 0 && (
                              <SocialIOCSection label="HANDLE" items={item.iocs.handles} icon={<AtSign className="size-2.5" />} />
                            )}
                            {item.iocs.hashtags.length > 0 && (
                              <SocialIOCSection label="HASHTAG" items={item.iocs.hashtags} icon={<Hash className="size-2.5" />} />
                            )}
                            {item.iocs.videos.length > 0 && (
                              <SocialIOCSection label="VIDEO" items={item.iocs.videos.slice(0, 3)} icon={<Video className="size-2.5" />} />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add to case */}
                    {currentCase && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addThreatAsEntity(item)}
                        className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 h-7 text-[10px]"
                      >
                        <Plus className="size-3" />
                        ADD TO CASE AS THREAT ENTITY
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- sub-components ----------------------------------------------------------

function StatBox({ label, value, color }: { label: string; value: number; color: 'cyan' | 'blue' | 'red' | 'orange' | 'pink' }) {
  const text =
    color === 'red' ? 'text-red-400' :
    color === 'orange' ? 'text-orange-400' :
    color === 'pink' ? 'text-pink-400' :
    color === 'blue' ? 'neon-blue' : 'neon-cyan';
  return (
    <div className="cyber-card rounded p-1.5 text-center">
      <p className={`text-base font-bold ${text}`}>{value}</p>
      <p className="text-[8px] text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
}

function FilterChip({
  active, onClick, label, icon, count,
}: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono tracking-wide transition-colors whitespace-nowrap ${
        active
          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/40 shadow-[0_0_8px_rgba(30,144,255,0.2)]'
          : 'text-muted-foreground/70 hover:text-blue-400/80 hover:bg-blue-500/5 border border-transparent'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="text-[8px] opacity-60">({count})</span>
      )}
    </button>
  );
}

function IOCSection({
  label, items, variant,
}: { label: string; items: string[]; variant: 'default' | 'danger' | 'warning' }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground/70 mb-1 font-mono tracking-wide">
        {label} · {items.length}
      </p>
      <div className="space-y-1">
        {items.map((ioc, i) => (
          <CodeBlock
            key={`${ioc}-${i}`}
            code={ioc}
            label={label}
            variant={variant}
            lineNumbers={false}
            sensitive={true}
            className="py-0.5"
          />
        ))}
      </div>
    </div>
  );
}

// TikTok / social IOC section — pink-accented, with a small icon prefix so the
// analyst can distinguish @handles, #hashtags and video URLs at a glance.
// Uses the same anti-copy CodeBlock as classic IOCs.
function SocialIOCSection({
  label, items, icon,
}: { label: string; items: string[]; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] text-pink-400/70 mb-1 font-mono tracking-wide flex items-center gap-1">
        {icon}
        {label} · {items.length}
      </p>
      <div className="space-y-1">
        {items.map((ioc, i) => (
          <CodeBlock
            key={`${ioc}-${i}`}
            code={ioc}
            label={label}
            variant="warning"
            lineNumbers={false}
            sensitive={true}
            className="py-0.5 border-pink-500/20"
          />
        ))}
      </div>
    </div>
  );
}
