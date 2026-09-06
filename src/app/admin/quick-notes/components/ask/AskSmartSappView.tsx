'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Copy,
  Plus,
  ListPlus,
  Check,
  Loader2,
  ShieldCheck,
  FileText,
  Phone,
  Calendar,
  ListTodo,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { askSmartSappKnowledgeAction } from '@/lib/quick-notes-search-actions';
import { createTaskAction } from '@/lib/task-server-actions';
import { createQuickNoteAction } from '@/lib/quick-notes-actions';
import { toast } from '@/hooks/use-toast';
import type {
  AskKnowledgeResponse,
  RagEvidenceCitation,
  RagActionSuggestion,
  RagConfidence,
} from '@/lib/quick-notes-types';
import type { Task, TaskPriority } from '@/lib/types';

export interface AskSmartSappViewProps {
  workspaceId: string | null | undefined;
  userId: string | undefined;
  initialQuery?: string;
  entityId?: string;
  entityName?: string;
}

const PROMPT_SUGGESTIONS = [
  'What payment or fee concerns have schools raised recently?',
  'Which customers asked about automated WhatsApp reminders?',
  'What key commitments were made in recent client meetings?',
  'What recurring objections are delaying deal closures?',
  'Summarize recent customer feedback on our billing portal.',
];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  quick_note: <FileText className="h-3.5 w-3.5 text-blue-500" />,
  entity_note: <FileText className="h-3.5 w-3.5 text-emerald-500" />,
  call_note: <Phone className="h-3.5 w-3.5 text-violet-500" />,
  meeting: <Calendar className="h-3.5 w-3.5 text-amber-500" />,
  task_note: <ListTodo className="h-3.5 w-3.5 text-rose-500" />,
  activity: <Sparkles className="h-3.5 w-3.5 text-cyan-500" />,
};

