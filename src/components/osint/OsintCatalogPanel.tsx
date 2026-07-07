'use client';

import { useState, useEffect, useMemo } from 'react';
import { osintApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Library,
  Search,
  Loader2,
  Github,
  Star,
  Code2,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Boxes,
} from 'lucide-react';

// =============================================================================
// OsintCatalogPanel — curated GitHub OSINT project directory
// author: artemis37 · OSINT Catalog
// Shows 45+ well-known OSINT projects organized by category, each correlated
// with the PHANTOM module that implements the same capability.
// =============================================================================

interface CatalogEntry {
  name: string;
  url: string;
  description: string;
  category: string;
  language: string;
  stars: string;
  phantomModule?: string | null;
}

interface CatalogResponse {
  author: string;
  tool: string;
  generatedAt: string;
  categories: string[];
  stats: { total: number; integrated: number; available: number };
  categoryLabels: Record<string, string>;
  total: number;
  entries: CatalogEntry[];
}

// Full category list — order drives the chip row
const CATEGORY_ORDER = [
  'username',
  'phone',
  'email',
  'domain',
  'image',
  'social',
  'breach',
  'geolocation',
  'documents',
  'threat-intel',
  'darkweb',
  'people',
] as const;

// Neon color rotation per category for visual variety
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

function chipActiveClass(color: string): string {
  switch (color) {
    case 'cyan':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
    case 'purple':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
    case 'green':
      return 'bg-green-500/15 text-green-300 border-green-500/40';
    case 'amber':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    default:
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
  }
}

