'use client';

/**
 * @fileoverview Deals 2.0 Command Center / Executive Overview Tab
 *
 * ARCHITECTURAL POINTER (Executive Revenue Command Center):
 * Provides top-level revenue visibility, health analysis, and operational routing:
 * - Executive revenue KPIs (Total Pipeline, Weighted Forecast, Won Revenue, Win Rate %, Avg Deal Size)
 * - Pipeline Health visual distribution bar with real-time status indicators
 * - Actionable "Attention Required" panel surfacing SLA breaches and stagnant opportunities
 * - Stage-by-stage breakdown showing volume, aggregate value, and average velocity
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All calculations must use pure helpers from `deal-health-engine.ts`.
 * - Touch targets on cards and buttons must meet >= 44x44px mobile accessibility.
 * - Dynamic multi-currency must route through `formatCurrency()`.
 *
 * TESTABILITY POINTER:
 * Verify metrics compute accurately against mock deals in unit tests.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  DollarSign, 
  Trophy, 
  Percent, 
  Layers, 
  ArrowUpRight, 
  Plus, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';
import type { Deal, DealStage, Pipeline } from '@/lib/types';
import { calculateDealsOverviewMetrics, calculateDaysInStage } from '@/lib/deals/deal-health-engine';
import DealsAttentionPanel from './DealsAttentionPanel';

interface DealsOverviewViewProps {
  pipeline: Pipeline;
  stages: DealStage[];
  deals: Deal[];
  onCreateDeal: () => void;
  onNavigateToBoard: (filterPreset?: string) => void;
  onNavigateToList: (filterPreset?: string) => void;
  onOpenDeal: (deal: Deal) => void;
}

export default function DealsOverviewView({
  pipeline,
  stages,
  deals,
  onCreateDeal,
  onNavigateToBoard,
  onNavigateToList,
  onOpenDeal,
}: DealsOverviewViewProps) {
  const metrics = React.useMemo(() => {
    return calculateDealsOverviewMetrics(deals, stages);
  }, [deals, stages]);

  const stageBreakdown = React.useMemo(() => {
    return stages.map(stage => {
      const stageDeals = deals.filter(d => d.stageId === stage.id && d.status === 'open');
      const totalValue = stageDeals.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0);
      const avgDays = stageDeals.length > 0
        ? Math.round(stageDeals.reduce((sum, d) => sum + calculateDaysInStage(d.stageEnteredAt, d.createdAt), 0) / stageDeals.length)
        : 0;

      return {
        stage,
        dealsCount: stageDeals.length,
        totalValue,
        avgDays,
      };
    });
  }, [stages, deals]);

  const healthTotal = metrics.healthyDealsCount + metrics.atRiskDealsCount + metrics.stalledDealsCount;
  const healthyPercent = healthTotal > 0 ? Math.round((metrics.healthyDealsCount / healthTotal) * 100) : 0;
  const atRiskPercent = healthTotal > 0 ? Math.round((metrics.atRiskDealsCount / healthTotal) * 100) : 0;
  const stalledPercent = healthTotal > 0 ? Math.round((metrics.stalledDealsCount / healthTotal) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl mx-auto scrollbar-thin">
      {/* Top Banner with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-background border border-primary/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg">
              {pipeline.name} • Command Center
            </Badge>
            <span className="text-xs font-bold text-muted-foreground">• {metrics.totalActiveDeals} Active Opportunities</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Pipeline Revenue Overview
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Real-time pipeline valuation, stage velocity, SLA health analysis, and immediate follow-up priorities.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => onNavigateToBoard()}
            variant="outline"
            className="h-11 min-h-[44px] px-4 rounded-xl font-bold border-border/80 hover:bg-muted/10 active:scale-[0.98] transition-all text-xs"
          >
            <Layers className="h-4 w-4 mr-2 text-primary" />
            Open Kanban
          </Button>
          <Button
            onClick={onCreateDeal}
            className="h-11 min-h-[44px] px-5 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all text-xs flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Deal
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline Value */}
        <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Total Pipeline</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {formatCurrency(metrics.totalPipelineValue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-semibold">
            <span>{metrics.totalActiveDeals} open deals</span>
          </div>
        </Card>

        {/* Weighted Forecast Value */}
        <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Weighted Forecast</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCurrency(metrics.totalWeightedValue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-semibold">
            <span>Probability-adjusted</span>
          </div>
        </Card>

        {/* Closed Won Revenue */}
        <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Won Revenue</span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {formatCurrency(metrics.totalWonValue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-semibold">
            <span>Closed Won deals</span>
          </div>
        </Card>

        {/* Win Rate Percentage */}
        <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Win Rate</span>
            <Percent className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            {metrics.winRatePercentage}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-semibold">
            <span>Avg size: {formatCurrency(metrics.avgDealSize)}</span>
          </div>
        </Card>
      </div>

      {/* Attention Required Panel */}
      <DealsAttentionPanel
        deals={deals}
        stages={stages}
        onOpenDeal={onOpenDeal}
        onFilterSlaBreached={() => onNavigateToBoard('sla_breached')}
        onFilterNoNextStep={() => onNavigateToList('no_next_step')}
        onFilterClosingSoon={() => onNavigateToList('closing_soon')}
      />

      {/* Health Distribution & Stage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Health Breakdown */}
        <Card className="rounded-3xl border-border/50 bg-card/60 shadow-sm p-5 space-y-4">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Pipeline Health Distribution</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardTitle>
            <CardDescription className="text-xs">
              Based on stage SLA compliance & activity recency
            </CardDescription>
          </CardHeader>

          {/* Segmented Progress Bar */}
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-full bg-muted/40 overflow-hidden flex">
              <div style={{ width: `${healthyPercent}%` }} className="bg-emerald-500 transition-all" title={`Healthy: ${healthyPercent}%`} />
              <div style={{ width: `${atRiskPercent}%` }} className="bg-amber-500 transition-all" title={`At Risk: ${atRiskPercent}%`} />
              <div style={{ width: `${stalledPercent}%` }} className="bg-destructive transition-all" title={`Stalled: ${stalledPercent}%`} />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {metrics.healthyDealsCount} Healthy ({healthyPercent}%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {metrics.atRiskDealsCount} At Risk ({atRiskPercent}%)
              </span>
              <span className="flex items-center gap-1.5 text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                {metrics.stalledDealsCount} Stalled ({stalledPercent}%)
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 space-y-2 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Closing this week:</span>
              <span className="font-bold text-foreground">{metrics.closingThisWeekCount} deals</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Without next step:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{metrics.noNextStepCount} deals</span>
            </div>
          </div>
        </Card>

        {/* Stage Volume & Velocity Summary */}
        <Card className="lg:col-span-2 rounded-3xl border-border/50 bg-card/60 shadow-sm p-5 space-y-4">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Stage Velocity & Value Distribution</CardTitle>
              <CardDescription className="text-xs">Active opportunities grouped by stage</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToList()}
              className="text-xs font-bold text-primary hover:bg-primary/10 h-8"
            >
              View All Deals <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>

          <div className="space-y-3">
            {stageBreakdown.map(({ stage, dealsCount, totalValue, avgDays }) => {
              const maxVal = Math.max(1, ...stageBreakdown.map(s => s.totalValue));
              const progressPercent = Math.round((totalValue / maxVal) * 100);

              return (
                <div key={stage.id} className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                      <span className="font-bold text-foreground">{stage.name}</span>
                      <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4">
                        {dealsCount} {dealsCount === 1 ? 'deal' : 'deals'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Avg {avgDays}d in stage
                      </span>
                      <span className="font-black text-foreground">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>
                  <Progress value={progressPercent} className="h-1.5 bg-muted/50" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
