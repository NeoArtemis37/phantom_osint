'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { alertsApi } from '@/lib/api-client';
import {
  ALERT_TIER_CONFIG,
  type Alert,
  type AlertTier,
  type AlertStatus,
  type AlertCategory,
} from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  AlertTriangle,
  AlertCircle,
  Info,
  Plus,
  Check,
  Clock,
  Bell,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';

const TIER_ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle,
  AlertCircle,
  Info,
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  location_confirmed: 'Location Confirmed',
  imminent_threat: 'Imminent Threat',
  opsec_breach: 'OPSEC Breach',
  associate_arrested: 'Associate Arrested',
  new_account: 'New Account',
  travel_pattern: 'Travel Pattern',
  financial: 'Financial',
  pattern_match: 'Pattern Match',
  platform_migration: 'Platform Migration',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setAlerts = usePhantomStore((s) => s.setAlerts);
  const [alerts, setLocalAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<AlertTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('active');
  const [createOpen, setCreateOpen] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTier, setNewTier] = useState<AlertTier>('routine');
  const [newCategory, setNewCategory] = useState<AlertCategory>('pattern_match');

  const fetchAlerts = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const filters: { tier?: AlertTier; status?: AlertStatus } = {};
      if (tierFilter !== 'all') filters.tier = tierFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await alertsApi.list(currentCase.id, filters);
      setLocalAlerts(data);
      setAlerts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase, tierFilter, statusFilter, setAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alert: Alert) => {
    try {
      const updated = await alertsApi.update(alert.id, {
        status: 'acknowledged',
        acknowledgedBy: 'current-user',
      });
      setLocalAlerts((prev) => {
        const next = prev.map((a) => (a.id === alert.id ? updated : a));
        setAlerts(next);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !newTitle.trim()) return;
    try {
      const created = await alertsApi.create({
        caseId: currentCase.id,
        title: newTitle.trim(),
        description: newDescription.trim(),
        tier: newTier,
        category: newCategory,
      });
      setLocalAlerts((prev) => [created, ...prev]);
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewTier('routine');
      setNewCategory('pattern_match');
    } catch {
      // ignore
    }
  };

  const criticalCount = alerts.filter((a) => a.tier === 'critical' && a.status === 'active').length;

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Bell className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to view alerts</p>
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
            <Bell className="size-4" />
            Alerts
            {criticalCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] h-5 animate-pulse">
                {criticalCount} CRITICAL
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">{alerts.length} alerts</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5 mr-1" />
          Create Alert
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {(['all', 'critical', 'urgent', 'routine'] as const).map((tier) => (
            <button
              key={tier}
              className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                tierFilter === tier
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTierFilter(tier)}
            >
              {tier === 'all' ? 'All' : ALERT_TIER_CONFIG[tier].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((status) => (
            <button
              key={status}
              className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No alerts matching filters</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const tierCfg = ALERT_TIER_CONFIG[alert.tier];
              const TierIcon = TIER_ICON_MAP[tierCfg.icon] || Info;
              const isActive = alert.status === 'active';

              return (
                <Card
                  key={alert.id}
                  className={`transition-all ${
                    alert.tier === 'critical' && isActive
                      ? 'border-red-500/50 bg-red-500/5'
                      : alert.tier === 'urgent' && isActive
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : ''
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Tier indicator */}
                      <div
                        className="size-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${tierCfg.color}20`, color: tierCfg.color }}
                      >
                        {alert.tier === 'critical' && isActive ? (
                          <Volume2 className="size-4" />
                        ) : (
                          <TierIcon className="size-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium truncate">
                            {alert.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 shrink-0"
                            style={{ color: tierCfg.color, borderColor: tierCfg.color }}
                          >
                            {tierCfg.label}
                          </Badge>
                          {alert.status !== 'active' && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              {alert.status}
                            </Badge>
                          )}
                        </div>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {alert.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-4">
                            {CATEGORY_LABELS[alert.category] || alert.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {relativeTime(alert.triggeredAt)}
                          </span>
                          {alert.entityId && (
                            <Badge variant="secondary" className="text-[10px] h-4 cursor-pointer">
                              Entity
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Acknowledge button */}
                      {isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => handleAcknowledge(alert)}
                        >
                          <Check className="size-3 mr-1" />
                          Ack
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Create Alert Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Create Alert
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Alert title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Alert details..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={newTier} onValueChange={(v) => setNewTier(v as AlertTier)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ALERT_TIER_CONFIG) as AlertTier[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {ALERT_TIER_CONFIG[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as AlertCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as AlertCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
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
                Create Alert
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
