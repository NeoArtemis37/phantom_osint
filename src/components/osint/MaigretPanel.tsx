'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import type { ProbeHit } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Fingerprint,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Zap,
  CheckCircle2,
  XCircle,
  Radar,
  AlertTriangle,
  AlertCircle,
  Globe,
} from 'lucide-react';

interface MaigretResult {
  username: string;
  mode: 'all' | 'top';
  confirmed: ProbeHit[];
  falsePositive: ProbeHit[];
  possible: ProbeHit[];
  errors: ProbeHit[];
  byCategory: Record<string, {
    confirmed: ProbeHit[];
    false_positive: ProbeHit[];
    possible: ProbeHit[];
    errors: ProbeHit[];
  }>;
  stats: { total: number; confirmed: number; falsePositive: number; possible: number; errors: number };
  totalScanned: number;
  totalFound: number;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  Social: 'cyan',
  Professional: 'purple',
  Gaming: 'green',
  Media: 'cyan',
  Blogging: 'purple',
  Forums: 'cyan',
  Developer: 'green',
  Creative: 'purple',
  Dating: 'cyan',
  Reference: 'green',
};

export default function MaigretPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<MaigretResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allMode, setAllMode] = useState(false);
  const [showFalsePos, setShowFalsePos] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // Live auto-search as you type (only in top mode — all mode is too slow for live)
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
        const data = await osintApi.maigret({
          username: trimmed,
          caseId: currentCase?.id,
          country,
          language,
          regionalOnly,
          all: allMode,
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
    }, allMode ? 400 : 700);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username, currentCase, country, language, regionalOnly, allMode]);

  const addAsEntity = async (hit: ProbeHit) => {
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
          <Fingerprint className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to run Maigret</p>
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
          <Fingerprint className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">MAIGRET ENUMERATION</h2>
            <p className="text-[10px] text-muted-foreground">Real HTTP probing · maigret --all --print-errors style</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* All / Top mode toggle (mirrors maigret --all flag) */}
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] tracking-wide">
            <input
              type="checkbox"
              checked={allMode}
              onChange={(e) => setAllMode(e.target.checked)}
              className="size-3 accent-cyan-400"
            />
            <span className="text-cyan-400/70">--all (probe every platform)</span>
          </label>
          {loading && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
              <Radar className="size-2.5 mr-0.5 animate-spin" />
              PROBING
            </Badge>
          )}
          {!loading && result && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
              <CheckCircle2 className="size-2.5 mr-0.5" />
              {result.stats.confirmed} CONFIRMED
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Search input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Fingerprint className="size-3.5" />
              USERNAME · LIVE HTTP ENUMERATION
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
              <Input
                placeholder={allMode ? "Type a username — probes ALL 200+ platforms (slow)..." : "Type a username — probes top 60 platforms..."}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="cyber-input h-11 pl-10 font-mono text-sm"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
              )}
              {!loading && username.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="size-2 rounded-full bg-green-400 pulse-dot" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-cyan-400" />
              Real HTTP probes with browser UA · {result?.stats.total || (allMode ? '200+' : '60')} platforms checked
              {result && ` · ${result.stats.confirmed} confirmed · ${result.stats.falsePositive} false positives`}
            </p>
          </div>

          {/* Stats bar — 4-quadrant red/green/yellow/gray classification */}
          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center border-green-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="size-3 text-green-400" />
                  <p className="text-xl font-bold neon-green">{result.stats.confirmed}</p>
                </div>
                <p className="text-[9px] text-green-400/70 tracking-wide">CONFIRMED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center border-red-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="size-3 text-red-400" />
                  <p className="text-xl font-bold text-red-400">{result.stats.falsePositive}</p>
                </div>
                <p className="text-[9px] text-red-400/70 tracking-wide">FALSE POSITIVE</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center border-yellow-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="size-3 text-yellow-400" />
                  <p className="text-xl font-bold text-yellow-400">{result.stats.possible}</p>
                </div>
                <p className="text-[9px] text-yellow-400/70 tracking-wide">POSSIBLE</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center border-gray-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="size-3 text-gray-400" />
                  <p className="text-xl font-bold text-gray-400">{result.stats.errors}</p>
                </div>
                <p className="text-[9px] text-gray-400/70 tracking-wide">ERRORS</p>
              </div>
            </div>
          )}

          {/* Toggle: show false positives + errors (mirrors --print-errors) */}
          {result && (result.falsePositive.length > 0 || result.errors.length > 0) && (
            <div className="flex items-center gap-4 flex-wrap">
              {result.falsePositive.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={showFalsePos}
                    onChange={(e) => setShowFalsePos(e.target.checked)}
                    className="size-3 accent-red-400"
                  />
                  <span className="text-red-400/70 tracking-wide">Show false positives ({result.falsePositive.length})</span>
                </label>
              )}
              {result.errors.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={showErrors}
                    onChange={(e) => setShowErrors(e.target.checked)}
                    className="size-3 accent-gray-400"
                  />
                  <span className="text-gray-400/70 tracking-wide">Show errors ({result.errors.length})</span>
                </label>
              )}
            </div>
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

          {/* CONFIRMED accounts grouped by category (GREEN — the primary output) */}
          {result && !loading && result.stats.confirmed > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-400" />
                <h3 className="text-xs font-semibold neon-green tracking-wide">CONFIRMED ACCOUNTS — GROUPED BY CATEGORY</h3>
                <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-400/30 ml-auto">
                  {result.stats.confirmed} total
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const group = result.byCategory[cat];
                  const items = group.confirmed;
                  if (items.length === 0) return null;
                  const color = CATEGORY_COLORS[cat] || 'cyan';
                  const colorClass = color === 'cyan' ? 'neon-cyan' : color === 'purple' ? 'neon-purple' : 'neon-green';
                  const dotClass = color === 'cyan' ? 'bg-cyan-400' : color === 'purple' ? 'bg-purple-400' : 'bg-green-400';

                  return (
                    <div key={cat} className="cyber-card rounded-md p-3 border-green-500/15 animate-fade-in-up">
                      <h3 className={`text-xs font-semibold mb-2 tracking-wide ${colorClass} flex items-center gap-1`}>
                        <span className={`size-1.5 rounded-full ${dotClass}`} />
                        {cat.toUpperCase()}
                        <Badge variant="outline" className="ml-auto text-[9px] h-4 text-green-400 border-green-400/30 bg-green-500/5">
                          {items.length} confirmed
                        </Badge>
                      </h3>
                      <div className="space-y-1">
                        {items.map((hit, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 p-1.5 rounded bg-green-500/[0.05] hover:bg-green-500/10 transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate text-cyan-50">{hit.platform}</p>
                                <a
                                  href={hit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] truncate block font-mono text-green-400/60 hover:text-green-400"
                                >
                                  {hit.url.replace(/^https?:\/\//, '')}
                                </a>
                                <p className="text-[8px] text-green-400/40 truncate">{hit.reason}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-400/30 bg-green-500/5">
                                {hit.confidence}%
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10 transition-opacity"
                                onClick={() => addAsEntity(hit)}
                              >
                                <Plus className="size-3" />
                              </Button>
                              <a
                                href={hit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10 transition-opacity inline-flex items-center justify-center rounded"
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

          {/* POSSIBLE accounts (YELLOW) */}
          {result && !loading && result.possible.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-yellow-400" />
                <h3 className="text-xs font-semibold text-yellow-400 tracking-wide">POSSIBLE — UNVERIFIED</h3>
                <Badge variant="outline" className="text-[9px] h-4 text-yellow-400 border-yellow-400/30 ml-auto">
                  {result.possible.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.possible.slice(0, 30).map((hit, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-yellow-500/[0.04] hover:bg-yellow-500/8 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="size-3 text-yellow-400/60 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-yellow-100/80">{hit.platform}</p>
                        <a href={hit.url} target="_blank" rel="noopener noreferrer" className="text-[9px] truncate block font-mono text-yellow-400/40 hover:text-yellow-400">
                          {hit.url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                    <a href={hit.url} target="_blank" rel="noopener noreferrer" className="size-6 p-0 opacity-0 group-hover:opacity-100 text-yellow-400 hover:bg-yellow-500/10 transition-opacity inline-flex items-center justify-center rounded">
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FALSE POSITIVES (RED — mirrors --print-errors) */}
          {result && !loading && showFalsePos && result.falsePositive.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-400" />
                <h3 className="text-xs font-semibold text-red-400 tracking-wide">FALSE POSITIVES — PROFILE DOES NOT EXIST</h3>
                <Badge variant="outline" className="text-[9px] h-4 text-red-400 border-red-400/30 ml-auto">
                  {result.falsePositive.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-72 overflow-y-auto">
                {result.falsePositive.map((hit, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-red-500/[0.03] hover:bg-red-500/6 transition-colors">
                    <XCircle className="size-3 text-red-400/50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate text-red-200/60">{hit.platform}</p>
                      <p className="text-[8px] text-red-400/40 truncate">{hit.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ERRORS (GRAY — timeouts/network) */}
          {result && !loading && showErrors && result.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-400 tracking-wide">ERRORS — TIMEOUT / NETWORK</h3>
                <Badge variant="outline" className="text-[9px] h-4 text-gray-400 border-gray-400/30 ml-auto">
                  {result.errors.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {result.errors.map((hit, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-gray-500/[0.03]">
                    <AlertCircle className="size-3 text-gray-400/50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate text-gray-300/60">{hit.platform}</p>
                      <p className="text-[8px] text-gray-400/40 truncate">{hit.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Fingerprint className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Start typing a username</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60 flex items-center gap-1">
                <Globe className="size-2.5" />
                Real HTTP probing · maigret --all --print-errors style
              </p>
            </div>
          )}

          {/* Searched but no confirmed results */}
          {!loading && searched && result && result.stats.confirmed === 0 && (
            <Card className="cyber-card rounded-md">
              <CardContent className="p-6 text-center">
                <Radar className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No confirmed accounts found</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Probed {result.stats.total} platforms · {result.stats.falsePositive} confirmed non-existent · {result.stats.possible} possible (unverified)
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
