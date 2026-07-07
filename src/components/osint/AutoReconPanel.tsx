'use client';

import { useState, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { reconApi, entitiesApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Crosshair,
  Zap,
  Loader2,
  ExternalLink,
  Plus,
  CheckCircle2,
  UserSearch,
  Globe,
  Image as ImageIcon,
  Phone,
  Target,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface AutoReconResult {
  target: string;
  detectedType: string;
  results: {
    username: Array<{ title: string; url: string; snippet: string; source: string; platform: string; confidence: number }>;
    social: Array<{ title: string; url: string; snippet: string; source: string }>;
    web: Array<{ title: string; url: string; snippet: string; source: string }>;
    reverse: Array<{ title: string; url: string; snippet: string; source: string }>;
    images: Array<{ url: string; title: string; source: string; width?: number; height?: number }>;
  };
  summary: { totalFound: number; sourcesScanned: number; entitiesCreated: number };
  entityIds: string[];
}

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

const SCANNER_STEPS = [
  { key: 'username', label: 'Username Enumeration', icon: UserSearch, color: 'cyan' },
  { key: 'social', label: 'Social Monitor', icon: Zap, color: 'purple' },
  { key: 'web', label: 'Deep Web Search', icon: Globe, color: 'cyan' },
  { key: 'reverse', label: 'Reverse Lookup', icon: Phone, color: 'green' },
  { key: 'images', label: 'Image Search', icon: ImageIcon, color: 'purple' },
] as const;

export default function AutoReconPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const [target, setTarget] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [result, setResult] = useState<AutoReconResult | null>(null);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(-1);
  const reqId = useRef(0);

  const launchRecon = async () => {
    if (!currentCase || target.trim().length < 2) return;
    const id = ++reqId.current;
    setStatus('scanning');
    setError('');
    setResult(null);
    setActiveStep(0);

    // Simulate progressive step activation for UX
    const stepInterval = setInterval(() => {
      setActiveStep((s) => (s < SCANNER_STEPS.length - 1 ? s + 1 : s));
    }, 400);

    try {
      const data = await reconApi.auto({
        target: target.trim(),
        caseId: currentCase.id,
        autoCreate,
        country,
        language,
        regionalOnly,
      });
      if (id === reqId.current) {
        setResult(data);
        setStatus('done');
        setActiveStep(SCANNER_STEPS.length);
      }
    } catch (err) {
      if (id === reqId.current) {
        setError(err instanceof Error ? err.message.replace(/^API \d+: /, '') : 'Recon failed');
        setStatus('error');
      }
    } finally {
      clearInterval(stepInterval);
    }
  };

  const addEntity = async (name: string, type: 'username' | 'url' | 'image' | 'person', value: string) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({ caseId: currentCase.id, name, type, value });
    } catch {
      // ignore
    }
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Crosshair className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to run auto recon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Crosshair className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">AUTO RECON</h2>
            <p className="text-[10px] text-muted-foreground">One-click · chains all 5 scanners in parallel</p>
          </div>
        </div>
        {status === 'scanning' && (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
            <Zap className="size-2.5 mr-0.5 animate-pulse" />
            RUNNING
          </Badge>
        )}
        {status === 'done' && result && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            <CheckCircle2 className="size-2.5 mr-0.5" />
            {result.summary.totalFound} FOUND
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Target input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Target className="size-3.5" />
              TARGET · USERNAME / EMAIL / PHONE / DOMAIN
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                <Input
                  placeholder="Enter target (e.g. johndoe, user@email.com, example.com)..."
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && status !== 'scanning' && launchRecon()}
                  className="cyber-input h-11 pl-10 font-mono text-sm"
                  disabled={status === 'scanning'}
                />
              </div>
              <Button
                onClick={launchRecon}
                disabled={status === 'scanning' || target.trim().length < 2}
                className="cyber-btn h-11 px-6"
              >
                {status === 'scanning' ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" /> SCANNING</>
                ) : (
                  <><Zap className="size-4 mr-1.5" /> LAUNCH RECON</>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-2.5 text-cyan-400" />
                Auto-detects type & runs username + social + deep web + reverse + image search
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="size-3 accent-cyan-400"
                />
                <span className="text-[10px] text-cyan-400/70 tracking-wide">AUTO-CREATE ENTITIES</span>
              </label>
            </div>
          </div>

          {/* Scanner progress dashboard */}
          {status === 'scanning' && (
            <div className="cyber-card rounded-md p-4">
              <h3 className="text-xs font-semibold mb-3 neon-cyan tracking-wide flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                RUNNING 5 SCANNERS IN PARALLEL
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SCANNER_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = i <= activeStep;
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-2 p-2 rounded border transition-all ${
                        isActive
                          ? 'border-cyan-500/30 bg-cyan-500/5'
                          : 'border-muted/20 bg-muted/10 opacity-50'
                      }`}
                    >
                      <Icon className={`size-3.5 ${isActive ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                      <span className={`text-[10px] tracking-wide ${isActive ? 'text-cyan-50' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                      {isActive && i < activeStep && (
                        <CheckCircle2 className="size-3 text-green-400 ml-auto" />
                      )}
                      {i === activeStep && (
                        <Loader2 className="size-3 text-cyan-400 animate-spin ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="cyber-card rounded-md p-4 border-destructive/30">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                <span className="text-sm font-medium">Recon Failed</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{error}</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && result && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-in-up">
                <div className="cyber-card rounded-md p-3 text-center">
                  <p className="text-xl font-bold neon-cyan">{result.summary.totalFound}</p>
                  <p className="text-[9px] text-muted-foreground tracking-wide">TOTAL HITS</p>
                </div>
                <div className="cyber-card rounded-md p-3 text-center">
                  <p className="text-xl font-bold neon-green">{result.results.username.length}</p>
                  <p className="text-[9px] text-muted-foreground tracking-wide">PROFILES</p>
                </div>
                <div className="cyber-card rounded-md p-3 text-center">
                  <p className="text-xl font-bold neon-purple">{result.results.web.length + result.results.social.length}</p>
                  <p className="text-[9px] text-muted-foreground tracking-wide">WEB + SOCIAL</p>
                </div>
                <div className="cyber-card rounded-md p-3 text-center">
                  <p className="text-xl font-bold neon-cyan">{result.results.images.length}</p>
                  <p className="text-[9px] text-muted-foreground tracking-wide">IMAGES</p>
                </div>
              </div>

              {result.summary.entitiesCreated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/20 animate-fade-in-up">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span className="text-xs text-green-400">
                    Auto-created {result.summary.entitiesCreated} entities in case graph
                  </span>
                </div>
              )}

              {/* Detected type badge */}
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                  DETECTED: {result.detectedType.toUpperCase()}
                </Badge>
              </div>

              {/* Username / Profile results */}
              {result.results.username.length > 0 && (
                <ResultSection
                  title="PROFILES FOUND"
                  icon={UserSearch}
                  color="cyan"
                  count={result.results.username.length}
                >
                  <div className="space-y-1.5">
                    {result.results.username.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-cyan-500/[0.02] hover:bg-cyan-500/5 transition-colors group">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{r.platform}</p>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400/50 hover:text-cyan-400 truncate block font-mono">
                              {r.url.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-400/30 bg-green-500/5">
                            {r.confidence}%
                          </Badge>
                          {!autoCreate && (
                            <Button variant="ghost" size="sm" className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10" onClick={() => addEntity(`${r.platform}`, 'username', r.url)}>
                              <Plus className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Web results */}
              {result.results.web.length > 0 && (
                <ResultSection title="DEEP WEB RESULTS" icon={Globe} color="cyan" count={result.results.web.length}>
                  <div className="space-y-1.5">
                    {result.results.web.map((r, i) => (
                      <Card key={i} className="cyber-card rounded-md animate-fade-in-up">
                        <CardContent className="p-2.5">
                          <h4 className="text-xs font-medium text-cyan-50 line-clamp-1">{r.title}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{r.snippet}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400/50 hover:text-cyan-400 flex items-center gap-0.5 mt-1 font-mono">
                            <ExternalLink className="size-2.5" />{r.source}
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Social results */}
              {result.results.social.length > 0 && (
                <ResultSection title="SOCIAL MENTIONS" icon={Zap} color="purple" count={result.results.social.length}>
                  <div className="space-y-1.5">
                    {result.results.social.map((r, i) => (
                      <Card key={i} className="cyber-card rounded-md animate-fade-in-up">
                        <CardContent className="p-2.5">
                          <h4 className="text-xs font-medium text-cyan-50 line-clamp-1">{r.title}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{r.snippet}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400/50 hover:text-cyan-400 flex items-center gap-0.5 mt-1 font-mono">
                            <ExternalLink className="size-2.5" />{r.source}
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Image results */}
              {result.results.images.length > 0 && (
                <ResultSection title="RELATED IMAGES" icon={ImageIcon} color="purple" count={result.results.images.length}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {result.results.images.map((img, i) => (
                      <a
                        key={i}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square rounded-md overflow-hidden cyber-card group"
                      >
                        { }
                        <img
                          src={img.url}
                          alt={img.title || 'search result'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                          <span className="text-[8px] text-cyan-50 font-mono truncate">{img.source}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </ResultSection>
              )}
            </>
          )}

          {/* Empty state */}
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <Crosshair className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Enter a target to launch full recon</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Runs 5 scanners in parallel · auto-detects target type
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  color,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: 'cyan' | 'purple' | 'green';
  count: number;
  children: React.ReactNode;
}) {
  const colorClass = color === 'cyan' ? 'neon-cyan' : color === 'purple' ? 'neon-purple' : 'neon-green';
  return (
    <div className="cyber-card rounded-md p-3 animate-fade-in-up">
      <h3 className={`text-xs font-semibold mb-2 tracking-wide ${colorClass} flex items-center gap-1.5`}>
        <Icon className="size-3.5" />
        {title}
        <Badge variant="outline" className={`ml-auto text-[9px] h-4 ${color === 'cyan' ? 'text-cyan-400 border-cyan-500/30' : color === 'purple' ? 'text-purple-400 border-purple-500/30' : 'text-green-400 border-green-500/30'}`}>
          {count}
        </Badge>
      </h3>
      {children}
    </div>
  );
}
