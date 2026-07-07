'use client';

import { useState } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { entitiesApi } from '@/lib/api-client';
import { ENTITY_LABELS, type EntityType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface AddEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddEntityDialog({ open, onOpenChange }: AddEntityDialogProps) {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setSelectedEntity = usePhantomStore((s) => s.setSelectedEntity);
  const quickAddPosition = usePhantomStore((s) => s.quickAddPosition);
  const setQuickAddPosition = usePhantomStore((s) => s.setQuickAddPosition);

  const [name, setName] = useState('');
  const [type, setType] = useState<EntityType>('person');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setType('person');
    setValue('');
    setNotes('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase) {
      setError('No case selected');
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const entity = await entitiesApi.create({
        caseId: currentCase.id,
        name: name.trim(),
        type,
        value: value.trim(),
        notes: notes.trim(),
        x: quickAddPosition?.x ?? Math.random() * 400,
        y: quickAddPosition?.y ?? Math.random() * 400,
      });
      setSelectedEntity(entity);
      resetForm();
      onOpenChange(false);
      if (quickAddPosition) setQuickAddPosition(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
      if (quickAddPosition) setQuickAddPosition(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5" />
            Add Entity
          </DialogTitle>
          <DialogDescription>
            Add a new entity to the current case. Entities represent people,
            accounts, locations, or other data points.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="entity-name">Name *</Label>
            <Input
              id="entity-name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => (
                  <SelectItem key={et} value={et}>
                    {ENTITY_LABELS[et]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="entity-value">Value</Label>
            <Input
              id="entity-value"
              placeholder="e.g. @johndoe, john@example.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="entity-notes">Notes</Label>
            <Textarea
              id="entity-notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Entity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
