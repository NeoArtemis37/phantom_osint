'use client';

import { useState, useEffect, useRef } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { searchApi, entitiesApi, osintApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock } from '@/components/ui/code-block';
import {
  Image as ImageIcon,
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Zap,
  AlertCircle,
  ScanSearch,
  Upload,
  X,
  User,
  Tag,
  MapPin,
  Palette,
  FileText,
  AlertTriangle,
  Sparkles,
  Facebook,
  Linkedin,
  Instagram,
} from 'lucide-react';

interface ImageResult {
  url: string;
  title: string;
  source: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

type PlatformTag = 'facebook' | 'linkedin' | 'instagram' | 'yandex';
type MatchType = 'profile' | 'photo' | 'mention' | 'image-search';

interface PlatformMatch {
  platform: PlatformTag;
  title: string;
  url: string;
  snippet: string;
  source: string;
  matchType: MatchType;
  confidence: number;
}

interface ImageReconResult {
  author: string;
  tool: string;
  generatedAt: string;
  imageProvided: boolean;
  analysis: {
    description: string;
    people: Array<{ count: number; gender: string; ageRange: string; notableFeatures: string }>;
    objects: string[];
    sceneType: string;
    locationClues: string[];
    estimatedLocation: string;
    textDetected: string[];
    logos: string[];
    colors: string[];
    mood: string;
    isScreenshot: boolean;
    isDocument: boolean;
    isProfilePicture: boolean;
    searchKeywords: string[];
    searchQuery: string;
    riskFlags: string[];
  };
  similarImages: Array<{ url: string; title: string; source: string; width?: number; height?: number }>;
  webAppearances: Array<{ title: string; url: string; snippet: string; source: string }>;
  platformMatches: PlatformMatch[];
  stats: {
    objects: number;
    people: number;
    textDetected: number;
    logos: number;
    similarImages: number;
    webAppearances: number;
    platformMatches: number;
    riskFlags: number;
  };
  error?: string;
}

export default function ImageSearchPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  // ===== INVESTIGATION LOCALE (set globally via the CountryLocaleSelector in the OSINT toolbar) =====
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  // --- TEXT mode state (existing) ---
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // --- RECON mode state (new) ---
  const [mode, setMode] = useState<'text' | 'recon'>('text');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // data URL
  const [uploadedName, setUploadedName] = useState<string>('');
  const [reconResult, setReconResult] = useState<ImageReconResult | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live auto-search as you type (TEXT mode only)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setError('');
      return;
    }

    if (debounce.current) clearTimeout(debounce.current);

    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      setError('');

      try {
        const data = await searchApi.image(trimmed, currentCase?.id, 16, { country, language, regionalOnly });
        if (id === reqId.current) {
          setResults(data.images || []);
          setSearched(true);
        }
      } catch (err) {
        if (id === reqId.current) {
          setError(err instanceof Error ? err.message.replace(/^API \d+: /, '') : 'Image search failed');
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (id === reqId.current) {
          setLoading(false);
        }
      }
    }, 600);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, currentCase, country, language, regionalOnly]);

  const addAsEntity = async (img: ImageResult) => {
    if (!currentCase) return;
    try {
      await entitiesApi.create({
        caseId: currentCase.id,
        name: img.title || `Image from ${img.source}`,
        type: 'image',
        value: img.url,
      });
    } catch {
      // ignore
    }
  };

  // --- RECON file handling ---
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReconError('Please select an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setReconError('Image must be under 8MB');
      return;
    }
    setReconError('');
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setUploadedName(file.name);
      setReconResult(null); // clear previous results
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be re-selected later
    e.target.value = '';
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setUploadedName('');
    setReconResult(null);
    setReconError('');
  };

  const runRecon = async () => {
    if (!uploadedImage) return;
    setReconLoading(true);
    setReconError('');
    setReconResult(null);
    try {
      const result = await osintApi.imageRecon({ image: uploadedImage, caseId: currentCase?.id, country, language, regionalOnly });
      setReconResult(result);
    } catch (err) {
      setReconError(err instanceof Error ? err.message.replace(/^API \d+: /, '') : 'Image recon failed');
    } finally {
      setReconLoading(false);
    }
  };

  const pivotToTextSearch = (keyword: string) => {
    setQuery(keyword);
    setMode('text');
  };

  return (
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 neon-purple" />
          <div>
            <h2 className="text-sm font-semibold neon-purple tracking-wide">IMAGE SEARCH</h2>
            <p className="text-[10px] text-muted-foreground">Live · auto-search as you type · reverse image recon</p>
          </div>
        </div>
        {mode === 'text' && loading && (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[9px]">
            <Zap className="size-2.5 mr-0.5 animate-pulse" />
            SEARCHING
          </Badge>
        )}
        {mode === 'text' && !loading && searched && results.length > 0 && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            {results.length} IMAGES
          </Badge>
        )}
        {mode === 'recon' && reconLoading && (
          <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30 text-[9px]">
            <Loader2 className="size-2.5 mr-0.5 animate-spin" />
            ANALYZING
          </Badge>
        )}
        {mode === 'recon' && !reconLoading && reconResult && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px]">
            RECON COMPLETE
          </Badge>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-2 border-b border-purple-500/10 bg-black/20">
        <button
          onClick={() => setMode('text')}
          className={
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-semibold tracking-wider transition-colors ' +
            (mode === 'text'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
              : 'text-muted-foreground/60 hover:text-purple-300/80 border border-transparent hover:bg-purple-500/5')
          }
        >
          <Search className="size-3" />
          TEXT SEARCH
        </button>
        <button
          onClick={() => setMode('recon')}
          className={
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-semibold tracking-wider transition-colors ' +
            (mode === 'recon'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-[0_0_12px_rgba(236,72,153,0.2)]'
              : 'text-muted-foreground/60 hover:text-pink-300/80 border border-transparent hover:bg-pink-500/5')
          }
        >
          <ScanSearch className="size-3" />
          IMAGE RECON (UPLOAD)
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {mode === 'text' ? (
            <>
              {/* ============ TEXT MODE (existing) ============ */}
              {/* Search input — live */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs tracking-wide text-purple-400/70">
                  <ImageIcon className="size-3.5" />
                  IMAGE SEARCH · LIVE
                </Label>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-purple-400/60" />
                  <Input
                    placeholder="Type to search for images... (person, place, logo)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="cyber-input h-11 pl-10 font-mono text-sm"
                  />
                  {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-purple-400" />
                  )}
                  {!loading && query.length >= 2 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <div className="size-2 rounded-full bg-purple-400 pulse-dot" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5 text-purple-400" />
                  Auto-searches as you type · {results.length} images found
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="cyber-card rounded-md p-3 border-destructive/30">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="size-4" />
                    <span className="text-xs">{error}</span>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {loading && results.length === 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-square rounded-md shimmer" />
                  ))}
                </div>
              )}

              {/* Results grid */}
              {results.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {results.map((img, i) => (
                    <Card
                      key={i}
                      className="cyber-card rounded-md overflow-hidden animate-fade-in-up group relative"
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    >
                      <div className="relative aspect-square overflow-hidden bg-muted/20">
                        <img
                          src={img.url}
                          alt={img.title || 'search result'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            t.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground/30"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5-2.5 2.5L9 8l-6 6"/></svg></div>';
                          }}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                          <div className="flex items-center justify-between gap-1">
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="size-7 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 transition-colors"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                            {currentCase && (
                              <button
                                onClick={() => addAsEntity(img)}
                                className="size-7 rounded-md bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-purple-300 transition-colors"
                                title="Add as entity"
                              >
                                <Plus className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Source badge */}
                        {img.source && (
                          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge className="text-[8px] h-3.5 px-1 bg-black/60 text-cyan-300 border-cyan-500/30 backdrop-blur-sm">
                              {img.source}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {img.title && (
                        <CardContent className="p-1.5">
                          <p className="text-[9px] text-muted-foreground line-clamp-1">{img.title}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty state — searched but no results */}
              {!loading && searched && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <ImageIcon className="size-6 mb-2 opacity-30" />
                  <p className="text-xs">No images for</p>
                  <p className="text-xs font-mono text-purple-400/60 mt-1">"{query}"</p>
                </div>
              )}

              {/* Initial empty state */}
              {!loading && !searched && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="relative mb-3">
                    <ImageIcon className="size-10 opacity-20" />
                    <div className="absolute inset-0 blur-xl bg-purple-500/10 rounded-full" />
                  </div>
                  <p className="text-sm neon-purple">Type to search for images</p>
                  <p className="text-[10px] mt-1 text-muted-foreground/60">
                    Find profile pictures, logos, screenshots & more
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ============ RECON MODE (new) ============ */}

              {/* Error banner */}
              {reconError && (
                <div className="cyber-card rounded-md p-3 border-destructive/30">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="size-4" />
                    <span className="text-xs">{reconError}</span>
                  </div>
                </div>
              )}

              {/* Upload zone + preview */}
              <div className="space-y-3">
                {!uploadedImage ? (
                  // Empty state — no image yet
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={
                      'flex flex-col items-center justify-center border-2 border-dashed rounded-md py-12 px-4 cursor-pointer transition-colors ' +
                      (dragOver
                        ? 'border-pink-500/60 bg-pink-500/5'
                        : 'border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5')
                    }
                  >
                    <div className="relative mb-3">
                      <ImageIcon className="size-12 text-pink-400/70" />
                      <div className="absolute inset-0 blur-xl bg-pink-500/20 rounded-full" />
                    </div>
                    <p className="text-sm font-semibold neon-pink text-pink-300 tracking-wide">
                      Upload an image for OSINT recon
                    </p>
                    <p className="text-[10px] mt-1 text-muted-foreground/70 text-center">
                      VLM analysis · similar images · web appearances · OCR · logo detection
                    </p>
                    <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-md border border-pink-500/30 bg-pink-500/10 text-[10px] font-mono text-pink-300 tracking-wider">
                      <Upload className="size-3" />
                      DROP AN IMAGE HERE OR CLICK TO BROWSE
                    </div>
                    <p className="text-[9px] mt-3 text-muted-foreground/50">
                      PNG / JPEG / WebP / GIF · max 8MB
                    </p>
                  </div>
                ) : (
                  // Image uploaded — preview + actions
                  <div className="cyber-card rounded-md p-3 border-pink-500/30">
                    <div className="flex items-start gap-3">
                      <div className="size-24 shrink-0 rounded-md overflow-hidden bg-black/40 border border-pink-500/20 flex items-center justify-center">
                        <img
                          src={uploadedImage}
                          alt={uploadedName || 'uploaded'}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-mono text-pink-300 truncate" title={uploadedName}>
                            {uploadedName || 'uploaded-image'}
                          </p>
                          <button
                            onClick={clearUpload}
                            className="size-6 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 transition-colors shrink-0"
                            title="Remove image"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {Math.round(uploadedImage.length * 0.75 / 1024)} KB · ready for analysis
                        </p>
                        <Button
                          onClick={runRecon}
                          disabled={reconLoading}
                          className="mt-2 w-full h-9 bg-gradient-to-r from-pink-500/90 to-fuchsia-500/90 hover:from-pink-500 hover:to-fuchsia-500 text-white border-0 font-mono text-[11px] tracking-wider shadow-[0_0_18px_rgba(236,72,153,0.3)]"
                        >
                          {reconLoading ? (
                            <>
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                              ANALYZING...
                            </>
                          ) : (
                            <>
                              <ScanSearch className="size-3.5 mr-1.5" />
                              RUN IMAGE RECON
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                  onChange={onFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Loading skeleton */}
              {reconLoading && (
                <div className="space-y-3">
                  <div className="cyber-card rounded-md p-3 border-pink-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="size-3.5 animate-spin text-pink-400" />
                      <span className="text-[11px] font-mono text-pink-300 tracking-wider">
                        Analyzing image with VLM...
                      </span>
                    </div>
                    <div className="h-3 rounded shimmer mb-2" />
                    <div className="h-3 rounded shimmer w-3/4 mb-2" />
                    <div className="h-3 rounded shimmer w-1/2" />
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {[...Array(7)].map((_, i) => (
                      <div key={i} className="h-12 rounded shimmer" />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-square rounded shimmer" />
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {!reconLoading && reconResult && (
                <div className="space-y-4">
                  {/* Error banner (soft — VLM parse error etc.) */}
                  {reconResult.error && (
                    <div className="cyber-card rounded-md p-2.5 border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-center gap-2 text-amber-400">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span className="text-[11px]">{reconResult.error}</span>
                      </div>
                    </div>
                  )}

                  {/* Description card */}
                  {reconResult.analysis.description && (
                    <div className="cyber-card rounded-md p-3 border-pink-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="size-3 text-pink-400" />
                        <span className="text-[10px] font-mono text-pink-400 tracking-wider">VLM DESCRIPTION</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {reconResult.analysis.description}
                      </p>
                    </div>
                  )}

                  {/* Stat bar — 8 boxes */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {[
                      { label: 'OBJECTS', value: reconResult.stats.objects, color: 'purple' },
                      { label: 'PEOPLE', value: reconResult.stats.people, color: 'pink' },
                      { label: 'TEXT', value: reconResult.stats.textDetected, color: 'cyan' },
                      { label: 'LOGOS', value: reconResult.stats.logos, color: 'cyan' },
                      { label: 'SIMILAR', value: reconResult.stats.similarImages, color: 'purple' },
                      { label: 'WEB', value: reconResult.stats.webAppearances, color: 'pink' },
                      { label: 'PLATFORMS', value: reconResult.stats.platformMatches, color: 'cyan' },
                      { label: 'RISK', value: reconResult.stats.riskFlags, color: 'red' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={
                          'rounded-md border bg-black/30 px-1.5 py-2 text-center ' +
                          (s.color === 'purple'
                            ? 'border-purple-500/30'
                            : s.color === 'pink'
                              ? 'border-pink-500/30'
                              : s.color === 'cyan'
                                ? 'border-cyan-500/30'
                                : 'border-red-500/30')
                        }
                      >
                        <div
                          className={
                            'text-base font-bold font-mono ' +
                            (s.color === 'purple'
                              ? 'text-purple-300'
                              : s.color === 'pink'
                                ? 'text-pink-300'
                                : s.color === 'cyan'
                                  ? 'text-cyan-300'
                                  : 'text-red-300')
                          }
                        >
                          {s.value}
                        </div>
                        <div className="text-[8px] font-mono text-muted-foreground/70 tracking-wider mt-0.5">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Risk flags banner */}
                  {reconResult.analysis.riskFlags.length > 0 && (
                    <div className="cyber-card rounded-md p-2.5 border-red-500/30 bg-red-500/5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="size-3 text-red-400" />
                        <span className="text-[10px] font-mono text-red-400 tracking-wider">RISK FLAGS</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {reconResult.analysis.riskFlags.map((flag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-red-500/10 text-red-300 border-red-500/30"
                          >
                            <AlertTriangle className="size-2.5" />
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Classification row — only show the ones that are true */}
                  {(reconResult.analysis.isScreenshot ||
                    reconResult.analysis.isDocument ||
                    reconResult.analysis.isProfilePicture) && (
                    <div className="flex flex-wrap gap-1.5">
                      {reconResult.analysis.isScreenshot && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono border bg-green-500/10 text-green-300 border-green-500/30">
                          <FileText className="size-3" />
                          IS SCREENSHOT
                        </span>
                      )}
                      {reconResult.analysis.isDocument && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono border bg-green-500/10 text-green-300 border-green-500/30">
                          <FileText className="size-3" />
                          IS DOCUMENT
                        </span>
                      )}
                      {reconResult.analysis.isProfilePicture && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono border bg-green-500/10 text-green-300 border-green-500/30">
                          <User className="size-3" />
                          IS PROFILE PICTURE
                        </span>
                      )}
                    </div>
                  )}

                  {/* People section */}
                  {reconResult.analysis.people.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-pink-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="size-3 text-pink-400" />
                        <span className="text-[10px] font-mono text-pink-400 tracking-wider">PEOPLE DETECTED</span>
                      </div>
                      <div className="space-y-1.5">
                        {reconResult.analysis.people.map((p, i) => (
                          <div key={i} className="rounded-md border border-pink-500/15 bg-black/20 px-2.5 py-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-pink-500/10 text-pink-300 border-pink-500/30 text-[9px]">
                                ×{p.count}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                <span className="text-pink-300/80">Gender:</span> {p.gender}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                <span className="text-pink-300/80">Age:</span> {p.ageRange}
                              </span>
                            </div>
                            {p.notableFeatures && p.notableFeatures !== 'none' && (
                              <p className="text-[10px] text-muted-foreground/80 mt-1">
                                <span className="text-pink-300/80">Notable:</span> {p.notableFeatures}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objects section */}
                  {reconResult.analysis.objects.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-purple-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ImageIcon className="size-3 text-purple-400" />
                        <span className="text-[10px] font-mono text-purple-400 tracking-wider">OBJECTS DETECTED</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {reconResult.analysis.objects.map((obj, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border bg-purple-500/10 text-purple-300 border-purple-500/30"
                          >
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Text detected / OCR section */}
                  {reconResult.analysis.textDetected.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-cyan-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <FileText className="size-3 text-cyan-400" />
                        <span className="text-[10px] font-mono text-cyan-400 tracking-wider">TEXT DETECTED (OCR) · NO-COPY</span>
                      </div>
                      <div className="space-y-1.5">
                        {reconResult.analysis.textDetected.map((txt, i) => (
                          <CodeBlock
                            key={i}
                            code={txt}
                            label={`OCR-${i + 1}`}
                            variant="default"
                            lineNumbers={false}
                            sensitive={true}
                            className="py-1"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logos section */}
                  {reconResult.analysis.logos.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-cyan-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag className="size-3 text-cyan-400" />
                        <span className="text-[10px] font-mono text-cyan-400 tracking-wider">LOGOS DETECTED</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {reconResult.analysis.logos.map((logo, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                          >
                            <Tag className="size-2.5" />
                            {logo}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location clues */}
                  {(reconResult.analysis.locationClues.length > 0 ||
                    reconResult.analysis.estimatedLocation !== 'unknown') && (
                    <div className="cyber-card rounded-md p-3 border-purple-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="size-3 text-purple-400" />
                        <span className="text-[10px] font-mono text-purple-400 tracking-wider">LOCATION ESTIMATE</span>
                      </div>
                      {reconResult.analysis.estimatedLocation &&
                        reconResult.analysis.estimatedLocation !== 'unknown' && (
                          <p className="text-sm font-semibold text-purple-300 mb-2">
                            📍 {reconResult.analysis.estimatedLocation}
                          </p>
                        )}
                      {reconResult.analysis.locationClues.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {reconResult.analysis.locationClues.map((clue, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-purple-500/10 text-purple-300 border-purple-500/30"
                            >
                              <MapPin className="size-2.5" />
                              {clue}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Colors palette */}
                  {reconResult.analysis.colors.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-pink-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Palette className="size-3 text-pink-400" />
                        <span className="text-[10px] font-mono text-pink-400 tracking-wider">COLOR PALETTE</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {reconResult.analysis.colors.map((hex, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-0.5"
                            title={hex}
                          >
                            <div
                              className="size-10 rounded border border-white/10 shadow-sm"
                              style={{ backgroundColor: hex.startsWith('#') ? hex : `#${hex}` }}
                            />
                            <span className="text-[8px] font-mono text-muted-foreground/70">{hex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search keywords — click to pivot to text mode */}
                  {reconResult.analysis.searchKeywords.length > 0 && (
                    <div className="cyber-card rounded-md p-3 border-pink-500/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="size-3 text-pink-400" />
                        <span className="text-[10px] font-mono text-pink-400 tracking-wider">
                          SEARCH KEYWORDS · CLICK TO PIVOT TO TEXT SEARCH
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {reconResult.analysis.searchKeywords.map((kw, i) => (
                          <button
                            key={i}
                            onClick={() => pivotToTextSearch(kw)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-pink-500/10 text-pink-300 border-pink-500/30 hover:bg-pink-500/20 hover:border-pink-500/50 transition-colors"
                            title={`Click to search "${kw}" in TEXT mode`}
                          >
                            <Search className="size-2.5" />
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform matches — Facebook / LinkedIn / Instagram / Yandex Images
                      targeted exact-match hunt. Rendered BEFORE similar images so the
                      investigator sees social/work-platform hits first. */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ScanSearch className="size-3 text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-400 tracking-wider">
                        PLATFORM MATCHES · EXACT-MATCH HUNT · {reconResult.platformMatches.length} FOUND
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {([
                        {
                          platform: 'facebook' as const,
                          label: 'FACEBOOK',
                          icon: Facebook,
                          accentClass: 'border-blue-500/30',
                          headerClass: 'text-blue-300',
                          badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                        },
                        {
                          platform: 'linkedin' as const,
                          label: 'LINKEDIN',
                          icon: Linkedin,
                          accentClass: 'border-blue-500/30',
                          headerClass: 'text-blue-300',
                          badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                        },
                        {
                          platform: 'instagram' as const,
                          label: 'INSTAGRAM',
                          icon: Instagram,
                          accentClass: 'border-pink-500/30',
                          headerClass: 'text-pink-300',
                          badgeClass:
                            'bg-gradient-to-r from-pink-500/15 to-purple-500/15 text-pink-300 border-pink-500/30',
                        },
                        {
                          platform: 'yandex' as const,
                          label: 'YANDEX IMAGES',
                          icon: ImageIcon,
                          accentClass: 'border-amber-500/30',
                          headerClass: 'text-amber-300',
                          badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                        },
                      ]).map((slot) => {
                        const hits = reconResult.platformMatches.filter(
                          (m) => m.platform === slot.platform
                        );
                        const Icon = slot.icon;
                        return (
                          <div
                            key={slot.platform}
                            className={`cyber-card rounded-md p-2.5 ${slot.accentClass}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Icon className={`size-3.5 ${slot.headerClass}`} />
                                <span
                                  className={`text-[10px] font-mono tracking-wider ${slot.headerClass}`}
                                >
                                  {slot.label}
                                </span>
                              </div>
                              <Badge className={`text-[8px] h-4 px-1.5 ${slot.badgeClass}`}>
                                {hits.length}
                              </Badge>
                            </div>
                            {hits.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground/60 italic px-1 py-2">
                                (no matches)
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                                {hits.map((m, i) => (
                                  <a
                                    key={i}
                                    href={m.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-md border border-cyan-500/15 bg-black/20 hover:bg-cyan-500/5 hover:border-cyan-500/30 transition-colors p-2 group"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold text-cyan-50/90 line-clamp-1 group-hover:text-cyan-50">
                                          {m.title || '(no title)'}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground/80 mt-0.5 line-clamp-2">
                                          {m.snippet}
                                        </p>
                                      </div>
                                      <ExternalLink className="size-3 text-cyan-400/50 group-hover:text-cyan-400 shrink-0 mt-0.5" />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <span
                                        className={
                                          'inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono border ' +
                                          (m.matchType === 'profile'
                                            ? 'bg-green-500/10 text-green-300 border-green-500/30'
                                            : m.matchType === 'photo'
                                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                              : m.matchType === 'mention'
                                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30')
                                        }
                                      >
                                        {m.matchType.toUpperCase()}
                                      </span>
                                      <span
                                        className={
                                          'inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono border ' +
                                          (m.confidence > 80
                                            ? 'bg-green-500/10 text-green-300 border-green-500/30'
                                            : m.confidence > 60
                                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                              : 'bg-muted/20 text-muted-foreground border-muted-foreground/30')
                                        }
                                      >
                                        {m.confidence}%
                                      </span>
                                      {m.source && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono border bg-muted/20 text-muted-foreground border-muted-foreground/20">
                                          {m.source}
                                        </span>
                                      )}
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Similar images grid */}
                  {reconResult.similarImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <ScanSearch className="size-3 text-purple-400" />
                        <span className="text-[10px] font-mono text-purple-400 tracking-wider">
                          SIMILAR IMAGES · {reconResult.similarImages.length} FOUND
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {reconResult.similarImages.map((img, i) => (
                          <Card
                            key={i}
                            className="cyber-card rounded-md overflow-hidden animate-fade-in-up group relative"
                            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                          >
                            <div className="relative aspect-square overflow-hidden bg-muted/20">
                              <img
                                src={img.url}
                                alt={img.title || 'similar image'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => {
                                  const t = e.target as HTMLImageElement;
                                  t.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground/30"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5-2.5 2.5L9 8l-6 6"/></svg></div>';
                                }}
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                <div className="flex items-center justify-between gap-1">
                                  <a
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="size-7 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 transition-colors"
                                  >
                                    <ExternalLink className="size-3" />
                                  </a>
                                  {currentCase && (
                                    <button
                                      onClick={() =>
                                        addAsEntity({
                                          url: img.url,
                                          title: img.title,
                                          source: img.source,
                                          width: img.width,
                                          height: img.height,
                                        })
                                      }
                                      className="size-7 rounded-md bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-purple-300 transition-colors"
                                      title="Add as entity"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Source badge */}
                              {img.source && (
                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Badge className="text-[8px] h-3.5 px-1 bg-black/60 text-cyan-300 border-cyan-500/30 backdrop-blur-sm">
                                    {img.source}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            {img.title && (
                              <CardContent className="p-1.5">
                                <p className="text-[9px] text-muted-foreground line-clamp-1">{img.title}</p>
                              </CardContent>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Web appearances list */}
                  {reconResult.webAppearances.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="size-3 text-pink-400" />
                        <span className="text-[10px] font-mono text-pink-400 tracking-wider">
                          WEB APPEARANCES · {reconResult.webAppearances.length} FOUND
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                        {reconResult.webAppearances.map((w, i) => (
                          <a
                            key={i}
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block cyber-card rounded-md p-2.5 border-pink-500/20 hover:border-pink-500/40 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-pink-300/90 line-clamp-1 group-hover:text-pink-300">
                                  {w.title || '(no title)'}
                                </p>
                                <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">
                                  {w.snippet}
                                </p>
                              </div>
                              <ExternalLink className="size-3 text-pink-400/50 group-hover:text-pink-400 shrink-0 mt-0.5" />
                            </div>
                            {w.source && (
                              <div className="mt-1.5">
                                <Badge className="text-[8px] h-3.5 px-1 bg-pink-500/10 text-pink-300 border-pink-500/30">
                                  {w.source}
                                </Badge>
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* artemis37 attribution footer */}
                  <div className="text-center pt-2 border-t border-pink-500/10">
                    <p className="text-[9px] font-mono text-muted-foreground/50 tracking-wider">
                      {reconResult.author} · {reconResult.tool} ·{' '}
                      {new Date(reconResult.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
