'use client';

/**
 * @fileoverview Forecast Overview Tab with Monte Carlo P10/P50/P90, Clari Categories & AI Synthesis (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. Monte Carlo In-Memory Stochastic Simulations (10,000 iterations): P10 Floor, P50 Likely, P90 Ceiling.
 * 2. Clari-style Category Rollups: Committed, Likely, Best Case, Upside, Omitted.
 * 3. Natural Language AI Forecast Explanation banner with risk factors and recommendations.
 * 4. In-flight Deal Inspection & Category Reassignment Table with +15 effort points on Committed promotion.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile ergonomics: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  Loader2,
} from 'lucide-react';
import type {
  ForecastCategory,
  RevenueForecastOverview,
} from '@/lib/revenue-forecasting/types';
import { reassignForecastCategoryAction } from '@/app/actions/revenue-forecasting-actions';

interface ForecastOverviewTabProps {
  overview: RevenueForecastOverview;
  workspaceId: string;
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  onDealReassigned: () => Promise<void>;
}

export function ForecastOverviewTab({
  overview,
  workspaceId,
  organizationId,
  currentUserId,
  currentUserName,
  onDealReassigned,
}: ForecastOverviewTabProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');
  const [updatingDealId, setUpdatingDealId] = React.useState<string | null>(null);

  const { monteCarloResult, categories, aiExplanation, allDeals, targetPacing } = overview;

  const handleCategoryChange = async (dealId: string, newCategory: ForecastCategory) => {
    setUpdatingDealId(dealId);
    try {
      const res = await reassignForecastCategoryAction({
        dealId,
        workspaceId,
        organizationId,
        newCategory,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      if (res.success) {
        if (res.pointsAwarded && res.pointsAwarded > 0) {
          toast({
            title: 'Forecast Category Locked',
            description: `Opportunity promoted to Committed! Awarded +${res.pointsAwarded} qualification points.`,
          });
        } else {
          toast({
            title: 'Category Updated',
            description: `Deal reassigned to ${newCategory.replace('_', ' ')}.`,
          });
        }
        await onDealReassigned();
      } else {
        throw new Error(res.error || 'Failed to update category');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast({
        title: 'Update Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setUpdatingDealId(null);
    }
  };

  // Filter deals
  const filteredDeals = React.useMemo(() => {
    return allDeals.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.stageName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat =
        selectedCategoryFilter === 'all' || d.forecastCategory === selectedCategoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [allDeals, searchTerm, selectedCategoryFilter]);

  return (
    <div className="space-y-8">
      {/* 1. Monte Carlo Statistical Outcome Distribution Cards */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Monte Carlo Predictive Simulation (10,000 Iterations)
            </h3>
            <p className="text-xs text-muted-foreground">
              Probabilistic distribution modeling based on deal stage velocity, buyer health scores, and historical conversion.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 w-fit">
            Mean: GHS {monteCarloResult.mean.toLocaleString()} (±{monteCarloResult.standardDeviation.toLocaleString()})
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* P10 Floor */}
          <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Conservative Floor (P10)
                </span>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
                  90% Probability
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-1.5">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                GHS {monteCarloResult.p10Floor.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum projected revenue outcome with 9-in-10 statistical confidence.
              </p>
            </CardContent>
          </Card>

          {/* P50 Likely Median */}
          <Card className="border-primary/40 bg-primary/5 rounded-2xl shadow-sm ring-1 ring-primary/20">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Most Likely Median (P50)
                </span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold">
                  50% Median
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-1.5">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-primary">
                GHS {monteCarloResult.p50Likely.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Target baseline expectation. Closest match to actual historical close rates.
              </p>
            </CardContent>
          </Card>

          {/* P90 Ceiling */}
          <Card className="border-emerald-500/30 bg-emerald-500/5 rounded-2xl shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Stretch Ceiling (P90)
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  10% Stretch
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-1.5">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                GHS {monteCarloResult.p90Ceiling.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Optimistic quarterly outcome if upside deals accelerate and zero slippage occurs.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Histogram Distribution Visualizer */}
        {monteCarloResult.distributionBuckets.length > 0 && (
          <Card className="border-border/50 rounded-2xl bg-card p-4 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Simulation Distribution Frequency</span>
                <span>Range: GHS {monteCarloResult.distributionBuckets[0].rangeStart.toLocaleString()} – {monteCarloResult.distributionBuckets[monteCarloResult.distributionBuckets.length - 1].rangeEnd.toLocaleString()}</span>
              </div>
              <div className="flex items-end gap-1.5 h-14 pt-2">
                {monteCarloResult.distributionBuckets.map((b, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-all group relative flex flex-col justify-end"
                    style={{ height: `${Math.min(100, Math.max(8, b.percentage * 3))}%` }}
                    title={`GHS ${b.rangeStart.toLocaleString()}-${b.rangeEnd.toLocaleString()}: ${b.percentage}%`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 pointer-events-none transition-opacity">
                      {b.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 2. Explainable AI Forecast Synthesis Banner */}
      <Card className="border-border/50 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>{aiExplanation.headline}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Natural language forecast explanation synthesized from Monte Carlo runs and pipeline velocity.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs font-bold gap-1 px-2.5 py-1 ${
                  aiExplanation.weeklyConfidenceDelta >= 0
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                    : 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                }`}
              >
                {aiExplanation.weeklyConfidenceDelta >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {aiExplanation.weeklyConfidenceDelta >= 0 ? '+' : ''}
                  {aiExplanation.weeklyConfidenceDelta}% vs last week
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed font-medium">
            {aiExplanation.explanationSummary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Positive Drivers */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Key Positive Drivers</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {aiExplanation.keyPositiveDrivers.map((driver, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Strategic Actions */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Recommended Management Plays</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {aiExplanation.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Key Risk Deals */}
          {aiExplanation.keyRiskDeals.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Top Pipeline Risks:</span>
                <span className="text-muted-foreground font-normal">
                  {aiExplanation.keyRiskDeals.map((r) => `${r.dealName} (GHS ${r.dealValue.toLocaleString()})`).join(', ')}
                </span>
              </div>
              <Badge variant="outline" className="border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold w-fit">
                {aiExplanation.keyRiskDeals.length} deals flagged
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Clari-style Forecast Category Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Clari Forecast Categories
          </h3>
          <span className="text-xs text-muted-foreground">
            Target Quota: GHS {targetPacing.targetQuota.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Committed */}
          <Card
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'committed' ? 'all' : 'committed')}
            className={`cursor-pointer transition-all border-emerald-500/40 rounded-2xl p-4 shadow-sm active:scale-[0.97] min-h-[44px] ${
              selectedCategoryFilter === 'committed' ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : 'bg-card hover:bg-emerald-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Committed</span>
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                {categories.committed.dealCount}
              </Badge>
            </div>
            <div className="text-lg font-black text-foreground">
              GHS {categories.committed.totalValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Weighted: GHS {categories.committed.weightedValue.toLocaleString()}</span>
              <span className="font-bold text-emerald-600">{categories.committed.percentageOfTarget}%</span>
            </div>
          </Card>

          {/* Likely */}
          <Card
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'likely' ? 'all' : 'likely')}
            className={`cursor-pointer transition-all border-blue-500/40 rounded-2xl p-4 shadow-sm active:scale-[0.97] min-h-[44px] ${
              selectedCategoryFilter === 'likely' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'bg-card hover:bg-blue-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Likely</span>
              <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px]">
                {categories.likely.dealCount}
              </Badge>
            </div>
            <div className="text-lg font-black text-foreground">
              GHS {categories.likely.totalValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Weighted: GHS {categories.likely.weightedValue.toLocaleString()}</span>
              <span className="font-bold text-blue-600">{categories.likely.percentageOfTarget}%</span>
            </div>
          </Card>

          {/* Best Case */}
          <Card
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'best_case' ? 'all' : 'best_case')}
            className={`cursor-pointer transition-all border-indigo-500/40 rounded-2xl p-4 shadow-sm active:scale-[0.97] min-h-[44px] ${
              selectedCategoryFilter === 'best_case' ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'bg-card hover:bg-indigo-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase">Best Case</span>
              <Badge className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px]">
                {categories.bestCase.dealCount}
              </Badge>
            </div>
            <div className="text-lg font-black text-foreground">
              GHS {categories.bestCase.totalValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Weighted: GHS {categories.bestCase.weightedValue.toLocaleString()}</span>
              <span className="font-bold text-indigo-600">{categories.bestCase.percentageOfTarget}%</span>
            </div>
          </Card>

          {/* Upside */}
          <Card
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'upside' ? 'all' : 'upside')}
            className={`cursor-pointer transition-all border-amber-500/40 rounded-2xl p-4 shadow-sm active:scale-[0.97] min-h-[44px] ${
              selectedCategoryFilter === 'upside' ? 'ring-2 ring-amber-500 bg-amber-500/10' : 'bg-card hover:bg-amber-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Upside</span>
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px]">
                {categories.upside.dealCount}
              </Badge>
            </div>
            <div className="text-lg font-black text-foreground">
              GHS {categories.upside.totalValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Weighted: GHS {categories.upside.weightedValue.toLocaleString()}</span>
              <span className="font-bold text-amber-600">{categories.upside.percentageOfTarget}%</span>
            </div>
          </Card>

          {/* Omitted */}
          <Card
            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === 'omitted' ? 'all' : 'omitted')}
            className={`cursor-pointer transition-all border-border/50 rounded-2xl p-4 shadow-sm active:scale-[0.97] min-h-[44px] ${
              selectedCategoryFilter === 'omitted' ? 'ring-2 ring-muted-foreground bg-muted/30' : 'bg-card hover:bg-muted/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Omitted</span>
              <Badge variant="outline" className="text-[10px]">
                {categories.omitted.dealCount}
              </Badge>
            </div>
            <div className="text-lg font-black text-foreground">
              GHS {categories.omitted.totalValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Weighted: GHS {categories.omitted.weightedValue.toLocaleString()}</span>
              <span className="font-bold text-muted-foreground">{categories.omitted.percentageOfTarget}%</span>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. In-Flight Deals Inspection & 1-Click Category Reassignment */}
      <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b pb-4 px-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              In-Flight Pipeline Opportunities ({filteredDeals.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Inspect opportunities, review AI health, and promote deals into Committed forecast categories.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deals, reps, stages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl text-xs"
              />
            </div>

            {selectedCategoryFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategoryFilter('all')}
                className="h-10 text-xs font-semibold rounded-xl min-h-[44px]"
              >
                Clear Filter
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Deal Opportunity</th>
                  <th className="py-3.5 px-4 font-bold">Value</th>
                  <th className="py-3.5 px-4 font-bold">Stage</th>
                  <th className="py-3.5 px-4 font-bold">Owner</th>
                  <th className="py-3.5 px-4 font-bold">Health Score</th>
                  <th className="py-3.5 px-4 font-bold">Expected Close</th>
                  <th className="py-3.5 px-4 font-bold text-right">Forecast Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No deals match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => {
                    const isUpdating = updatingDealId === deal.id;
                    const healthTierColor =
                      deal.healthScore >= 75
                        ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30'
                        : deal.healthScore >= 50
                        ? 'text-amber-700 bg-amber-500/10 border-amber-500/30'
                        : 'text-rose-700 bg-rose-500/10 border-rose-500/30';

                    return (
                      <tr key={deal.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground">{deal.name}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            {deal.isSingleThreaded && (
                              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3 inline" /> Single-threaded
                              </span>
                            )}
                            {deal.slipCount > 0 && (
                              <span className="text-rose-600 font-semibold">
                                • Slipped {deal.slipCount}x
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-black text-foreground">
                          GHS {deal.value.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">{deal.stageName}</td>
                        <td className="py-3.5 px-4 text-foreground font-medium">{deal.ownerName}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className={`text-[10px] font-bold ${healthTierColor}`}>
                            {deal.healthScore}/100
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {new Date(deal.expectedCloseDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                              <select
                                value={deal.forecastCategory}
                                onChange={(e) =>
                                  handleCategoryChange(deal.id, e.target.value as ForecastCategory)
                                }
                                className={`text-xs font-bold rounded-xl border px-3 py-1.5 bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] cursor-pointer active:scale-[0.97] transition-all ${
                                  deal.forecastCategory === 'committed'
                                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                                    : deal.forecastCategory === 'likely'
                                    ? 'border-blue-500/40 text-blue-700 dark:text-blue-300'
                                    : deal.forecastCategory === 'best_case'
                                    ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-300'
                                    : deal.forecastCategory === 'upside'
                                    ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                                    : 'border-border text-muted-foreground'
                                }`}
                              >
                                <option value="committed">Committed (High Rigor)</option>
                                <option value="likely">Likely (Strong Path)</option>
                                <option value="best_case">Best Case</option>
                                <option value="upside">Upside</option>
                                <option value="omitted">Omitted</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
