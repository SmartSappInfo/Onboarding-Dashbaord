'use client';

/**
 * SmartSapp Forms 2.0: Form Topic Clusters & Qualitative Synthesis Card
 * 
 * Collapsible executive intelligence component displaying cross-submission
 * sentiment distributions, clustered themes with sample quotes, executive summaries,
 * and strategic recommendations.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  MessageSquareQuote,
  ChevronDown,
  ChevronUp,
  Wand2,
  Loader2,
  RefreshCw,
  Quote,
  Zap,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getOrGenerateFormTopicClustersAction } from '@/lib/forms/form-intelligence-actions';
import type { Form } from '@/lib/types';
import type { FormAiTopicClusterSummary } from '@/lib/forms/form-intelligence-types';

interface FormTopicClustersCardProps {
  form: Form;
  totalSubmissions: number;
}

export default function FormTopicClustersCard({
  form,
  totalSubmissions,
}: FormTopicClustersCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<FormAiTopicClusterSummary | null>(null);

  // Auto-fetch cached intelligence on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCached() {
      try {
        const res = await getOrGenerateFormTopicClustersAction({
          formId: form.id,
          forceRefresh: false,
        });
        if (isMounted && res.success && res.clusters && res.clusters.totalSubmissionsAnalyzed > 0) {
          setSummary(res.clusters);
        }
      } catch {
        // Non-blocking background fetch failure
      }
    }
    loadCached();
    return () => {
      isMounted = false;
    };
  }, [form.id]);

  const handleSynthesize = async () => {
    setIsLoading(true);
    try {
      const res = await getOrGenerateFormTopicClustersAction({
        formId: form.id,
        forceRefresh: true,
      });

      if (res.success && res.clusters) {
        setSummary(res.clusters);
        setIsExpanded(true);
        toast({
          title: 'Synthesis Complete ✨',
          description: `Analyzed ${res.clusters.totalSubmissionsAnalyzed} submissions and extracted ${res.clusters.topThemes.length} topic clusters.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Synthesis Failed',
          description: res.error || 'Could not cluster qualitative responses.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const sentimentDist = summary?.sentimentDistribution;

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/15 via-background to-background shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex items-center gap-3 cursor-pointer select-none group flex-1"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                AI Qualitative Research & Topic Clusters
              </h3>
              {summary && summary.totalSubmissionsAnalyzed > 0 ? (
                <Badge variant="outline" className="text-[10px] font-bold bg-background text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                  {summary.totalSubmissionsAnalyzed} Responses Analyzed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Ready to Synthesize
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Automated sentiment analysis, customer pain points, and thematic clustering across all submissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleSynthesize}
            disabled={isLoading || totalSubmissions === 0}
            size="sm"
            className="rounded-xl h-9 font-bold text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-primary text-white shadow-sm active:scale-95 min-h-[36px]"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {summary ? 'Re-Synthesize' : 'Synthesize Insights'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(prev => !prev)}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded Intelligence Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-indigo-500/20 p-5 space-y-5 bg-background/50"
          >
            {summary && summary.totalSubmissionsAnalyzed > 0 ? (
              <>
                {/* ── Row 1: Sentiment Distribution Strip ── */}
                {sentimentDist && (
                  <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        Overall Sentiment Distribution
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        Mean Score: <span className={sentimentDist.averageSentimentScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {sentimentDist.averageSentimentScore >= 0 ? '+' : ''}{sentimentDist.averageSentimentScore.toFixed(2)}
                        </span>
                      </span>
                    </div>

                    {/* Proportional Segment Bar */}
                    <div className="h-3 rounded-full overflow-hidden flex bg-muted/40 border border-border/40">
                      <div
                        style={{ width: `${sentimentDist.positivePercentage}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`Positive: ${sentimentDist.positivePercentage}%`}
                      />
                      <div
                        style={{ width: `${sentimentDist.neutralPercentage}%` }}
                        className="bg-amber-400 h-full transition-all"
                        title={`Neutral: ${sentimentDist.neutralPercentage}%`}
                      />
                      <div
                        style={{ width: `${sentimentDist.negativePercentage}%` }}
                        className="bg-rose-500 h-full transition-all"
                        title={`Negative: ${sentimentDist.negativePercentage}%`}
                      />
                    </div>

                    {/* Legend Labels */}
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Positive ({sentimentDist.positivePercentage}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Neutral ({sentimentDist.neutralPercentage}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        Negative ({sentimentDist.negativePercentage}%)
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Row 2: Executive Cross-Submission Summary ── */}
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Executive Research Synthesis
                  </p>
                  <p className="text-xs text-foreground font-medium leading-relaxed">
                    {summary.executiveSummary}
                  </p>
                </div>

                {/* ── Row 3: Clustered Thematic Topics ── */}
                {summary.topThemes && summary.topThemes.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
                      Identified Topic & Pain Point Clusters ({summary.topThemes.length})
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {summary.topThemes.map((theme) => (
                        <div
                          key={theme.id}
                          className="p-4 rounded-2xl bg-card border border-border/60 space-y-2.5 shadow-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-foreground line-clamp-1">{theme.topic}</h4>
                              <Badge variant="outline" className="text-[9px] font-bold bg-muted/40 shrink-0">
                                {theme.percentageShare}% share
                              </Badge>
                            </div>
                            {theme.painPointSummary && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {theme.painPointSummary}
                              </p>
                            )}
                          </div>

                          {/* Sample Quotes */}
                          {theme.sampleQuotes && theme.sampleQuotes.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-[10px] text-muted-foreground/90 italic flex items-start gap-1.5">
                              <Quote className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
                              <span>&ldquo;{theme.sampleQuotes[0]}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Row 4: Strategic Takeaways ── */}
                {summary.actionableRecommendations && summary.actionableRecommendations.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" /> Actionable Recommendations
                    </span>
                    <ul className="space-y-1.5 text-xs text-foreground/90 font-medium">
                      {summary.actionableRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Zap className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center space-y-3">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-semibold text-foreground">No Qualitative Synthesis Generated Yet</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Click &ldquo;Synthesize Insights&rdquo; to analyze your {totalSubmissions} submissions and generate topic clusters.
                </p>
                <Button
                  onClick={handleSynthesize}
                  disabled={isLoading || totalSubmissions === 0}
                  className="rounded-xl h-9 text-xs font-bold gap-1.5"
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Synthesize Insights Now
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
