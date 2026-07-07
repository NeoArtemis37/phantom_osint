'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { entitiesApi, relationshipsApi, evidenceApi } from '@/lib/api-client';
import type { Entity } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Merge, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EntityMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntityId?: string | null;
}

export default function EntityMergeDialog({ open, onOpenChange, sourceEntityId }: EntityMergeDialogProps) {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setSelectedEntity = usePhantomStore((s) => s.setSelectedEntity);
  const requestGraphFit = usePhantomStore((s) => s.requestGraphFit);
  const { toast } = useToast();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingEntities, setFetchingEntities] = useState(false);
  const [preview, setPreview] = useState<{ relationships: number; evidence: number } | null>(null);

  // Fetch entities for the current case
  const fetchEntities = useCallback(async () => {
    if (!currentCase) return;
    setFetchingEntities(true);
    try {
      const list = await entitiesApi.list(currentCase.id);
      setEntities(list);
    } catch {
      // silently ignore
    } finally {
      setFetchingEntities(false);
    }
  }, [currentCase]);

  useEffect(() => {
    if (open) {
      fetchEntities();
    }
  }, [open, fetchEntities]);

  // Pre-select source entity
  useEffect(() => {
    if (sourceEntityId && open) {
      setSourceId(sourceEntityId);
    }
  }, [sourceEntityId, open]);

  // Compute preview when both source and target are selected
  useEffect(() => {
    if (!sourceId || !targetId || sourceId === targetId || !currentCase) {
      setPreview(null);
      return;
    }

    const computePreview = async () => {
      try {
        const [rels, evidenceList] = await Promise.all([
          relationshipsApi.list(currentCase.id),
          evidenceApi.list(currentCase.id),
        ]);

        const sourceRels = rels.filter(
          (r) => r.sourceId === sourceId || r.targetId === sourceId
        );
        const sourceEvidence = evidenceList.filter((e) => e.entityId === sourceId);

        setPreview({
          relationships: sourceRels.length,
          evidence: sourceEvidence.length,
        });
      } catch {
        setPreview(null);
      }
    };

    computePreview();
  }, [sourceId, targetId, currentCase]);

  const handleMerge = async () => {
    if (!sourceId || !targetId || !currentCase) return;

    setLoading(true);
    try {
      const merged = await entitiesApi.merge(sourceId, targetId, currentCase.id);
      setSelectedEntity(merged as unknown as Entity);
      requestGraphFit();
      toast({
        title: 'Entities merged',
        description: 'Source entity has been merged into the target. All relationships and evidence have been reassigned.',
      });
      onOpenChange(false);
      setSourceId('');
      setTargetId('');
      setPreview(null);
    } catch (err) {
      toast({
        title: 'Merge failed',
        description: err instanceof Error ? err.message : 'An error occurred during merge.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sourceEntity = entities.find((e) => e.id === sourceId);
  const targetEntity = entities.find((e) => e.id === targetId);
  const canMerge = sourceId && targetId && sourceId !== targetId && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="size-5" />
            Merge Entities
          </DialogTitle>
          <DialogDescription>
            Merge two duplicate entities into one. The source entity will be deleted and all its
            data will be reassigned to the target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Source <span className="text-destructive">(will be deleted)</span>
            </Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder={fetchingEntities ? 'Loading...' : 'Select source entity'} />
              </SelectTrigger>
              <SelectContent>
                {entities
                  .filter((e) => e.id !== targetId)
                  .map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name} ({entity.type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center justify-center">
            <ArrowRight className="size-5 text-muted-foreground" />
          </div>

          {/* Target selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Target <span className="text-green-600">(will be kept)</span>
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder={fetchingEntities ? 'Loading...' : 'Select target entity'} />
              </SelectTrigger>
              <SelectContent>
                {entities
                  .filter((e) => e.id !== sourceId)
                  .map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name} ({entity.type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">Merge preview:</p>
              <p className="text-muted-foreground">
                {preview.relationships} relationship{preview.relationships !== 1 ? 's' : ''} will be reassigned
              </p>
              <p className="text-muted-foreground">
                {preview.evidence} evidence item{preview.evidence !== 1 ? 's' : ''} will be moved
              </p>
              {sourceEntity && (
                <p className="text-muted-foreground">
                  &quot;{sourceEntity.name}&quot; will be added as an alias to &quot;{targetEntity?.name}&quot;
                </p>
              )}
            </div>
          )}

          {/* Warning */}
          {canMerge && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                This action cannot be undone. The source entity will be permanently deleted and its
                data merged into the target.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleMerge}
            disabled={!canMerge}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="size-4 mr-2" />
                Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
