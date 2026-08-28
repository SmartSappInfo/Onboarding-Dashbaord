'use client';

/**
 * @fileoverview Deals 2.0 Revenue Forecasting Workspace
 *
 * ARCHITECTURAL POINTER (Forecast Matrix & Revenue Probability):
 * Groups deals into standard CRM Forecast Categories:
 * - Commit (High confidence deals committed for the period)
 * - Best Case (Upside opportunities)
 * - Pipeline (Standard active pipeline)
 * - Closed Won (Successfully won opportunities)
 * - Omitted (Excluded from revenue projections)
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Category mutations must update the deal document and recalculate weighted pipeline.
 * - Multi-currency formatting must route through `formatCurrency()`.
 * - Responsive horizontal scrolling with >= 44px touch targets.
 *
 * TESTABILITY POINTER:
 * Verify changing forecast category invokes `updateDealAction` and updates optimistic totals.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Layers
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';
import type { Deal, DealStage, ForecastCategory } from '@/lib/types';
import { calculateWeightedValue } from '@/lib/deals/deal-health-engine';
import { updateDealAction } from '@/app/actions/deal-actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import Link from 'next/link';

interface DealsForecastViewProps {
  pipelineId: string;
  deals: Deal[];
  stages: DealStage[];
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
  pipelineId: _pipelineId,
  deals,
  stages: _stages,
}: DealsForecastViewProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = React.useState<'all' | 'this_month' | 'this_quarter'>('all');

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
      // ARCHITECTURAL POINTER (Rule 10 - Forecast Isolation):
      // Won deals automatically belong to 'closed'. Lost deals MUST be isolated into 'omitted'
      // to guarantee they never pollute active pipeline columns (Commit, Best Case, Pipeline)
      // or inflate weighted revenue projections.
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
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4 max-w-full overflow-hidden">
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
            Revenue Opportunity Matrix
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeframe} onValueChange={(val: 'all' | 'this_month' | 'this_quarter') => setTimeframe(val)}>
            <SelectTrigger className="w-44 h-10 rounded-xl text-xs font-bold border-border/80 bg-background">
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
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                    <span className="font-black text-foreground">
                      {formatCurrency(group.totalValue)}
                    </span>
                    {category.id !== 'omitted' && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Weighted: {formatCurrency(group.weightedValue)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Deals List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                  {group.deals.map(deal => (
                    <div 
                      key={deal.id}
                      className="p-3.5 rounded-2xl bg-background border border-border/60 hover:border-primary/30 transition-all shadow-sm space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link 
                          href={`/admin/deals/${deal.id}`}
                          className="font-bold text-xs text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {deal.name}
                        </Link>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                        <span className="font-black text-foreground">
                          {formatCurrency(deal.value)}
                        </span>
                        {deal.expectedCloseDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.expectedCloseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {/* Forecast Category Switcher */}
                      <div className="pt-1">
                        <Select 
                          value={deal.status === 'won' ? 'closed' : deal.status === 'lost' ? 'omitted' : (deal.forecastCategory || 'pipeline')}
                          onValueChange={(val: ForecastCategory) => handleCategoryChange(deal.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[10px] font-bold rounded-lg bg-muted/30 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-popover z-[200]">
                            {FORECAST_CATEGORIES.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}

                  {group.deals.length === 0 && (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-muted-foreground/40 text-xs">
                      <Layers className="h-6 w-6 mb-1 opacity-50" />
                      <span>No deals in {category.label}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
