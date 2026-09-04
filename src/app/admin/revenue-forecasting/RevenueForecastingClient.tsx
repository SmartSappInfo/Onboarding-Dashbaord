'use client';

/**
 * @fileoverview Revenue Attribution & Predictive Forecasting Cockpit Host Client (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. High-density KPI cards (P50 Forecast, Committed Revenue, Quota Attainment %, Slipped Deals).
 * 2. 4 Master Tabs:
 *    - Predictive Forecast & Clari Overview
 *    - Multi-Touch Revenue Attribution
 *    - Daily Pace & Target Attainment
 *    - Deal Slippage Velocity Radar
 * 3. Mobile touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Secure tenant isolation via useWorkspace() and useTenant().
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  BarChart3,
  Layers,
  Target,
  Compass,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { RevenueForecastOverview } from '@/lib/revenue-forecasting/types';
import { getRevenueForecastOverviewAction } from '@/app/actions/revenue-forecasting-actions';
import { ForecastOverviewTab } from './components/ForecastOverviewTab';
import { RevenueAttributionTab } from './components/RevenueAttributionTab';
import { TargetPaceTrackerTab } from './components/TargetPaceTrackerTab';
import { DealSlippageRadarTab } from './components/DealSlippageRadarTab';

export default function RevenueForecastingClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const currentUserId = user?.uid || 'usr_rep_1';
  const currentUserName = user?.displayName || 'Sales Leader';

  // State
  const [activeTab, setActiveTab] = React.useState<string>('overview');
  const [overview, setOverview] = React.useState<RevenueForecastOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Data Loading
  const loadData = React.useCallback(async () => {
    try {
      const res = await getRevenueForecastOverviewAction({
        workspaceId,
        organizationId,
        userId: currentUserId,
        userName: currentUserName,
      });

      if (res.success && res.overview) {
        setOverview(res.overview);
      } else if (res.error) {
        toast({
          title: 'Forecasting Sync Notice',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to communicate with forecasting engine.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, currentUserName, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    toast({
      title: 'Forecast Recalculated',
      description: 'Monte Carlo simulations, credit splits, and slippage metrics updated.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">
          Running Monte Carlo simulation & revenue attribution models...
        </p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <h2 className="text-lg font-bold text-foreground">Forecast Overview Unavailable</h2>
        <p className="text-xs text-muted-foreground max-w-md">
          Unable to retrieve predictive forecasting records. Please ensure your workspace has initialized deal records.
        </p>
        <Button onClick={handleRefresh} className="rounded-xl font-bold text-xs min-h-[44px]">
          Retry Connection
        </Button>
      </div>
    );
  }

  const criticalSlippageCount = overview.slippageRadar.filter(
    (d) => d.severity === 'critical' || d.severity === 'high'
  ).length;

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Cockpit Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Revenue Attribution & Predictive Forecasting
              </h1>
              <p className="text-xs text-muted-foreground">
                Multi-touch attribution, 10,000-run Monte Carlo simulation, Clari categories, and close-date slippage velocity.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl font-bold text-xs gap-2 min-h-[44px] shadow-sm active:scale-[0.97]"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <RefreshCw className="w-4 h-4 text-primary" />
            )}
            <span>Recalculate Pipeline</span>
          </Button>
        </div>
      </div>

      {/* Top High-Density Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Monte Carlo P50 Forecast */}
        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Monte Carlo P50
            </span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
              50% Median
            </Badge>
          </div>
          <div className="text-2xl font-black tracking-tight text-primary mt-1">
            GHS {overview.monteCarloResult.p50Likely.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Floor: GHS {overview.monteCarloResult.p10Floor.toLocaleString()} • Ceiling: GHS {overview.monteCarloResult.p90Ceiling.toLocaleString()}
          </p>
        </Card>

        {/* Metric 2: Committed Revenue */}
        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Committed Revenue
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
              {overview.categories.committed.dealCount} Deals
            </Badge>
          </div>
          <div className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
            GHS {overview.totalCommittedValue.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {overview.categories.committed.percentageOfTarget}% of quarterly target quota
          </p>
        </Card>

        {/* Metric 3: Quota Attainment & Pacing */}
        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Quota Attainment
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold capitalize ${
                overview.targetPacing.paceHealth === 'ahead' || overview.targetPacing.paceHealth === 'on_track'
                  ? 'border-emerald-500/40 text-emerald-700'
                  : 'border-amber-500/40 text-amber-700'
              }`}
            >
              {overview.targetPacing.paceHealth.replace('_', ' ')}
            </Badge>
          </div>
          <div className="text-2xl font-black tracking-tight text-foreground mt-1">
            {overview.targetPacing.attainmentPercentage}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            GHS {overview.targetPacing.actualWon.toLocaleString()} won • {overview.targetPacing.daysRemaining} days left
          </p>
        </Card>

        {/* Metric 4: Slippage Radar Warning */}
        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Slipped Deals
            </span>
            {criticalSlippageCount > 0 ? (
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
                {criticalSlippageCount} High Risk
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                Stable
              </Badge>
            )}
          </div>
          <div className="text-2xl font-black tracking-tight text-foreground mt-1">
            {overview.slippageRadar.filter((d) => d.slipCount > 0).length} Deals
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Close dates pushed past baseline schedule
          </p>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-2xl border flex flex-wrap gap-1 w-full justify-start h-auto">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97] transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Predictive Forecast & Clari</span>
          </TabsTrigger>

          <TabsTrigger
            value="attribution"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97] transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Multi-Touch Attribution</span>
          </TabsTrigger>

          <TabsTrigger
            value="pace"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97] transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Target className="w-4 h-4 text-blue-600" />
            <span>Daily Pace Tracker</span>
          </TabsTrigger>

          <TabsTrigger
            value="slippage"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97] transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Compass className="w-4 h-4 text-amber-600" />
            <span>Slippage Velocity Radar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="focus-visible:outline-none">
          <ForecastOverviewTab
            overview={overview}
            workspaceId={workspaceId}
            organizationId={organizationId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onDealReassigned={loadData}
          />
        </TabsContent>

        <TabsContent value="attribution" className="focus-visible:outline-none">
          <RevenueAttributionTab
            overview={overview}
            workspaceId={workspaceId}
            organizationId={organizationId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onAttributionUpdated={loadData}
          />
        </TabsContent>

        <TabsContent value="pace" className="focus-visible:outline-none">
          <TargetPaceTrackerTab overview={overview} />
        </TabsContent>

        <TabsContent value="slippage" className="focus-visible:outline-none">
          <DealSlippageRadarTab overview={overview} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
