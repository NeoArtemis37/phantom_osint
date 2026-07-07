'use client';

import { useState, useEffect } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { relationshipsApi, entitiesApi } from '@/lib/api-client';
import { RELATIONSHIP_LABELS, type RelationshipType, type Entity } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2 } from 'lucide-react';

interface AddRelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddRelationshipDialog({
  open,
  onOpenChange,
}: AddRelationshipDialogProps) {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const selectedEntity = usePhantomStore((s) => s.selectedEntity);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState<RelationshipType>('associated');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load entities for the current case
  useEffect(() => {
    if (!currentCase || !open) return;
    setLoading(true);
    entitiesApi
      .list(currentCase.id)
      .then(setEntities)
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, [currentCase, open]);

  // Pre-select source entity if one is selected in the store
  useEffect(() => {
    if (selectedEntity && open) {
      setSourceId(selectedEntity.id);
    }
  }, [selectedEntity, open]);

  const resetForm = () => {
    setSourceId('');
    setTargetId('');
    setRelType('associated');
    setLabel('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase) {
      setError('No case selected');
      return;
    }
    if (!sourceId || !targetId) {
      setError('Both source and target entities are required');
      return;
    }
    if (sourceId === targetId) {
      setError('Source and target must be different entities');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await relationshipsApi.create({
        caseId: currentCase.id,
        sourceId,
        targetId,
        type: relType,
        label: label.trim() || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create relationship');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const getEntityDisplayName = (entity: Entity) =>
    `${entity.name} (${entity.type})`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            Add Relationship
          </DialogTitle>
          <DialogDescription>
            Create a relationship between two entities in the current case.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source Entity */}
          <div className="space-y-2">
            <Label>Source Entity *</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((ent) => (
                  <SelectItem key={ent.id} value={ent.id}>
                    {getEntityDisplayName(ent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label>Relationship Type *</Label>
            <Select
              value={relType}
              onValueChange={(v) => setRelType(v as RelationshipType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RELATIONSHIP_LABELS) as RelationshipType[]).map(
                  (rt) => (
                    <SelectItem key={rt} value={rt}>
                      {RELATIONSHIP_LABELS[rt]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Target Entity */}
          <div className="space-y-2">
            <Label>Target Entity *</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target entity" />
              </SelectTrigger>
              <SelectContent>
                {entities
                  .filter((ent) => ent.id !== sourceId)
                  .map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {getEntityDisplayName(ent)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="rel-label">Label (optional)</Label>
            <Input
              id="rel-label"
              placeholder="e.g. Works at, Friend of"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading && (
            <p className="text-sm text-muted-foreground">Loading entities...</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !sourceId || !targetId}
            >
              {submitting ? 'Creating...' : 'Create Relationship'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
