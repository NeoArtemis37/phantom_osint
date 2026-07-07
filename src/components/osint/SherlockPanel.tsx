'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import type { SherlockHit } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Zap,
  CheckCircle2,
  Radar,
  ShieldCheck,
  Unlock,
} from 'lucide-react';

// =============================================================================
// SherlockPanel — Sherlock-style username enumeration UI
// Distinct from Maigret: shows Sherlock site-rank, errorType detection method,
// and a "found vs available" split (real Sherlock reports which sites the
// username is *available* on, unlike Maigret which only reports found).
// =============================================================================

interface SherlockResult {
  username: string;
  tool: string;
  toolReference: string;
  mode: 'all' | 'top';
  found: SherlockHit[];
  confirmed: SherlockHit[];
  available: SherlockHit[];
  falsePositive: SherlockHit[];
  possible: SherlockHit[];
  errors: SherlockHit[];
  byCategory: Record<string, { confirmed: SherlockHit[]; false_positive: SherlockHit[]; possible: SherlockHit[]; errors: SherlockHit[]; }>;
  stats: { total: number; confirmed: number; falsePositive: number; possible: number; errors: number };
  totalScanned: number;
  totalFound: number;
  totalAvailable: number;
  generatedAt: string;
}

// Blue-neon category mapping (cyber / blue palette per user request)
const CATEGORY_COLORS: Record<string, 'cyan' | 'blue' | 'green'> = {
  Social: 'cyan',
  Developer: 'green',
  Professional: 'blue',
  Gaming: 'cyan',
  Media: 'blue',
  Forums: 'cyan',
  Creative: 'blue',
  Blogging: 'cyan',
  Dating: 'blue',
  Reference: 'green',
};

const colorText = (c: string) =>
  c === 'blue' ? 'neon-blue' : c === 'green' ? 'neon-green' : 'neon-cyan';
const colorDot = (c: string) =>
  c === 'blue' ? 'bg-blue-400' : c === 'green' ? 'bg-green-400' : 'bg-cyan-400';
const colorBadge = (c: string) =>
  c === 'blue'
    ? 'text-blue-400 border-blue-500/30'
    : c === 'green'
    ? 'text-green-400 border-green-500/30'
    : 'text-cyan-400 border-cyan-500/30';

