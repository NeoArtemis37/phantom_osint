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
  Users,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Zap,
  CheckCircle2,
  Briefcase,
  Share2,
  FileText,
  Newspaper,
  Phone,
  Mail,
  Radar,
} from 'lucide-react';

// =============================================================================
// PeopleSearchPanel — idcrawl-style meta people-search
// author: artemis37 · People Search (idcrawl-style)
// Fans out 7 parallel z-ai web_search calls against LinkedIn, Facebook,
// Twitter/X, Instagram, public-records & people-directory sites, and news
// mentions. Aggregates + dedupes + classifies into 4 categories.
// =============================================================================

interface PeopleHit {
  category: 'professional' | 'social' | 'public-records' | 'news';
  title: string;
  url: string;
  snippet: string;
  extractedPhone?: string;
  extractedEmail?: string;
  confidence: number;
}

// byCategory is the grouped view of `results`; the api-client widens the
// inner `category` field to `string` (since Record<string, ...> can't preserve
// the union through an index signature). We mirror that contract here so the
// response type-checks against SetStateAction<PeopleResult | null>.
type GroupedHit = Omit<PeopleHit, 'category'> & { category: string };

interface PeopleResult {
  query: string;
  results: PeopleHit[];
  byCategory: Record<string, GroupedHit[]>;
  totalFound: number;
  author: string;
  tool: string;
  generatedAt: string;
  error?: string;
}

// Category metadata — drives icons + neon colors per the cyberpunk theme
const CATEGORY_META: Record<
  PeopleHit['category'],
  { label: string; icon: typeof Briefcase; color: 'cyan' | 'purple' | 'green' | 'amber' }
> = {
  professional: { label: 'Professional', icon: Briefcase, color: 'purple' },
  social: { label: 'Social', icon: Share2, color: 'cyan' },
  'public-records': { label: 'Public Records', icon: FileText, color: 'amber' },
  news: { label: 'News', icon: Newspaper, color: 'green' },
};

const CATEGORY_ORDER: PeopleHit['category'][] = ['professional', 'social', 'public-records', 'news'];

function colorClass(color: string): string {
  switch (color) {
    case 'cyan':
      return 'neon-cyan';
    case 'purple':
      return 'neon-purple';
    case 'green':
      return 'neon-green';
    case 'amber':
      return 'text-amber-400';
    default:
      return 'neon-cyan';
  }
}

function dotClass(color: string): string {
  switch (color) {
    case 'cyan':
      return 'bg-cyan-400';
    case 'purple':
      return 'bg-purple-400';
    case 'green':
      return 'bg-green-400';
    case 'amber':
      return 'bg-amber-400';
    default:
      return 'bg-cyan-400';
  }
}

function borderClass(color: string): string {
  switch (color) {
    case 'cyan':
      return 'text-cyan-400 border-cyan-500/30';
    case 'purple':
      return 'text-purple-400 border-purple-500/30';
    case 'green':
      return 'text-green-400 border-green-500/30';
    case 'amber':
      return 'text-amber-400 border-amber-500/30';
    default:
      return 'text-cyan-400 border-cyan-500/30';
  }
}

