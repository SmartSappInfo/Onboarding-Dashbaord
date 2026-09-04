'use client';

/**
 * @fileoverview Executive Boardroom Pulse Tab (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10:
 * - High-level C-suite KPI cards: Target Revenue, Weighted Forecast, Predicted Pacing %, Quota Coverage.
 * - Pacing Trajectory Curve (Day 1 to 90) comparing Target, Actual, and Projected.
 * - AI Executive Strategic Briefing with high-leverage risk insights.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing. Zero 'any' or 'any[]'.
 * - Touch targets >= 44px on interactive cards.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Target,
  Sparkles,
  PieChart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { ExecutiveBoardroomSummary } from '@/lib/revenue-os/types';

interface ExecutivePulseTabProps {
  summary: ExecutiveBoardroomSummary;
  onNavigateToSimulator?: () => void;
}

export function ExecutivePulseTab({ summary, onNavigateToSimulator }: ExecutivePulseTabProps) {
  const isPacingAhead = summary.predictedPacingPercent >= 100;
  const isCoverageHealthy = summary.quotaCoverageRatio >= 3.0;

  return (
    <div className="space-y-6">
      {/* AI Executive Briefing Banner */}
      <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  AI Boardroom Executive Briefing
                  <Badge variant="outline" className="text-2xs font-semibold uppercase tracking-wider">
                    Quarter-End Outlook
                  </Badge>
                </h2>
                {onNavigateToSimulator && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToSimulator}
                    className="h-8 rounded-lg text-2xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform w-fit"
                  >
                    Simulate Scenarios
                  </Button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {summary.aiExecutiveBriefing}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* C-Suite KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Target Revenue */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quarterly Target
            </span>
            <div className="p-2 rounded-xl bg-muted/60 text-muted-foreground border border-border/40">
              <Target className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              ${(summary.targetRevenueDollars / 1000000).toFixed(2)}M
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Committed boardroom revenue quota
            </p>
          </CardContent>
        </Card>

        {/* Weighted Forecast */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Weighted Forecast
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              ${(summary.weightedForecastDollars / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {isPacingAhead ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-2xs font-semibold flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  Pacing surplus
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 text-2xs font-semibold flex items-center">
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  Shortfall risk
                </span>
              )}
              <span className="text-2xs text-muted-foreground">vs target</span>
            </div>
          </CardContent>
        </Card>

        {/* Predicted Pacing Attainment */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Attainment Pacing
            </span>
            <div
              className={`p-2 rounded-xl border ${
                isPacingAhead
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {summary.predictedPacingPercent}%
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Quarter-end algorithmic projection
            </p>
          </CardContent>
        </Card>

        {/* Quota Coverage Ratio */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pipeline Coverage
            </span>
            <div
              className={`p-2 rounded-xl border ${
                isCoverageHealthy
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
              }`}
            >
              <PieChart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {summary.quotaCoverageRatio.toFixed(1)}x
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Benchmark target: 3.5x coverage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 90-Day Pacing Trajectory Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              90-Day Revenue Pacing Trajectory
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparing committed target ramp against closed actuals and AI projection.
            </p>
          </div>
          <div className="flex items-center gap-3 text-2xs font-semibold">
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Target
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Closed Actual
            </span>
            <span className="flex items-center gap-1 text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" /> AI Projection
            </span>
          </div>
        </div>

        {/* Trajectory Timeline Points */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-5">
          {summary.pacingTrajectory.map((pt) => (
            <div
              key={pt.dayNumber}
              className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Day {pt.dayNumber}</span>
                {pt.actualDollars > 0 && (
                  <Badge variant="outline" className="text-3xs text-emerald-600 border-emerald-500/30 px-1 py-0">
                    Closed
                  </Badge>
                )}
              </div>
              <div className="space-y-1 text-2xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Target:</span>
                  <span className="font-mono font-medium">${(pt.targetDollars / 1000).toFixed(0)}k</span>
                </div>
                {pt.actualDollars > 0 ? (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Actual:</span>
                    <span className="font-mono">${(pt.actualDollars / 1000).toFixed(0)}k</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-primary font-semibold">
                    <span>Projected:</span>
                    <span className="font-mono">${(pt.projectedDollars / 1000).toFixed(0)}k</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
