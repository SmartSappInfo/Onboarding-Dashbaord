'use client';

/**
 * @fileoverview Rep Performance Profile & Coaching Tab for Sales Performance & Intelligence 2.0.
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 8 and UI/UX Sections 42, 43 & 44:
 * - Rep Profile Header with 0-100 composite Performance Index.
 * - Mobile-first ranked horizontal bars for the 5 dimensions.
 * - Explainable "Why?" performance driver breakdown.
 * - Tactical coaching recommendation cards.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing with zero 'any'.
 * - Accessible touch targets >= 44px.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  HelpCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  ShieldCheck, 
  Compass,
  Loader2
} from 'lucide-react';
import type { LeaderboardRepSummary, PerformanceScorecard, WhyExplanation } from '@/lib/sales-performance/types';
import { getRepPerformanceDetailAction } from '@/app/actions/sales-performance-actions';

interface RepProfileTabProps {
  workspaceId: string;
  reps: LeaderboardRepSummary[];
  onOpenLedger: (repId: string) => void;
}

export function RepProfileTab({
  workspaceId,
  reps,
  onOpenLedger,
}: RepProfileTabProps) {
  const [selectedRepId, setSelectedRepId] = React.useState<string>(reps[0]?.userId || '');
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [scorecard, setScorecard] = React.useState<PerformanceScorecard | null>(reps[0]?.scorecard || null);
  const [whyExplanation, setWhyExplanation] = React.useState<WhyExplanation | null>(null);

  const selectedRep = React.useMemo(() => {
    return reps.find((r) => r.userId === selectedRepId) || reps[0];
  }, [reps, selectedRepId]);

  React.useEffect(() => {
    if (!selectedRepId || !workspaceId) return;

    let isCancelled = false;
    setIsLoadingDetail(true);

    getRepPerformanceDetailAction({ workspaceId, repId: selectedRepId })
      .then((res) => {
        if (!isCancelled && res.success && res.scorecard) {
          setScorecard(res.scorecard);
          setWhyExplanation(res.whyExplanation || null);
        }
      })
      .catch((err) => {
        console.error('[RepProfileTab] Failed to fetch details:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDetail(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedRepId, workspaceId]);

  if (!selectedRep) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
        No sales representatives available in the workspace.
      </div>
    );
  }

  const dimensionsList = scorecard
    ? [
        { key: 'activity', label: 'Activity (Volume)', score: scorecard.activityScore, color: 'bg-indigo-500' },
        { key: 'effort', label: 'Effort (Intentional Work)', score: scorecard.effortScore, color: 'bg-emerald-500' },
        { key: 'quality', label: 'Quality (Hygiene & Standards)', score: scorecard.qualityScore, color: 'bg-amber-500' },
        { key: 'effectiveness', label: 'Effectiveness (Conversion)', score: scorecard.effectivenessScore, color: 'bg-sky-500' },
        { key: 'outcome', label: 'Outcome (Won Deals & Pipeline)', score: scorecard.outcomeScore, color: 'bg-purple-500' },
      ].sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="space-y-6">
      {/* Rep Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/30 shadow-sm">
            <AvatarImage src={selectedRep.photoURL} />
            <AvatarFallback className="bg-primary/10 text-primary font-black">
              {selectedRep.userName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <h3 className="text-base font-black text-foreground">{selectedRep.userName}</h3>
            <p className="text-xs text-muted-foreground">{selectedRep.userEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger className="w-full sm:w-[220px] rounded-xl text-xs font-bold h-10">
              <SelectValue placeholder="Select executive" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {reps.map((r) => (
                <SelectItem key={r.userId} value={r.userId} className="text-xs font-semibold">
                  {r.userName} ({r.performanceIndex}/100)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => onOpenLedger(selectedRep.userId)}
            className="rounded-xl text-xs font-bold active:scale-[0.97] min-h-[44px] sm:min-h-[38px]"
          >
            <Activity className="h-3.5 w-3.5 mr-1.5 text-primary" /> View Audit Ledger
          </Button>
        </div>
      </div>

      {isLoadingDetail ? (
        <div className="py-16 text-center text-xs text-muted-foreground font-semibold flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading representative scorecard...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Multidimensional Dimensions Breakdown (7 Cols) */}
          <Card className="lg:col-span-7 rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/30 pb-4">
              <div>
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> 5-Dimension Performance Scorecard
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-factor breakdown separating volume, intentional effort, quality, response, and results.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Index</span>
                <div className="text-2xl font-black font-mono text-primary">
                  {scorecard?.compositeIndex || selectedRep.performanceIndex}
                  <span className="text-xs font-bold text-muted-foreground">/100</span>
                </div>
              </div>
            </div>

            {/* Ranked Horizontal Bars (Mobile-first pattern, UI Doc Section 43) */}
            <div className="space-y-4">
              {dimensionsList.map((dim) => (
                <div key={dim.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-foreground">{dim.label}</span>
                    <span className="font-mono font-black">{dim.score} / 100</span>
                  </div>
                  <Progress value={dim.score} className="h-2 rounded-full" />
                </div>
              ))}
            </div>

            {/* Operational Metrics Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/30">
              <div className="p-3 rounded-xl bg-muted/15 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Calls</span>
                <span className="text-lg font-black font-mono">{selectedRep.calls}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/15 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Meetings</span>
                <span className="text-lg font-black font-mono">{selectedRep.meetings}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/15 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Deals</span>
                <span className="text-lg font-black font-mono">{selectedRep.deals}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/15 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Tasks</span>
                <span className="text-lg font-black font-mono">{selectedRep.tasks}</span>
              </div>
            </div>
          </Card>

          {/* Right: Explainable "Why?" Drivers & Coaching (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* "Why?" Explanation Card */}
            <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-500" /> Score Drivers (&quot;Why?&quot;)
                </h4>
                <Badge variant="outline" className="text-[10px] font-bold">
                  Explainable
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {whyExplanation?.trendText || 'Performance is steady across measured operational standards.'}
              </p>

              {/* Drivers list */}
              <div className="space-y-2.5">
                {whyExplanation?.drivers && whyExplanation.drivers.length > 0 ? (
                  whyExplanation.drivers.map((driver, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border bg-muted/10 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 text-left">
                        <div className="flex items-center gap-1.5">
                          {driver.type === 'positive' ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-foreground">{driver.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">{driver.explanation}</p>
                      </div>
                      <Badge
                        className={
                          driver.type === 'positive'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-mono font-bold'
                        }
                      >
                        {driver.impactPercent > 0 ? `+${driver.impactPercent}%` : `${driver.impactPercent}%`}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    Driver factors within normal baseline parameters.
                  </p>
                )}
              </div>
            </Card>

            {/* Coaching Recommendation */}
            {whyExplanation?.aiRecommendation && (
              <Card className="rounded-2xl border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md p-5 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                  <Compass className="h-4 w-4" /> Tactical Coaching Suggestion
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  &ldquo;{whyExplanation.aiRecommendation}&rdquo;
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
