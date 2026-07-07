'use client';

import { useState, useEffect } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { exportApi, entitiesApi, relationshipsApi, timelineApi, watchlistApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileJson,
  Download,
  FileText,
  Users,
  Link2,
  Clock,
  Shield,
  Loader2,
  CheckCircle2,
  Globe,
  Network,
} from 'lucide-react';

type ExportFormat = 'json' | 'stix' | 'geojson';

interface FormatOption {
  value: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
  extension: string;
  mimeType: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'json',
    label: 'JSON',
    icon: <FileJson className="size-4" />,
    description: 'Full case data export for backup/import',
    extension: '.json',
    mimeType: 'application/json',
  },
  {
    value: 'stix',
    label: 'STIX 2.1',
    icon: <Network className="size-4" />,
    description: 'Threat intelligence standard for MISP, OpenCTI, and other TIPs',
    extension: '.stix.json',
    mimeType: 'application/json',
  },
  {
    value: 'geojson',
    label: 'GeoJSON',
    icon: <Globe className="size-4" />,
    description: 'Geographic data for mapping tools like QGIS, Mapbox',
    extension: '.geojson',
    mimeType: 'application/geo+json',
  },
];

interface PreviewCounts {
  entities: number;
  relationships: number;
  timeline: number;
  watchlist: number;
}

export default function ReportGenerator() {
  const currentCase = usePhantomStore((s) => s.currentCase);

  const [previewCounts, setPreviewCounts] = useState<PreviewCounts>({
    entities: 0,
    relationships: 0,
    timeline: 0,
    watchlist: 0,
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

  // Load preview counts
  useEffect(() => {
    if (!currentCase) return;
    setLoading(true);

    Promise.all([
      entitiesApi.list(currentCase.id).catch(() => []),
      relationshipsApi.list(currentCase.id).catch(() => []),
      timelineApi.list(currentCase.id).catch(() => []),
      watchlistApi.list(currentCase.id).catch(() => []),
    ])
      .then(([entities, relationships, timeline, watchlist]) => {
        setPreviewCounts({
          entities: entities.length,
          relationships: relationships.length,
          timeline: timeline.length,
          watchlist: watchlist.length,
        });
      })
      .finally(() => setLoading(false));
  }, [currentCase]);

  const handleGenerate = async () => {
    if (!currentCase) return;

    setGenerating(true);
    setError('');
    setGenerated(false);

    try {
      const data = await exportApi.exportJson(currentCase.id, exportFormat);
      setReportData(data);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const currentFormatOption = FORMAT_OPTIONS.find((f) => f.value === exportFormat)!;

  const handleDownload = () => {
    if (!reportData || !currentCase) return;

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: currentFormatOption.mimeType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phantom-case-${currentCase.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}${currentFormatOption.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalItems =
    previewCounts.entities +
    previewCounts.relationships +
    previewCounts.timeline +
    previewCounts.watchlist;

  const previewItems = [
    {
      icon: <Users className="size-4" />,
      label: 'Entities',
      count: previewCounts.entities,
      color: 'text-blue-600',
    },
    {
      icon: <Link2 className="size-4" />,
      label: 'Relationships',
      count: previewCounts.relationships,
      color: 'text-purple-600',
    },
    {
      icon: <Clock className="size-4" />,
      label: 'Timeline Events',
      count: previewCounts.timeline,
      color: 'text-amber-600',
    },
    {
      icon: <Shield className="size-4" />,
      label: 'Watchlist Items',
      count: previewCounts.watchlist,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <FileText className="size-5 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Report Generator</h2>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : !currentCase ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="size-8 mb-2 opacity-50" />
            <p className="text-sm">Select a case to generate a report</p>
          </div>
        ) : (
          <>
            {/* Export Configuration */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileJson className="size-4" />
                  Export Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Case</span>
                  <span className="text-sm font-medium">{currentCase.name}</span>
                </div>

                {/* Format Selector */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Export Format</span>
                  <Select
                    value={exportFormat}
                    onValueChange={(v) => {
                      setExportFormat(v as ExportFormat);
                      setGenerated(false);
                      setReportData(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            {opt.icon}
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Format Description */}
                <div className="rounded-md bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {currentFormatOption.icon}
                    <span className="text-sm font-medium">{currentFormatOption.label}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
                      {currentFormatOption.extension}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {currentFormatOption.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Report Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  The following data will be included in the export:
                </p>
                {previewItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={item.color}>{item.icon}</span>
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5">
                      {item.count}
                    </Badge>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-medium">Total Items</span>
                  <Badge className="text-xs h-5">{totalItems}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || totalItems === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  {currentFormatOption.icon}
                  <span className="ml-2">Generate {currentFormatOption.label} Export</span>
                </>
              )}
            </Button>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Success & Download */}
            {generated && reportData && (
              <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="size-5" />
                      <span className="text-sm font-medium">
                        {currentFormatOption.label} export generated successfully
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Export contains{' '}
                      {exportFormat === 'stix'
                        ? `${Array.isArray((reportData as Record<string, unknown>).objects) ? ((reportData as Record<string, unknown>).objects as unknown[]).length : 0} STIX objects`
                        : exportFormat === 'geojson'
                          ? `${Array.isArray((reportData as Record<string, unknown>).features) ? ((reportData as Record<string, unknown>).features as unknown[]).length : 0} geographic features`
                          : `${Object.keys(reportData).length} top-level sections`}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleDownload}
                    >
                      <Download className="size-4 mr-2" />
                      Download {currentFormatOption.label}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {totalItems === 0 && !generating && (
              <p className="text-xs text-muted-foreground text-center">
                No data to export. Add entities, relationships, or timeline
                events to the case first.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
