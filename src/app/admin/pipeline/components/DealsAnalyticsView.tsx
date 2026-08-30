'use client';

/**
 * @fileoverview Deals Platform 2.0 Management-Grade Revenue Intelligence Hub
 *
 * ARCHITECTURAL POINTER (3-Tier Revenue Intelligence Architecture - PRD Section 124 & UI Section 35):
 * Renders a structured, high-visibility 3-tier analytics hierarchy:
 * 1. Executive Tier:
 *    - Closed Won Revenue
 *    - Total Active Pipeline Value
 *    - Pipeline Coverage Ratio (Pipeline / Target Quota)
 *    - Overall Win Rate %
 * 2. Management Tier:
 *    - Stage Conversion & Retention Funnel (PRD §51, UI §36)
 *    - Sales Velocity Engine & Speedometer ($/day, cycle length)
 *    - Sales Rep Performance Leaderboard (PRD §52)
 *    - Systemic Stage Bottlenecks & SLA Friction Alerts (PRD §53)
 * 3. Operations Tier:
 *    - SLA Breached & Stalled Opportunities Breakdown
 *    - Revenue Attribution by Lead Source & Channel (PRD §51)
 *    - Operational Next Steps & Urgency Distribution
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Strict zero 'any' / zero 'any[]'.
 * - Minimum 44x44px mobile touch targets.
 * - Dynamic multi-currency formatting via `formatCurrency()`.
 * - Pure memoized engine calculations via `deal-analytics-engine.ts`.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Trophy, 
  Percent, 
  Calendar, 
  Target, 
  AlertTriangle, 
  Clock, 
  Layers, 
  PieChart,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';
import type { Deal, DealStage, UserProfile, Activity, Pipeline, PipelineTarget } from '@/lib/types';
import { buildConsolidatedAnalyticsDataset } from '@/lib/deals/deal-analytics-engine';
import StageConversionFunnel from './StageConversionFunnel';
import SalesVelocityCard from './SalesVelocityCard';
import RepPerformanceTable from './RepPerformanceTable';
import PipelineTargetModal from './PipelineTargetModal';

interface DealsAnalyticsViewProps {
  pipeline: Pipeline;
  stages: DealStage[];
  deals: Deal[];
  users: UserProfile[];
  activities?: Activity[];
  pipelineTarget?: PipelineTarget | null;
  onNavigateToBoard?: () => void;
  onNavigateToList?: () => void;
  onTargetSaved?: (target: PipelineTarget) => void;
}

export default function DealsAnalyticsView({
  pipeline,
  stages,
  deals,
  users,
  activities = [],
  pipelineTarget = null,
  onNavigateToBoard,
  onNavigateToList,
  onTargetSaved,
}: DealsAnalyticsViewProps) {
  const [timeframe, setTimeframe] = React.useState<'all' | 'this_month' | 'this_quarter' | 'this_year'>('all');
  const [isTargetModalOpen, setIsTargetModalOpen] = React.useState(false);

  // Timeframe Filtering
  const filteredDeals = React.useMemo(() => {
    if (timeframe === 'all') return deals;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    return deals.filter(deal => {
      const dateStr = deal.expectedCloseDate || deal.createdAt;
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;

      if (timeframe === 'this_month') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      if (timeframe === 'this_quarter') {
        const q = Math.floor(d.getMonth() / 3);
        return d.getFullYear() === currentYear && q === currentQuarter;
      }
      if (timeframe === 'this_year') {
        return d.getFullYear() === currentYear;
      }
      return true;
    });
  }, [deals, timeframe]);

  const targetAmount = pipelineTarget?.targetAmount || 0;
  const currency = pipelineTarget?.currency || 'GHS';

  // Build Consolidated 3-Tier Analytics Dataset via pure engine
  const dataset = React.useMemo(() => {
    return buildConsolidatedAnalyticsDataset(
      filteredDeals,
      stages,
      users,
      targetAmount,
      currency,
      activities
    );
  }, [filteredDeals, stages, users, targetAmount, currency, activities]);

  const { executive, management, operations } = dataset;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl mx-auto scrollbar-thin">
      {/* Top Banner with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-background border border-primary/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg">
              {pipeline.name} • Revenue Intelligence
            </Badge>
            <span className="text-xs font-bold text-muted-foreground">
              • 3-Tier Matrix
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Pipeline Analytics & Forecasting Hub
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Executive revenue metrics, stage conversion funnels, sales velocity speedometer, rep performance scorecards, and bottleneck detection.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsTargetModalOpen(true)}
            className="h-11 min-h-[44px] px-4 rounded-xl text-xs font-bold border-border/80 bg-background hover:bg-muted/10 flex items-center gap-1.5"
          >
            <Target className="h-4 w-4 text-primary" />
            <span>{targetAmount > 0 ? `Target: ${formatCurrency(targetAmount, currency)}` : 'Set Quota Target'}</span>
          </Button>

          <Select value={timeframe} onValueChange={(val: 'all' | 'this_month' | 'this_quarter' | 'this_year') => setTimeframe(val)}>
            <SelectTrigger className="w-44 h-11 min-h-[44px] rounded-xl text-xs font-bold border-border/80 bg-background">
              <Calendar className="h-3.5 w-3.5 mr-2 text-primary" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-popover z-[200]">
              <SelectItem value="all" className="text-xs font-semibold">All Time</SelectItem>
              <SelectItem value="this_month" className="text-xs font-semibold">This Month</SelectItem>
              <SelectItem value="this_quarter" className="text-xs font-semibold">This Quarter</SelectItem>
              <SelectItem value="this_year" className="text-xs font-semibold">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TIER 1: EXECUTIVE REVENUE KPIS (UI Section 35)                       */}
      {/* ==================================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-primary" />
            Executive Revenue Summary
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Won Revenue */}
          <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
              <span>Won Revenue</span>
              <Trophy className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(executive.totalRevenueWon, currency)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
              Closed revenue achieved
            </div>
          </Card>

          {/* Active Pipeline */}
          <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
              <span>Total Pipeline</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">
              {formatCurrency(executive.totalPipelineValue, currency)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
              Active open opportunities
            </div>
          </Card>

          {/* Win Rate */}
          <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
              <span>Win Rate</span>
              <Percent className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {executive.winRatePercentage}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
              Closed won / closed total
            </div>
          </Card>

          {/* Pipeline Coverage */}
          <Card className="rounded-2xl border-border/50 bg-card/60 shadow-sm p-4 hover:border-purple-500/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
              <span>Pipeline Coverage</span>
              <Target className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {executive.targetAmount > 0 ? `${executive.pipelineCoverageRatio}×` : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
              {executive.targetAmount > 0 ? `Target: ${formatCurrency(executive.targetAmount, currency)}` : 'Set target quota to track'}
            </div>
          </Card>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TIER 2: MANAGEMENT INTELLIGENCE (Conversion, Velocity, Reps, Bottlenecks) */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Management Operations & Velocity Matrix
          </span>
        </div>

        {/* Systemic Bottleneck Alerts */}
        {management.bottlenecks.length > 0 && (
          <div className="space-y-2">
            {management.bottlenecks.map(b => (
              <div
                key={b.stageId}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                  b.severity === 'critical'
                    ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                    : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${b.severity === 'critical' ? 'bg-red-500/20 text-red-600' : 'bg-amber-500/20 text-amber-600'}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider">
                      Pipeline Bottleneck Detected: {b.stageName}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-extrabold px-2 py-0">
                      {b.delayFactor}× SLA Delay
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-foreground/80">
                    {b.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Funnel & Velocity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StageConversionFunnel funnelSteps={management.funnel} currency={currency} />
          <SalesVelocityCard velocity={management.velocity} currency={currency} />
        </div>

        {/* Rep Leaderboard */}
        <RepPerformanceTable reps={management.reps} currency={currency} />
      </div>

      {/* ==================================================================== */}
      {/* TIER 3: OPERATIONS INTELLIGENCE (Attribution, Stalled, SLAs)           */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <PieChart className="h-4 w-4 text-primary" />
            Operations & Revenue Attribution
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue Attribution by Source */}
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border/40 pb-4">
              <CardTitle className="text-base font-black tracking-tight text-foreground">
                Revenue Won by Lead Source
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Origin channel distribution of completed commercial agreements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {operations.attributions.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center opacity-40">
                  <PieChart className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs font-bold text-muted-foreground">No Won Revenue Attribution Data</span>
                </div>
              ) : (
                operations.attributions.map(attr => (
                  <div key={attr.source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-foreground">{attr.source}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(attr.revenueWon, currency)} ({attr.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${attr.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Operational Risk & SLA Status */}
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border/40 pb-4">
              <CardTitle className="text-base font-black tracking-tight text-foreground">
                Operational SLA & Stagnation State
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Immediate pipeline friction and SLA compliance metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="text-xs font-bold text-foreground">SLA Breached Opportunities</div>
                    <div className="text-[10px] text-muted-foreground">Exceeded stage SLA time limit</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-red-600 dark:text-red-400">{operations.slaBreachedCount}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold">{formatCurrency(operations.slaBreachedValue, currency)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Stalled Pipeline Opportunities</div>
                    <div className="text-[10px] text-muted-foreground">No recent activity or progress recorded</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400">{operations.stalledDealsCount}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold">{formatCurrency(operations.stalledDealsValue, currency)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Target Configuration Modal */}
      <PipelineTargetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        pipelineId={pipeline.id}
        pipelineName={pipeline.name}
        currentTarget={pipelineTarget}
        onTargetSaved={onTargetSaved}
      />
    </div>
  );
}
