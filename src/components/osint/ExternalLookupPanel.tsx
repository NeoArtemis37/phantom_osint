'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi, entitiesApi } from '@/lib/api-client';
import type { EntityType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Globe2,
  AtSign,
  Phone,
  Server,
  Image as ImageIcon,
  User,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Zap,
  CheckCircle2,
  Github,
  Radar,
  Link2,
  Boxes,
} from 'lucide-react';

// =============================================================================
// ExternalLookupPanel — Unified External OSINT Lookup engine
// author: artemis37 · External OSINT Lookup
// Integrates ALL 49 external GitHub OSINT projects tagged `phantomModule:
// 'External Lookup'` in the catalog. For a given (type, value) target,
// fans out one parallel web_search per matching tool (5-15 tools depending
// on type) and groups the deduped results by tool, alongside each tool's
// direct deep-link URL (so the analyst can click straight through).
// =============================================================================

type InputType = 'username' | 'email' | 'phone' | 'domain' | 'ip' | 'image' | 'name';

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

interface ToolResult {
  tool: {
    id: string;
    name: string;
    category: string;
    url: string;
    description: string;
    githubRef?: string;
  };
  deepLink: string | null;
  results: SearchHit[];
  totalFound: number;
}

interface ExternalResult {
  type: string;
  value: string;
  tools: ToolResult[];
  totalResults: number;
  author: string;
  tool: string;
  generatedAt: string;
}

// 7 input-type toggle buttons — each gets a distinct neon color so the
// analyst can tell at a glance which type is active.
const TYPE_META: Record<
  InputType,
  { label: string; icon: typeof AtSign; color: 'cyan' | 'purple' | 'green' | 'amber' | 'pink'; entityType: EntityType }
> = {
  username: { label: 'Username', icon: AtSign, color: 'cyan', entityType: 'username' },
  email:    { label: 'Email',    icon: AtSign, color: 'purple', entityType: 'email' },
  phone:    { label: 'Phone',    icon: Phone, color: 'amber', entityType: 'phone' },
  domain:   { label: 'Domain',   icon: Globe2, color: 'green', entityType: 'url' },
  ip:       { label: 'IP',       icon: Server, color: 'cyan', entityType: 'url' },
  image:    { label: 'Image',    icon: ImageIcon, color: 'purple', entityType: 'image' },
  name:     { label: 'Name',     icon: User, color: 'green', entityType: 'person' },
};

const TYPE_ORDER: InputType[] = ['username', 'email', 'phone', 'domain', 'ip', 'image', 'name'];

// Per-category neon color rotation (mirrors OsintCatalogPanel)
const CATEGORY_COLORS: Record<string, string> = {
  username: 'cyan',
  phone: 'amber',
  email: 'purple',
  domain: 'green',
  image: 'cyan',
  social: 'purple',
  breach: 'amber',
  geolocation: 'green',
  documents: 'cyan',
  'threat-intel': 'purple',
  darkweb: 'amber',
  people: 'green',
};

function colorText(color: string): string {
  switch (color) {
    case 'cyan':   return 'neon-cyan';
    case 'purple': return 'neon-purple';
    case 'green':  return 'neon-green';
    case 'amber':  return 'text-amber-400';
    case 'pink':   return 'text-pink-400';
    default:       return 'neon-cyan';
  }
}

function colorDot(color: string): string {
  switch (color) {
    case 'cyan':   return 'bg-cyan-400';
    case 'purple': return 'bg-purple-400';
    case 'green':  return 'bg-green-400';
    case 'amber':  return 'bg-amber-400';
    case 'pink':   return 'bg-pink-400';
    default:       return 'bg-cyan-400';
  }
}

function colorBorder(color: string): string {
  switch (color) {
    case 'cyan':   return 'border-cyan-500/30 text-cyan-400';
    case 'purple': return 'border-purple-500/30 text-purple-400';
    case 'green':  return 'border-green-500/30 text-green-400';
    case 'amber':  return 'border-amber-500/30 text-amber-400';
    case 'pink':   return 'border-pink-500/30 text-pink-400';
    default:       return 'border-cyan-500/30 text-cyan-400';
  }
}

