'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Pre-Publish AI Survey Quality Auditor Drawer
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Pre-Launch Psychometric & Structural Audit:
 *    - Runs auditSurveyQualityAction to analyze survey elements for bias, clarity, fatigue, and flow.
 *    - Provides one-click in-place application of improvements via applySurveyAiOptimizationAction.
 * 2. Mobile-Optimized & Accessible:
 *    - Standard min-h-[44px] touch targets and active:scale-[0.97] tactile press feedback.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyQuestion } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ThumbsUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { auditSurveyQualityAction, applySurveyAiOptimizationAction } from '@/lib/surveys/survey-ai-intelligence-actions';
import type { SurveyQualityAuditOutput, QuestionAuditSuggestion } from '@/ai/schemas/survey-intelligence-schemas';

export interface SurveyQualityAuditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: Survey;
  workspaceId: string;
  onQuestionUpdated?: (questionId: string, updated: Partial<SurveyQuestion>) => void;
}

export function SurveyQualityAuditorDrawer({
  open,
  onOpenChange,
  survey,
  workspaceId,
  onQuestionUpdated,
}: SurveyQualityAuditorDrawerProps) {
  const { toast } = useToast();
  const { provider, modelId } = useLiveAiModel();

  const [isLoading, setIsLoading] = React.useState(false);
  const [auditData, setAuditData] = React.useState<SurveyQualityAuditOutput | null>(null);
  const [applyingQuestionId, setApplyingQuestionId] = React.useState<string | null>(null);
  const [appliedQuestionIds, setAppliedQuestionIds] = React.useState<Set<string>>(new Set());

  const runAudit = React.useCallback(async () => {
    if (!survey.id || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await auditSurveyQualityAction(survey.id, workspaceId, {
        provider,
        modelId,
        draftElements: (survey.elements || []) as unknown as Record<string, unknown>[],
        draftTitle: survey.title,
        draftDescription: survey.description,
      });
      if (res.success && res.data) {
        setAuditData(res.data);
        toast({
          title: 'Survey Audit Complete',
          description: `Calculated Quality Index: ${res.data.overallScore}/100 (Grade: ${res.data.grade})`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Audit Failed',
          description: res.error || 'Failed to complete survey audit',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  }, [survey.id, workspaceId, provider, modelId, toast]);

  // Run audit when drawer opens if no audit exists yet
  React.useEffect(() => {
    if (open && !auditData && !isLoading) {
      runAudit();
    }
  }, [open, auditData, isLoading, runAudit]);

  const handleApplySuggestion = async (suggestion: QuestionAuditSuggestion) => {
    if (!survey.id || !workspaceId) return;
    setApplyingQuestionId(suggestion.questionId);
    try {
      const res = await applySurveyAiOptimizationAction(
        survey.id,
        workspaceId,
        suggestion.questionId,
        suggestion.improvedTitle,
        suggestion.improvedDescription,
        suggestion.improvedOptions
      );

      if (res.success) {
        setAppliedQuestionIds((prev) => new Set([...prev, suggestion.questionId]));
        if (onQuestionUpdated) {
          onQuestionUpdated(suggestion.questionId, {
            title: suggestion.improvedTitle,
            description: suggestion.improvedDescription,
            options: suggestion.improvedOptions,
          });
        }
        toast({
          title: 'Question Optimized',
          description: 'Survey blueprint updated with recommended wording.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Apply',
          description: res.error || 'Could not update question',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply optimization',
      });
    } finally {
      setApplyingQuestionId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getGradeBadgeVariant = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (grade === 'B') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (grade === 'C') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">AI Survey Quality Auditor</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Psychometric analysis, bias detection, and mobile fatigue optimization.
                </SheetDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={runAudit}
              disabled={isLoading}
              className="h-8 gap-1.5 active:scale-[0.97]"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Re-Audit
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Evaluating Survey Architecture...</p>
                <p className="text-xs text-muted-foreground">
                  Checking psychometric neutrality, cognitive load, and mobile completion friction.
                </p>
              </div>
            </div>
          ) : auditData ? (
            <div className="space-y-6">
              {/* Scorecard Banner */}
              <div className="p-5 rounded-2xl border border-border/80 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Survey Quality Index
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-extrabold font-mono ${getScoreColor(auditData.overallScore)}`}>
                        {auditData.overallScore}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">/ 100</span>
                      <Badge variant="outline" className={`font-mono text-xs font-bold ${getGradeBadgeVariant(auditData.grade)}`}>
                        Grade {auditData.grade}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Est. Completion:</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground">
                      ~{auditData.estimatedCompletionMinutes} mins
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                  {auditData.executiveSummary}
                </p>

                {/* 4 Dimension Sub-Scores */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Clarity & Readability</span>
                      <span className="font-bold font-mono">{auditData.clarityScore}%</span>
                    </div>
                    <Progress value={auditData.clarityScore} className="h-1.5" />
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Neutrality & Bias Guard</span>
                      <span className="font-bold font-mono">{auditData.neutralityScore}%</span>
                    </div>
                    <Progress value={auditData.neutralityScore} className="h-1.5" />
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Fatigue & Brevity</span>
                      <span className="font-bold font-mono">{auditData.fatigueRiskScore}%</span>
                    </div>
                    <Progress value={auditData.fatigueRiskScore} className="h-1.5" />
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Flow & Logic Coherence</span>
                      <span className="font-bold font-mono">{auditData.flowCoherenceScore}%</span>
                    </div>
                    <Progress value={auditData.flowCoherenceScore} className="h-1.5" />
                  </div>
                </div>
              </div>

              {/* Strengths */}
              {auditData.strengths.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                    Key Architectural Strengths
                  </span>
                  <div className="space-y-1.5">
                    {auditData.strengths.map((str, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-foreground bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/10">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question Suggestions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Actionable Question Optimizations ({auditData.suggestions.length})
                  </span>
                </div>

                {auditData.suggestions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center text-xs text-emerald-600 font-medium">
                    No psychometric issues detected. All questions are balanced and ready for publication!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditData.suggestions.map((sug) => {
                      const isApplied = appliedQuestionIds.has(sug.questionId);
                      const isApplying = applyingQuestionId === sug.questionId;

                      return (
                        <Card key={sug.questionId} className="rounded-xl border-border/80 bg-card overflow-hidden">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">
                                {sug.issueType.replace(/_/g, ' ')}
                              </Badge>
                              {isApplied && (
                                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Applied
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground">{sug.issueDescription}</p>

                            <div className="space-y-2 text-xs border-t border-border/50 pt-2.5">
                              <div>
                                <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider block">
                                  Current Question:
                                </span>
                                <p className="text-foreground line-through opacity-70">{sug.currentTitle}</p>
                              </div>

                              <div>
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                  Recommended Phrasing:
                                </span>
                                <p className="text-foreground font-medium">{sug.improvedTitle}</p>
                              </div>

                              {sug.improvedDescription && (
                                <p className="text-[11px] text-muted-foreground italic">
                                  Helper: &ldquo;{sug.improvedDescription}&rdquo;
                                </p>
                              )}

                              {sug.improvedOptions && sug.improvedOptions.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {sug.improvedOptions.map((opt, oIdx) => (
                                    <span key={oIdx} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="pt-1 flex justify-end">
                              <Button
                                size="sm"
                                variant={isApplied ? "outline" : "default"}
                                onClick={() => handleApplySuggestion(sug)}
                                disabled={isApplied || isApplying}
                                className="h-8 gap-1.5 text-xs font-semibold active:scale-[0.97]"
                              >
                                {isApplying ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Applying...
                                  </>
                                ) : isApplied ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    Applied to Survey
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3.5 w-3.5" />
                                    Apply Optimization
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="p-4 border-t border-border bg-card sticky bottom-0">
          <Button
            variant="outline"
            className="w-full h-10 font-semibold active:scale-[0.97]"
            onClick={() => onOpenChange(false)}
          >
            Close Auditor
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
