'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { modulesApi } from '@/lib/api-client';
import { MODULE_DEFINITIONS, type CaseModule, type ModuleKey } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Hash,
  Search,
  Database,
  UserSearch,
  Radar,
  Eye,
  Phone,
  ScanFace,
  Bitcoin,
  Archive,
  Code,
  Loader2,
  Play,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Hash,
  Search,
  Database,
  UserSearch,
  Radar,
  Eye,
  Phone,
  ScanFace,
  Bitcoin,
  Archive,
  Code,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  idle: { label: 'Idle', color: 'text-muted-foreground', icon: Clock },
  running: { label: 'Running', color: 'text-amber-500', icon: Loader2 },
  completed: { label: 'Completed', color: 'text-green-500', icon: CheckCircle2 },
  error: { label: 'Error', color: 'text-red-500', icon: AlertCircle },
};

export default function ModulePanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const [modules, setModules] = useState<CaseModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configModule, setConfigModule] = useState<CaseModule | null>(null);
  const [configJson, setConfigJson] = useState('');
  const [running, setRunning] = useState(false);

  const fetchModules = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const data = await modulesApi.list(currentCase.id);
      setModules(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleToggle = async (mod: CaseModule) => {
    try {
      const updated = await modulesApi.update(mod.id, { enabled: !mod.enabled });
      setModules((prev) => prev.map((m) => (m.id === mod.id ? updated : m)));
    } catch {
      // If update fails (module doesn't exist), try creating it
      if (!mod.enabled && currentCase) {
        try {
          const created = await modulesApi.create({
            caseId: currentCase.id,
            moduleKey: mod.moduleKey,
            enabled: true,
          });
          setModules((prev) => [...prev, created]);
        } catch {
          // ignore
        }
      }
    }
  };

  const handleOpenConfig = (mod: CaseModule) => {
    setConfigModule(mod);
    setConfigJson(JSON.stringify(mod.config, null, 2));
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!configModule) return;
    try {
      const parsed = JSON.parse(configJson);
      const updated = await modulesApi.update(configModule.id, { config: parsed });
      setModules((prev) => prev.map((m) => (m.id === configModule.id ? updated : m)));
      setConfigOpen(false);
    } catch {
      // invalid JSON
    }
  };

  const handleRunAll = async () => {
    if (!currentCase) return;
    setRunning(true);
    const activeModules = modules.filter((m) => m.enabled);
    for (const mod of activeModules) {
      try {
        await modulesApi.update(mod.id, { status: 'running' });
      } catch {
        // ignore
      }
    }
    // Refresh after a short delay to simulate running
    setTimeout(() => {
      fetchModules();
      setRunning(false);
    }, 2000);
  };

  const getModuleState = (key: ModuleKey): CaseModule | undefined => {
    return modules.find((m) => m.moduleKey === key);
  };

  if (!currentCase) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Cpu className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a case to manage modules</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-sm font-semibold">OSINT Modules</h2>
          <p className="text-xs text-muted-foreground">
            {modules.filter((m) => m.enabled).length} active / {Object.keys(MODULE_DEFINITIONS).length} total
          </p>
        </div>
        <Button size="sm" onClick={handleRunAll} disabled={running}>
          {running ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Play className="size-3.5 mr-1" />}
          Run All Active
        </Button>
      </div>

      {/* Module Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(MODULE_DEFINITIONS) as ModuleKey[]).map((key) => {
            const def = MODULE_DEFINITIONS[key];
            const mod = getModuleState(key);
            const isEnabled = mod?.enabled ?? false;
            const status = mod?.status ?? 'idle';
            const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
            const IconComponent = ICON_MAP[def.icon] || Code;
            const StatusIcon = statusCfg.icon;

            return (
              <Card
                key={key}
                className={`transition-all ${
                  isEnabled ? 'border-primary/30 shadow-sm' : 'opacity-70'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${def.color}20`, color: def.color }}
                    >
                      <IconComponent className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium truncate">{def.name}</h3>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => {
                            if (mod) handleToggle(mod);
                          }}
                          className="scale-75"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {def.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 ${statusCfg.color}`}
                        >
                          <StatusIcon className={`size-2.5 mr-1 ${status === 'running' ? 'animate-spin' : ''}`} />
                          {statusCfg.label}
                        </Badge>
                        {mod?.lastRun && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(mod.lastRun).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isEnabled && mod && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleOpenConfig(mod)}
                      >
                        <Settings className="size-3 mr-1" />
                        Config
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              Module Configuration
            </DialogTitle>
          </DialogHeader>
          {configModule && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Module</Label>
                <p className="text-sm text-muted-foreground">
                  {MODULE_DEFINITIONS[configModule.moduleKey as ModuleKey]?.name || configModule.moduleKey}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Configuration (JSON)</Label>
                <Textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveConfig}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
