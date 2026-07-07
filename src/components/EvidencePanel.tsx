'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { evidenceApi, entitiesApi } from '@/lib/api-client';
import type { Evidence, EvidenceConfidence, Entity } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileSearch,
  Plus,
  Loader2,
  Shield,
  ExternalLink,
  Hash,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Scale,
  Link2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const CONFIDENCE_CONFIG: Record<EvidenceConfidence, { label: string; color: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', color: 'text-green-600', icon: CheckCircle2 },
  probable: { label: 'Probable', color: 'text-amber-600', icon: AlertTriangle },
  unconfirmed: { label: 'Unconfirmed', color: 'text-blue-600', icon: HelpCircle },
  disputed: { label: 'Disputed', color: 'text-red-600', icon: XCircle },
};

const SOURCE_TYPE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'document', label: 'Document' },
  { value: 'image', label: 'Image' },
  { value: 'communication', label: 'Communication' },
  { value: 'financial', label: 'Financial' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'database', label: 'Database' },
];

export default function EvidencePanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState('web');
  const [newConfidence, setNewConfidence] = useState<EvidenceConfidence>('probable');
  const [newEntityId, setNewEntityId] = useState('');

  const fetchData = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const filters: { entityId?: string; sourceType?: string } = {};
      if (sourceTypeFilter !== 'all') filters.sourceType = sourceTypeFilter;
      const data = await evidenceApi.list(currentCase.id, filters);
      setEvidence(data);
      const entData = await entitiesApi.list(currentCase.id);
      setEntities(entData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase, sourceTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEvidence = confidenceFilter === 'all'
    ? evidence
    : evidence.filter((e) => e.confidence === confidenceFilter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !newTitle.trim()) return;
    try {
      const created = await evidenceApi.create({
        caseId: currentCase.id,
        entityId: newEntityId || undefined,
        title: newTitle.trim(),
        description: newDescription.trim(),
        sourceUrl: newSourceUrl.trim(),
        sourceType: newSourceType,
        data: {},
        confidence: newConfidence,
        collectedBy: 'current-user',
      });
      setEvidence((prev) => [created, ...prev]);
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewSourceUrl('');
      setNewSourceType('web');
      setNewConfidence('probable');
      setNewEntityId('');
    } catch {
      // ignore
    }
  };

  const handleToggleLegalFlag = async (ev: Evidence) => {
    try {
      const updated = await evidenceApi.update(ev.id, {
        legalReviewFlag: !ev.legalReviewFlag,
      });
      setEvidence((prev) => prev.map((e) => (e.id === ev.id ? updated : e)));
      if (selectedEvidence?.id === ev.id) {
        setSelectedEvidence(updated);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await evidenceApi.delete(id);
      setEvidence((prev) => prev.filter((e) => e.id !== id));
      if (selectedEvidence?.id === id) {
        setDetailOpen(false);
        setSelectedEvidence(null);
      }
    } catch {
      // ignore
    }
  };

  const openDetail = (ev: Evidence) => {
    setSelectedEvidence(ev);
    setDetailOpen(true);
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <FileSearch className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to view evidence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileSearch className="size-4" />
            Evidence
          </h2>
          <p className="text-xs text-muted-foreground">{filteredEvidence.length} items</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5 mr-1" />
          Add Evidence
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
          <SelectTrigger className="w-36 h-7 text-xs">
            <SelectValue placeholder="Source Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-32 h-7 text-xs">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            {(Object.keys(CONFIDENCE_CONFIG) as EvidenceConfidence[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CONFIDENCE_CONFIG[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Evidence List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvidence.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileSearch className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No evidence found</p>
            </div>
          ) : (
            filteredEvidence.map((ev) => {
              const confCfg = CONFIDENCE_CONFIG[ev.confidence] || CONFIDENCE_CONFIG.probable;
              const ConfIcon = confCfg.icon;

              return (
                <Card
                  key={ev.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(ev)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 bg-muted ${confCfg.color}`}>
                        <ConfIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium truncate">{ev.title}</h4>
                          {ev.legalReviewFlag && (
                            <Badge className="bg-amber-500/10 text-amber-600 text-[10px] h-4">
                              <Scale className="size-2.5 mr-0.5" />
                              Legal Review
                            </Badge>
                          )}
                        </div>
                        {ev.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {ev.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 ${confCfg.color}`}
                          >
                            {confCfg.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {ev.sourceType}
                          </Badge>
                          {ev.contentHash && (
                            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                              <Hash className="size-2.5" />
                              {ev.contentHash.slice(0, 12)}...
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {new Date(ev.collectedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ev.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Create Evidence Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Add Evidence
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Evidence title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the evidence..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Source URL</Label>
                <Input
                  placeholder="https://..."
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select value={newSourceType} onValueChange={setNewSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Confidence</Label>
                <Select value={newConfidence} onValueChange={(v) => setNewConfidence(v as EvidenceConfidence)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONFIDENCE_CONFIG) as EvidenceConfidence[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONFIDENCE_CONFIG[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked Entity</Label>
                <Select value={newEntityId} onValueChange={setNewEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {entities.map((ent) => (
                      <SelectItem key={ent.id} value={ent.id}>
                        {ent.name} ({ent.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={!newTitle.trim()}>
                Add Evidence
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Evidence Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Evidence Detail
            </DialogTitle>
          </DialogHeader>
          {selectedEvidence && (() => {
            const confCfg = CONFIDENCE_CONFIG[selectedEvidence.confidence] || CONFIDENCE_CONFIG.probable;
            const ConfIcon = confCfg.icon;
            return (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  {/* Title & confidence */}
                  <div>
                    <h3 className="text-base font-semibold">{selectedEvidence.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`${confCfg.color}`}>
                        <ConfIcon className="size-3 mr-1" />
                        {confCfg.label}
                      </Badge>
                      <Badge variant="secondary">{selectedEvidence.sourceType}</Badge>
                      {selectedEvidence.legalReviewFlag && (
                        <Badge className="bg-amber-500/10 text-amber-600">
                          <Scale className="size-3 mr-1" />
                          Legal Review Flag
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedEvidence.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm mt-1">{selectedEvidence.description}</p>
                    </div>
                  )}

                  {/* Source URL */}
                  {selectedEvidence.sourceUrl && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <a
                        href={selectedEvidence.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="size-3" />
                        {selectedEvidence.sourceUrl.length > 60
                          ? `${selectedEvidence.sourceUrl.slice(0, 60)}...`
                          : selectedEvidence.sourceUrl}
                      </a>
                    </div>
                  )}

                  {/* Content Hash */}
                  {selectedEvidence.contentHash && (
                    <div>
                      <Label className="text-xs text-muted-foreground">SHA-256 Hash</Label>
                      <p className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                        {selectedEvidence.contentHash}
                      </p>
                    </div>
                  )}

                  {/* Confidence visualization */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Confidence Level</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${
                              selectedEvidence.confidence === 'verified' ? 100
                              : selectedEvidence.confidence === 'probable' ? 75
                              : selectedEvidence.confidence === 'unconfirmed' ? 40
                              : 20
                            }%`,
                            backgroundColor: confCfg.color.replace('text-', '').replace('600', '500'),
                          }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${confCfg.color}`}>
                        {confCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Chain of Custody */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Chain of Custody</Label>
                    {selectedEvidence.chainOfCustody && selectedEvidence.chainOfCustody.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {selectedEvidence.chainOfCustody.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="size-1.5 rounded-full bg-primary shrink-0" />
                            <span className="font-medium">{entry.action}</span>
                            <span className="text-muted-foreground">
                              by {entry.userId}
                            </span>
                            <span className="text-muted-foreground ml-auto">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">No custody records</p>
                    )}
                  </div>

                  {/* Data */}
                  {selectedEvidence.data && Object.keys(selectedEvidence.data).length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Raw Data</Label>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-40">
                        {JSON.stringify(selectedEvidence.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant={selectedEvidence.legalReviewFlag ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleLegalFlag(selectedEvidence)}
                    >
                      <Scale className="size-3.5 mr-1" />
                      {selectedEvidence.legalReviewFlag ? 'Remove Legal Flag' : 'Flag for Legal Review'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleDelete(selectedEvidence.id);
                        setDetailOpen(false);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