export default function SherlockPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<SherlockResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // Live auto-search as you type (Sherlock-style: instant enumeration)
  useEffect(() => {
    const trimmed = username.trim();
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
        const data = await osintApi.sherlock({ username: trimmed, caseId: currentCase?.id, country, language, regionalOnly });
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
  }, [username, currentCase, country, language, regionalOnly]);

  const addAsEntity = async (hit: SherlockHit) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: `${username}@${hit.platform}`,
        type: 'username',
        value: hit.url,
      });
    } catch {
      // ignore
    }
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Radar className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to run Sherlock</p>
        </div>
      </div>
    );
  }

  const categories = result ? Object.keys(result.byCategory).sort() : [];

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Radar className="size-4 neon-blue" />
          <div>
            <h2 className="text-sm font-semibold neon-blue tracking-wide">SHERLOCK ENUMERATION</h2>
            <p className="text-[10px] text-muted-foreground">
              Live · {result?.totalScanned || '70+'} sites · sherlock-project style · rank-sorted
            </p>
          </div>
        </div>
        {loading && (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[9px]">
            <Radar className="size-2.5 mr-0.5 animate-spin" />
            PROBING
          </Badge>
        )}
        {!loading && result && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            <CheckCircle2 className="size-2.5 mr-0.5" />
            {result.totalFound} FOUND · {result.totalAvailable} FREE
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Search input — live */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-blue-400/70">
              <Radar className="size-3.5" />
              USERNAME · LIVE SHERLOCK PROBE
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-blue-400/60" />
              <Input
                placeholder="Type a username — Sherlock probes 70+ sites..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="cyber-input h-11 pl-10 font-mono text-sm"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-blue-400" />
              )}
              {!loading && username.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="size-2 rounded-full bg-blue-400 pulse-dot" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-blue-400" />
              Auto-probes as you type · rank-sorted · Sherlock reference: {result?.toolReference || 'sherlock-project/sherlock'}
            </p>
          </div>

          {/* Stats bar — 3 boxes */}
          {result && (
            <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{result.totalScanned}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">SITES PROBED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-green">{result.totalFound}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">CLAIMED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-blue">{result.totalAvailable}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">AVAILABLE</p>
              </div>
            </div>
          )}

          {/* Toggle available sites */}
          {result && result.available.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={showAvailable}
                onChange={(e) => setShowAvailable(e.target.checked)}
                className="size-3 accent-blue-400"
              />
              <span className="text-blue-400/70 tracking-wide flex items-center gap-1">
                <Unlock className="size-3" />
                Show available sites ({result.available.length} — username likely free)
              </span>
            </label>
          )}

          {/* Loading skeleton */}
          {loading && (
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

          {/* Found results grouped by category */}
          {result && !loading && result.totalFound > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold neon-green tracking-wide flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                CLAIMED ACCOUNTS ({result.totalFound})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const catData = result.byCategory[cat];
                  const hits = catData ? catData.confirmed : [];
                  if (hits.length === 0) return null;
                  const c = CATEGORY_COLORS[cat] || 'cyan';

                  return (
                    <div key={cat} className="cyber-card rounded-md p-3 animate-fade-in-up">
                      <h3 className={`text-xs font-semibold mb-2 tracking-wide ${colorText(c)} flex items-center gap-1`}>
                        <span className={`size-1.5 rounded-full ${colorDot(c)}`} />
                        {cat.toUpperCase()}
                        <Badge variant="outline" className={`ml-auto text-[9px] h-4 ${colorBadge(c)}`}>
                          {hits.length} found
                        </Badge>
                      </h3>
                      <div className="space-y-1">
                        {hits.map((hit, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 p-1.5 rounded transition-colors group bg-green-500/[0.04] hover:bg-green-500/8"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate text-cyan-50">
                                  {hit.platform}
                                  <span className="text-[9px] text-muted-foreground ml-1.5">#{hit.rank}</span>
                                </p>
                                <a
                                  href={hit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] truncate block font-mono hover:text-blue-400 text-blue-400/50"
                                >
                                  {hit.url.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-400/30 bg-green-500/5">
                                {hit.confidence}%
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-blue-400 hover:bg-blue-500/10 transition-opacity"
                                onClick={() => addAsEntity(hit)}
                              >
                                <Plus className="size-3" />
                              </Button>
                              <a
                                href={hit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-blue-400 hover:bg-blue-500/10 transition-opacity inline-flex items-center justify-center rounded"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available sites list */}
          {result && !loading && showAvailable && result.available.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold neon-blue tracking-wide flex items-center gap-1">
                <Unlock className="size-3.5" />
                AVAILABLE SITES ({result.totalAvailable})
                <span className="text-[9px] text-muted-foreground font-normal ml-1">— username not found, likely free to claim</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {result.available.slice(0, 60).map((hit, i) => (
                  <a
                    key={i}
                    href={hit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 p-1.5 rounded bg-muted/20 hover:bg-blue-500/8 transition-colors text-[10px] font-mono group"
                  >
                    <div className="size-1.5 rounded-full bg-blue-400/50 shrink-0" />
                    <span className="truncate text-muted-foreground group-hover:text-blue-400/80">{hit.platform}</span>
                    <span className="text-[8px] text-muted-foreground/40 ml-auto">#{hit.rank}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Radar className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-blue-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-blue">Start typing a username</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Sherlock probes 70+ sites · rank-sorted · sherlock-project style
              </p>
            </div>
          )}

          {/* Searched but no found results */}
          {!loading && searched && result && result.totalFound === 0 && (
            <div className="cyber-card rounded-md p-6 text-center">
              <Unlock className="size-8 mx-auto mb-2 text-blue-400/40" />
              <p className="text-sm neon-blue">Username appears available everywhere</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                No verified hits across {result.totalScanned} sites. Toggle "Show available" to see the full list.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
