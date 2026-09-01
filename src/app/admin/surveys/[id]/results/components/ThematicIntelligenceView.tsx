'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Sentiment & Thematic Intelligence View
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Qualitative & Anomaly Discovery:
 *    - Ingests cached insights from Firestore surveys/{surveyId}/ai_insights/latest
 *    - Allows on-demand generation via generateSurveyThematicInsightsAction.
 * 2. Evidence-Backed Quotes:
 *    - Shows verbatim citations with response IDs.
 * 3. Mobile-Optimized (min-h-[44px], active:scale-[0.97]).
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Loader2,
  Smile,
  Meh,
  Frown,
  AlertOctagon,
  Quote,
  TrendingUp,
  TrendingDown,
  Tag,
  ShieldAlert,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { generateSurveyThematicInsightsAction } from '@/lib/surveys/survey-ai-intelligence-actions';
import type {
  SurveySentimentThemeOutput,
  SurveyAnomalyDetectionOutput,
} from '@/ai/schemas/survey-intelligence-schemas';

interface CachedAiInsights {
  updatedAt: string;
  sentimentThemes?: SurveySentimentThemeOutput | null;
  anomalies?: SurveyAnomalyDetectionOutput;
  analyzedResponsesCount: number;
}

export interface ThematicIntelligenceViewProps {
  survey: Survey;
  responses: SurveyResponse[];
  workspaceId: string;
}

export function ThematicIntelligenceView({
  survey,
  responses,
  workspaceId,
}: ThematicIntelligenceViewProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { provider, modelId } = useLiveAiModel();

  const [isGenerating, setIsGenerating] = React.useState(false);

  const insightsDocRef = useMemoFirebase(() => {
    if (!firestore || !survey.id) return null;
    return doc(firestore, 'surveys', survey.id, 'ai_insights', 'latest');
  }, [firestore, survey.id]);

  const { data: cachedInsights, isLoading: isCacheLoading } = useDoc<CachedAiInsights>(insightsDocRef);

  const sentimentData = cachedInsights?.sentimentThemes;
  const anomalyData = cachedInsights?.anomalies;

  const handleGenerate = async () => {
    if (!survey.id || !workspaceId) return;
    setIsGenerating(true);
    try {
      const res = await generateSurveyThematicInsightsAction(survey.id, workspaceId, { provider, modelId });
      if (res.success) {
        toast({
          title: 'Thematic Synthesis Complete',
          description: 'Discovered sentiment clusters, verbatims, and anomaly signals.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: res.error || 'Failed to synthesize qualitative feedback',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">AI Thematic & Sentiment Discovery</h3>
            <p className="text-xs text-muted-foreground">
              Latent topic clustering, sentiment polarity, and statistical anomaly detection.
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || responses.length === 0}
          className="h-10 gap-2 font-semibold active:scale-[0.97] w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Synthesizing Verbatims...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {sentimentData ? 'Re-Synthesize Insights' : 'Generate AI Insights'}
            </>
          )}
        </Button>
      </div>

      {isCacheLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground">Loading AI intelligence models...</p>
        </div>
      ) : !sentimentData && !anomalyData ? (
        <Card className="rounded-2xl border-dashed border-2 border-border p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="font-bold text-base text-foreground">No AI Insights Synthesized Yet</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Click &ldquo;Generate AI Insights&rdquo; above to run sentiment analysis, cluster qualitative verbatims, and audit data for statistical anomalies.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. Sentiment Polarity Overview */}
          {sentimentData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-border bg-card p-5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Net Sentiment Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-primary">
                    {sentimentData.overallSentiment.netSentimentScore > 0 ? '+' : ''}
                    {sentimentData.overallSentiment.netSentimentScore}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">(-100 to +100)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  % Positive minus % Negative qualitative sentiment
                </p>
              </Card>

              <Card className="rounded-2xl border-border bg-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Positive Sentiment
                  </span>
                  <Smile className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-3xl font-extrabold font-mono text-emerald-600">
                  {sentimentData.overallSentiment.positivePercentage}%
                </span>
                <Progress value={sentimentData.overallSentiment.positivePercentage} className="h-1.5" />
              </Card>

              <Card className="rounded-2xl border-border bg-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Neutral / Mixed
                  </span>
                  <Meh className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-3xl font-extrabold font-mono text-blue-600">
                  {sentimentData.overallSentiment.neutralPercentage + sentimentData.overallSentiment.mixedPercentage}%
                </span>
                <Progress
                  value={sentimentData.overallSentiment.neutralPercentage + sentimentData.overallSentiment.mixedPercentage}
                  className="h-1.5"
                />
              </Card>

              <Card className="rounded-2xl border-border bg-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                    Negative Sentiment
                  </span>
                  <Frown className="h-4 w-4 text-rose-500" />
                </div>
                <span className="text-3xl font-extrabold font-mono text-rose-600">
                  {sentimentData.overallSentiment.negativePercentage}%
                </span>
                <Progress value={sentimentData.overallSentiment.negativePercentage} className="h-1.5" />
              </Card>
            </div>
          )}

          {/* 2. Executive Narrative */}
          {sentimentData?.executiveNarrative && (
            <Card className="rounded-2xl border-border bg-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Quote className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Executive Qualitative Summary</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                {sentimentData.executiveNarrative}
              </p>
            </Card>
          )}

          {/* 3. Thematic Clusters with Verbatim Quotes */}
          {sentimentData?.themes && sentimentData.themes.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Discovered Thematic Clusters ({sentimentData.themes.length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sentimentData.themes.map((theme) => (
                  <Card key={theme.themeId} className="rounded-2xl border-border bg-card overflow-hidden">
                    <CardHeader className="pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">{theme.title}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono font-bold ${
                            theme.sentimentPolarity === 'mostly_positive'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : theme.sentimentPolarity === 'mostly_negative'
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          }`}
                        >
                          {theme.sentimentPolarity.replace(/_/g, ' ')} ({theme.prevalencePercentage}%)
                        </Badge>
                      </div>
                      <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                        {theme.description}
                      </CardDescription>

                      {/* Keywords */}
                      {theme.keywords && theme.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {theme.keywords.map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-mono">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    {/* Verbatim Citations */}
                    {theme.supportingCitations && theme.supportingCitations.length > 0 && (
                      <CardContent className="pt-0 space-y-2 border-t border-border/50 p-4 bg-muted/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Representative Respondent Verbatims:
                        </span>
                        <div className="space-y-2">
                          {theme.supportingCitations.map((cit, cIdx) => (
                            <div key={cIdx} className="p-2.5 rounded-xl bg-card border border-border/60 text-xs space-y-1">
                              <p className="italic text-foreground">&ldquo;{cit.quote}&rdquo;</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                <span>Ref: {cit.responseId.slice(0, 10)}...</span>
                                {cit.respondentContext && <span>{cit.respondentContext}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 4. Anomaly & Outlier Alerts */}
          {anomalyData?.anomalies && anomalyData.anomalies.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Detected Statistical Anomalies ({anomalyData.anomalies.length})
              </h4>

              <div className="space-y-3">
                {anomalyData.anomalies.map((anom) => (
                  <Card key={anom.anomalyId} className="rounded-xl border-border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] uppercase font-mono font-bold ${getSeverityBadge(anom.severity)}`}>
                            {anom.severity} severity
                          </Badge>
                          <span className="font-bold text-xs text-foreground">{anom.title}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                        {anom.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{anom.description}</p>

                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary font-medium flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 shrink-0" />
                      <span>Recommended Action: {anom.recommendedAction}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
