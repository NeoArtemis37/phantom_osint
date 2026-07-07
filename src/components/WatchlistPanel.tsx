'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { watchlistApi } from '@/lib/api-client';
import type { WatchlistItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Eye,
  Plus,
  Trash2,
  Shield,
  AlertCircle,
} from 'lucide-react';

const WATCHLIST_TYPES = ['keyword', 'username', 'email', 'phone', 'domain'] as const;

export default function WatchlistPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTerm, setAddTerm] = useState('');
  const [addType, setAddType] = useState<string>('keyword');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const data = await watchlistApi.list(currentCase.id);
      setItems(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !addTerm.trim()) return;

    setSubmitting(true);
    try {
      await watchlistApi.create({
        caseId: currentCase.id,
        term: addTerm.trim(),
        type: addType,
        active: true,
      });
      setAddTerm('');
      setAddType('keyword');
      fetchItems();
    } catch (err) {
      console.error('Failed to add watchlist item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: WatchlistItem) => {
    // Since there's no update API, we delete and re-create
    try {
      await watchlistApi.delete(item.id);
      await watchlistApi.create({
        caseId: item.caseId,
        term: item.term,
        type: item.type,
        active: !item.active,
      });
      fetchItems();
    } catch (err) {
      console.error('Failed to toggle watchlist item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await watchlistApi.delete(id);
      fetchItems();
    } catch (err) {
      console.error('Failed to delete watchlist item:', err);
    }
  };

  const activeCount = items.filter((i) => i.active).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Watchlist</h2>
          <Badge variant="secondary" className="text-[10px]">
            {activeCount} / {items.length} active
          </Badge>
        </div>
      </div>

      {/* Add Form */}
      <div className="p-4 border-b">
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Watch term..."
              value={addTerm}
              onChange={(e) => setAddTerm(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <Select value={addType} onValueChange={setAddType}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WATCHLIST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            className="h-8 px-3"
            disabled={submitting || !addTerm.trim() || !currentCase}
          >
            <Plus className="size-3.5" />
          </Button>
        </form>
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="size-8 mb-2 opacity-50" />
            <p className="text-sm">No watchlist items</p>
            <p className="text-xs mt-1">
              Add terms to monitor for mentions
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Switch
                        checked={item.active}
                        onCheckedChange={() => handleToggleActive(item)}
                        className="scale-75"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium truncate ${
                            !item.active ? 'text-muted-foreground line-through' : ''
                          }`}
                        >
                          {item.term}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4">
                            {item.type}
                          </Badge>
                          {item.hitCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-4 gap-0.5"
                            >
                              <AlertCircle className="size-2.5" />
                              {item.hitCount} hit{item.hitCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.lastHit && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {new Date(item.lastHit).toLocaleDateString()}
                        </span>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Watchlist Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove &quot;{item.term}&quot; from the watchlist? This cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
