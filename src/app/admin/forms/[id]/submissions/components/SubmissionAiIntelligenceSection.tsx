'use client';

/**
 * SmartSapp Forms 2.0: Response Center Submission AI Intelligence Section
 * 
 * Embedded in the respondent profile drawer to display real-time
 * sentiment scoring, intent classification, executive summary,
 * extracted topics, and 1-click recommended action triggers.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Wand2,
  Loader2,
  Tag,
  ArrowRight,
  Flame,
  ShieldAlert,
  Quote,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { classifySubmissionAction, executeRecommendedAction } from '@/lib/forms/form-intelligence-actions';
import type { Form, FormSubmission } from '@/lib/types';
import type { FormSubmissionAiClassification, RecommendedAction } from '@/lib/forms/form-intelligence-types';

interface SubmissionAiIntelligenceSectionProps {
  submission: FormSubmission;
  form: Form;
  userId?: string;
  onClassificationUpdated?: (classification: FormSubmissionAiClassification) => void;
}

export default function SubmissionAiIntelligenceSection({
  submission,
  form,
  userId = 'system_user',
  onClassificationUpdated,
}: SubmissionAiIntelligenceSectionProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [executedActionIds, setExecutedActionIds] = useState<Set<string>>(new Set());

  const classification = submission.aiClassification;

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await classifySubmissionAction({
        formId: form.id,
        submissionId: submission.id,
      });

      if (res.success && res.classification) {
        toast({
          title: 'AI Classification Complete ✨',
          description: `Sentiment: ${res.classification.sentiment} (${res.classification.intent})`,
        });
        if (onClassificationUpdated) {
          onClassificationUpdated(res.classification);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Classification Failed',
          description: res.error || 'Could not analyze submission responses.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteAction = async (action: RecommendedAction) => {
    setExecutingActionId(action.id);
    try {
      const res = await executeRecommendedAction({
        formId: form.id,
        submissionId: submission.id,
        action,
        userId,
      });

      if (res.success) {
        toast({ title: 'Action Executed', description: res.message });
        setExecutedActionIds(prev => new Set(prev).add(action.id));
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setExecutingActionId(null);
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">Positive Sentiment</Badge>;
      case 'negative':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold">Negative / Critical</Badge>;
      default:
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">Neutral</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] font-bold">Urgency: High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">Urgency: Med</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground text-[10px] font-bold">Urgency: Low</Badge>;
    }
  };

  if (!classification) {
    return (
      <div className="rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4 flex flex-col items-center justify-center text-center space-y-2.5">
        <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-foreground">AI Response Intelligence</p>
          <p className="text-[10px] text-muted-foreground max-w-xs">
            Generate instant sentiment score, classified intent, key topics, and recommended actions.
          </p>
        </div>
        <Button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          size="sm"
          className="rounded-xl h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-indigo-600 to-primary text-white shadow-sm active:scale-95"
        >
          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Analyze with AI
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-950/15 via-background to-background border border-indigo-500/20 shadow-sm">
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {getSentimentBadge(classification.sentiment)}
          {getUrgencyBadge(classification.urgency)}
          <Badge variant="outline" className="text-[10px] font-bold bg-background">
            Score: {classification.leadQualityScore}/100
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground gap-1"
        >
          {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 text-indigo-500" />}
          Re-Analyze
        </Button>
      </div>

      {/* Classified Intent */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Intent:</span>
        <span className="text-xs font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
          {classification.intent}
        </span>
      </div>

      {/* Executive Summary */}
      <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-indigo-500" />
          Executive Summary
        </p>
        <p className="text-xs text-foreground/90 font-medium leading-relaxed">
          {classification.summary}
        </p>
      </div>

      {/* Extracted Topics */}
      {classification.topics && classification.topics.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Identified Topics & Themes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {classification.topics.map((t, idx) => (
              <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/50">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Quotes */}
      {classification.keyQuotes && classification.keyQuotes.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Quote className="h-3 w-3" /> Key Respondent Quote
          </p>
          <p className="text-[11px] text-muted-foreground italic">
            &ldquo;{classification.keyQuotes[0]}&rdquo;
          </p>
        </div>
      )}

      {/* Recommended Actions */}
      {classification.recommendedActions && classification.recommendedActions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Recommended Next Actions
          </span>
          <div className="space-y-1.5">
            {classification.recommendedActions.map((act) => {
              const isExecuted = executedActionIds.has(act.id);
              const isExecuting = executingActionId === act.id;
              return (
                <div
                  key={act.id}
                  className="p-2.5 rounded-xl bg-card border border-border/60 flex items-center justify-between gap-2 shadow-xs"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{act.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{act.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isExecuted ? 'secondary' : 'default'}
                    onClick={() => handleExecuteAction(act)}
                    disabled={isExecuted || isExecuting}
                    className="rounded-lg h-7 px-2.5 text-[10px] font-bold gap-1 shrink-0 active:scale-95"
                  >
                    {isExecuting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isExecuted ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Done
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-3 w-3" /> Run
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
