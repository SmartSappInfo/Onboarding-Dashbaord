'use client';

/**
 * @fileoverview Team Capacity Planner & Cohort Ramp Tab (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10:
 * - Multi-cohort ramp-weighted team capacity planning.
 * - Weights: 0.35x (Onboarding, 0-3 mo), 0.70x (Ramping, 4-12 mo), 1.00x (Ramped, >12 mo).
 * - Quota coverage ratio vs industry benchmark (3.5x).
 * - Live capacity shortfall calculation and recommended hiring gap.
 * - Rep deal workload utilization meters (active deals / deal capacity limit).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile ergonomics: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 * - Division-by-zero protected by safe fallback values.
 *
 * @testability Pure presentation component with deterministic data bindings.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Target,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserPlus,
  Search,
} from 'lucide-react';
import type { CapacityPlan, RampTier } from '@/lib/revenue-os/types';

interface CapacityPlannerTabProps {
  capacityPlan: CapacityPlan;
}

export function CapacityPlannerTab({ capacityPlan }: CapacityPlannerTabProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedTier, setSelectedTier] = React.useState<RampTier | 'all'>('all');

  const hasShortfall = capacityPlan.capacityShortfallDollars > 0;
  const isCoverageHealthy = capacityPlan.quotaCoverageRatio >= 3.0;

  // Filter cohorts by search query and ramp tier
  const filteredCohorts = React.useMemo(() => {
    return capacityPlan.cohorts.filter((cohort) => {
      const matchesSearch =
        cohort.repName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cohort.teamId && cohort.teamId.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTier = selectedTier === 'all' || cohort.rampTier === selectedTier;
      return matchesSearch && matchesTier;
    });
  }, [capacityPlan.cohorts, searchQuery, selectedTier]);

  const onboardingCount = capacityPlan.cohorts.filter((c) => c.rampTier === 'onboarding').length;
  const rampingCount = capacityPlan.rampingRepsCount;
  const rampedCount = capacityPlan.rampedRepsCount;

  return (
    <div className="space-y-6">
      {/* Top Capacity Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Target vs Effective Capacity */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Effective Capacity
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Target className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              ${(capacityPlan.effectiveCapacityTotal / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xs text-muted-foreground">
                Target: ${(capacityPlan.targetRevenue / 1000000).toFixed(2)}M
              </span>
              <span className="text-2xs text-muted-foreground">•</span>
              <span className="text-2xs font-semibold text-primary">
                {Math.round((capacityPlan.effectiveCapacityTotal / (capacityPlan.targetRevenue || 1)) * 100)}%
              </span>
            </div>
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
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {capacityPlan.quotaCoverageRatio.toFixed(1)}x
            </div>
            <div className="flex items-center gap-1 mt-1 text-2xs">
              {isCoverageHealthy ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Healthy buffer
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Below 3.5x benchmark
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Capacity Shortfall or Surplus */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Capacity Deficit
            </span>
            <div
              className={`p-2 rounded-xl border ${
                hasShortfall
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }`}
            >
              <Briefcase className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {hasShortfall
                ? `$${Math.round(capacityPlan.capacityShortfallDollars / 1000).toLocaleString()}k`
                : '$0k'}
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              {hasShortfall
                ? 'Effective quota deficit vs plan'
                : '100% quota capacity covered'}
            </p>
          </CardContent>
        </Card>

        {/* Recommended Hires Gap */}
        <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recommended Hires
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">
              {capacityPlan.recommendedHiresCount} {capacityPlan.recommendedHiresCount === 1 ? 'AE' : 'AEs'}
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              {capacityPlan.recommendedHiresCount > 0
                ? 'Required to bridge Q4 quota gap'
                : 'Headcount fully scaled for quarter'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Ramp Structure Callout Banner */}
      <Card className="rounded-2xl border border-primary/20 bg-muted/30 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                Ramp Weighting Model
              </Badge>
              <span className="text-xs text-muted-foreground">Standard 3-Month Preset</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Capacity accounts for rep ramp curves: Onboarding produces 35% quota, Ramping produces 70%, and Ramped produces 100%.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-xl bg-card border border-border/60">
              <div className="text-xs font-bold text-foreground">{rampedCount}</div>
              <div className="text-3xs text-muted-foreground uppercase">Ramped (1.0x)</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-xl bg-card border border-border/60">
              <div className="text-xs font-bold text-foreground">{rampingCount}</div>
              <div className="text-3xs text-muted-foreground uppercase">Ramping (0.7x)</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-xl bg-card border border-border/60">
              <div className="text-xs font-bold text-foreground">{onboardingCount}</div>
              <div className="text-3xs text-muted-foreground uppercase">Onboarding (0.35x)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Rep Cohorts & Workload Utilization Table */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Sales Rep Capacity & Workload Allocation
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Individual rep tenure, ramp-weighted capacity quota, and deal load saturation.
            </p>
          </div>

          {/* Search & Ramp Tier Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search rep name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 rounded-xl text-xs w-44 sm:w-56 min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
              {(['all', 'ramped', 'ramping', 'onboarding'] as const).map((tier) => (
                <Button
                  key={tier}
                  type="button"
                  variant={selectedTier === tier ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedTier(tier)}
                  className={`h-7 px-2.5 rounded-lg text-2xs font-semibold capitalize min-h-[44px] sm:min-h-0 ${
                    selectedTier === tier ? 'shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  {tier}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Cohort Rep Cards / Rows */}
        <div className="divide-y divide-border/40 pt-2">
          {filteredCohorts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No sales reps found matching the selected filters.
            </div>
          ) : (
            filteredCohorts.map((rep) => {
              const isOverloaded = rep.utilizationPercent > 85;
              const isUnderUtilized = rep.utilizationPercent < 40;

              return (
                <div
                  key={rep.repId}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Rep Identity & Ramp Tier */}
                  <div className="space-y-1.5 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{rep.repName}</span>
                      <Badge
                        variant="outline"
                        className={`text-3xs font-semibold uppercase tracking-wider px-1.5 py-0 ${
                          rep.rampTier === 'ramped'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : rep.rampTier === 'ramping'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        }`}
                      >
                        {rep.rampTier} ({rep.rampFactor}x)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                      <span>Tenure: {rep.tenureMonths} mo</span>
                      <span>•</span>
                      <span>Team: {rep.teamId || 'General Sales'}</span>
                    </div>
                  </div>

                  {/* Quota & Effective Capacity */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 text-xs md:min-w-[200px]">
                    <div>
                      <span className="text-2xs text-muted-foreground block">Assigned Quota</span>
                      <span className="font-bold text-foreground font-mono">
                        ${(rep.assignedQuota / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs text-muted-foreground block">Effective Capacity</span>
                      <span className="font-bold text-primary font-mono">
                        ${(rep.effectiveCapacityQuota / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>

                  {/* Workload Utilization Meter */}
                  <div className="space-y-1.5 md:w-56">
                    <div className="flex justify-between items-center text-2xs">
                      <span className="text-muted-foreground">Deal Utilization</span>
                      <span
                        className={`font-semibold font-mono ${
                          isOverloaded
                            ? 'text-rose-600 dark:text-rose-400'
                            : isUnderUtilized
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                        }`}
                      >
                        {rep.activeDealsCount} / {rep.dealCapacityLimit} ({rep.utilizationPercent}%)
                      </span>
                    </div>

                    {/* Utilization Bar */}
                    <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverloaded
                            ? 'bg-rose-500'
                            : isUnderUtilized
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, rep.utilizationPercent)}%` }}
                      />
                    </div>
                    <span className="text-3xs text-muted-foreground block">
                      {isOverloaded
                        ? 'High deal saturation risk'
                        : isUnderUtilized
                        ? 'Available deal capacity'
                        : 'Balanced active pipeline'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
