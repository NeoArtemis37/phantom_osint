'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { entitiesApi, relationshipsApi } from '@/lib/api-client';
import EntityMergeDialog from '@/components/EntityMergeDialog';
import {
  ENTITY_LABELS,
  ENTITY_COLORS,
  RELATIONSHIP_LABELS,
  type EntityType,
  type RelationshipType,
  type Entity,
  type Relationship,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  X,
  Pencil,
  Trash2,
  Link2,
  Save,
  User,
  MapPin,
  Globe,
  Mail,
  Phone,
  Building2,
  Hash,
  Image as ImageIcon,
  Monitor,
  Merge,
  Tag,
  Bitcoin,
  Film,
} from 'lucide-react';

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  person: <User className="size-4" />,
  username: <Hash className="size-4" />,
  location: <MapPin className="size-4" />,
  device: <Monitor className="size-4" />,
  organization: <Building2 className="size-4" />,
  email: <Mail className="size-4" />,
  phone: <Phone className="size-4" />,
  url: <Globe className="size-4" />,
  image: <ImageIcon className="size-4" />,
  cryptocurrency: <Bitcoin className="size-4" />,
  media: <Film className="size-4" />,
};

export default function EntityPanel() {
  const selectedEntity = usePhantomStore((s) => s.selectedEntity);
  const setSelectedEntity = usePhantomStore((s) => s.setSelectedEntity);
  const setSidePanelContent = usePhantomStore((s) => s.setSidePanelContent);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<EntityType>('person');
  const [connections, setConnections] = useState<Relationship[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  // Sync local state when selectedEntity changes
  useEffect(() => {
    if (selectedEntity) {
      setName(selectedEntity.name);
      setValue(selectedEntity.value);
      setNotes(selectedEntity.notes);
      setType(selectedEntity.type);
      setEditing(false);
    }
  }, [selectedEntity]);

  // Fetch relationships for this entity
  const fetchConnections = useCallback(async () => {
    if (!selectedEntity) return;
    try {
      const rels = await relationshipsApi.list(selectedEntity.caseId);
      const filtered = rels.filter(
        (r) => r.sourceId === selectedEntity.id || r.targetId === selectedEntity.id
      );
      setConnections(filtered);
    } catch {
      // silently ignore
    }
  }, [selectedEntity]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  if (!selectedEntity) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await entitiesApi.update(selectedEntity.id, {
        name,
        value,
        notes,
        type,
      });
      setSelectedEntity(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update entity:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await entitiesApi.delete(selectedEntity.id);
      setSelectedEntity(null);
    } catch (err) {
      console.error('Failed to delete entity:', err);
    }
  };

  const handleClose = () => {
    setSelectedEntity(null);
  };

  const handleAddRelationship = () => {
    setSidePanelContent('add-relationship');
  };

  const entityColor = ENTITY_COLORS[selectedEntity.type] || '#6b7280';

  // Extract aliases from merged metadata
  const entityMeta = selectedEntity.metadata || {};
  const aliases: string[] = Array.isArray(entityMeta._aliases) ? entityMeta._aliases : [];

  const getConnectedEntityName = (rel: Relationship, currentId: string): string => {
    if (rel.sourceId === currentId) {
      return rel.target?.name || rel.targetId;
    }
    return rel.source?.name || rel.sourceId;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center size-8 rounded-md text-white"
            style={{ backgroundColor: entityColor }}
          >
            {ENTITY_ICONS[selectedEntity.type]}
          </div>
          <h2 className="font-semibold text-sm truncate max-w-[180px]">
            Entity Details
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" onClick={handleClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Type Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={{
                borderColor: entityColor,
                color: entityColor,
              }}
            >
              {ENTITY_LABELS[selectedEntity.type]}
            </Badge>
            {editing && (
              <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => (
                    <SelectItem key={et} value={et}>
                      {ENTITY_LABELS[et]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            {editing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <p className="text-sm font-medium">{selectedEntity.name}</p>
            )}
          </div>

          {/* Value */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Value</Label>
            {editing ? (
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded break-all">
                {selectedEntity.value || '—'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            {editing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {selectedEntity.notes || '—'}
              </p>
            )}
          </div>

          {/* Edit Actions */}
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="size-3.5 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setName(selectedEntity.name);
                  setValue(selectedEntity.value);
                  setNotes(selectedEntity.notes);
                  setType(selectedEntity.type);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          <Separator />

          {/* Metadata */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Metadata</Label>
            {selectedEntity.metadata &&
            Object.keys(selectedEntity.metadata).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(selectedEntity.metadata).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1"
                  >
                    <span className="text-muted-foreground font-medium">{key}</span>
                    <span className="font-mono truncate max-w-[160px]">
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No metadata</p>
            )}
          </div>

          <Separator />

          {/* Aliases */}
          {aliases.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="size-3" />
                Aliases ({aliases.length})
              </Label>
              <div className="flex flex-wrap gap-1">
                {aliases.map((alias, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {aliases.length > 0 && <Separator />}

          {/* Connected Entities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Connections ({connections.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleAddRelationship}
              >
                <Link2 className="size-3 mr-1" />
                Add
              </Button>
            </div>
            {connections.length > 0 ? (
              <div className="space-y-1">
                {connections.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
                  >
                    <span className="truncate max-w-[120px]">
                      {getConnectedEntityName(rel, selectedEntity.id)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {RELATIONSHIP_LABELS[rel.type as RelationshipType] || rel.type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No connections</p>
            )}
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Created:{' '}
              {new Date(selectedEntity.createdAt).toLocaleString()}
            </p>
            <p>
              Updated:{' '}
              {new Date(selectedEntity.updatedAt).toLocaleString()}
            </p>
          </div>

          {/* Merge + Delete Actions */}
          {!editing && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setMergeDialogOpen(true)}
              >
                <Merge className="size-3.5 mr-1" />
                Merge with...
              </Button>

              <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                  <Trash2 className="size-3.5 mr-1" />
                  Delete Entity
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Entity</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{selectedEntity.name}&quot;?
                    This will also remove all associated relationships. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Merge Dialog */}
          <EntityMergeDialog
            open={mergeDialogOpen}
            onOpenChange={setMergeDialogOpen}
            sourceEntityId={selectedEntity.id}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
