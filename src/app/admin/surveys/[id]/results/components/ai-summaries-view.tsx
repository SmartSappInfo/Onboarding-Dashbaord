'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Evidence-Backed Natural Language Research Assistant View
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Evidence-Backed Query Interface:
 *    - Answers user questions with verbatim quote citations, response IDs, confidence scores, and metric chips.
 * 2. Mobile-Optimized & Tactile:
 *    - Standard min-h-[44px] touch targets, active:scale-[0.97] press states.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser } from '@/firebase';
import type { Survey, SurveyResponse, SurveySummary } from '@/lib/types';
import { doc, deleteDoc } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';
import { querySurveyResearchAssistantAction } from '@/lib/surveys/survey-ai-intelligence-actions';
import type { SurveyResearchAssistantOutput } from '@/ai/schemas/survey-intelligence-schemas';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Sparkles,
  MoreVertical,
  Copy,
  Trash2,
  Send,
  HelpCircle,
  Quote,
  TrendingUp,
  Zap,
} from 'lucide-react';

const formSchema = z.object({
  prompt: z.string().min(5, { message: 'Please enter a research inquiry of at least 5 characters.' }),
});

type FormData = z.infer<typeof formSchema>;

const SUGGESTED_PROMPTS = [
  'What are the top 3 parent concerns?',
  'Summarize primary satisfaction drivers across channels',
  'What are the most urgent operational pain points?',
  'What actionable recommendations should leadership prioritize?',
];

export interface AISummariesViewProps {
  survey: Survey;
  responses: SurveyResponse[];
  summaries?: SurveySummary[];
  areSummariesLoading?: boolean;
}

export default function AISummariesView({
  survey,
  responses,
  summaries = [],
  areSummariesLoading = false,
}: AISummariesViewProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId } = useWorkspace();
  const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();

  const [isQuerying, setIsQuerying] = React.useState(false);
  const [summaryToDelete, setSummaryToDelete] = React.useState<SurveySummary | null>(null);
  const [latestResearchResult, setLatestResearchResult] = React.useState<SurveyResearchAssistantOutput | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!survey.id) {
      toast({ variant: 'destructive', title: 'Survey ID is missing' });
      return;
    }
    const workspaceId = survey.workspaceIds?.[0] || activeOrganizationId || 'default';
    setIsQuerying(true);
    try {
      const result = await querySurveyResearchAssistantAction(
        survey.id,
        workspaceId,
        data.prompt,
        { provider: liveProvider, modelId: liveModelId }
      );

      if (result.success && result.data) {
        setLatestResearchResult(result.data);
        form.reset();
        toast({
          title: 'Evidence Synthesized',
          description: `Generated findings backed by ${result.data.evidenceCitations.length} cited verbatims.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Query Failed',
          description: result.error || 'Failed to process inquiry',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !summaryToDelete) return;
    try {
      await deleteDoc(doc(firestore, `surveys/${survey.id}/summaries`, summaryToDelete.id));
      toast({ title: 'Analysis Deleted' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to Delete',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSummaryToDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    // Strip HTML tags for clean clipboard copy
    const cleanText = text.replace(/<[^>]*>?/gm, '');
    navigator.clipboard.writeText(cleanText);
    toast({ title: 'Copied to Clipboard' });
  };

  return (
    <div className="space-y-6">
      {/* Research Assistant Input Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Natural Language Research Assistant</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ask analytical questions over survey responses and receive evidence-backed answers citing exact response IDs.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Suggested Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Suggested Research Questions:
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => form.setValue('prompt', prompt)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-medium text-foreground transition-all active:scale-[0.97] text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Compare satisfaction between day students and boarders regarding cafeteria food, and highlight top complaints..."
                        className="min-h-[90px] rounded-xl resize-none text-xs leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isQuerying || responses.length === 0}
                  className="h-10 px-5 gap-2 font-semibold active:scale-[0.97]"
                >
                  {isQuerying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Synthesizing Evidence...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Ask Research Assistant
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Latest Evidence-Backed Research Result */}
      {latestResearchResult && (
        <Card className="rounded-2xl border-primary/30 bg-primary/[0.02] shadow-sm space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-mono text-xs font-bold gap-1">
                <Zap className="h-3 w-3" />
                Latest Research Synthesis
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {latestResearchResult.confidenceScore}% Confidence ({latestResearchResult.sampleSizeAnalyzed} responses)
              </Badge>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(latestResearchResult.answerHtml)}
              className="h-8 gap-1.5 text-xs active:scale-[0.97]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Answer
            </Button>
          </div>

          {/* Key Metric Chips */}
          {latestResearchResult.keyMetrics && latestResearchResult.keyMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {latestResearchResult.keyMetrics.map((met, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-card border border-border text-xs space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    {met.label}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-extrabold font-mono text-foreground text-sm">{met.value}</span>
                    {met.comparison && <span className="text-[10px] text-muted-foreground">{met.comparison}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Answer HTML */}
          <div
            className="prose dark:prose-invert prose-xs max-w-none text-xs leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(latestResearchResult.answerHtml, { USE_PROFILES: { html: true } }),
            }}
          />

          {/* Evidence Citations */}
          {latestResearchResult.evidenceCitations && latestResearchResult.evidenceCitations.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5 text-primary" />
                Evidence Citations & Verbatim Backing ({latestResearchResult.evidenceCitations.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {latestResearchResult.evidenceCitations.map((cit, cIdx) => (
                  <div key={cIdx} className="p-3 rounded-xl bg-card border border-border/80 text-xs space-y-1">
                    <p className="italic text-foreground">&ldquo;{cit.evidenceText}&rdquo;</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Ref: {cit.responseId.slice(0, 10)}...</span>
                      <span>{cit.questionTitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Follow-Ups */}
          {latestResearchResult.suggestedFollowUpQuestions && latestResearchResult.suggestedFollowUpQuestions.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                Suggested Next Research Inquiries:
              </span>
              <div className="flex flex-wrap gap-2">
                {latestResearchResult.suggestedFollowUpQuestions.map((q, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => form.setValue('prompt', q)}
                    className="px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-medium transition-all active:scale-[0.97] text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Historical Analyses List */}
      <div className="space-y-4">
        <h4 className="font-bold text-sm text-foreground">Saved Analytical Syntheses ({summaries.length})</h4>

        {areSummariesLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : summaries.length === 0 ? (
          <Card className="rounded-2xl border-dashed border p-6 text-center text-xs text-muted-foreground">
            No previous analyses recorded. Ask your first research question above!
          </Card>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <Card key={summary.id} className="rounded-2xl border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-bold text-foreground">
                        {summary.prompt || 'Executive Summary'}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-mono text-muted-foreground">
                        {summary.createdAt ? format(new Date(summary.createdAt), 'PPP p') : 'Unknown date'}
                      </CardDescription>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 active:scale-[0.97]">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyToClipboard(summary.summary)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Copy Text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSummaryToDelete(summary)}
                          className="text-rose-600 focus:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div
                    className="prose dark:prose-invert prose-xs max-w-none text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(summary.summary, { USE_PROFILES: { html: true } }),
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!summaryToDelete} onOpenChange={(open) => !open && setSummaryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This action cannot be undone. This research summary will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
