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
  Globe,
  Loader2,
  ExternalLink,
  Plus,
  Mail,
  Phone,
  Link2,
  User,
  Image as ImageIcon,
  ScanSearch,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface CrawlResult {
  url: string;
  title: string;
  description: string;
  emails: string[];
  phones: string[];
  socialLinks: Array<{ platform: string; url: string; username: string }>;
  usernames: Array<{ platform: string; username: string; url: string }>;
  images: string[];
  allUrls: string[];
  entitiesCreated: number;
  entityIds: string[];
}

type CrawlStatus = 'idle' | 'crawling' | 'done' | 'error';

export default function CrawlerPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const [url, setUrl] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [status, setStatus] = useState<CrawlStatus>('idle');
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const crawl = async () => {
    if (!currentCase || url.trim().length < 4) return;
    const id = ++reqId.current;
    setStatus('crawling');
    setError('');
    setResult(null);

    try {
      const data = await reconApi.crawl({
        url: url.trim(),
        caseId: currentCase.id,
        autoCreate,
        country,
        language,
        regionalOnly,
      });
      if (id === reqId.current) {
        setResult(data);
        setStatus('done');
      }
    } catch (err) {
      if (id === reqId.current) {
        setError(err instanceof Error ? err.message.replace(/^API \d+: /, '') : 'Crawl failed');
        setStatus('error');
      }
    }
  };

  const addEntity = async (name: string, type: 'email' | 'phone' | 'username' | 'url' | 'image', value: string) => {
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
          <ScanSearch className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to use the crawler</p>
        </div>
      </div>
    );
  }

  const totalExtracted = result
    ? result.emails.length + result.phones.length + result.socialLinks.length + result.images.length
    : 0;

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <ScanSearch className="size-4 neon-cyan" />
          <div>
            <h2 className="text-sm font-semibold neon-cyan tracking-wide">ACTIVE CRAWLER</h2>
            <p className="text-[10px] text-muted-foreground">Fetch a URL · extract emails, phones, socials, images</p>
          </div>
        </div>
        {status === 'crawling' && (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">
            <Loader2 className="size-2.5 mr-0.5 animate-spin" />
            CRAWLING
          </Badge>
        )}
        {status === 'done' && result && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            <CheckCircle2 className="size-2.5 mr-0.5" />
            {totalExtracted} EXTRACTED
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* URL input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs tracking-wide text-cyan-400/70">
              <Globe className="size-3.5" />
              TARGET URL
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400/60" />
                <Input
                  placeholder="https://example.com or example.com..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && status !== 'crawling' && crawl()}
                  className="cyber-input h-11 pl-10 font-mono text-sm"
                  disabled={status === 'crawling'}
                />
              </div>
              <Button
                onClick={crawl}
                disabled={status === 'crawling' || url.trim().length < 4}
                className="cyber-btn h-11 px-6"
              >
                {status === 'crawling' ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" /> CRAWLING</>
                ) : (
                  <><ScanSearch className="size-4 mr-1.5" /> CRAWL</>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <FileText className="size-2.5 text-cyan-400" />
                Fetches page · regex-extracts entities · auto-creates into graph
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

          {/* Crawling animation */}
          {status === 'crawling' && (
            <div className="cyber-card rounded-md p-6 flex flex-col items-center">
              <div className="relative mb-3">
                <ScanSearch className="size-10 text-cyan-400 animate-pulse" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Crawling & extracting...</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">{url}</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="cyber-card rounded-md p-4 border-destructive/30">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                <span className="text-sm font-medium">Crawl Failed</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{error}</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && result && (
            <>
              {/* Page info */}
              <div className="cyber-card rounded-md p-3 animate-fade-in-up">
                <div className="flex items-start gap-2">
                  <Globe className="size-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-cyan-50">{result.title}</h3>
                    {result.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.description}</p>
                    )}
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5 mt-1 font-mono">
                      <ExternalLink className="size-2.5" />{result.url}
                    </a>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-in-up">
                <StatBox icon={Mail} count={result.emails.length} label="EMAILS" color="green" />
                <StatBox icon={Phone} count={result.phones.length} label="PHONES" color="cyan" />
                <StatBox icon={User} count={result.socialLinks.length} label="SOCIALS" color="purple" />
                <StatBox icon={ImageIcon} count={result.images.length} label="IMAGES" color="cyan" />
              </div>

              {result.entitiesCreated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/20">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span className="text-xs text-green-400">
                    Auto-created {result.entitiesCreated} entities in case graph
                  </span>
                </div>
              )}

              {/* Emails */}
              {result.emails.length > 0 && (
                <ExtractSection title="EMAILS" icon={Mail} color="green">
                  <div className="space-y-1">
                    {result.emails.map((email, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-green-500/[0.03] hover:bg-green-500/5 group">
                        <span className="text-xs font-mono text-green-100">{email}</span>
                        {!autoCreate && (
                          <Button variant="ghost" size="sm" className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10" onClick={() => addEntity(email, 'email', email)}>
                            <Plus className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ExtractSection>
              )}

              {/* Phones */}
              {result.phones.length > 0 && (
                <ExtractSection title="PHONE NUMBERS" icon={Phone} color="cyan">
                  <div className="space-y-1">
                    {result.phones.map((phone, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-cyan-500/[0.03] hover:bg-cyan-500/5 group">
                        <span className="text-xs font-mono text-cyan-100">{phone}</span>
                        {!autoCreate && (
                          <Button variant="ghost" size="sm" className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10" onClick={() => addEntity(phone, 'phone', phone)}>
                            <Plus className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ExtractSection>
              )}

              {/* Social Links */}
              {result.socialLinks.length > 0 && (
                <ExtractSection title="SOCIAL PROFILES" icon={User} color="purple">
                  <div className="space-y-1">
                    {result.socialLinks.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-purple-500/[0.03] hover:bg-purple-500/5 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[9px] h-4 text-purple-400 border-purple-500/30 bg-purple-500/5 shrink-0">
                            {s.platform}
                          </Badge>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-purple-100 hover:text-purple-300 truncate">
                            {s.username ? `@${s.username}` : s.url.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                        {!autoCreate && (
                          <Button variant="ghost" size="sm" className="size-6 p-0 opacity-0 group-hover:opacity-100 text-cyan-400 hover:bg-cyan-500/10" onClick={() => addEntity(`${s.username || 'profile'}@${s.platform}`, 'username', s.url)}>
                            <Plus className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ExtractSection>
              )}

              {/* Images */}
              {result.images.length > 0 && (
                <ExtractSection title="IMAGES FOUND" icon={ImageIcon} color="cyan">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {result.images.slice(0, 16).map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-md overflow-hidden cyber-card group">
                        { }
                        <img src={img} alt="extracted" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                      </a>
                    ))}
                  </div>
                </ExtractSection>
              )}

              {/* All URLs */}
              {result.allUrls.length > 0 && (
                <ExtractSection title="ALL LINKS" icon={Link2} color="cyan">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.allUrls.slice(0, 30).map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block text-[10px] font-mono text-cyan-400/50 hover:text-cyan-400 truncate">
                        {u}
                      </a>
                    ))}
                  </div>
                </ExtractSection>
              )}
            </>
          )}

          {/* Empty state */}
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="relative mb-3">
                <ScanSearch className="size-12 opacity-20" />
                <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
              </div>
              <p className="text-sm neon-cyan">Enter a URL to crawl</p>
              <p className="text-[10px] mt-1 text-muted-foreground/60">
                Extracts emails, phones, social profiles & images automatically
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatBox({ icon: Icon, count, label, color }: { icon: React.ElementType; count: number; label: string; color: 'cyan' | 'purple' | 'green' }) {
  const colorClass = color === 'cyan' ? 'neon-cyan' : color === 'purple' ? 'neon-purple' : 'neon-green';
  return (
    <div className="cyber-card rounded-md p-3 text-center">
      <Icon className={`size-3.5 mx-auto mb-1 ${colorClass}`} />
      <p className={`text-lg font-bold ${colorClass}`}>{count}</p>
      <p className="text-[9px] text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
}

function ExtractSection({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: 'cyan' | 'purple' | 'green'; children: React.ReactNode }) {
  const colorClass = color === 'cyan' ? 'neon-cyan' : color === 'purple' ? 'neon-purple' : 'neon-green';
  return (
    <div className="cyber-card rounded-md p-3 animate-fade-in-up">
      <h3 className={`text-xs font-semibold mb-2 tracking-wide ${colorClass} flex items-center gap-1.5`}>
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </div>
  );
}
