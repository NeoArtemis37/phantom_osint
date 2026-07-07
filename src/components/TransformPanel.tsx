'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { transformsApi } from '@/lib/api-client';
import { TRANSFORM_STATUS_LABELS, type TransformFlow, type TransformStep } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Plus,
  Play,
  Trash2,
  ArrowDown,
  Workflow,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const AVAILABLE_TRANSFORMS = [
  'username-to-profiles',
  'profile-to-contacts',
  'image-to-metadata',
  'text-to-sentiment',
  'location-to-heatmap',
  'email-to-accounts',
  'phone-to-lookup',
  'domain-to-dns',
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600 border-gray-300',
  running: 'bg-blue-500/10 text-blue-600 border-blue-300',
  completed: 'bg-green-500/10 text-green-600 border-green-300',
  failed: 'bg-red-500/10 text-red-600 border-red-300',
};

export default function TransformPanel() {
  const currentCase = usePhantomStore((s) => s.currentCase);

  const [flows, setFlows] = useState<TransformFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  // New flow form
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowSteps, setFlowSteps] = useState<
    (Omit<TransformStep, 'id'> & { tempId: string })[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchFlows = useCallback(async () => {
    if (!currentCase) return;
    setLoading(true);
    try {
      const data = await transformsApi.list(currentCase.id);
      setFlows(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [currentCase]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const resetForm = () => {
    setFlowName('');
    setFlowDescription('');
    setFlowSteps([]);
    setSubmitting(false);
  };

  const addStep = () => {
    setFlowSteps((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        transform: AVAILABLE_TRANSFORMS[0],
        input: '',
        config: {},
        enabled: true,
      },
    ]);
  };

  const updateStep = (
    tempId: string,
    field: string,
    value: unknown
  ) => {
    setFlowSteps((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (tempId: string) => {
    setFlowSteps((prev) => prev.filter((s) => s.tempId !== tempId));
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !flowName.trim()) return;

    setSubmitting(true);
    try {
      await transformsApi.create({
        caseId: currentCase.id,
        name: flowName.trim(),
        description: flowDescription.trim() || undefined,
        steps: flowSteps.map((s) => ({
          transform: s.transform,
          input: s.input,
          config: s.config,
          enabled: s.enabled,
        })),
      });
      resetForm();
      setCreateDialogOpen(false);
      fetchFlows();
    } catch (err) {
      console.error('Failed to create flow:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunFlow = async (flow: TransformFlow) => {
    try {
      await transformsApi.update(flow.id, { status: 'running' });
      fetchFlows();
      // Simulate completion after 3 seconds
      setTimeout(async () => {
        try {
          await transformsApi.update(flow.id, {
            status: 'completed',
            results: { completedAt: new Date().toISOString() },
          });
          fetchFlows();
        } catch {
          // ignore
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to run flow:', err);
    }
  };

  const handleDeleteFlow = async (id: string) => {
    try {
      await transformsApi.delete(id);
      fetchFlows();
    } catch (err) {
      console.error('Failed to delete flow:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Workflow className="size-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Transforms</h2>
          <Badge variant="secondary" className="text-[10px]">
            {flows.length}
          </Badge>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCreateDialogOpen(true)}
          disabled={!currentCase}
        >
          <Plus className="size-3 mr-1" />
          New Flow
        </Button>
      </div>

      {/* Flows List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Workflow className="size-8 mb-2 opacity-50" />
            <p className="text-sm">No transform flows</p>
            <p className="text-xs mt-1">Create a flow to start data enrichment</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {flows.map((flow) => {
              const isExpanded = expandedFlow === flow.id;
              const steps: TransformStep[] = Array.isArray(flow.steps)
                ? flow.steps
                : [];
              const statusClass =
                STATUS_COLORS[flow.status] || STATUS_COLORS.draft;

              return (
                <Card key={flow.id} className="overflow-hidden">
                  <CardHeader
                    className="p-3 cursor-pointer"
                    onClick={() =>
                      setExpandedFlow(isExpanded ? null : flow.id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-sm truncate">
                          {flow.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 shrink-0 ${statusClass}`}
                        >
                          {TRANSFORM_STATUS_LABELS[flow.status as keyof typeof TRANSFORM_STATUS_LABELS] || flow.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {steps.length} step{steps.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {flow.status !== 'running' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunFlow(flow);
                            }}
                          >
                            <Play className="size-3.5" />
                          </Button>
                        )}
                        {flow.status === 'running' && (
                          <div className="size-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mr-1" />
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Flow</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete &quot;{flow.name}&quot;? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteFlow(flow.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {flow.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {flow.description}
                      </p>
                    )}
                  </CardHeader>

                  {isExpanded && steps.length > 0 && (
                    <CardContent className="px-3 pb-3 pt-0">
                      <Separator className="mb-3" />
                      <div className="space-y-0">
                        {steps.map((step, idx) => (
                          <div key={step.id || idx}>
                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Settings2 className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium truncate">
                                  {step.transform}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {step.input && (
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    {step.input}
                                  </Badge>
                                )}
                                <Badge
                                  variant={step.enabled ? 'default' : 'secondary'}
                                  className="text-[10px] h-5"
                                >
                                  {step.enabled ? 'On' : 'Off'}
                                </Badge>
                              </div>
                            </div>
                            {idx < steps.length - 1 && (
                              <div className="flex justify-center py-1">
                                <ArrowDown className="size-3.5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Create Flow Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create Transform Flow</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFlow} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">Flow Name *</Label>
              <Input
                id="flow-name"
                placeholder="e.g. Username Enrichment"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-desc">Description</Label>
              <Input
                id="flow-desc"
                placeholder="What does this flow do?"
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addStep}
                >
                  <Plus className="size-3 mr-1" />
                  Add Step
                </Button>
              </div>

              {flowSteps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Add steps to build the transform pipeline
                </p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-0 pr-2">
                    {flowSteps.map((step, idx) => (
                      <div key={step.tempId}>
                        <div className="p-3 rounded-md border bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Step {idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px]">Enabled</Label>
                              <Switch
                                checked={step.enabled}
                                onCheckedChange={(v) =>
                                  updateStep(step.tempId, 'enabled', v)
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive"
                                onClick={() => removeStep(step.tempId)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Transform</Label>
                              <Select
                                value={step.transform}
                                onValueChange={(v) =>
                                  updateStep(step.tempId, 'transform', v)
                                }
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_TRANSFORMS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Input Ref</Label>
                              <Input
                                className="h-7 text-xs"
                                placeholder="e.g. step-0"
                                value={step.input}
                                onChange={(e) =>
                                  updateStep(
                                    step.tempId,
                                    'input',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                        {idx < flowSteps.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ArrowDown className="size-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setCreateDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !flowName.trim()}>
                {submitting ? 'Creating...' : 'Create Flow'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
