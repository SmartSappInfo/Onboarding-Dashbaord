'use client';

/**
 * @fileoverview Deals 2.0 Revenue Forecasting Workspace & Risk Matrix
 *
 * ARCHITECTURAL POINTER (Forecast Matrix, Risk Panel & Revenue Probability - PRD Section 124 & UI Sections 33, 34):
 * - Groups deals into standard CRM Forecast Categories:
 *     - Commit (High confidence deals committed for the period)
 *     - Best Case (Upside opportunities)
 *     - Pipeline (Standard active pipeline)
 *     - Closed Won (Successfully won opportunities)
 *     - Omitted (Excluded from revenue projections)
 * - Renders Horizon / Stacked Forecast Progression Bars (UI Section 33).
 * - Surfaces actionable Forecast Risk Warning Cards (UI Section 34):
 *     - High-Risk Commit Deals (Commit deals flagged at_risk / stalled)
 *     - Deals closing in <= 14 days
 *     - Deals without scheduled next steps
 * - Drives Pipeline Quota Targets and dynamic coverage ratios.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Strict zero 'any' / zero 'any[]'.
 * - Minimum 44x44px touch targets on all interactive controls.
 * - Dynamic multi-currency formatting via `formatCurrency()`.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Layers, 
  Target, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  FileQuestion,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';
import type { Deal, DealStage, ForecastCategory, PipelineTarget } from '@/lib/types';
import { calculateWeightedValue } from '@/lib/deals/deal-health-engine';
import { calculateForecastRiskSummary } from '@/lib/deals/deal-analytics-engine';
import { updateDealAction } from '@/app/actions/deal-actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import PipelineTargetModal from './PipelineTargetModal';
import Link from 'next/link';

interface DealsForecastViewProps {
  pipelineId: string;
  deals: Deal[];
  stages: DealStage[];
  pipelineTarget?: PipelineTarget | null;
  onOpenDeal?: (deal: Deal) => void;
  onTargetSaved?: (target: PipelineTarget) => void;
}

const FORECAST_CATEGORIES: Array<{
  id: ForecastCategory;
  label: string;
  description: string;
  color: string;
  defaultProbability: number;
}> = [
  {
    id: 'commit',
    label: 'Commit',
    description: 'Guaranteed or pledged to close this period',
    color: '#10b981', // emerald
    defaultProbability: 90,
  },
  {
    id: 'best_case',
    label: 'Best Case',
    description: 'High-probability upside opportunities',
    color: '#3b82f6', // blue
    defaultProbability: 70,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'Active opportunities in progression',
    color: '#8b5cf6', // purple
    defaultProbability: 40,
  },
  {
    id: 'closed',
    label: 'Closed Won',
    description: 'Secured and completed revenue',
    color: '#059669', // dark green
    defaultProbability: 100,
  },
  {
    id: 'omitted',
    label: 'Omitted',
    description: 'Excluded from forecast calculations',
    color: '#64748b', // slate
    defaultProbability: 0,
  },
];

export default function DealsForecastView({
  pipelineId,
  deals,
  stages,
  pipelineTarget = null,
  onOpenDeal,
  onTargetSaved,
}: DealsForecastViewProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = React.useState<'all' | 'this_month' | 'this_quarter'>('all');
  const [isTargetModalOpen, setIsTargetModalOpen] = React.useState(false);
  const [activeRiskDrawer, setActiveRiskDrawer] = React.useState<'high_risk' | 'closing_soon' | 'no_next_step' | null>(null);

  const filteredDeals = React.useMemo(() => {
    if (timeframe === 'all') return deals;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return deals.filter(deal => {
      if (!deal.expectedCloseDate) return true;
      const closeDate = new Date(deal.expectedCloseDate);
      if (isNaN(closeDate.getTime())) return true;

      if (timeframe === 'this_month') {
        return closeDate.getFullYear() === currentYear && closeDate.getMonth() === currentMonth;
      }

      if (timeframe === 'this_quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        const dealQuarter = Math.floor(closeDate.getMonth() / 3);
        return closeDate.getFullYear() === currentYear && currentQuarter === dealQuarter;
      }

      return true;
    });
  }, [deals, timeframe]);

  const categoryGroups = React.useMemo(() => {
    const groups = new Map<ForecastCategory, { deals: Deal[]; totalValue: number; weightedValue: number }>();

    FORECAST_CATEGORIES.forEach(cat => {
      groups.set(cat.id, { deals: [], totalValue: 0, weightedValue: 0 });
    });

    for (const deal of filteredDeals) {
      // Won deals belong to 'closed'. Lost deals belong to 'omitted'.
      const cat: ForecastCategory = deal.status === 'won'
        ? 'closed'
        : deal.status === 'lost'
        ? 'omitted'
        : (deal.forecastCategory || 'pipeline');

      const group = groups.get(cat) || groups.get('pipeline')!;
      const val = Number.isFinite(deal.value) ? deal.value : 0;
      const prob = deal.status === 'lost'
        ? 0
        : (deal.probability ?? (cat === 'closed' ? 100 : (cat === 'commit' ? 90 : (cat === 'best_case' ? 70 : 40))));

      group.deals.push(deal);
      group.totalValue += val;
      if (cat !== 'omitted') {
        group.weightedValue += calculateWeightedValue(val, prob);
      }
    }

    return groups;
  }, [filteredDeals]);

  const overallWeightedForecast = React.useMemo(() => {
    let total = 0;
    categoryGroups.forEach((group, cat) => {
      if (cat !== 'omitted') {
        total += group.weightedValue;
      }
    });
    return total;
  }, [categoryGroups]);

  // Risk Summary Extraction (UI Section 34)
  const riskSummary = React.useMemo(() => {
    return calculateForecastRiskSummary(filteredDeals, stages);
  }, [filteredDeals, stages]);

  const commitValue = categoryGroups.get('commit')?.totalValue || 0;
  const bestCaseValue = categoryGroups.get('best_case')?.totalValue || 0;
  const pipelineValue = categoryGroups.get('pipeline')?.totalValue || 0;
  const wonValue = categoryGroups.get('closed')?.totalValue || 0;
  const totalActivePipeline = commitValue + bestCaseValue + pipelineValue;

  const targetAmount = pipelineTarget?.targetAmount || 0;
  const coverageRatio = targetAmount > 0 ? Number((totalActivePipeline / targetAmount).toFixed(2)) : 0;

  const handleCategoryChange = async (dealId: string, newCategory: ForecastCategory) => {
    if (!activeWorkspaceId) return;

    try {
      const res = await updateDealAction(dealId, {
        forecastCategory: newCategory,
      }, activeWorkspaceId, user?.uid);

      if (res.success) {
        toast({
          title: 'Forecast Category Updated',
          description: `Moved deal to ${FORECAST_CATEGORIES.find(c => c.id === newCategory)?.label || newCategory}.`,
        });
      } else {
        throw new Error(res.error || 'Failed to update forecast category');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Update Failed', description: error });
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-5 max-w-full overflow-y-auto scrollbar-thin">
      {/* Forecast Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border/80 shadow-sm shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg">
              Weighted Forecasting
            </Badge>
            <span className="text-xs font-bold text-muted-foreground">
              Total Weighted Expected: <strong className="text-foreground">{formatCurrency(overallWeightedForecast)}</strong>
            </span>
          </div>
          <h2 className="text-xl font-black text-foreground tracking-tight">
            Revenue Opportunity & Forecast Matrix
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsTargetModalOpen(true)}
            className="h-10 min-h-[44px] rounded-xl text-xs font-bold border-border/80 bg-background hover:bg-muted/10 flex items-center gap-1.5"
          >
            <Target className="h-4 w-4 text-primary" />
            <span>{targetAmount > 0 ? `Target: ${formatCurrency(targetAmount)}` : 'Set Quota Target'}</span>
          </Button>

          <Select value={timeframe} onValueChange={(val: 'all' | 'this_month' | 'this_quarter') => setTimeframe(val)}>
            <SelectTrigger className="w-44 h-10 min-h-[44px] rounded-xl text-xs font-bold border-border/80 bg-background">
              <Calendar className="h-3.5 w-3.5 mr-2 text-primary" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-popover z-[200]">
              <SelectItem value="all" className="text-xs font-semibold">All Timeframes</SelectItem>
              <SelectItem value="this_month" className="text-xs font-semibold">Closing This Month</SelectItem>
              <SelectItem value="this_quarter" className="text-xs font-semibold">Closing This Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* UI Section 33: Visual Forecast Horizon & Target Progression Bar */}
      <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Forecast Category Breakdown</span>
          </div>
          {targetAmount > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Pipeline Target Quota:</span>
              <strong className="text-foreground">{formatCurrency(targetAmount)}</strong>
              <Badge variant="outline" className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                coverageRatio >= 3 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
              }`}>
                {coverageRatio}× Coverage
              </Badge>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No revenue target set for this period · <button type="button" onClick={() => setIsTargetModalOpen(true)} className="text-primary font-bold hover:underline">Set Quota</button>
            </span>
          )}
        </div>

        {/* Stacked Horizon Bar */}
        <div className="h-6 w-full bg-muted/40 rounded-2xl overflow-hidden p-1 border border-border/50 flex gap-1 items-center">
          {wonValue > 0 && (
            <div
              style={{ width: `${Math.max(5, (wonValue / (totalActivePipeline + wonValue || 1)) * 100)}%` }}
              className="h-full bg-emerald-600 rounded-xl transition-all duration-500"
              title={`Closed Won: ${formatCurrency(wonValue)}`}
            />
          )}
          {commitValue > 0 && (
            <div
              style={{ width: `${Math.max(5, (commitValue / (totalActivePipeline + wonValue || 1)) * 100)}%` }}
              className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-xl transition-all duration-500"
              title={`Commit: ${formatCurrency(commitValue)}`}
            />
          )}
          {bestCaseValue > 0 && (
            <div
              style={{ width: `${Math.max(5, (bestCaseValue / (totalActivePipeline + wonValue || 1)) * 100)}%` }}
              className="h-full bg-blue-500 rounded-xl transition-all duration-500"
              title={`Best Case: ${formatCurrency(bestCaseValue)}`}
            />
          )}
          {pipelineValue > 0 && (
            <div
              style={{ width: `${Math.max(5, (pipelineValue / (totalActivePipeline + wonValue || 1)) * 100)}%` }}
              className="h-full bg-purple-500 rounded-xl transition-all duration-500"
              title={`Pipeline: ${formatCurrency(pipelineValue)}`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1 font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span className="text-muted-foreground">Won:</span>
            <strong className="text-foreground">{formatCurrency(wonValue)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 dark:bg-emerald-500" />
            <span className="text-muted-foreground">Commit:</span>
            <strong className="text-foreground">{formatCurrency(commitValue)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Best Case:</span>
            <strong className="text-foreground">{formatCurrency(bestCaseValue)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">Pipeline:</span>
            <strong className="text-foreground">{formatCurrency(pipelineValue)}</strong>
          </div>
        </div>
      </div>

      {/* UI Section 34: Forecast Risk Warning Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <span>Forecast Risks & Attention Priorities</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. High-Risk Commit Deals */}
          <div
            onClick={() => setActiveRiskDrawer(activeRiskDrawer === 'high_risk' ? null : 'high_risk')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
              riskSummary.highRiskCommitCount > 0
                ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30 hover:border-red-500/50 shadow-xs'
                : 'bg-card border-border/50 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-black text-red-600 dark:text-red-400">
                  High-Risk Commit Deals
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-extrabold bg-red-500/10 text-red-600 border-red-500/20">
                {riskSummary.highRiskCommitCount}
              </Badge>
            </div>
            <div className="text-xl font-black text-foreground mt-2 tracking-tight">
              {formatCurrency(riskSummary.highRiskCommitValue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {riskSummary.highRiskCommitCount > 0
                ? 'Committed opportunities flagged at-risk or with SLA breaches.'
                : 'No at-risk deals in Commit category.'}
            </p>
          </div>

          {/* 2. Closing in 14 Days */}
          <div
            onClick={() => setActiveRiskDrawer(activeRiskDrawer === 'closing_soon' ? null : 'closing_soon')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
              riskSummary.closingIn14DaysCount > 0
                ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 shadow-xs'
                : 'bg-card border-border/50 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                  Closing Within 14 Days
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-extrabold bg-amber-500/10 text-amber-600 border-amber-500/20">
                {riskSummary.closingIn14DaysCount}
              </Badge>
            </div>
            <div className="text-xl font-black text-foreground mt-2 tracking-tight">
              {formatCurrency(riskSummary.closingIn14DaysValue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active opportunities with target close dates in the next 14 calendar days.
            </p>
          </div>

          {/* 3. Without Next Steps */}
          <div
            onClick={() => setActiveRiskDrawer(activeRiskDrawer === 'no_next_step' ? null : 'no_next_step')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
              riskSummary.withoutNextStepsCount > 0
                ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50 shadow-xs'
                : 'bg-card border-border/50 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                  Without Next Steps
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-extrabold bg-purple-500/10 text-purple-600 border-purple-500/20">
                {riskSummary.withoutNextStepsCount}
              </Badge>
            </div>
            <div className="text-xl font-black text-foreground mt-2 tracking-tight">
              {formatCurrency(riskSummary.withoutNextStepsValue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active opportunities lacking defined forward actions or follow-up tasks.
            </p>
          </div>
        </div>

        {/* Expandable Risk Deals Drawer */}
        {activeRiskDrawer && (
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-md space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-foreground">
                {activeRiskDrawer === 'high_risk' && 'High-Risk Commit Opportunities'}
                {activeRiskDrawer === 'closing_soon' && 'Opportunities Closing in ≤ 14 Days'}
                {activeRiskDrawer === 'no_next_step' && 'Opportunities Lacking Scheduled Next Steps'}
              </span>
              <button
                type="button"
                onClick={() => setActiveRiskDrawer(null)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold"
              >
                Close Drawer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-52 overflow-y-auto">
              {(activeRiskDrawer === 'high_risk'
                ? riskSummary.highRiskCommitDeals
                : activeRiskDrawer === 'closing_soon'
                ? riskSummary.closingSoonDeals
                : riskSummary.noNextStepDeals
              ).map(deal => (
                <div
                  key={deal.id}
                  onClick={() => onOpenDeal ? onOpenDeal(deal) : window.open(`/admin/deals/${deal.id}`, '_blank')}
                  className="p-2.5 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-foreground truncate">{deal.name}</div>
                    <div className="text-[10px] text-muted-foreground font-semibold">
                      {formatCurrency(deal.value || 0)} · {deal.assignedTo?.name || 'Unassigned'}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Forecast Columns Matrix */}
      <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex items-start gap-4 min-w-[1300px] h-full">
          {FORECAST_CATEGORIES.map(category => {
            const group = categoryGroups.get(category.id) || { deals: [], totalValue: 0, weightedValue: 0 };

            return (
              <div 
                key={category.id} 
                className="w-[260px] md:w-[280px] shrink-0 flex flex-col h-full rounded-3xl bg-card/60 border border-border/70 overflow-hidden shadow-sm"
              >
                {/* Category Header */}
                <div 
                  className="p-4 border-b border-border/40 bg-card/90 space-y-2 relative"
                >
                  <div 
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      {category.label}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 h-5" style={{ color: category.color, borderColor: `${category.color}40` }}>
                      {group.deals.length}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {category.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Total</span>
                      <div className="font-extrabold text-foreground">
                        {formatCurrency(group.totalValue)}
                      </div>
                    </div>
                    {category.id !== 'omitted' && (
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Weighted</span>
                        <div className="font-extrabold" style={{ color: category.color }}>
                          {formatCurrency(group.weightedValue)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deals List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[520px] scrollbar-none">
                  {group.deals.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/60 rounded-2xl opacity-40">
                      <Layers className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs font-bold text-muted-foreground">No Deals</span>
                    </div>
                  ) : (
                    group.deals.map(deal => {
                      const prob = deal.probability ?? category.defaultProbability;
                      const isLost = deal.status === 'lost';
                      const isWon = deal.status === 'won';

                      return (
                        <div 
                          key={deal.id}
                          className="p-3 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-2 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link 
                              href={`/admin/deals/${deal.id}`}
                              className="text-xs font-bold text-foreground hover:text-primary transition-colors line-clamp-1 flex-1"
                            >
                              {deal.name}
                            </Link>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-black text-foreground">
                              {formatCurrency(deal.value || 0)}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4 bg-muted/30">
                              {isLost ? '0%' : isWon ? '100%' : `${prob}%`}
                            </Badge>
                          </div>

                          {/* Quick Category Switcher */}
                          {!isWon && !isLost && (
                            <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-muted-foreground">Category:</span>
                              <Select
                                value={deal.forecastCategory || 'pipeline'}
                                onValueChange={(val: ForecastCategory) => handleCategoryChange(deal.id, val)}
                              >
                                <SelectTrigger className="h-6 px-2 text-[10px] font-bold rounded-lg border-border/60 bg-muted/20 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border bg-popover z-[250]">
                                  {FORECAST_CATEGORIES.filter(c => c.id !== 'closed').map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                                      {c.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Modal */}
      <PipelineTargetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        pipelineId={pipelineId}
        currentTarget={pipelineTarget}
        onTargetSaved={onTargetSaved}
      />
    </div>
  );
}
