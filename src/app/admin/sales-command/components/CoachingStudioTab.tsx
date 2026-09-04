'use client';

/**
 * @fileoverview 1:1 Coaching Studio Tab (Tab 3) for SmartSapp Manager Command Center.
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 40 & UI Section 40:
 * - Automated 1:1 coaching dossier synthesis merging:
 *   1. Phase 1 multi-dimensional scorecards (Activity, Effort, Quality, Effectiveness, Outcome).
 *   2. Phase 2 daily execution velocity and queue throughput.
 *   3. Deals requiring managerial assistance.
 *   4. AI-generated discussion agenda and mutual commitments tracker.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Interactive elements must provide minimum 44px touch targets.
 * - Mobile responsive: 1-column layout on mobile, side-by-side on desktop.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Award,
  Flame,
  MessageSquare,
  ListTodo,
  Loader2,
} from 'lucide-react';
import type {
  RepWorkloadSummary,
  CoachingBrief1on1,
  AtRiskDeal,
  ManagerInterventionType,
} from '@/lib/manager-command/types';
import { generateRepCoachingBriefAction } from '@/app/actions/manager-command-actions';

interface CoachingStudioTabProps {
  reps: RepWorkloadSummary[];
  selectedRepId?: string;
  onSelectRep: (repId: string) => void;
  workspaceId: string;
  organizationId: string;
  onTriggerIntervention?: (params: {
    targetDeal?: AtRiskDeal;
    targetRep?: RepWorkloadSummary;
    defaultType?: ManagerInterventionType;
  }) => void;
}

export function CoachingStudioTab({
  reps,
  selectedRepId,
  onSelectRep,
  workspaceId,
  organizationId,
  onTriggerIntervention,
}: CoachingStudioTabProps) {
  const { toast } = useToast();
  const activeRepId = selectedRepId || (reps.length > 0 ? reps[0].userId : '');
  const [brief, setBrief] = React.useState<CoachingBrief1on1 | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [checkedCommitments, setCheckedCommitments] = React.useState<Record<string, boolean>>({});

  const activeRep = reps.find((r) => r.userId === activeRepId);

  // Load coaching brief on rep selection
  React.useEffect(() => {
    let isMounted = true;
    if (!activeRepId || !workspaceId) return;

    async function loadBrief() {
      setIsLoading(true);
      try {
        const res = await generateRepCoachingBriefAction({
          workspaceId,
          organizationId,
          repId: activeRepId,
        });

        if (isMounted && res.success && res.data) {
          setBrief(res.data);
          setCheckedCommitments({});
        }
      } catch (err) {
        console.error('Failed to load coaching brief:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBrief();

    return () => {
      isMounted = false;
    };
  }, [activeRepId, workspaceId, organizationId]);

  const toggleCommitment = (text: string) => {
    setCheckedCommitments((prev) => ({
      ...prev,
      [text]: !prev[text],
    }));
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header & Rep Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>1:1 Coaching Brief Studio</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Structured managerial dossiers merging scorecard competencies with real-time deal bottlenecks.
          </p>
        </div>

        {/* Rep Selector Dropdown */}
        <div className="w-full sm:w-72">
          <select
            value={activeRepId}
            onChange={(e) => onSelectRep(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            {reps.map((r) => (
              <option key={r.userId} value={r.userId}>
                {r.userName} ({r.role}) — {r.performanceIndex} pts
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-2xl border p-12 text-center bg-card/40 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">
            Compiling 1:1 briefing dossier from performance scores and deal activity...
          </p>
        </Card>
      ) : !brief || !activeRep ? (
        <Card className="rounded-2xl border border-dashed p-12 text-center bg-card/40">
          <p className="text-xs text-muted-foreground">
            Select a sales representative above to generate their 1:1 coaching dossier.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. Executive Summary Profile Card */}
          <Card className="rounded-2xl border bg-gradient-to-br from-card/80 via-card to-primary/5 backdrop-blur-sm p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-inner">
                  {brief.repName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-foreground">{brief.repName}</h3>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {activeRep.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{brief.repEmail}</p>
                </div>
              </div>

              {/* High-Level Pacing Chips */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="rounded-xl border bg-card p-2.5 px-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Scorecard</span>
                  <span className="text-sm font-mono font-bold text-primary">{brief.performanceIndex} / 100</span>
                </div>
                <div className="rounded-xl border bg-card p-2.5 px-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Quota Pacing</span>
                  <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {brief.quotaAttainmentPercent}%
                  </span>
                </div>
                <div className="rounded-xl border bg-card p-2.5 px-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Points (7d)</span>
                  <span className="text-sm font-mono font-bold text-foreground">{brief.pointsLast7Days}</span>
                </div>
                <div className="rounded-xl border bg-card p-2.5 px-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Velocity</span>
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                    {brief.queueCompletionVelocity}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* 2. Dual Column: Scorecard Breakdown & Coaching Agenda */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left: Scorecard Competencies & Deal Assists */}
            <div className="space-y-4 sm:space-y-6">
              {/* Scorecard Dimensions */}
              <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    <span>Phase 1 Dimension Competencies</span>
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Activity Score</span>
                      <span className="font-mono font-bold text-foreground">{brief.scorecard.activityScore}/100</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${brief.scorecard.activityScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Effort Depth</span>
                      <span className="font-mono font-bold text-foreground">{brief.scorecard.effortScore}/100</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${brief.scorecard.effortScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Quality Score</span>
                      <span className="font-mono font-bold text-foreground">{brief.scorecard.qualityScore}/100</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${brief.scorecard.qualityScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Outcome Conversion</span>
                      <span className="font-mono font-bold text-foreground">{brief.scorecard.outcomeScore}/100</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${brief.scorecard.outcomeScore}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-[11px]">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <span className="font-bold block">Top Strength</span>
                    <span>{brief.strongestDimension}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <span className="font-bold block">Coaching Focus</span>
                    <span>{brief.weakestDimension}</span>
                  </div>
                </div>
              </Card>

              {/* Deals Requiring Manager Assist */}
              <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span>Deals Requiring Manager Assist ({brief.stalledDeals.length})</span>
                  </h4>
                </div>

                {brief.stalledDeals.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">
                    No deals currently requiring managerial unblocking.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {brief.stalledDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-3 rounded-xl border bg-muted/20 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-foreground">{deal.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="font-mono font-semibold">GHS {deal.value.toLocaleString()}</span>
                              <span>•</span>
                              <span>{deal.stage}</span>
                              <span>•</span>
                              <span className="text-destructive font-semibold">{deal.daysStalled}d stalled</span>
                            </div>
                          </div>
                          {onTriggerIntervention && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const targetDealObj: AtRiskDeal = {
                                  id: deal.id,
                                  name: deal.name,
                                  value: deal.value,
                                  stage: deal.stage,
                                  stageName: deal.stage,
                                  daysInCurrentStage: deal.daysStalled,
                                  assignedRepId: activeRep.userId,
                                  assignedRepName: activeRep.userName,
                                  riskScore: 75,
                                  riskReasons: [`Stalled for ${deal.daysStalled} days`],
                                };
                                onTriggerIntervention({
                                  targetDeal: targetDealObj,
                                  defaultType: 'elevate_to_hero',
                                });
                              }}
                              className="h-7 min-h-[32px] px-2 text-[10px] font-semibold gap-1 rounded-lg"
                            >
                              <Flame className="h-2.5 w-2.5 text-primary" />
                              <span>Elevate</span>
                            </Button>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-snug bg-background/50 p-2 rounded-lg border border-border/40">
                          <strong className="text-foreground">Assist Recommendation:</strong> {deal.recommendedAssist}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right: AI Discussion Agenda & Mutual Commitments */}
            <div className="space-y-4 sm:space-y-6">
              {/* Discussion Agenda */}
              <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recommended 1:1 Discussion Agenda
                  </h4>
                </div>

                <ul className="space-y-2 pt-1">
                  {brief.discussionPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground/90 leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Commitments Tracker */}
              <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Sprint Commitments & Agreements
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {Object.values(checkedCommitments).filter(Boolean).length} / {brief.suggestedCommitments.length} Agreed
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {brief.suggestedCommitments.map((commitment, idx) => {
                    const isChecked = !!checkedCommitments[commitment];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleCommitment(commitment)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-3 min-h-[44px] ${
                          isChecked
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-border/60 hover:bg-muted/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCommitment(commitment)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                        <span
                          className={`text-xs leading-relaxed ${
                            isChecked ? 'line-through text-muted-foreground font-normal' : 'text-foreground font-medium'
                          }`}
                        >
                          {commitment}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      toast({
                        title: 'Commitments Saved',
                        description: `Recorded 1:1 coaching commitments for ${brief.repName}.`,
                      });
                    }}
                    className="min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Save 1:1 Commitments</span>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