export default function PeopleSearchPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);

  const [name, setName] = useState('');
  const [result, setResult] = useState<PeopleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // --- Live auto-search (700ms debounce) ---
  useEffect(() => {
    const trimmed = name.trim();
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
        const data = await osintApi.peopleSearch(trimmed, currentCase?.id, {
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
  }, [name, currentCase, country, language, regionalOnly]);

  const addAsEntity = async (hit: { title: string; url: string }) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: hit.title,
        type: 'person',
        value: hit.url,
      });
    } catch {
      // ignore — best effort
    }
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Users className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to run People Search</p>
        </div>
      </div>
    );
  }

  // Per-category counts (drives the stats row)
  const counts: Record<PeopleHit['category'], number> = {
    professional: result?.byCategory?.professional?.length ?? 0,
    social: result?.byCategory?.social?.length ?? 0,
    'public-records': result?.byCategory?.['public-records']?.length ?? 0,
    news: result?.byCategory?.news?.length ?? 0,
  };

  const partialError = result?.error && result.error !== 'unexpected-error';

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Users className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">PEOPLE SEARCH</h2>
            <p className="text-[10px] text-muted-foreground">
              Live · idcrawl-style · 7 sources in parallel · artemis37
            </p>
          </div>
        </div>
        {loading && (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
            <Radar className="size-2.5 mr-0.5 animate-spin" />
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

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Search input — live */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Users className="size-3.5" />
              NAME · LIVE PEOPLE SEARCH (IDCRAWL-STYLE)
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
              <Input
                placeholder="Type a person's name to search LinkedIn, Facebook, Twitter, public records & news..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="cyber-input h-11 pl-10 font-mono text-sm"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
              )}
              {!loading && name.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="size-2 rounded-full bg-green-400 pulse-dot" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-cyan-400" />
              Auto-searches as you type · 7 parallel queries (LinkedIn · Facebook · X · Instagram · public-records · directories · news)
              {country && ` · locale: ${country}`}
            </p>
          </div>

          {/* Partial-error banner */}
          {partialError && (
            <div className="text-[10px] text-amber-400/80 border border-amber-500/30 bg-amber-500/5 rounded px-2 py-1">
              Some queries failed (rate-limited). Showing partial results.
            </div>
          )}

          {/* Stats bar — TOTAL MATCHES / PROFILES / PUBLIC RECORDS / NEWS MENTIONS */}
          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{result.totalFound}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">TOTAL MATCHES</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-purple">
                  {counts.professional + counts.social}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-wide">PROFILES</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold text-amber-400">{counts['public-records']}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">PUBLIC RECORDS</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-green">{counts.news}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">NEWS MENTIONS</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="cyber-card rounded-md p-3">
                  <div className="h-3 w-24 rounded shimmer mb-2" />
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

          {/* Category-grouped results grid */}
          {result && !loading && result.totalFound > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CATEGORY_ORDER.map((cat) => {
                const items = result.byCategory[cat] ?? [];
                if (items.length === 0) return null;
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const color = meta.color;
                return (
                  <div key={cat} className="cyber-card rounded-md p-3 animate-fade-in-up">
                    <h3
                      className={`text-xs font-semibold mb-2 tracking-wide ${colorClass(color)} flex items-center gap-1.5`}
                    >
                      <Icon className="size-3.5" />
                      <span className={`size-1.5 rounded-full ${dotClass(color)}`} />
                      {meta.label.toUpperCase()}
                      <Badge
                        variant="outline"
                        className={`ml-auto text-[9px] h-4 ${borderClass(color)}`}
                      >
                        {items.length}
                      </Badge>
                    </h3>
                    <div className="space-y-2">
                      {items.map((hit, i) => (
                        <div
                          key={`${cat}-${i}-${hit.url}`}
                          className="p-2 rounded bg-cyan-500/[0.02] hover:bg-cyan-500/5 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {/* Title + confidence */}
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium truncate text-cyan-50">
                                  {hit.title}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] h-4 shrink-0 ${
                                    hit.confidence > 80
                                      ? 'text-green-400 border-green-400/30 bg-green-500/5'
                                      : hit.confidence > 60
                                        ? 'text-amber-400 border-amber-400/30 bg-amber-500/5'
                                        : 'text-muted-foreground border-muted-foreground/30'
                                  }`}
                                >
                                  {hit.confidence}%
                                </Badge>
                              </div>
                              {/* Snippet */}
                              {hit.snippet && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                  {hit.snippet}
                                </p>
                              )}
                              {/* Extracted phone / email badges */}
                              {(hit.extractedPhone || hit.extractedEmail) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {hit.extractedPhone && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] h-4 text-amber-400 border-amber-500/30 bg-amber-500/5"
                                    >
                                      <Phone className="size-2.5 mr-0.5" />
                                      {hit.extractedPhone}
                                    </Badge>
                                  )}
                                  {hit.extractedEmail && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] h-4 text-cyan-400 border-cyan-500/30 bg-cyan-500/5"
                                    >
                                      <Mail className="size-2.5 mr-0.5" />
                                      {hit.extractedEmail}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {/* External link */}
                              <a
                                href={hit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-cyan-400/60 hover:text-cyan-400 truncate block font-mono mt-1"
                              >
                                {hit.url.replace(/^https?:\/\//, '').slice(0, 70)}
                                {hit.url.length > 70 ? '...' : ''}
                              </a>
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10 transition-opacity"
                                onClick={() => addAsEntity(hit)}
                                title="Add to case"
                              >
                                <Plus className="size-3" />
                              </Button>
                              <a
                                href={hit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10 transition-opacity inline-flex items-center justify-center rounded"
                                title="Open externally"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state — not searched yet */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Users className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Start typing a person&apos;s name</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Meta-searches LinkedIn, Facebook, X, Instagram, public records &amp; news
              </p>
              <p className="text-[9px] mt-2 text-muted-foreground/40 font-mono">
                artemis37 · People Search (idcrawl-style)
              </p>
            </div>
          )}

          {/* Searched but no results */}
          {!loading && searched && result && result.totalFound === 0 && (
            <Card className="cyber-card rounded-md">
              <CardContent className="p-6 text-center">
                <Radar className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No people matches found</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Try a fuller name, a nickname, or a different spelling. The search covers 7
                  sources in parallel — rate-limits may suppress some queries.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
