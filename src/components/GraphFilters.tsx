'use client';

import { useMemo } from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { usePhantomStore } from '@/store/phantom-store';
import {
  ENTITY_COLORS,
  ENTITY_LABELS,
  RELATIONSHIP_COLORS,
  RELATIONSHIP_LABELS,
  type EntityType,
  type RelationshipType,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_ENTITY_TYPES: EntityType[] = [
  'person',
  'username',
  'location',
  'device',
  'organization',
  'email',
  'phone',
  'url',
  'image',
  'cryptocurrency',
  'media',
];

const ALL_RELATIONSHIP_TYPES: RelationshipType[] = [
  'owns',
  'communicated',
  'located_at',
  'associated',
  'member_of',
  'operates',
  'linked',
  'reported',
  'finances',
  'familial',
  'operational',
  'geographic',
];

const THREAT_LEVELS = [
  { value: 'unknown', label: 'Unknown', color: '#6b7280' },
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GraphFiltersProps {
  onClose: () => void;
}

export default function GraphFilters({ onClose }: GraphFiltersProps) {
  const graphFilters = usePhantomStore((s) => s.graphFilters);
  const setGraphFilters = usePhantomStore((s) => s.setGraphFilters);
  const resetGraphFilters = usePhantomStore((s) => s.resetGraphFilters);

  // ---- Active filter count ----
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (graphFilters.entityTypes.length > 0) count++;
    if (graphFilters.relationshipTypes.length > 0) count++;
    if (graphFilters.minConfidence > 0) count++;
    if (graphFilters.threatLevels.length > 0) count++;
    if (graphFilters.timeRange.start || graphFilters.timeRange.end) count++;
    return count;
  }, [graphFilters]);

  // ---- Entity type handlers ----
  const toggleEntityType = (type: string) => {
    const current = graphFilters.entityTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setGraphFilters({ entityTypes: next });
  };

  const selectAllEntityTypes = () => {
    setGraphFilters({ entityTypes: [] }); // empty = show all
  };

  const clearEntityTypes = () => {
    setGraphFilters({ entityTypes: ['__none__'] }); // impossible type = hide all
  };

  // ---- Relationship type handlers ----
  const toggleRelationshipType = (type: string) => {
    const current = graphFilters.relationshipTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setGraphFilters({ relationshipTypes: next });
  };

  const selectAllRelationshipTypes = () => {
    setGraphFilters({ relationshipTypes: [] }); // empty = show all
  };

  const clearRelationshipTypes = () => {
    setGraphFilters({ relationshipTypes: ['__none__'] });
  };

  // ---- Threat level handlers ----
  const toggleThreatLevel = (level: string) => {
    const current = graphFilters.threatLevels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setGraphFilters({ threatLevels: next });
  };

  const selectAllThreatLevels = () => {
    setGraphFilters({ threatLevels: [] });
  };

  const clearThreatLevels = () => {
    setGraphFilters({ threatLevels: ['__none__'] });
  };

  // ---- Time range handlers ----
  const setTimeStart = (value: string) => {
    setGraphFilters({
      timeRange: { ...graphFilters.timeRange, start: value || null },
    });
  };

  const setTimeEnd = (value: string) => {
    setGraphFilters({
      timeRange: { ...graphFilters.timeRange, end: value || null },
    });
  };

  const clearTimeRange = () => {
    setGraphFilters({ timeRange: { start: null, end: null } });
  };

  // ---- Reset ----
  const handleReset = () => {
    resetGraphFilters();
  };

  return (
    <Card className="w-[260px] bg-background/95 backdrop-blur-sm border-border shadow-lg">
      <CardHeader className="pb-3 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Graph Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        <ScrollArea className="h-[calc(100vh-180px)] max-h-[600px] pr-2">
          <div className="space-y-4">

            {/* ── Entity Types ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Entity Types
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    className="text-[10px] text-primary hover:underline"
                    onClick={selectAllEntityTypes}
                  >
                    All
                  </button>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={clearEntityTypes}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {ALL_ENTITY_TYPES.map((type) => {
                  const isChecked =
                    graphFilters.entityTypes.length === 0 ||
                    graphFilters.entityTypes.includes(type);
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Checkbox
                        id={`entity-${type}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleEntityType(type)}
                        className="size-3.5"
                      />
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ENTITY_COLORS[type] }}
                      />
                      <Label
                        htmlFor={`entity-${type}`}
                        className="text-xs cursor-pointer leading-tight"
                      >
                        {ENTITY_LABELS[type]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ── Relationship Types ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Relationship Types
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    className="text-[10px] text-primary hover:underline"
                    onClick={selectAllRelationshipTypes}
                  >
                    All
                  </button>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={clearRelationshipTypes}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {ALL_RELATIONSHIP_TYPES.map((type) => {
                  const isChecked =
                    graphFilters.relationshipTypes.length === 0 ||
                    graphFilters.relationshipTypes.includes(type);
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Checkbox
                        id={`rel-${type}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleRelationshipType(type)}
                        className="size-3.5"
                      />
                      <span
                        className="w-4 h-0.5 shrink-0 rounded-full"
                        style={{ backgroundColor: RELATIONSHIP_COLORS[type] }}
                      />
                      <Label
                        htmlFor={`rel-${type}`}
                        className="text-xs cursor-pointer leading-tight"
                      >
                        {RELATIONSHIP_LABELS[type]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ── Confidence ── */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                Minimum Confidence: {graphFilters.minConfidence}%
              </Label>
              <Slider
                value={[graphFilters.minConfidence]}
                onValueChange={([v]) => setGraphFilters({ minConfidence: v })}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0%</span>
                <span className="text-[10px] text-muted-foreground">100%</span>
              </div>
            </div>

            <Separator />

            {/* ── Threat Level ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Threat Level
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    className="text-[10px] text-primary hover:underline"
                    onClick={selectAllThreatLevels}
                  >
                    All
                  </button>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={clearThreatLevels}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {THREAT_LEVELS.map(({ value, label, color }) => {
                  const isChecked =
                    graphFilters.threatLevels.length === 0 ||
                    graphFilters.threatLevels.includes(value);
                  return (
                    <div
                      key={value}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Checkbox
                        id={`threat-${value}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleThreatLevel(value)}
                        className="size-3.5"
                      />
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <Label
                        htmlFor={`threat-${value}`}
                        className="text-xs cursor-pointer leading-tight"
                      >
                        {label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ── Time Range ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time Range
                </Label>
                {(graphFilters.timeRange.start || graphFilters.timeRange.end) && (
                  <button
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={clearTimeRange}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-8 shrink-0">
                    From
                  </Label>
                  <Input
                    type="date"
                    value={graphFilters.timeRange.start ?? ''}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="h-7 text-xs bg-transparent border-border"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-8 shrink-0">
                    To
                  </Label>
                  <Input
                    type="date"
                    value={graphFilters.timeRange.end ?? ''}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="h-7 text-xs bg-transparent border-border"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Actions ── */}
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={onClose}
              >
                Apply Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleReset}
              >
                <RotateCcw className="size-3 mr-1" />
                Reset All
              </Button>
            </div>

          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
