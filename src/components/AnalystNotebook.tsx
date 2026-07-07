'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Brain,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  HelpCircle,
  Minus,
  Download,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Eye,
  Lightbulb,
  Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryType = 'Observation' | 'Hypothesis' | 'Assessment' | 'Caveat' | 'Key Assumption';
type ConfidenceLevel = 'High' | 'Medium' | 'Low';

// NATO STANAG 2511 Source Reliability/Credibility
type SourceReliability = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type SourceCredibility = '1' | '2' | '3' | '4' | '5' | '6';

interface AnalyticEntry {
  id: string;
  timestamp: string;
  analyst: string;
  entryType: EntryType;
  content: string;
  confidence: ConfidenceLevel;
  sourceReliability: SourceReliability;
  sourceCredibility: SourceCredibility;
  linkedEntity: string | null;
}

type ACHCell = '+' | '-' | '' | '?';

interface ACHHypothesis {
  id: string;
  text: string;
}

interface ACHEvidence {
  id: string;
  text: string;
  isDiagnostic: boolean;
}

interface ACHData {
  hypotheses: ACHHypothesis[];
  evidence: ACHEvidence[];
  cells: Record<string, ACHCell>; // key: `${evidenceId}-${hypothesisId}`
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTRY_TYPE_CONFIG: Record<EntryType, { icon: React.ElementType; color: string; bg: string }> = {
  Observation: { icon: Eye, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  Hypothesis: { icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  Assessment: { icon: Brain, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  Caveat: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  'Key Assumption': { icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
};

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { color: string; bg: string; label: string }> = {
  High: { color: 'text-green-400', bg: 'bg-green-500/15', label: 'HIGH' },
  Medium: { color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'MED' },
  Low: { color: 'text-red-400', bg: 'bg-red-500/15', label: 'LOW' },
};

const RELIABILITY_LABELS: Record<SourceReliability, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Cannot Judge',
};

const CREDIBILITY_LABELS: Record<SourceCredibility, string> = {
  '1': 'Confirmed by other sources',
  '2': 'Probably True',
  '3': 'Possibly True',
  '4': 'Doubtful',
  '5': 'Improbable',
  '6': 'Cannot Judge',
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function getLogKey(caseId: string) {
  return `phantom-notebook-log-${caseId}`;
}

function getACHKey(caseId: string) {
  return `phantom-notebook-ach-${caseId}`;
}

function loadLog(caseId: string): AnalyticEntry[] {
  try {
    const raw = localStorage.getItem(getLogKey(caseId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(caseId: string, entries: AnalyticEntry[]) {
  localStorage.setItem(getLogKey(caseId), JSON.stringify(entries));
}

function loadACH(caseId: string): ACHData {
  try {
    const raw = localStorage.getItem(getACHKey(caseId));
    return raw ? JSON.parse(raw) : { hypotheses: [], evidence: [], cells: {} };
  } catch {
    return { hypotheses: [], evidence: [], cells: {} };
  }
}

function saveACH(caseId: string, data: ACHData) {
  localStorage.setItem(getACHKey(caseId), JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AnalystNotebook() {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const user = usePhantomStore((s) => s.user);

  const caseId = currentCase?.id ?? '';

  // --- Analytic Log state ---
  const [logEntries, setLogEntries] = useState<AnalyticEntry[]>([]);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New entry form
  const [newType, setNewType] = useState<EntryType>('Observation');
  const [newContent, setNewContent] = useState('');
  const [newConfidence, setNewConfidence] = useState<ConfidenceLevel>('Medium');
  const [newReliability, setNewReliability] = useState<SourceReliability>('C');
  const [newCredibility, setNewCredibility] = useState<SourceCredibility>('3');
  const [newLinkedEntity, setNewLinkedEntity] = useState<string>('none');

  // Edit form
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<EntryType>('Observation');
  const [editConfidence, setEditConfidence] = useState<ConfidenceLevel>('Medium');
  const [editReliability, setEditReliability] = useState<SourceReliability>('C');
  const [editCredibility, setEditCredibility] = useState<SourceCredibility>('3');

  // --- ACH state ---
  const [achData, setAchData] = useState<ACHData>({ hypotheses: [], evidence: [], cells: {} });
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newEvidenceText, setNewEvidenceText] = useState('');

  // Filter
  const [logFilter, setLogFilter] = useState<EntryType | 'all'>('all');

  // --- Load from localStorage when caseId changes ---
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);

  if (caseId !== loadedCaseId) {
    setLoadedCaseId(caseId);
    if (caseId) {
      setLogEntries(loadLog(caseId));
      setAchData(loadACH(caseId));
    } else {
      setLogEntries([]);
      setAchData({ hypotheses: [], evidence: [], cells: {} });
    }
  }

  // --- Persist log ---
  const persistLog = useCallback(
    (entries: AnalyticEntry[]) => {
      setLogEntries(entries);
      if (caseId) saveLog(caseId, entries);
    },
    [caseId]
  );

  // --- Persist ACH ---
  const persistACH = useCallback(
    (data: ACHData) => {
      setAchData(data);
      if (caseId) saveACH(caseId, data);
    },
    [caseId]
  );

  // --- Analytic Log handlers ---
  const handleAddEntry = () => {
    if (!newContent.trim()) return;
    const entry: AnalyticEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      analyst: user?.name ?? 'Unknown',
      entryType: newType,
      content: newContent.trim(),
      confidence: newConfidence,
      sourceReliability: newReliability,
      sourceCredibility: newCredibility,
      linkedEntity: newLinkedEntity === 'none' ? null : newLinkedEntity,
    };
    persistLog([entry, ...logEntries]);
    setNewContent('');
    setShowNewEntry(false);
  };

  const handleDeleteEntry = (id: string) => {
    persistLog(logEntries.filter((e) => e.id !== id));
  };

  const handleStartEdit = (entry: AnalyticEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditType(entry.entryType);
    setEditConfidence(entry.confidence);
    setEditReliability(entry.sourceReliability);
    setEditCredibility(entry.sourceCredibility);
  };

  const handleSaveEdit = (id: string) => {
    persistLog(
      logEntries.map((e) =>
        e.id === id
          ? {
              ...e,
              content: editContent.trim(),
              entryType: editType,
              confidence: editConfidence,
              sourceReliability: editReliability,
              sourceCredibility: editCredibility,
            }
          : e
      )
    );
    setEditingId(null);
  };

  // --- ACH handlers ---
  const handleAddHypothesis = () => {
    if (!newHypothesis.trim()) return;
    const h: ACHHypothesis = { id: crypto.randomUUID(), text: newHypothesis.trim() };
    const updated: ACHData = { ...achData, hypotheses: [...achData.hypotheses, h] };
    persistACH(updated);
    setNewHypothesis('');
  };

  const handleDeleteHypothesis = (id: string) => {
    const newCells: Record<string, ACHCell> = {};
    for (const [key, val] of Object.entries(achData.cells)) {
      if (!key.endsWith(`-${id}`)) newCells[key] = val;
    }
    persistACH({
      ...achData,
      hypotheses: achData.hypotheses.filter((h) => h.id !== id),
      cells: newCells,
    });
  };

  const handleUpdateHypothesis = (id: string, text: string) => {
    persistACH({
      ...achData,
      hypotheses: achData.hypotheses.map((h) => (h.id === id ? { ...h, text } : h)),
    });
  };

  const handleAddEvidence = () => {
    if (!newEvidenceText.trim()) return;
    const e: ACHEvidence = { id: crypto.randomUUID(), text: newEvidenceText.trim(), isDiagnostic: false };
    persistACH({ ...achData, evidence: [...achData.evidence, e] });
    setNewEvidenceText('');
  };

  const handleDeleteEvidence = (id: string) => {
    const newCells: Record<string, ACHCell> = {};
    for (const [key, val] of Object.entries(achData.cells)) {
      if (!key.startsWith(`${id}-`)) newCells[key] = val;
    }
    persistACH({
      ...achData,
      evidence: achData.evidence.filter((e) => e.id !== id),
      cells: newCells,
    });
  };

  const handleUpdateEvidence = (id: string, text: string) => {
    persistACH({
      ...achData,
      evidence: achData.evidence.map((e) => (e.id === id ? { ...e, text } : e)),
    });
  };

  const handleCellClick = (evidenceId: string, hypothesisId: string) => {
    const key = `${evidenceId}-${hypothesisId}`;
    const current = achData.cells[key] ?? '';
    const cycle: ACHCell[] = ['', '+', '-', '?'];
    const nextIndex = (cycle.indexOf(current) + 1) % cycle.length;
    persistACH({
      ...achData,
      cells: { ...achData.cells, [key]: cycle[nextIndex] },
    });
  };

  const handleToggleDiagnostic = (evidenceId: string) => {
    persistACH({
      ...achData,
      evidence: achData.evidence.map((e) =>
        e.id === evidenceId ? { ...e, isDiagnostic: !e.isDiagnostic } : e
      ),
    });
  };

  // --- ACH scoring ---
  const getInconsistencyCount = (hypothesisId: string): number => {
    let count = 0;
    for (const ev of achData.evidence) {
      if (achData.cells[`${ev.id}-${hypothesisId}`] === '-') count++;
    }
    return count;
  };

  const getConsistencyCount = (hypothesisId: string): number => {
    let count = 0;
    for (const ev of achData.evidence) {
      if (achData.cells[`${ev.id}-${hypothesisId}`] === '+') count++;
    }
    return count;
  };

  const minInconsistency = Math.min(
    ...achData.hypotheses.map((h) => getInconsistencyCount(h.id)),
    Infinity
  );

  // --- Export ACH as text ---
  const handleExportACH = () => {
    const lines: string[] = [];
    lines.push('=== ANALYSIS OF COMPETING HYPOTHESES ===');
    lines.push(`Case: ${currentCase?.name ?? 'Unknown'}`);
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push('');

    // Header row
    const header = ['Evidence', ...achData.hypotheses.map((h) => h.text), 'Diagnostic?'];
    lines.push(header.join('\t'));

    // Evidence rows
    for (const ev of achData.evidence) {
      const cells = achData.hypotheses.map((h) => {
        const v = achData.cells[`${ev.id}-${h.id}`] ?? '';
        return v === '+' ? '+' : v === '-' ? '-' : v === '?' ? '?' : 'N/A';
      });
      lines.push([ev.text, ...cells, ev.isDiagnostic ? 'Yes' : 'No'].join('\t'));
    }

    // Score row
    const scores = achData.hypotheses.map((h) => {
      const inc = getInconsistencyCount(h.id);
      const con = getConsistencyCount(h.id);
      return `${inc} inc / ${con} con`;
    });
    lines.push(['SCORE', ...scores, ''].join('\t'));

    // Most likely
    const mostLikely = achData.hypotheses.find((h) => getInconsistencyCount(h.id) === minInconsistency);
    if (mostLikely) {
      lines.push('');
      lines.push(`Most likely hypothesis (fewest inconsistencies): ${mostLikely.text}`);
    }

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ach-${caseId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Export Log ---
  const handleExportLog = () => {
    const lines: string[] = [];
    lines.push('=== ANALYTIC LOG ===');
    lines.push(`Case: ${currentCase?.name ?? 'Unknown'}`);
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push('');

    for (const entry of logEntries) {
      lines.push(`[${new Date(entry.timestamp).toLocaleString()}] ${entry.entryType} | ${entry.analyst}`);
      lines.push(`Confidence: ${entry.confidence} | Source: ${entry.sourceReliability}${entry.sourceCredibility} (${RELIABILITY_LABELS[entry.sourceReliability]} / ${CREDIBILITY_LABELS[entry.sourceCredibility]})`);
      if (entry.linkedEntity) lines.push(`Linked Entity: ${entry.linkedEntity}`);
      lines.push(entry.content);
      lines.push('---');
    }

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytic-log-${caseId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Filter entries ---
  const filteredEntries =
    logFilter === 'all' ? logEntries : logEntries.filter((e) => e.entryType === logFilter);

  // --- No case selected ---
  if (!currentCase) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <BookOpen className="size-12 opacity-40" />
          <p className="text-sm">Select a case to use the Analyst Notebook</p>
        </div>
      </div>
    );
  }

  // --- Cell color ---
  const getCellColor = (value: ACHCell) => {
    switch (value) {
      case '+':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case '-':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case '?':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      default:
        return 'bg-muted/30 text-muted-foreground border-border';
    }
  };

  const getCellIcon = (value: ACHCell) => {
    switch (value) {
      case '+':
        return <CheckCircle className="size-3.5" />;
      case '-':
        return <XCircle className="size-3.5" />;
      case '?':
        return <HelpCircle className="size-3.5" />;
      default:
        return <Minus className="size-3.5 opacity-40" />;
    }
  };

  // --- Source rating badge color ---
  const getSourceRatingColor = (reliability: SourceReliability, credibility: SourceCredibility) => {
    // A1 = best, F6 = worst
    const rIdx = 'ABCDEF'.indexOf(reliability);
    const cIdx = '123456'.indexOf(credibility);
    const score = rIdx + cIdx;
    if (score <= 2) return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (score <= 4) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <h2 className="text-sm font-semibold">Analyst Notebook</h2>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              ICD 203 / STANAG 2511
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] h-5">
              {logEntries.length} entries
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="log" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-2">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="log" className="flex-1 gap-1.5">
              <BookOpen className="size-3.5" />
              Analytic Log
            </TabsTrigger>
            <TabsTrigger value="ach" className="flex-1 gap-1.5">
              <Brain className="size-3.5" />
              ACH Matrix
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ==========================================
            TAB 1: ANALYTIC LOG
            ========================================== */}
        <TabsContent value="log" className="flex-1 overflow-hidden mt-0">
          <div className="h-full flex flex-col">
            {/* Controls bar */}
            <div className="shrink-0 px-4 py-2 flex items-center gap-2 border-b">
              <Button
                size="sm"
                className="gap-1.5 h-7"
                onClick={() => {
                  setShowNewEntry(!showNewEntry);
                  setNewType('Observation');
                  setNewContent('');
                  setNewConfidence('Medium');
                  setNewReliability('C');
                  setNewCredibility('3');
                  setNewLinkedEntity('none');
                }}
              >
                <Plus className="size-3.5" />
                New Entry
              </Button>

              <Separator orientation="vertical" className="h-5" />

              <Select value={logFilter} onValueChange={(v) => setLogFilter(v as EntryType | 'all')}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Observation">Observation</SelectItem>
                  <SelectItem value="Hypothesis">Hypothesis</SelectItem>
                  <SelectItem value="Assessment">Assessment</SelectItem>
                  <SelectItem value="Caveat">Caveat</SelectItem>
                  <SelectItem value="Key Assumption">Key Assumption</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7"
                onClick={handleExportLog}
                disabled={logEntries.length === 0}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>

            {/* New entry form */}
            {showNewEntry && (
              <div className="shrink-0 px-4 py-3 border-b bg-muted/20">
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Entry Type
                            </label>
                            <Select value={newType} onValueChange={(v) => setNewType(v as EntryType)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Observation">Observation</SelectItem>
                                <SelectItem value="Hypothesis">Hypothesis</SelectItem>
                                <SelectItem value="Assessment">Assessment</SelectItem>
                                <SelectItem value="Caveat">Caveat</SelectItem>
                                <SelectItem value="Key Assumption">Key Assumption</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Confidence
                            </label>
                            <Select value={newConfidence} onValueChange={(v) => setNewConfidence(v as ConfidenceLevel)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Source Reliability
                            </label>
                            <Select value={newReliability} onValueChange={(v) => setNewReliability(v as SourceReliability)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['A', 'B', 'C', 'D', 'E', 'F'] as SourceReliability[]).map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r} — {RELIABILITY_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Information Credibility
                            </label>
                            <Select value={newCredibility} onValueChange={(v) => setNewCredibility(v as SourceCredibility)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['1', '2', '3', '4', '5', '6'] as SourceCredibility[]).map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c} — {CREDIBILITY_LABELS[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Content
                          </label>
                          <Textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="Enter your analytic observation, hypothesis, or assessment..."
                            className="min-h-[80px] text-sm resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 ${CONFIDENCE_CONFIG[newConfidence].bg} ${CONFIDENCE_CONFIG[newConfidence].color}`}
                            >
                              {CONFIDENCE_CONFIG[newConfidence].label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 ${getSourceRatingColor(newReliability, newCredibility)}`}
                            >
                              {newReliability}{newCredibility}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => setShowNewEntry(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 gap-1.5"
                              onClick={handleAddEntry}
                              disabled={!newContent.trim()}
                            >
                              <Save className="size-3.5" />
                              Save Entry
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Log entries */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {filteredEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <BookOpen className="size-10 opacity-30 mb-3" />
                    <p className="text-sm">No analytic entries yet</p>
                    <p className="text-xs mt-1">Click &quot;New Entry&quot; to begin documenting your analysis</p>
                  </div>
                )}
                {filteredEntries.map((entry) => {
                  const typeConfig = ENTRY_TYPE_CONFIG[entry.entryType];
                  const TypeIcon = typeConfig.icon;

                  return (
                    <Card
                      key={entry.id}
                      className={`border ${typeConfig.bg} transition-colors`}
                    >
                      <CardContent className="p-4">
                        {editingId === entry.id ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  Type
                                </label>
                                <Select value={editType} onValueChange={(v) => setEditType(v as EntryType)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Observation">Observation</SelectItem>
                                    <SelectItem value="Hypothesis">Hypothesis</SelectItem>
                                    <SelectItem value="Assessment">Assessment</SelectItem>
                                    <SelectItem value="Caveat">Caveat</SelectItem>
                                    <SelectItem value="Key Assumption">Key Assumption</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  Confidence
                                </label>
                                <Select value={editConfidence} onValueChange={(v) => setEditConfidence(v as ConfidenceLevel)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  Reliability
                                </label>
                                <Select value={editReliability} onValueChange={(v) => setEditReliability(v as SourceReliability)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(['A', 'B', 'C', 'D', 'E', 'F'] as SourceReliability[]).map((r) => (
                                      <SelectItem key={r} value={r}>
                                        {r} — {RELIABILITY_LABELS[r]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  Credibility
                                </label>
                                <Select value={editCredibility} onValueChange={(v) => setEditCredibility(v as SourceCredibility)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(['1', '2', '3', '4', '5', '6'] as SourceCredibility[]).map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c} — {CREDIBILITY_LABELS[c]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[60px] text-sm resize-none"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 gap-1.5"
                                onClick={() => handleSaveEdit(entry.id)}
                              >
                                <Save className="size-3.5" />
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <TypeIcon className={`size-3.5 ${typeConfig.color}`} />
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${typeConfig.bg} ${typeConfig.color}`}
                                >
                                  {entry.entryType}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${CONFIDENCE_CONFIG[entry.confidence].bg} ${CONFIDENCE_CONFIG[entry.confidence].color}`}
                                >
                                  {CONFIDENCE_CONFIG[entry.confidence].label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${getSourceRatingColor(entry.sourceReliability, entry.sourceCredibility)}`}
                                  title={`${RELIABILITY_LABELS[entry.sourceReliability]} / ${CREDIBILITY_LABELS[entry.sourceCredibility]}`}
                                >
                                  {entry.sourceReliability}{entry.sourceCredibility}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  onClick={() => handleStartEdit(entry)}
                                >
                                  <Edit3 className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                              <span>{new Date(entry.timestamp).toLocaleString()}</span>
                              <span>by {entry.analyst}</span>
                              {entry.linkedEntity && (
                                <span className="flex items-center gap-1">
                                  <span className="size-1 rounded-full bg-muted-foreground" />
                                  Entity: {entry.linkedEntity}
                                </span>
                              )}
                              <span title={`${RELIABILITY_LABELS[entry.sourceReliability]} / ${CREDIBILITY_LABELS[entry.sourceCredibility]}`}>
                                Source: {entry.sourceReliability}{entry.sourceCredibility}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* ==========================================
            TAB 2: ACH MATRIX
            ========================================== */}
        <TabsContent value="ach" className="flex-1 overflow-hidden mt-0">
          <div className="h-full flex flex-col">
            {/* Controls */}
            <div className="shrink-0 px-4 py-2 flex items-center gap-2 border-b">
              <Button
                size="sm"
                className="gap-1.5 h-7"
                onClick={handleExportACH}
                disabled={achData.hypotheses.length === 0}
              >
                <Download className="size-3.5" />
                Export ACH
              </Button>

              <div className="flex-1" />

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-green-500/20 border border-green-500/40" /> Consistent
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-red-500/20 border border-red-500/40" /> Inconsistent
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-yellow-500/20 border border-yellow-500/40" /> Insufficient
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-muted/30 border border-border" /> N/A
                </span>
              </div>
            </div>

            {/* ACH Matrix content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Hypotheses section */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Hypotheses
                      </h3>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {achData.hypotheses.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">
                        No hypotheses defined. Add hypotheses to begin ACH analysis.
                      </p>
                    )}
                    {achData.hypotheses.map((h, idx) => {
                      const incCount = getInconsistencyCount(h.id);
                      const isMostLikely = achData.hypotheses.length > 1 && incCount === minInconsistency;
                      return (
                        <div key={h.id} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 w-5 justify-center shrink-0 ${
                              isMostLikely ? 'bg-green-500/20 text-green-400 border-green-500/40' : ''
                            }`}
                          >
                            {idx + 1}
                          </Badge>
                          <Input
                            value={h.text}
                            onChange={(e) => handleUpdateHypothesis(h.id, e.target.value)}
                            className="h-7 text-xs flex-1"
                            placeholder={`Hypothesis ${idx + 1}`}
                          />
                          {achData.evidence.length > 0 && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 whitespace-nowrap ${
                                isMostLikely
                                  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                  : 'bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              {incCount} inc
                            </Badge>
                          )}
                          {isMostLikely && (
                            <Badge className="text-[9px] h-5 bg-green-500/20 text-green-400 border border-green-500/40 whitespace-nowrap">
                              MOST LIKELY
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteHypothesis(h.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newHypothesis}
                        onChange={(e) => setNewHypothesis(e.target.value)}
                        className="h-7 text-xs flex-1"
                        placeholder="Enter new hypothesis..."
                        onKeyDown={(e) => e.key === 'Enter' && handleAddHypothesis()}
                      />
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        onClick={handleAddHypothesis}
                        disabled={!newHypothesis.trim()}
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence section */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Evidence Items
                      </h3>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {achData.evidence.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">
                        No evidence items. Add evidence to evaluate against hypotheses.
                      </p>
                    )}
                    {achData.evidence.map((ev, idx) => (
                      <div key={ev.id} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 w-5 justify-center shrink-0 ${
                            ev.isDiagnostic ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : ''
                          }`}
                        >
                          {idx + 1}
                        </Badge>
                        <Input
                          value={ev.text}
                          onChange={(e) => handleUpdateEvidence(ev.id, e.target.value)}
                          className="h-7 text-xs flex-1"
                          placeholder={`Evidence ${idx + 1}`}
                        />
                        <Button
                          variant={ev.isDiagnostic ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => handleToggleDiagnostic(ev.id)}
                        >
                          <AlertTriangle className="size-3" />
                          Diagnostic
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEvidence(ev.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newEvidenceText}
                        onChange={(e) => setNewEvidenceText(e.target.value)}
                        className="h-7 text-xs flex-1"
                        placeholder="Enter new evidence item..."
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEvidence()}
                      />
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        onClick={handleAddEvidence}
                        disabled={!newEvidenceText.trim()}
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* ACH Matrix Grid */}
                {achData.hypotheses.length > 0 && achData.evidence.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Evaluation Matrix
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Click cells to cycle: N/A → + (consistent) → - (inconsistent) → ? (insufficient data)
                      </p>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-2 border-b border-r border-border min-w-[200px]">
                                Evidence
                              </th>
                              {achData.hypotheses.map((h, idx) => (
                                <th
                                  key={h.id}
                                  className={`text-center text-[10px] uppercase tracking-wider font-medium p-2 border-b border-border min-w-[100px] ${
                                    getInconsistencyCount(h.id) === minInconsistency && achData.hypotheses.length > 1
                                      ? 'text-green-400'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  H{idx + 1}
                                  {getInconsistencyCount(h.id) === minInconsistency && achData.hypotheses.length > 1 && (
                                    <span className="ml-1 text-green-400">*</span>
                                  )}
                                </th>
                              ))}
                              <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-2 border-b border-border min-w-[60px]">
                                Diagnostic
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {achData.evidence.map((ev, evIdx) => (
                              <tr key={ev.id} className={evIdx % 2 === 0 ? 'bg-muted/10' : ''}>
                                <td className="text-xs p-2 border-r border-border max-w-[250px]">
                                  <span className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] h-4 w-4 justify-center shrink-0 p-0 ${
                                        ev.isDiagnostic ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : ''
                                      }`}
                                    >
                                      {evIdx + 1}
                                    </Badge>
                                    <span className="truncate">{ev.text}</span>
                                  </span>
                                </td>
                                {achData.hypotheses.map((h) => {
                                  const cellKey = `${ev.id}-${h.id}`;
                                  const cellValue = achData.cells[cellKey] ?? '';
                                  return (
                                    <td key={h.id} className="text-center p-1.5 border-border">
                                      <button
                                        onClick={() => handleCellClick(ev.id, h.id)}
                                        className={`inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer hover:opacity-80 ${getCellColor(cellValue)}`}
                                        title={
                                          cellValue === '+'
                                            ? 'Consistent'
                                            : cellValue === '-'
                                            ? 'Inconsistent'
                                            : cellValue === '?'
                                            ? 'Insufficient data'
                                            : 'N/A - Click to set'
                                        }
                                      >
                                        {getCellIcon(cellValue)}
                                      </button>
                                    </td>
                                  );
                                })}
                                <td className="text-center p-2 border-l border-border">
                                  {ev.isDiagnostic ? (
                                    <AlertTriangle className="size-3.5 text-amber-400 mx-auto" />
                                  ) : (
                                    <Minus className="size-3.5 text-muted-foreground/30 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {/* Score row */}
                          <tfoot>
                            <tr className="border-t-2 border-border">
                              <td className="text-xs font-semibold p-2 border-r border-border text-muted-foreground">
                                Inconsistencies
                              </td>
                              {achData.hypotheses.map((h) => {
                                const incCount = getInconsistencyCount(h.id);
                                const conCount = getConsistencyCount(h.id);
                                const isMostLikely = achData.hypotheses.length > 1 && incCount === minInconsistency;
                                return (
                                  <td
                                    key={h.id}
                                    className={`text-center p-2 ${
                                      isMostLikely ? 'bg-green-500/10' : ''
                                    }`}
                                  >
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span
                                        className={`text-sm font-bold ${
                                          isMostLikely ? 'text-green-400' : incCount > 0 ? 'text-red-400' : 'text-muted-foreground'
                                        }`}
                                      >
                                        {incCount}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground">
                                        {conCount} con
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="p-2 border-l border-border" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Legend and conclusion */}
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="size-3 text-green-400" /> Consistent
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="size-3 text-red-400" /> Inconsistent
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="size-3 text-yellow-400" /> Insufficient Data
                          </span>
                          <span className="flex items-center gap-1">
                            <Minus className="size-3 opacity-40" /> N/A
                          </span>
                        </div>
                        {achData.hypotheses.length > 1 && (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/20">
                            <CheckCircle className="size-4 text-green-400 shrink-0" />
                            <p className="text-xs text-green-400">
                              <span className="font-semibold">Most likely hypothesis: </span>
                              {achData.hypotheses.find((h) => getInconsistencyCount(h.id) === minInconsistency)?.text ?? 'N/A'}
                              <span className="text-green-400/60 ml-1">
                                (fewest inconsistencies: {minInconsistency})
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* NATO STANAG 2511 Reference Card */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      NATO STANAG 2511 — Source Evaluation Reference
                    </h3>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[10px]">
                        <thead>
                          <tr>
                            <th className="p-1.5 border border-border text-muted-foreground font-medium text-left">
                              Reliability \ Credibility
                            </th>
                            {(['1', '2', '3', '4', '5', '6'] as SourceCredibility[]).map((c) => (
                              <th key={c} className="p-1.5 border border-border text-muted-foreground font-medium text-center">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(['A', 'B', 'C', 'D', 'E', 'F'] as SourceReliability[]).map((r) => (
                            <tr key={r}>
                              <td className="p-1.5 border border-border font-medium text-muted-foreground">
                                {r} — {RELIABILITY_LABELS[r]}
                              </td>
                              {(['1', '2', '3', '4', '5', '6'] as SourceCredibility[]).map((c) => (
                                <td
                                  key={c}
                                  className={`p-1.5 border border-border text-center ${getSourceRatingColor(r, c)}`}
                                >
                                  {r}{c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                      <p><span className="font-medium">Reliability (Row):</span> A = Completely Reliable → F = Cannot Judge</p>
                      <p><span className="font-medium">Credibility (Col):</span> 1 = Confirmed → 6 = Cannot Judge</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
