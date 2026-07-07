'use client';

import { useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { useLiveSearch } from '@/hooks/use-live-search';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Loader2,
  ExternalLink,
  X,
  Zap,
  CornerDownLeft,
  Plus,
} from 'lucide-react';
import { entitiesApi } from '@/lib/api-client';
import { CountryLocaleSelector } from '@/components/CountryLocaleSelector';

export default function SearchPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setSidePanelOpen = usePhantomStore((s) => s.setSidePanelOpen);
  const setSidePanelContent = usePhantomStore((s) => s.setSidePanelContent);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    results,
    loading,
    cached,
    clear,
  } = useLiveSearch({
    caseId: currentCase?.id,
    debounceMs: 450,
    minQueryLength: 2,
  });

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addAsEntity = async (title: string, url: string) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: title,
        type: 'url',
        value: url,
      });
      // Close panel to show graph
      setSidePanelContent('entity-detail');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-4 text-cyan-400" />
              {loading && (
                <div className="absolute -top-1 -right-1 size-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            <h2 className="font-semibold text-sm neon-cyan tracking-wide">LIVE SEARCH</h2>
          </div>
          {loading && (
            <Badge className="ml-auto bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
              <Zap className="size-2.5 mr-0.5" />
              SCANNING
            </Badge>
          )}
          {cached && !loading && results.length > 0 && (
            <Badge className="ml-auto bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
              CACHED
            </Badge>
          )}
        </div>

        {/* Search input — live */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60 pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="Type to search live..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="cyber-input h-10 pl-10 pr-10 font-mono text-sm"
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
          {/* Animated border on focus */}
          <div className="absolute inset-0 rounded-md pointer-events-none border border-cyan-400/0 group-focus-within:border-cyan-400/30 transition-colors" />
        </div>

        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <CornerDownLeft className="size-2.5" />
          Auto-searches as you type · {results.length} results
          {loading && ' · searching...'}
        </p>

        {/* Compact investigation-locale selector — sets the country / language /
            regional-only flag in the shared Zustand store, which the
            useLiveSearch hook reads on every request. */}
        <div className="mt-3">
          <CountryLocaleSelector compact />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Loading skeleton — first search */}
          {loading && results.length === 0 && (
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

          {/* Live results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <Card
                  key={idx}
                  className="cyber-card rounded-md border-cyan-500/10 hover:border-cyan-500/40 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                >
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium leading-tight line-clamp-2 text-cyan-50">
                        {result.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400/60 hover:text-cyan-400 transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        {currentCase && result.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-6 p-0 text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() => addAsEntity(result.title, result.url)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {result.snippet}
                    </p>
                    {result.url && (
                      <p className="text-[10px] text-cyan-400/40 truncate font-mono">
                        {result.url}
                      </p>
                    )}
                    {result.source && (
                      <Badge variant="outline" className="text-[9px] h-4 border-cyan-500/30 text-cyan-400/70">
                        {result.source}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Inline loading more (when results already exist) */}
          {loading && results.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="size-4 animate-spin text-cyan-400" />
            </div>
          )}

          {/* Empty state — typed but no results */}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="size-6 mb-2 opacity-30" />
              <p className="text-xs">No results for</p>
              <p className="text-xs font-mono text-cyan-400/60 mt-1">"{query}"</p>
            </div>
          )}

          {/* Initial empty state */}
          {!loading && results.length === 0 && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Search className="size-8 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Start typing to search</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Live results appear as you type
              </p>
            </div>
          )}

          {/* Error state */}
          {!loading && results.length === 0 && (
            <p className="text-[10px] text-destructive/60 text-center"></p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
