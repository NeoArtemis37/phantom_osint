'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { casesApi, modulesApi } from '@/lib/api-client';
import {
  CASE_STATUS_LABELS,
  CASE_SENSITIVITY_LABELS,
  INTELLIGENCE_LEVEL_CONFIG,
  MODULE_DEFINITIONS,
  type Case,
  type CaseSensitivity,
  type IntelligenceLevel,
  type ModuleKey,
} from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Briefcase,
  Plus,
  Trash2,
  FolderOpen,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  UserCircle,
  Phone,
  Mail,
  Bitcoin,
  Users,
  FileText,
  Cpu,
  X,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 border-green-300 dark:text-green-400',
  closed: 'bg-gray-500/10 text-gray-600 border-gray-300 dark:text-gray-400',
  archived: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
};

interface CaseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseManager({ open, onOpenChange }: CaseManagerProps) {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setCurrentCase = usePhantomStore((s) => s.setCurrentCase);

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form - basic
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSensitivity, setNewSensitivity] = useState<CaseSensitivity>('confidential');
  const [newIntelLevel, setNewIntelLevel] = useState<IntelligenceLevel>('BETA');

  // Target profile
  const [targetOpen, setTargetOpen] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [kunyaAlias, setKunyaAlias] = useState('');
  const [knownUsernames, setKnownUsernames] = useState<string[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [cryptoWallets, setCryptoWallets] = useState<string[]>([]);
  const [cryptoInput, setCryptoInput] = useState('');
  const [knownAssociates, setKnownAssociates] = useState('');
  const [operationalHistory, setOperationalHistory] = useState('');

  // Module activation
  const [modulesOpen, setModulesOpen] = useState(false);
  const [activeModules, setActiveModules] = useState<Set<ModuleKey>>(new Set());

  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await casesApi.list();
      setCases(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchCases();
  }, [open, fetchCases]);

  const addToList = (list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) => {
    const val = input.trim();
    if (val && !list.includes(val)) {
      setList([...list, val]);
    }
    setInput('');
  };

  const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setNewName('');
    setNewDescription('');
    setNewSensitivity('confidential');
    setNewIntelLevel('BETA');
    setLegalName('');
    setKunyaAlias('');
    setKnownUsernames([]);
    setUsernameInput('');
    setPhoneNumbers([]);
    setPhoneInput('');
    setEmails([]);
    setEmailInput('');
    setCryptoWallets([]);
    setCryptoInput('');
    setKnownAssociates('');
    setOperationalHistory('');
    setActiveModules(new Set());
    setTargetOpen(false);
    setModulesOpen(false);
  };

  const handleSelectCase = (c: Case) => {
    setCurrentCase(c);
    onOpenChange(false);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const targetProfile = {
        legalName: legalName || undefined,
        kunyaAlias: kunyaAlias || undefined,
        knownUsernames: knownUsernames.length > 0 ? knownUsernames : undefined,
        phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
        emails: emails.length > 0 ? emails : undefined,
        cryptoWallets: cryptoWallets.length > 0 ? cryptoWallets : undefined,
        knownAssociates: knownAssociates || undefined,
        operationalHistory: operationalHistory || undefined,
      };

      const newCase = await casesApi.create({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        sensitivity: newSensitivity,
        intelligenceLevel: newIntelLevel,
        targetProfile,
      });

      // Update target profile via case update if needed
      if (Object.values(targetProfile).some(Boolean)) {
        await casesApi.update(newCase.id, {
          description: newDescription.trim() || undefined,
          targetProfile,
        } as never);
      }

      // Activate modules
      if (activeModules.size > 0 && newCase.id) {
        for (const moduleKey of activeModules) {
          try {
            await modulesApi.create({
              caseId: newCase.id,
              moduleKey,
              enabled: true,
            });
          } catch {
            // Module might already exist
          }
        }
      }

      setCurrentCase(newCase);
      resetForm();
      setShowCreate(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await casesApi.delete(id);
      if (currentCase?.id === id) {
        setCurrentCase(null);
      }
      fetchCases();
    } catch (err) {
      console.error('Failed to delete case:', err);
    }
  };

  const toggleModule = (key: ModuleKey) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            Case Manager
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create toggle */}
          {!showCreate ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4 mr-2" />
              Create New Case
            </Button>
          ) : (
            <Card>
              <CardContent className="p-4">
                <form onSubmit={handleCreateCase} className="space-y-4">
                  {/* Basic Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="size-4" />
                      Basic Information
                    </h3>
                    <div className="space-y-2">
                      <Label htmlFor="case-name">Case Name *</Label>
                      <Input
                        id="case-name"
                        placeholder="e.g. Operation Shadow"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="case-desc">Description</Label>
                      <Textarea
                        id="case-desc"
                        placeholder="Brief description of the investigation..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Sensitivity</Label>
                        <Select
                          value={newSensitivity}
                          onValueChange={(v) =>
                            setNewSensitivity(v as CaseSensitivity)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(CASE_SENSITIVITY_LABELS) as CaseSensitivity[]
                            ).map((s) => (
                              <SelectItem key={s} value={s}>
                                {CASE_SENSITIVITY_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Intelligence Level</Label>
                        <Select
                          value={newIntelLevel}
                          onValueChange={(v) =>
                            setNewIntelLevel(v as IntelligenceLevel)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(INTELLIGENCE_LEVEL_CONFIG) as IntelligenceLevel[]).map((level) => (
                              <SelectItem key={level} value={level}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: INTELLIGENCE_LEVEL_CONFIG[level].color }}
                                  />
                                  {level} — {INTELLIGENCE_LEVEL_CONFIG[level].description}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Target Profile */}
                  <Collapsible open={targetOpen} onOpenChange={setTargetOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold w-full text-left hover:text-foreground transition-colors"
                      >
                        {targetOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        <UserCircle className="size-4" />
                        Target Profile
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Legal Name</Label>
                          <Input
                            placeholder="Full legal name"
                            value={legalName}
                            onChange={(e) => setLegalName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kunya / Alias</Label>
                          <Input
                            placeholder="Known alias"
                            value={kunyaAlias}
                            onChange={(e) => setKunyaAlias(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Known Usernames */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <UserCircle className="size-3.5" />
                          Known Usernames
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add username..."
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addToList(knownUsernames, setKnownUsernames, usernameInput, setUsernameInput);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addToList(knownUsernames, setKnownUsernames, usernameInput, setUsernameInput)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {knownUsernames.map((u, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {u}
                              <button type="button" onClick={() => removeFromList(knownUsernames, setKnownUsernames, i)}>
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Phone Numbers */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Phone className="size-3.5" />
                          Phone Numbers
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="+1-555-..."
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addToList(phoneNumbers, setPhoneNumbers, phoneInput, setPhoneInput);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addToList(phoneNumbers, setPhoneNumbers, phoneInput, setPhoneInput)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {phoneNumbers.map((p, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {p}
                              <button type="button" onClick={() => removeFromList(phoneNumbers, setPhoneNumbers, i)}>
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Emails */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Mail className="size-3.5" />
                          Email Addresses
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="email@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addToList(emails, setEmails, emailInput, setEmailInput);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addToList(emails, setEmails, emailInput, setEmailInput)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {emails.map((em, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {em}
                              <button type="button" onClick={() => removeFromList(emails, setEmails, i)}>
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Crypto Wallets */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Bitcoin className="size-3.5" />
                          Crypto Wallets
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Wallet address..."
                            value={cryptoInput}
                            onChange={(e) => setCryptoInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addToList(cryptoWallets, setCryptoWallets, cryptoInput, setCryptoInput);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addToList(cryptoWallets, setCryptoWallets, cryptoInput, setCryptoInput)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {cryptoWallets.map((c, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {c.length > 16 ? `${c.slice(0, 8)}...${c.slice(-4)}` : c}
                              <button type="button" onClick={() => removeFromList(cryptoWallets, setCryptoWallets, i)}>
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Known Associates */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          Known Associates
                        </Label>
                        <Textarea
                          placeholder="List known associates, one per line..."
                          value={knownAssociates}
                          onChange={(e) => setKnownAssociates(e.target.value)}
                          rows={3}
                        />
                      </div>

                      {/* Operational History */}
                      <div className="space-y-2">
                        <Label>Operational History</Label>
                        <Textarea
                          placeholder="Previous operations, locations, patterns..."
                          value={operationalHistory}
                          onChange={(e) => setOperationalHistory(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Module Activation */}
                  <Collapsible open={modulesOpen} onOpenChange={setModulesOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold w-full text-left hover:text-foreground transition-colors"
                      >
                        {modulesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        <Cpu className="size-4" />
                        Module Activation ({activeModules.size} active)
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {(Object.keys(MODULE_DEFINITIONS) as ModuleKey[]).map((key) => {
                          const def = MODULE_DEFINITIONS[key];
                          const isActive = activeModules.has(key);
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                                isActive ? 'border-primary/50 bg-primary/5' : 'border-border'
                              }`}
                            >
                              <Switch
                                checked={isActive}
                                onCheckedChange={() => toggleModule(key)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{def.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{def.description}</p>
                              </div>
                              <div
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: def.color }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={creating || !newName.trim()}
                    >
                      {creating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                      Create Case
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreate(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Cases list */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              All Cases ({cases.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Briefcase className="size-6 mb-2 opacity-50" />
                <p className="text-sm">No cases yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2 pr-2">
                  {cases.map((c) => {
                    const isCurrent = currentCase?.id === c.id;
                    const statusClass =
                      STATUS_COLORS[c.status] || STATUS_COLORS.active;
                    const entityCount = c._count?.entities ?? 0;
                    const intelTag = c.tags?.[0]?.toUpperCase?.();
                    const intelLevel = intelTag && intelTag in INTELLIGENCE_LEVEL_CONFIG
                      ? INTELLIGENCE_LEVEL_CONFIG[intelTag as keyof typeof INTELLIGENCE_LEVEL_CONFIG]
                      : null;

                    return (
                      <Card
                        key={c.id}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          isCurrent ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleSelectCase(c)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium truncate">
                                  {c.name}
                                </h4>
                                {isCurrent && (
                                  <Check className="size-3.5 text-primary shrink-0" />
                                )}
                              </div>
                              {c.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {c.description}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-4 ${statusClass}`}
                                >
                                  {CASE_STATUS_LABELS[c.status as keyof typeof CASE_STATUS_LABELS] || c.status}
                                </Badge>
                                {intelLevel && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4"
                                    style={{
                                      color: intelLevel.color,
                                      borderColor: intelLevel.color,
                                    }}
                                  >
                                    {intelLevel.label}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  <FolderOpen className="size-2.5 mr-0.5" />
                                  {entityCount}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Case</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Delete &quot;{c.name}&quot; and all its data? This includes
                                    all entities, relationships, timeline events, and
                                    watchlist items. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteCase(c.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