export default function AskSmartSappView({
  workspaceId,
  userId,
  initialQuery = '',
  entityId,
  entityName,
}: AskSmartSappViewProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [loading, setLoading] = React.useState(false);
  const [thinkingStep, setThinkingStep] = React.useState<string>('');
  const [response, setResponse] = React.useState<AskKnowledgeResponse | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [convertedTasks, setConvertedTasks] = React.useState<Record<string, boolean>>({});
  const [savedNote, setSavedNote] = React.useState(false);
  const [showAllCitations, setShowAllCitations] = React.useState(false);

  const runQuery = async (queryToRun: string) => {
    const q = queryToRun.trim();
    if (!q || !workspaceId || !userId) return;

    setLoading(true);
    setResponse(null);
    setSavedNote(false);
    setThinkingStep('Searching authorized workspace knowledge...');

    const stepTimer1 = setTimeout(() => {
      setThinkingStep('Analyzing relationships, notes, and CRM records...');
    }, 1200);

    const stepTimer2 = setTimeout(() => {
      setThinkingStep('Synthesizing evidence and grounding citations...');
    }, 2400);

    try {
      const res = await askSmartSappKnowledgeAction({
        workspaceId,
        userId,
        query: q,
        entityId,
        entityName,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (res.success) {
        setResponse(res.data);
      } else {
        toast({
          title: 'Knowledge Query Failed',
          description: res.error || 'Could not synthesize answer. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Query Error',
        description: 'An unexpected network error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setThinkingStep('');
    }
  };

  const handleCopyAnswer = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied to clipboard',
      description: 'Knowledge answer copied successfully.',
    });
  };

  const handleConvertToTask = async (action: RagActionSuggestion, index: number) => {
    if (!workspaceId || !userId) return;
    try {
      const taskPayload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        workspaceId,
        title: action.title,
        description: action.rationale || `Generated from Company Brain query: "${query}"`,
        priority: action.priority as TaskPriority,
        status: 'todo',
        category: 'follow_up',
        assignedTo: userId,
        entityId: entityId ?? null,
        entityName: entityName ?? null,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        reminders: [],
        reminderSent: false,
      };
      const result = await createTaskAction(taskPayload, userId);

      if (result.success) {
        setConvertedTasks((prev) => ({ ...prev, [index]: true }));
        toast({
          title: 'Task Created',
          description: `"${action.title}" added to your Tasks.`,
          actionConfig: {
            path: '/admin/tasks',
            label: 'View Tasks',
          },
        });
      }
    } catch {
      toast({
        title: 'Task Creation Failed',
        description: 'Could not create task from recommendation.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAsNote = async () => {
    if (!workspaceId || !userId || !response) return;
    try {
      const result = await createQuickNoteAction(
        workspaceId,
        {
          title: `Brain Synthesis: ${query.slice(0, 50)}`,
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                text: response.answer,
              },
            ],
          },
          knowledgeType: 'insight',
          tags: ['company-brain', 'ai-synthesis'],
          links: {
            entityId,
            entityName,
          },
        },
        userId
      );

      if (result.success) {
        setSavedNote(true);
        toast({
          title: 'Note Saved',
          description: 'Synthesis saved to Company Brain.',
          actionConfig: {
            path: '/admin/quick-notes',
            label: 'View Notes',
          },
        });
      }
    } catch {
      toast({
        title: 'Save Failed',
        description: 'Could not save synthesis as note.',
        variant: 'destructive',
      });
    }
  };

  const getConfidenceBadge = (confidence: RagConfidence, score: number) => {
    if (confidence === 'high') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1.5 py-1 px-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          High Confidence ({score}%)
        </Badge>
      );
    }
    if (confidence === 'medium') {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1.5 py-1 px-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          Medium Confidence ({score}%)
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 gap-1.5 py-1 px-2.5">
        <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
        Low Confidence ({score}%)
      </Badge>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-serif font-semibold tracking-tight text-foreground">
              Ask SmartSapp Knowledge
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Natural language answers grounded in your authorized workspace notes, CRM interactions, and evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/quick-notes">
            <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-[36px]">
              Back to Brain Board
            </Button>
          </Link>
          <Link href="/admin/quick-notes/settings">
            <Button variant="ghost" size="sm" className="min-h-[44px] md:min-h-[36px] text-muted-foreground">
              Brain Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Omnibar Search Input */}
      <Card className="border-border/70 shadow-sm bg-card">
        <CardContent className="p-4 md:p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runQuery(query);
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything (e.g., What objections did parents raise this term?)..."
                aria-label="Ask your knowledge query"
                disabled={loading || !userId}
                className="pl-11 pr-4 text-base min-h-[48px] bg-background border-border/80 focus-visible:ring-violet-500"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !query.trim() || !userId}
              className="min-h-[48px] px-6 bg-violet-600 hover:bg-violet-700 text-white font-medium gap-2 shrink-0 active:scale-[0.98] transition-transform"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Ask Knowledge</span>
                </>
              )}
            </Button>
          </form>

          {/* Suggested Prompts */}
          {!response && !loading && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Suggested questions to explore:</p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion);
                      void runQuery(suggestion);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground border border-border/60 rounded-full px-3 py-1.5 transition-colors text-left min-h-[36px]"
                  >
                    <span>{suggestion}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Thinking Feedback */}
      {loading && (
        <Card className="border-border/60 bg-muted/30 animate-pulse">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 rounded-full bg-violet-500/10 text-violet-600 animate-spin">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-medium text-foreground">{thinkingStep}</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Extracting semantic chunks and ranking factual citations across your authorized workspace records.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Answer & Grounded Evidence Card */}
      {response && !loading && (
        <div className="space-y-6">
          <Card className="border-border/80 shadow-md bg-card overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Grounded Knowledge Answer
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Synthesized across {response.citations.length} workspace evidence sources
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {getConfidenceBadge(response.confidence, response.confidenceScore)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAnswer}
                  className="min-h-[36px] gap-1.5 text-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAsNote}
                  disabled={savedNote}
                  className="min-h-[36px] gap-1.5 text-xs"
                >
                  {savedNote ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5" />}
                  {savedNote ? 'Saved' : 'Save as Note'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Answer Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed text-base font-normal">
                {response.answer}
              </div>

              {/* Key Findings */}
              {response.keyFindings.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-600" />
                    Key Takeaways
                  </h4>
                  <ul className="space-y-1.5 text-sm text-foreground list-disc list-inside">
                    {response.keyFindings.map((finding, idx) => (
                      <li key={idx} className="leading-snug">
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Actions / 1-Click Task Converter */}
              {response.recommendedActions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ListPlus className="h-3.5 w-3.5 text-blue-600" />
                    Recommended Actions
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {response.recommendedActions.map((action, idx) => {
                      const isConverted = convertedTasks[idx];
                      return (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
                                {action.priority}
                              </Badge>
                              <span className="text-xs font-medium text-foreground leading-tight">
                                {action.title}
                              </span>
                            </div>
                            {action.rationale && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {action.rationale}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isConverted}
                            onClick={() => void handleConvertToTask(action, idx)}
                            className="shrink-0 h-8 text-xs min-w-[90px] gap-1 active:scale-95"
                          >
                            {isConverted ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Created</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                <span>Add Task</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Traceable Evidence & Citations Panel */}
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Evidence & Supporting Sources ({response.citations.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Original notes, transcripts, and records used to formulate this answer
                  </CardDescription>
                </div>

                {response.citations.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCitations(!showAllCitations)}
                    className="text-xs gap-1 h-8"
                  >
                    {showAllCitations ? 'Show Less' : `Show All (${response.citations.length})`}
                    {showAllCitations ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {response.citations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No specific citations were referenced.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(showAllCitations ? response.citations : response.citations.slice(0, 4)).map(
                    (citation: RagEvidenceCitation, idx: number) => {
                      const href = citation.originHref || '/admin/quick-notes';
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors space-y-2 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {SOURCE_ICONS[citation.sourceType] || <FileText className="h-3.5 w-3.5" />}
                                <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                                  {citation.title || 'Source record'}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {citation.timestamp ? new Date(citation.timestamp).toLocaleDateString() : 'Recent'}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground/90 italic line-clamp-3 bg-background/50 p-2 rounded border border-border/40">
                              "{citation.excerpt}"
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground border-t border-border/30">
                            <span>Author: {citation.authorName || 'Team Member'}</span>
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium"
                            >
                              <span>Open Record</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
