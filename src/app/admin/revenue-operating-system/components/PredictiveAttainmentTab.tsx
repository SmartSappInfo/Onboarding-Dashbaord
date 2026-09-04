'use client';

/**
 * @fileoverview Predictive Attainment & Early-Warning Churn Radar Tab (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10:
 * - Algorithmic deal-health-weighted rep attainment prediction.
 * - Rep categorization: 'exceeding' (>=105%), 'on_track' (90-104%), 'at_risk' (75-89%), 'critical' (<75%).
 * - Early-warning churn & slippage radar detecting buyer touch decay (>14d, >21d) and single-threading.
 * - Actionable executive intervention recommendations for at-risk enterprise pipeline.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 * - Division-by-zero protected by safe fallback values.
 *
 * @testability Pure presentation component with deterministic input bindings.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldAlert,
  Search,
  Clock,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import type {
  PredictiveAttainmentRecord,
  PredictiveChurnRisk,
  AttainmentCategory,
} from '@/lib/revenue-os/types';

interface PredictiveAttainmentTabProps {
  predictiveAttainments: PredictiveAttainmentRecord[];
  churnRisks: PredictiveChurnRisk[];
}

export function PredictiveAttainmentTab({
  predictiveAttainments,
  churnRisks,
}: PredictiveAttainmentTabProps) {
  const [repSearchQuery, setRepSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<AttainmentCategory | 'all'>('all');

  // Filter rep attainments
  const filteredAttainments = React.useMemo(() => {
    return predictiveAttainments.filter((record) => {
      const matchesSearch =
        record.repName.toLowerCase().includes(repSearchQuery.toLowerCase()) ||
        (record.teamId && record.teamId.toLowerCase().includes(repSearchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === 'all' || record.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [predictiveAttainments, repSearchQuery, selectedCategory]);

  const atRiskCount = predictiveAttainments.filter(
    (r) => r.category === 'at_risk' || r.category === 'critical'
  ).length;

  const totalPipelineAtRiskDollars = churnRisks.reduce((acc, c) => acc + c.dealValue, 0);

  return (
    <div className="space-y-6">
      {/* Top Attainment & Risk Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Reps At Risk Count */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              At-Risk Attainment
            </span>
            <div
              className={`p-2 rounded-xl border ${
                atRiskCount > 0
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {atRiskCount} {atRiskCount === 1 ? 'Rep' : 'Reps'}
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Projected below 90% quota attainment
            </p>
          </CardContent>
        </Card>

        {/* Churn Risk Pipeline */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pipeline Churn Risk
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              ${Math.round(totalPipelineAtRiskDollars / 1000).toLocaleString()}k
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              {churnRisks.length} deals with touch decay or stalling
            </p>
          </CardContent>
        </Card>

        {/* Average Touch Decay Days */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Touch Decay Pacing
            </span>
            <div className="p-2 rounded-xl bg-muted/60 text-muted-foreground border border-border/40">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {churnRisks.length > 0
                ? Math.round(
                    churnRisks.reduce((acc, c) => acc + c.touchDecayDays, 0) / churnRisks.length
                  )
                : 0}d
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Avg days since buyer interaction
            </p>
          </CardContent>
        </Card>

        {/* Total Tracked Quota */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reps Monitored
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Briefcase className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {predictiveAttainments.length}
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Total sales headcount in active quarter
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Rep Predictive Attainment Table */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Rep Predictive Quota Attainment
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Health-discounted predictive attainment combining closed actuals and pipeline probability.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search rep name..."
                value={repSearchQuery}
                onChange={(e) => setRepSearchQuery(e.target.value)}
                className="pl-8 h-9 rounded-xl text-xs w-44 sm:w-56 min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
              {(['all', 'exceeding', 'on_track', 'at_risk', 'critical'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={selectedCategory === cat ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-7 px-2.5 rounded-lg text-2xs font-semibold capitalize min-h-[44px] sm:min-h-0 ${
                    selectedCategory === cat ? 'shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Attainment Rows */}
        <div className="divide-y divide-border/40 pt-2">
          {filteredAttainments.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No reps found matching the selected filters.
            </div>
          ) : (
            filteredAttainments.map((rep) => {
              const isExceeding = rep.category === 'exceeding';
              const isOnTrack = rep.category === 'on_track';
              const isAtRisk = rep.category === 'at_risk';

              return (
                <div
                  key={rep.repId}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Rep Info & Category Badge */}
                  <div className="space-y-1.5 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{rep.repName}</span>
                      <Badge
                        variant="outline"
                        className={`text-3xs font-semibold uppercase tracking-wider px-1.5 py-0 ${
                          isExceeding
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : isOnTrack
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                            : isAtRisk
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        }`}
                      >
                        {rep.category.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                      <span>Team: {rep.teamId || 'Enterprise Sales'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {rep.pacingTrend === 'accelerating' ? (
                          <span className="text-emerald-600 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-0.5" /> Accelerating
                          </span>
                        ) : rep.pacingTrend === 'decelerating' ? (
                          <span className="text-rose-600 flex items-center">
                            <TrendingDown className="h-3 w-3 mr-0.5" /> Decelerating
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center">
                            <Minus className="h-3 w-3 mr-0.5" /> Steady
                          </span>
                        )}
                      </span>
                    </div>

                    {rep.primaryRiskFactor && (
                      <p className="text-3xs text-amber-600 dark:text-amber-400 font-medium">
                        Risk: {rep.primaryRiskFactor}
                      </p>
                    )}
                  </div>

                  {/* Quota vs Predicted Attainment */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 text-xs md:min-w-[200px]">
                    <div>
                      <span className="text-2xs text-muted-foreground block">Quota Target</span>
                      <span className="font-bold text-foreground font-mono">
                        ${(rep.quota / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs text-muted-foreground block">Predicted Output</span>
                      <span className="font-bold text-primary font-mono">
                        ${(rep.predictedAttainmentDollars / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>

                  {/* Attainment Percentage & Progress Bar */}
                  <div className="space-y-1.5 md:w-56">
                    <div className="flex justify-between items-center text-2xs">
                      <span className="text-muted-foreground">Pacing Attainment</span>
                      <span
                        className={`font-bold font-mono ${
                          isExceeding
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isOnTrack
                            ? 'text-foreground'
                            : isAtRisk
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {rep.predictedAttainmentPercent}%
                      </span>
                    </div>

                    <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isExceeding
                            ? 'bg-emerald-500'
                            : isOnTrack
                            ? 'bg-primary'
                            : isAtRisk
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, rep.predictedAttainmentPercent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-3xs text-muted-foreground font-mono">
                      <span>Closed: ${(rep.closedRevenue / 1000).toFixed(0)}k</span>
                      <span>Pipe: +${(rep.weightedPipeline / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Section 2: Early-Warning Churn & Slippage Radar */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground">
                Early-Warning Churn & Slippage Radar
              </CardTitle>
              <Badge variant="outline" className="text-2xs font-semibold text-rose-600 border-rose-500/30">
                Live Alert Feed
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-value enterprise opportunities vulnerable to silent decay or stakeholder disconnection.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {churnRisks.length} flagged accounts
          </span>
        </div>

        {/* Churn Risk Cards */}
        <div className="divide-y divide-border/40 pt-2">
          {churnRisks.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No high-risk pipeline deals detected. Buyer engagement signals are healthy.
            </div>
          ) : (
            churnRisks.map((risk) => (
              <div
                key={risk.id}
                className="py-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                {/* Deal Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-foreground">{risk.dealName}</span>
                    <Badge
                      variant="outline"
                      className={`text-3xs font-semibold uppercase px-1.5 py-0 ${
                        risk.riskSeverity === 'critical'
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : risk.riskSeverity === 'high'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                      }`}
                    >
                      {risk.riskSeverity}
                    </Badge>
                    <span className="text-2xs text-muted-foreground font-mono">
                      ${risk.dealValue.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-2xs text-muted-foreground">
                    Account: <span className="text-foreground font-medium">{risk.accountName || 'Enterprise Lead'}</span>
                    {' • '}
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {risk.touchDecayDays} days silent
                    </span>
                    {' • '}
                    Driver: {risk.primaryDriver}
                  </p>

                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40 text-2xs">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Suggested Intervention: </span>
                      <span className="text-muted-foreground">{risk.suggestedIntervention}</span>
                    </div>
                  </div>
                </div>

                {/* Risk Probability Meter */}
                <div className="flex-shrink-0 text-right md:w-36 space-y-1">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {risk.churnProbabilityPercent}% Churn Risk
                  </div>
                  <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-300"
                      style={{ width: `${risk.churnProbabilityPercent}%` }}
                    />
                  </div>
                  <span className="text-3xs text-muted-foreground block">
                    Detected {new Date(risk.detectedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