function colorActiveBg(color: string): string {
  switch (color) {
    case 'cyan':   return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
    case 'purple': return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
    case 'green':  return 'bg-green-500/15 text-green-300 border-green-500/40';
    case 'amber':  return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    case 'pink':   return 'bg-pink-500/15 text-pink-300 border-pink-500/40';
    default:       return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
  }
}

export default function ExternalLookupPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);

  const [type, setType] = useState<InputType>('username');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<ExternalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // --- Live auto-search (700ms debounce, race-safe via reqId) ---
  useEffect(() => {
    const trimmed = value.trim();
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
        const data = await osintApi.externalLookup({
          type,
          value: trimmed,
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
  }, [type, value, currentCase, country, language, regionalOnly]);

  const addAsEntity = async (hit: SearchHit) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: hit.title || hit.url,
        type: TYPE_META[type].entityType,
        value: hit.url,
      });
    } catch {
      // best-effort — ignore
    }
  };

  // Sort tools so the ones with results float to the top, then by totalFound desc
  const sortedTools = useMemo<ToolResult[]>(() => {
    if (!result) return [];
    return [...result.tools].sort((a, b) => {
      if ((a.totalFound > 0) !== (b.totalFound > 0)) {
        return a.totalFound > 0 ? -1 : 1;
      }
      return b.totalFound - a.totalFound;
    });
  }, [result]);

  const deepLinkCount = useMemo(
    () => (result ? result.tools.filter((t) => t.deepLink !== null).length : 0),
    [result]
  );

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Globe2 className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to run External OSINT Lookup</p>
        </div>
      </div>
    );
  }

  const activeMeta = TYPE_META[type];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">EXTERNAL OSINT LOOKUP</h2>
            <p className="text-[10px] text-muted-foreground">
              49-tool deep-link engine · artemis37 · External OSINT Lookup
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
              <Radar className="size-2.5 mr-0.5 animate-spin" />
              SCANNING
            </Badge>
          )}
          {!loading && result && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
              <CheckCircle2 className="size-2.5 mr-0.5" />
              {result.totalResults} RESULTS
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Input-type selector — 7 toggle buttons with distinct neon colors */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Boxes className="size-3.5" />
              INPUT TYPE · SELECT TARGET CATEGORY
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {TYPE_ORDER.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`text-[10px] px-2 py-2 rounded-md border transition-colors inline-flex flex-col items-center gap-1 ${
                      isActive ? colorActiveBg(meta.color) : 'bg-muted/20 text-muted-foreground border-border/40 hover:border-cyan-500/30 hover:text-cyan-400'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span className="tracking-wide">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value input — live */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <ActiveIcon className={`size-3.5 ${colorText(activeMeta.color)}`} />
              {activeMeta.label.toUpperCase()} · LIVE PARALLEL LOOKUP
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
              <Input
                placeholder={`Type a ${activeMeta.label.toLowerCase()} to query 5-15 external OSINT tools in parallel...`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="cyber-input h-11 pl-10 font-mono text-sm"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
              )}
              {!loading && value.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="size-2 rounded-full bg-green-400 pulse-dot" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-cyan-400" />
              Auto-searches as you type · fans out one parallel web_search per tool · dedupes results across all tools
              {country && ` · locale: ${country}`}
            </p>
          </div>

          {/* Stats row — TOOLS QUERIED / TOTAL RESULTS / DEEP LINKS */}
          {result && (
            <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{result.tools.length}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">TOOLS QUERIED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-green">{result.totalResults}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">TOTAL RESULTS</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-purple">{deepLinkCount}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">DEEP LINKS</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="cyber-card rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-4 rounded shimmer" />
                    <div className="h-3 w-32 rounded shimmer" />
                    <div className="h-3 w-12 rounded shimmer ml-auto" />
                  </div>
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="py-1.5">
                      <div className="h-2.5 w-3/4 rounded shimmer mb-1" />
                      <div className="h-2 w-full rounded shimmer" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Results grouped by tool */}
          {result && !loading && sortedTools.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 neon-cyan" />
                <h3 className="text-xs font-semibold neon-cyan tracking-wide">
                  RESULTS BY TOOL · {result.tools.length} SOURCES
                </h3>
                <Badge variant="outline" className="text-[9px] h-4 text-cyan-400 border-cyan-400/30 ml-auto">
                  {result.totalResults} unique URLs
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedTools.map((tr, i) => {
                  const color = CATEGORY_COLORS[tr.tool.category] ?? 'cyan';
                  const hasResults = tr.totalFound > 0;
                  return (
                    <div
                      key={tr.tool.id}
                      className={`cyber-card rounded-md p-3 animate-fade-in-up group hover:border-cyan-500/40 transition-colors ${
                        hasResults ? 'border-cyan-500/20' : 'opacity-60'
                      }`}
                      style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
                    >
                      {/* Tool header — name + category + open-tool + github */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`size-1.5 rounded-full ${colorDot(color)}`} />
                            <h4 className={`text-xs font-semibold truncate ${colorText(color)}`}>
                              {tr.tool.name}
                            </h4>
                            <Badge
                              variant="outline"
                              className={`text-[8px] h-3.5 px-1 ${colorBorder(color)} bg-transparent`}
                            >
                              {tr.tool.category}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                            {tr.tool.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Results count badge */}
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 ${
                              hasResults
                                ? 'text-green-400 border-green-400/30 bg-green-500/5'
                                : 'text-muted-foreground/60 border-muted-foreground/20'
                            }`}
                          >
                            {tr.totalFound}
                          </Badge>
                          {/* GitHub link */}
                          {tr.tool.githubRef && (
                            <a
                              href={`https://github.com/${tr.tool.githubRef}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="size-6 p-0 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 inline-flex items-center justify-center rounded transition-colors"
                              title={`Open ${tr.tool.githubRef} on GitHub`}
                            >
                              <Github className="size-3" />
                            </a>
                          )}
                          {/* Open tool deep-link */}
                          {tr.deepLink ? (
                            <a
                              href={tr.deepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`size-6 p-0 ${colorText(color)} hover:bg-cyan-500/10 inline-flex items-center justify-center rounded transition-colors`}
                              title="Open tool with this target pre-filled"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span
                              className="size-6 p-0 inline-flex items-center justify-center text-muted-foreground/30"
                              title="No direct deep-link (CLI-only tool)"
                            >
                              <ExternalLink className="size-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Results list — scrollable */}
                      {hasResults ? (
                        <div className="max-h-48 overflow-y-auto custom-scroll pr-1 space-y-1.5">
                          {tr.results.map((hit, j) => (
                            <div
                              key={`${tr.tool.id}-${j}`}
                              className="rounded bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] transition-colors p-2 group/hit"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <a
                                  href={hit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-cyan-50 hover:text-cyan-300 line-clamp-1 flex-1 min-w-0"
                                  title={hit.title}
                                >
                                  {hit.title || hit.url}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-5 p-0 opacity-0 group-hover/hit:opacity-100 text-cyan-400 hover:bg-cyan-500/10 transition-opacity shrink-0"
                                  onClick={() => addAsEntity(hit)}
                                  title="Add to case as entity"
                                >
                                  <Plus className="size-2.5" />
                                </Button>
                              </div>
                              {hit.snippet && (
                                <p className="text-[9px] text-muted-foreground/80 line-clamp-2 mt-0.5 leading-relaxed">
                                  {hit.snippet}
                                </p>
                              )}
                              <a
                                href={hit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-cyan-400/50 hover:text-cyan-400 truncate block font-mono mt-0.5"
                              >
                                {hit.url.replace(/^https?:\/\//, '').slice(0, 80)}
                                {hit.url.length > 80 ? '...' : ''}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground/50 text-center py-3">
                          No public results — open the tool directly to query its source.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — never searched yet */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Globe2 className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Pick a target type and start typing</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60 flex items-center gap-1">
                <Link2 className="size-2.5" />
                49 external OSINT tools · deep-link + parallel search · artemis37
              </p>
            </div>
          )}

          {/* Searched but no results at all */}
          {!loading && searched && result && result.totalResults === 0 && (
            <Card className="cyber-card rounded-md">
              <CardContent className="p-6 text-center">
                <Radar className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No public results found across {result.tools.length} tools</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Try a different value or open individual tools directly via the &ldquo;Open tool ↗&rdquo; buttons to query their proprietary sources.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Author attribution footer */}
          {result && (
            <div className="pt-2 border-t border-cyan-500/10">
              <p className="text-[9px] text-muted-foreground/50 text-center font-mono">
                artemis37 · External OSINT Lookup · {result.tools.length} tools · {result.totalResults} unique results
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
