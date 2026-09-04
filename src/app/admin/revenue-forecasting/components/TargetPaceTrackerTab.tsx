'use client';

/**
 * @fileoverview Target Attainment Daily Pace Tracker Tab (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. Daily Pace Velocity: Required Daily Pace vs Current Run-Rate Pacing.
 * 2. Visual Time Elapsed vs Revenue Progress Gauge.
 * 3. Projected Run-Rate & Monte Carlo Outcomes.
 * 4. Actionable Gap-to-Quota Recovery Playbook.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile ergonomics: min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Target,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Zap,
  Flame,
} from 'lucide-react';
import type {
  PaceHealthStatus,
  RevenueForecastOverview,
  TargetAttainmentPacing,
} from '@/lib/revenue-forecasting/types';

interface TargetPaceTrackerTabProps {
  overview: RevenueForecastOverview;
}

export function TargetPaceTrackerTab({ overview }: TargetPaceTrackerTabProps) {
  const { targetPacing, monteCarloResult } = overview;

  const getPaceStatusBadge = (status: PaceHealthStatus) => {
    switch (status) {
      case 'ahead':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-bold gap-1 px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ahead of Target Pace
          </Badge>
        );
      case 'on_track':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs font-bold gap-1 px-3 py-1">
            <TrendingUp className="w-3.5 h-3.5" />
            On Track with Quota
          </Badge>
        );
      case 'behind':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-bold gap-1 px-3 py-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Behind Required Pace
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs font-bold gap-1 px-3 py-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Critical Quota Deficit
          </Badge>
        );
    }
  };

  const dailyGap = Math.max(0, targetPacing.requiredDailyPace - targetPacing.currentDailyPace);
  const timeProgress = Math.round(
    (targetPacing.daysElapsed / targetPacing.totalDaysInPeriod) * 100
  );

  return (
    <div className="space-y-8">
      {/* 1. Master Quota Progress & Pacing Banner */}
      <Card className="border-border/50 rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                {targetPacing.targetName}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time daily run rate analysis versus required closing velocity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {getPaceStatusBadge(targetPacing.paceHealth)}
          </div>
        </div>

        {/* Visual Attainment Progress Bars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
          {/* Revenue Attainment vs Target */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">Revenue Attainment Progress</span>
              <span className="text-primary font-black">
                GHS {targetPacing.actualWon.toLocaleString()} / GHS {targetPacing.targetQuota.toLocaleString()} ({targetPacing.attainmentPercentage}%)
              </span>
            </div>
            <div className="h-4 w-full bg-muted/60 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all h-full"
                style={{ width: `${Math.min(100, targetPacing.attainmentPercentage)}%` }}
                title={`Won: GHS ${targetPacing.actualWon.toLocaleString()}`}
              />
              <div
                className="bg-blue-400/70 transition-all h-full"
                style={{
                  width: `${Math.min(
                    100 - targetPacing.attainmentPercentage,
                    (targetPacing.committedPipeline / targetPacing.targetQuota) * 100
                  )}%`,
                }}
                title={`Committed: GHS ${targetPacing.committedPipeline.toLocaleString()}`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Actual Won ({targetPacing.attainmentPercentage}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                Committed In-Flight (GHS {targetPacing.committedPipeline.toLocaleString()})
              </span>
              <span className="font-bold text-rose-600">
                Gap: GHS {targetPacing.quotaGap.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Time Elapsed Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">Quarter Timeline Progress</span>
              <span className="text-muted-foreground">
                {targetPacing.daysElapsed} of {targetPacing.totalDaysInPeriod} Days Elapsed ({timeProgress}%)
              </span>
            </div>
            <Progress value={timeProgress} className="h-4" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>Day 1 (Start)</span>
              <span className="font-bold text-amber-600">
                {targetPacing.daysRemaining} Days Remaining
              </span>
              <span>Day {targetPacing.totalDaysInPeriod} (Quarter End)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Key Daily Pace Velocity Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Required Daily Pace */}
        <Card className="border-border/50 rounded-2xl p-5 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            Required Daily Pace
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            GHS {targetPacing.requiredDailyPace.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Daily run-rate needed over remaining {targetPacing.daysRemaining} days.
          </p>
        </Card>

        {/* Current Daily Pace */}
        <Card className="border-border/50 rounded-2xl p-5 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            Current Daily Pace
          </span>
          <div className="text-2xl font-black text-foreground mt-1">
            GHS {targetPacing.currentDailyPace.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Average closing velocity over past {targetPacing.daysElapsed} days.
          </p>
        </Card>

        {/* Projected Run-Rate Outcome */}
        <Card className="border-border/50 rounded-2xl p-5 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Run-Rate Projection
          </span>
          <div className="text-2xl font-black text-foreground mt-1">
            GHS {targetPacing.projectedRunRateOutcome.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Outcome if current closing velocity continues unchanged.
          </p>
        </Card>

        {/* Monte Carlo P50 Outcome */}
        <Card className="border-primary/40 bg-primary/5 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Monte Carlo P50 Projection
          </span>
          <div className="text-2xl font-black text-primary mt-1">
            GHS {targetPacing.projectedP50Outcome.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Won revenue + median statistical pipeline conversion.
          </p>
        </Card>
      </div>

      {/* 3. Daily Velocity Deficit Analysis & Playbook */}
      <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b pb-4 px-6 pt-5">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Gap-to-Quota Deficit Analysis & Recovery Playbook
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Target attainment recommendations to bridge the daily velocity gap of GHS {dailyGap.toLocaleString()}/day.
          </p>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Play 1: Accelerate Committed Deals */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Play 1: Accelerate Committed</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You have GHS {targetPacing.committedPipeline.toLocaleString()} in committed pipeline. Prioritize executive alignment on the top 2 deals to pull forward close dates before the final 2 weeks.
              </p>
            </div>

            {/* Play 2: Increase Deal Size */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
                <span>Play 2: Multi-Year Expansion</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Offer multi-year prepayment discounts on active proposal stages. Converting 1 enterprise deal to an upfront annual commitment closes 35% of the quota gap.
              </p>
            </div>

            {/* Play 3: Defend Slipped Opportunities */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Play 3: Unblock Slipped Deals</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Audit the Deal Slippage Radar. Deals delayed more than 14 days require mutual action plan unblocking with economic buyers to prevent pushing into next quarter.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
