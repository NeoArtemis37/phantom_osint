'use client';

import { useState } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { osintApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  Search,
  Loader2,
  ExternalLink,
  Clock,
  CalendarDays,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
} from 'lucide-react';

// =============================================================================
// PHANTOM OSINT — Wayback Machine panel  ·  author: artemis37
// Establishes a timeline of how a URL/domain's web presence evolved over time
// (past → now) using web.archive.org's public APIs.
// One-click scan (the CDX API can be slow, so no live auto-search).
// =============================================================================

interface WaybackSnapshot {
  timestamp: string;
  originalUrl: string;
  statusCode: number;
  digest: string;
  archiveUrl: string;
}

interface YearlyCount {
  year: number;
  count: number;
}

interface TimelineEntry {
  date: string;
  event: string;
  archiveUrl?: string;
}

interface WaybackResult {
  url: string;
  totalSnapshots: number;
  firstSnapshot: { timestamp: string; url: string } | null;
  latestSnapshot: { timestamp: string; url: string; status: number } | null;
  snapshots: WaybackSnapshot[];
  yearlyCounts: YearlyCount[];
  timeline: TimelineEntry[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Format a YYYYMMDDHHMMSS Wayback timestamp as a human-readable date
// ---------------------------------------------------------------------------
function formatTimestamp(ts: string | undefined): string {
  if (!ts || ts.length < 8) return ts || 'Unknown';
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthIdx = Math.max(0, Math.min(11, parseInt(month, 10) - 1));
  const dayNum = parseInt(day, 10) || 1;
  return `${monthNames[monthIdx]} ${dayNum}, ${year}`;
}

// Compact timestamp for tight spaces (e.g. "Mar 15, 2020")
function formatTimestampShort(ts: string | undefined): string {
  if (!ts || ts.length < 8) return ts || 'Unknown';
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Math.max(0, Math.min(11, parseInt(month, 10) - 1));
  const dayNum = parseInt(day, 10) || 1;
  return `${monthAbbr[monthIdx]} ${dayNum}, ${year}`;
}

export default function WaybackPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);

