'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { timelineApi } from '@/lib/api-client';
import {
  EVENT_TYPE_LABELS,
  type EventType,
  type TimelineEvent,
} from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Clock,
  Info,
  AlertTriangle,
  Zap,
  Search,
  MessageSquare,
  Filter,
  Crosshair,
  MapPin,
  DollarSign,
} from 'lucide-react';

const EVENT_COLORS: Record<EventType, string> = {
  info: '#3b82f6',
  alert: '#ef4444',
  action: '#22c55e',
  discovery: '#f59e0b',
  communication: '#a855f7',
  capture: '#06b6d4',
  relocation: '#ec4899',
  financial: '#84cc16',
};

const EVENT_BG: Record<EventType, string> = {
  info: 'bg-blue-500/10',
  alert: 'bg-red-500/10',
  action: 'bg-green-500/10',
  discovery: 'bg-amber-500/10',
  communication: 'bg-purple-500/10',
  capture: 'bg-cyan-500/10',
  relocation: 'bg-pink-500/10',
  financial: 'bg-lime-500/10',
};

const EVENT_ICONS: Record<EventType, React.ReactNode> = {
  info: <Info className="size-4" />,
  alert: <AlertTriangle className="size-4" />,
  action: <Zap className="size-4" />,
  discovery: <Search className="size-4" />,
  communication: <MessageSquare className="size-4" />,
  capture: <Crosshair className="size-4" />,
  relocation: <MapPin className="size-4" />,
  financial: <DollarSign className="size-4" />,
};

export default function TimelineView() {
  const currentCase = usePhantomStore((s) => s.currentCase);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // New event form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEventType, setNewEventType] = useState<EventType>('info');
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const data = await timelineApi.list(currentCase.id);
      // Sort by timestamp descending (newest first)
      data.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setEvents(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents =
    filter === 'all'
      ? events
      : events.filter((e) => e.eventType === filter);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !newTitle.trim()) return;

    setSubmitting(true);
    try {
      await timelineApi.create({
        caseId: currentCase.id,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        eventType: newEventType,
      });
      setNewTitle('');
      setNewDescription('');
      setNewEventType('info');
      setAddDialogOpen(false);
      fetchEvents();
    } catch (err) {
      console.error('Failed to add event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Timeline</h2>
          <Badge variant="secondary" className="text-[10px]">
            {filteredEvents.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1">
            <Filter className="size-3.5 text-muted-foreground" />
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as EventType | 'all')}
            >
              <SelectTrigger className="h-7 text-xs w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((et) => (
                  <SelectItem key={et} value={et}>
                    {EVENT_TYPE_LABELS[et]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAddDialogOpen(true)}
            disabled={!currentCase}
          >
            <Plus className="size-3 mr-1" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="size-8 mb-2 opacity-50" />
            <p className="text-sm">No timeline events</p>
            <p className="text-xs mt-1">
              Add an event to start tracking activity
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {filteredEvents.map((event) => {
                  const color = EVENT_COLORS[event.eventType] || '#6b7280';
                  const bg = EVENT_BG[event.eventType] || 'bg-muted/50';
                  const icon = EVENT_ICONS[event.eventType];

                  return (
                    <div key={event.id} className="relative flex gap-3 pl-1">
                      {/* Dot on timeline */}
                      <div
                        className="relative z-10 flex items-center justify-center size-[30px] rounded-full border-2 shrink-0"
                        style={{ borderColor: color, backgroundColor: 'hsl(var(--background))' }}
                      >
                        <div
                          className="flex items-center justify-center size-5 rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          {icon}
                        </div>
                      </div>

                      {/* Event Card */}
                      <Card className={`flex-1 ${bg} border-0 shadow-none`}>
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium leading-tight">
                              {event.title}
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 h-5"
                              style={{ borderColor: color, color }}
                            >
                              {EVENT_TYPE_LABELS[event.eventType]}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Add Event Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Timeline Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEvent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                placeholder="Event title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={newEventType}
                onValueChange={(v) => setNewEventType(v as EventType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((et) => (
                    <SelectItem key={et} value={et}>
                      {EVENT_TYPE_LABELS[et]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea
                id="event-desc"
                placeholder="What happened..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !newTitle.trim()}>
                {submitting ? 'Adding...' : 'Add Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