function chipIdleClass(): string {
  return 'bg-muted/20 text-muted-foreground border-border/40 hover:border-cyan-500/30 hover:text-cyan-400';
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

function titleColorClass(color: string): string {
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

export default function OsintCatalogPanel() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // null = All
  const [search, setSearch] = useState('');

  // --- Fetch the full catalog once on mount ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await osintApi.catalog();
        if (!cancelled) {
          setData(resp);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load catalog');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Filtered entries (by category + by search term) ---
  const filtered = useMemo<CatalogEntry[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.entries.filter((e) => {
      if (activeCategory && e.category !== activeCategory) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.language.toLowerCase().includes(q) ||
        (e.phantomModule ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, activeCategory, search]);

  // --- Counts per category (for the chip badges) ---
  const categoryCounts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (!data) return map;
    for (const e of data.entries) {
      map[e.category] = (map[e.category] ?? 0) + 1;
    }
    return map;
  }, [data]);

  const stats = data?.stats ?? { total: 0, integrated: 0, available: 0 };

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Library className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">OSINT CATALOG</h2>
            <p className="text-[10px] text-muted-foreground">
              Curated GitHub OSINT projects · correlated with PHANTOM modules · artemis37
            </p>
          </div>
        </div>
        {loading && (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
            <Loader2 className="size-2.5 mr-0.5 animate-spin" />
            LOADING
          </Badge>
        )}
        {!loading && data && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            <Boxes className="size-2.5 mr-0.5" />
            {data.total} PROJECTS
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Stats row — TOTAL PROJECTS / INTEGRATED / AVAILABLE TO INTEGRATE */}
          <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
            <div className="cyber-card rounded-md p-3 text-center">
              <p className="text-xl font-bold neon-cyan">{stats.total}</p>
              <p className="text-[9px] text-muted-foreground tracking-wide">TOTAL PROJECTS</p>
            </div>
            <div className="cyber-card rounded-md p-3 text-center">
              <p className="text-xl font-bold neon-green">{stats.integrated}</p>
              <p className="text-[9px] text-muted-foreground tracking-wide">INTEGRATED</p>
            </div>
            <div className="cyber-card rounded-md p-3 text-center">
              <p className="text-xl font-bold neon-purple">{stats.available}</p>
              <p className="text-[9px] text-muted-foreground tracking-wide">AVAILABLE TO INTEGRATE</p>
            </div>
          </div>

          {/* Search box — filter catalog by name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Search className="size-3.5" />
              FILTER CATALOG
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
              <Input
                placeholder="Search by project name, description, language, or PHANTOM module..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="cyber-input h-10 pl-10 font-mono text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-cyan-400"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${
                activeCategory === null ? chipActiveClass('cyan') : chipIdleClass()
              }`}
            >
              All ({stats.total})
            </button>
            {CATEGORY_ORDER.map((cat) => {
              const color = CATEGORY_COLORS[cat] ?? 'cyan';
              const label = data?.categoryLabels[cat] ?? cat;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${
                    isActive ? chipActiveClass(color) : chipIdleClass()
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${dotClass(color)}`} />
                  {label}
                  <span className="opacity-60">({categoryCounts[cat] ?? 0})</span>
                </button>
              );
            })}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="cyber-card rounded-md p-3">
                  <div className="h-3 w-32 rounded shimmer mb-2" />
                  <div className="h-2 w-full rounded shimmer mb-1" />
                  <div className="h-2 w-2/3 rounded shimmer" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="cyber-card rounded-md p-6 text-center">
              <p className="text-sm text-red-400">Failed to load catalog</p>
              <p className="text-[10px] text-muted-foreground mt-1">{error}</p>
            </div>
          )}

          {/* Scrollable catalog grid */}
          {!loading && !error && (
            <div className="max-h-[60vh] overflow-y-auto phantom-scroll pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((entry, i) => {
                  const color = CATEGORY_COLORS[entry.category] ?? 'cyan';
                  const isIntegrated = Boolean(entry.phantomModule);
                  const label = data?.categoryLabels[entry.category] ?? entry.category;
                  return (
                    <div
                      key={`${entry.name}-${i}`}
                      className="cyber-card rounded-md p-3 animate-fade-in-up hover:border-cyan-500/40 transition-colors group"
                      style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
                    >
                      {/* Header row — name + github link */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`size-1.5 rounded-full ${dotClass(color)}`} />
                            <h4 className={`text-xs font-semibold truncate ${titleColorClass(color)}`}>
                              {entry.name}
                            </h4>
                          </div>
                          <p className="text-[9px] text-muted-foreground/70 ml-3 mt-0.5 tracking-wide">
                            {label.toUpperCase()}
                          </p>
                        </div>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-7 p-0 shrink-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 inline-flex items-center justify-center rounded transition-colors"
                          title="Open on GitHub / product page"
                        >
                          <Github className="size-3.5" />
                        </a>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {entry.description}
                      </p>

                      {/* Badges row — language + stars + PHANTOM module */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {/* Language */}
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 text-purple-400 border-purple-500/30 bg-purple-500/5"
                        >
                          <Code2 className="size-2.5 mr-0.5" />
                          {entry.language}
                        </Badge>
                        {/* Stars */}
                        {entry.stars !== 'n/a' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 text-amber-400 border-amber-500/30 bg-amber-500/5"
                          >
                            <Star className="size-2.5 mr-0.5" />
                            {entry.stars}
                          </Badge>
                        )}
                        {/* PHANTOM module integration badge */}
                        {isIntegrated ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 text-green-400 border-green-500/30 bg-green-500/5"
                          >
                            <CheckCircle2 className="size-2.5 mr-0.5" />
                            Integrated: {entry.phantomModule}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 text-muted-foreground/70 border-muted-foreground/20"
                          >
                            <CircleDashed className="size-2.5 mr-0.5" />
                            Not integrated
                          </Badge>
                        )}
                      </div>

                      {/* Footer link */}
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-cyan-400/50 hover:text-cyan-400 truncate block font-mono mt-2"
                      >
                        <ExternalLink className="size-2.5 inline mr-0.5" />
                        {entry.url.replace(/^https?:\/\//, '').slice(0, 60)}
                        {entry.url.length > 60 ? '...' : ''}
                      </a>
                    </div>
                  );
                })}
              </div>

              {/* Empty filter state */}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Library className="size-10 opacity-20 mb-2" />
                  <p className="text-sm">No catalog entries match your filter</p>
                  <p className="text-[10px] mt-1 text-muted-foreground/60">
                    Try clearing the search or selecting a different category
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Author attribution footer */}
          {!loading && data && (
            <div className="pt-2 border-t border-cyan-500/10">
              <p className="text-[9px] text-muted-foreground/50 text-center font-mono">
                artemis37 · OSINT Catalog · {data.total} curated projects across {data.categories.length} categories
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