  const [url, setUrl] = useState('');
  const [result, setResult] = useState<WaybackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const scan = async () => {
    const trimmed = url.trim();
    if (trimmed.length < 4 || !currentCase) return;

    setLoading(true);
    setResult(null);
    setSearched(false);

    try {
      const data = await osintApi.wayback(trimmed, currentCase.id, { country, language, regionalOnly });
      setResult(data);
      setSearched(true);
    } catch {
      setResult(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  // Years active = span between first and latest yearly count
  const yearsActive = result && result.yearlyCounts.length > 0
    ? result.yearlyCounts[result.yearlyCounts.length - 1].year - result.yearlyCounts[0].year
    : 0;

  // Max yearly count (for bar chart scaling)
  const maxCount = result && result.yearlyCounts.length > 0
    ? Math.max(...result.yearlyCounts.map((y) => y.count))
    : 1;

  // Build a set of timestamps that mark digest changes (for snapshot list badge)
  const digestChangeIndices = new Set<number>();
  if (result) {
    for (let i = 1; i < result.snapshots.length; i++) {
      const prev = result.snapshots[i - 1];
      const curr = result.snapshots[i];
      if (prev.digest && curr.digest && prev.digest !== curr.digest) {
        digestChangeIndices.add(i);
      }
    }
  }

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <History className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to query the Wayback Machine</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <History className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">WAYBACK MACHINE</h2>
            <p className="text-[10px] text-muted-foreground">
              <span className="neon-purple">artemis37</span> · Wayback Machine · past → now timeline
            </p>
          </div>
        </div>
        {loading && (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
            <Activity className="size-2.5 mr-0.5 animate-pulse" />
            SCANNING ARCHIVE
          </Badge>
        )}
        {!loading && result && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            <CheckCircle2 className="size-2.5 mr-0.5" />
            {result.totalSnapshots} SNAPSHOTS
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* URL input + scan button */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Clock className="size-3.5" />
              URL OR DOMAIN · ONE-CLICK ARCHIVE SCAN
            </Label>
            <div className="flex gap-2">
              <div className="relative group flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                <Input
                  placeholder="example.com or https://example.com/path..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) scan();
                  }}
                  className="cyber-input h-11 pl-10 font-mono text-sm"
                />
                {loading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-cyan-400" />
                )}
              </div>
              <Button
                onClick={scan}
                disabled={loading || url.trim().length < 4}
                className="cyber-btn h-11 px-5"
              >
                {loading ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="size-4 mr-1" />
                )}
                Scan Archive
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-cyan-400" />
              Queries the CDX + Sparkline + Availability APIs · up to 50 archived snapshots
            </p>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="cyber-card rounded-md p-3 text-center">
                    <div className="h-6 w-12 mx-auto rounded shimmer mb-2" />
                    <div className="h-2 w-16 mx-auto rounded shimmer" />
                  </div>
                ))}
              </div>
              <div className="cyber-card rounded-md p-4">
                <div className="h-3 w-32 rounded shimmer mb-3" />
                <div className="flex items-end gap-1 h-24">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t shimmer"
                      style={{ height: `${20 + ((i * 13) % 70)}%` }}
                    />
                  ))}
                </div>
              </div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="cyber-card rounded-md p-3 flex items-center gap-3">
                  <div className="size-3 rounded-full shimmer" />
                  <div className="h-3 flex-1 rounded shimmer" />
                </div>
              ))}
            </div>
          )}

          {/* Error / empty result message */}
          {!loading && result && result.error && result.totalSnapshots === 0 && (
            <Card className="cyber-card rounded-md border-amber-500/20">
              <CardContent className="p-6 text-center">
                <FileWarning className="size-8 mx-auto mb-2 text-amber-400/60" />
                <p className="text-sm text-amber-300">{result.error}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Wayback Machine may be unavailable or has never archived this URL.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stats row */}
          {!loading && result && result.totalSnapshots > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-in-up">
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{result.totalSnapshots}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">TOTAL SNAPSHOTS</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xs font-bold neon-green leading-tight">
                  {result.firstSnapshot ? formatTimestampShort(result.firstSnapshot.timestamp) : '—'}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-wide mt-1">FIRST CAPTURED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xs font-bold neon-purple leading-tight">
                  {result.latestSnapshot ? formatTimestampShort(result.latestSnapshot.timestamp) : '—'}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-wide mt-1">LATEST CAPTURED</p>
              </div>
              <div className="cyber-card rounded-md p-3 text-center">
                <p className="text-xl font-bold neon-cyan">{yearsActive}</p>
                <p className="text-[9px] text-muted-foreground tracking-wide">YEARS ACTIVE</p>
              </div>
            </div>
          )}

          {/* Yearly counts bar chart */}
          {!loading && result && result.yearlyCounts.length > 0 && (
            <div className="cyber-card rounded-md p-4 animate-fade-in-up">
              <h3 className="text-xs font-semibold neon-cyan tracking-wide mb-3 flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                ARCHIVE DENSITY · SNAPSHOTS PER YEAR
              </h3>
              <div className="flex items-end gap-1 h-32 overflow-x-auto">
                {result.yearlyCounts.map((y) => {
                  const heightPct = maxCount > 0 ? Math.max(4, (y.count / maxCount) * 100) : 4;
                  return (
                    <div
                      key={y.year}
                      className="flex flex-col items-center justify-end min-w-[24px] flex-1 group"
                      title={`${y.year}: ${y.count} snapshots`}
                    >
                      <span className="text-[9px] font-mono text-cyan-400/70 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {y.count}
                      </span>
                      <div
                        className="w-full rounded-t-sm bg-gradient-to-t from-cyan-500/30 to-cyan-400/80 hover:from-cyan-400/60 hover:to-cyan-300 transition-colors"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[8px] font-mono text-muted-foreground mt-1 whitespace-nowrap rotate-0">
                        {String(y.year).slice(-2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Snapshots list */}
          {!loading && result && result.snapshots.length > 0 && (
            <div className="space-y-2 animate-fade-in-up">
              <h3 className="text-xs font-semibold neon-cyan tracking-wide flex items-center gap-1">
                <History className="size-3.5" />
                ARCHIVED SNAPSHOTS
                <Badge variant="outline" className="ml-auto text-[9px] h-4 text-cyan-400 border-cyan-500/30">
                  {result.snapshots.length} / 50
                </Badge>
              </h3>
              <div className="max-h-96 overflow-y-auto custom-scroll pr-1 space-y-1.5">
                {result.snapshots.map((snap, i) => {
                  const isChange = digestChangeIndices.has(i);
                  return (
                    <div
                      key={`${snap.timestamp}-${i}`}
                      className={`cyber-card rounded-md p-3 flex items-center justify-between gap-3 group transition-colors hover:bg-cyan-500/5 ${
                        isChange ? 'border-purple-500/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`size-2 rounded-full shrink-0 ${isChange ? 'bg-purple-400' : 'bg-cyan-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-cyan-50 truncate">
                            {formatTimestamp(snap.timestamp)}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 truncate font-mono">
                            {snap.originalUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isChange && (
                          <Badge variant="outline" className="text-[9px] h-4 text-purple-400 border-purple-500/30 bg-purple-500/5">
                            <AlertTriangle className="size-2.5 mr-0.5" />
                            CHANGED
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-4 ${
                            snap.statusCode === 200
                              ? 'text-green-400 border-green-500/30 bg-green-500/5'
                              : 'text-amber-400 border-amber-500/30 bg-amber-500/5'
                          }`}
                        >
                          {snap.statusCode}
                        </Badge>
                        <a
                          href={snap.archiveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-6 p-0 inline-flex items-center justify-center rounded text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                          title="View on Wayback Machine"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline of changes */}
          {!loading && result && result.timeline.length > 0 && (
            <div className="cyber-card rounded-md p-4 animate-fade-in-up">
              <h3 className="text-xs font-semibold neon-cyan tracking-wide mb-4 flex items-center gap-1">
                <Activity className="size-3.5" />
                TIMELINE OF CHANGES
              </h3>
              <div className="relative pl-6">
                {/* Vertical neon-cyan connecting line */}
                <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400/80 via-cyan-500/40 to-purple-500/40" />
                <div className="space-y-4">
                  {result.timeline.map((entry, i) => {
                    const isChange = entry.event.toLowerCase().includes('change');
                    const isFirst = i === 0;
                    const isLast = i === result.timeline.length - 1 && result.timeline.length > 1;
                    const dotClass = isChange
                      ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                      : isFirst
                        ? 'bg-green-400 shadow-[0_0_8px_rgba(0,255,157,0.6)]'
                        : isLast
                          ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]'
                          : 'bg-cyan-400/60';
                    return (
                      <div key={i} className="relative">
                        {/* Dot on the line */}
                        <div className={`absolute -left-[18px] top-1 size-2.5 rounded-full ${dotClass}`} />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-cyan-50">{entry.date}</p>
                            <p className={`text-[10px] mt-0.5 ${isChange ? 'text-purple-300' : 'text-muted-foreground'}`}>
                              {entry.event}
                            </p>
                          </div>
                          {entry.archiveUrl && (
                            <a
                              href={entry.archiveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="size-6 p-0 inline-flex items-center justify-center rounded text-cyan-400 hover:bg-cyan-500/10 transition-colors shrink-0"
                              title="View archived snapshot"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state — never scanned */}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <History className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Enter a URL to scan the archive</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Builds a past → now timeline from web.archive.org snapshots
              </p>
            </div>
          )}

          {/* Searched but no results */}
          {!loading && searched && (!result || result.totalSnapshots === 0) && !(result?.error) && (
            <Card className="cyber-card rounded-md">
              <CardContent className="p-6 text-center">
                <History className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No archived snapshots found</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  This URL may never have been crawled by the Wayback Machine.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
