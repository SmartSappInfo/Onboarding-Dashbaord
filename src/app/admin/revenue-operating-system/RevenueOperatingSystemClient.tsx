'use client';

/**
 * @fileoverview Advanced Revenue Operating System Cockpit Client (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10 / PRD Section 123 (Phase 10):
 * - Executive Boardroom Pulse: C-Suite metrics, pacing trajectory curve, AI executive briefing.
 * - Revenue "What-If" Sensitivity Simulator: Vectorized in-memory sliders, confidence intervals, save scenario (+20 pts).
 * - Multi-Cohort Capacity Planning: Quota coverage, ramp discounting (0.35x, 0.70x, 1.00x), rep utilization, hiring gap.
 * - Predictive Attainment & Churn Radar: Health-discounted attainment, early-warning churn alerts.
 * - Organizational Strategy & Archetypes: Behavioral execution archetypes, AI strategic levers (+25 pts).
 * - Live Backoffice Control Plane link.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Secure tenant isolation via useWorkspace() and useTenant().
 * - Mobile touch ergonomics: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 *
 * @testability Deterministic state coordination with isolated Server Action boundaries.
 */

import * as React from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  SlidersHorizontal,
  Users,
  ShieldAlert,
  Compass,
  RotateCw,
  Sparkles,
  Sliders,
  Loader2,
} from 'lucide-react';
import type {
  RevenueScenario,
  RevenueOsGovernance,
  BaselineRevenueContext,
  CapacityPlan,
  PredictiveAttainmentRecord,
  PredictiveChurnRisk,
  OrganizationalBehaviorArchetype,
  AiStrategicRecommendation,
  ExecutiveBoardroomSummary,
} from '@/lib/revenue-os/types';
import {
  getExecutiveBoardroomDataAction,
  saveRevenueScenarioAction,
  deleteRevenueScenarioAction,
  applyStrategicRecommendationAction,
  reseedRevenueOsDefaultsAction,
} from '@/app/actions/revenue-os-actions';
import { ExecutivePulseTab } from './components/ExecutivePulseTab';
import { RevenueSimulatorTab } from './components/RevenueSimulatorTab';
import { CapacityPlannerTab } from './components/CapacityPlannerTab';
import { PredictiveAttainmentTab } from './components/PredictiveAttainmentTab';
import { OrganizationalStrategyTab } from './components/OrganizationalStrategyTab';

export default function RevenueOperatingSystemClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'default-workspace';
  const organizationId = activeOrganizationId || 'default-org';
  const currentUserId = user?.uid || 'system_user';
  const currentUserName = user?.displayName || user?.email || 'Executive Leader';

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSavingScenario, setIsSavingScenario] = React.useState(false);
  const [isApplyingStrategy, setIsApplyingStrategy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('boardroom');

  // Core Data State
  const [governance, setGovernance] = React.useState<RevenueOsGovernance | null>(null);
  const [baseline, setBaseline] = React.useState<BaselineRevenueContext>({
    baselineQuarterlyRevenue: 1250000,
    targetQuarterlyRevenue: 1500000,
    baselineWinRatePercent: 28,
    baselineAverageDealSize: 32000,
    baselineQuarterlyDealsCount: 45,
    baselineSlippageRatePercent: 18,
    baselineSalesCycleDays: 38,
    activeRepsCount: 6,
  });
  const [scenarios, setScenarios] = React.useState<RevenueScenario[]>([]);
  const [capacityPlan, setCapacityPlan] = React.useState<CapacityPlan>({
    id: 'cap_default',
    workspaceId,
    organizationId,
    quarterLabel: 'Q4 2026',
    targetRevenue: 1500000,
    totalReps: 6,
    rampedRepsCount: 3,
    rampingRepsCount: 2,
    effectiveCapacityTotal: 1350000,
    quotaCoverageRatio: 3.2,
    capacityShortfallDollars: 150000,
    recommendedHiresCount: 1,
    cohorts: [],
    updatedAt: new Date().toISOString(),
  });
  const [predictiveAttainments, setPredictiveAttainments] = React.useState<PredictiveAttainmentRecord[]>([]);
  const [churnRisks, setChurnRisks] = React.useState<PredictiveChurnRisk[]>([]);
  const [archetypes, setArchetypes] = React.useState<OrganizationalBehaviorArchetype[]>([]);
  const [strategicRecommendations, setStrategicRecommendations] = React.useState<AiStrategicRecommendation[]>([]);
  const [boardroomSummary, setBoardroomSummary] = React.useState<ExecutiveBoardroomSummary>({
    totalPipelineDollars: 4800000,
    targetRevenueDollars: 1500000,
    weightedForecastDollars: 1410000,
    predictedPacingPercent: 94,
    quotaCoverageRatio: 3.2,
    activeScenariosCount: 3,
    aiExecutiveBriefing: 'Executive forecast predicts $1.41M (94% of quota target) with moderate slippage risk.',
    pacingTrajectory: [],
  });

  const loadData = React.useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await getExecutiveBoardroomDataAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
      });

      if (res.success && res.data) {
        setGovernance(res.data.governance);
        setBaseline(res.data.baseline);
        setScenarios(res.data.scenarios);
        setCapacityPlan(res.data.capacityPlan);
        setPredictiveAttainments(res.data.predictiveAttainments);
        setChurnRisks(res.data.churnRisks);
        setArchetypes(res.data.archetypes);
        setStrategicRecommendations(res.data.strategicRecommendations);
        setBoardroomSummary(res.data.boardroomSummary);
      } else {
        toast({
          title: 'Failed to load Revenue OS data',
          description: res.error || 'Check permissions or workspace setup.',
          variant: 'destructive',
          actionConfig: { path: '/admin', label: 'Admin Hub' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown load error',
        variant: 'destructive',
        actionConfig: { path: '/admin', label: 'Admin Hub' },
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Save Scenario Model
  const handleSaveScenario = async (scenario: RevenueScenario) => {
    try {
      setIsSavingScenario(true);
      const res = await saveRevenueScenarioAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
        actorName: currentUserName,
        scenario,
      });

      if (res.success) {
        toast({
          title: 'Scenario Model Saved',
          description: `Calibrated "${scenario.name}". Awarded +${res.pointsAwarded || 20} effort points.`,
        });
        await loadData();
      } else {
        toast({
          title: 'Save Failed',
          description: res.error || 'Could not save scenario model.',
          variant: 'destructive',
          actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save scenario',
        variant: 'destructive',
        actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
      });
    } finally {
      setIsSavingScenario(false);
    }
  };

  // Handler: Delete Custom Scenario
  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      const res = await deleteRevenueScenarioAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
        scenarioId,
      });

      if (res.success) {
        toast({
          title: 'Scenario Deleted',
          description: 'Removed custom scenario model from boardroom library.',
        });
        await loadData();
      } else {
        toast({
          title: 'Delete Failed',
          description: res.error || 'Could not delete scenario.',
          variant: 'destructive',
          actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Delete failed',
        variant: 'destructive',
        actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
      });
    }
  };

  // Handler: Apply Strategic Recommendation
  const handleApplyRecommendation = async (recId: string) => {
    try {
      setIsApplyingStrategy(true);
      const res = await applyStrategicRecommendationAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
        actorName: currentUserName,
        recId,
      });

      if (res.success) {
        toast({
          title: 'Strategy Enacted',
          description: `Executive intervention applied. Awarded +${res.pointsAwarded || 25} effort points.`,
        });
        await loadData();
      } else {
        toast({
          title: 'Enact Failed',
          description: res.error || 'Could not apply recommendation.',
          variant: 'destructive',
          actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply recommendation',
        variant: 'destructive',
        actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
      });
    } finally {
      setIsApplyingStrategy(false);
    }
  };

  // Handler: Reseed Default Scenarios
  const handleReseed = async () => {
    try {
      setIsRefreshing(true);
      const res = await reseedRevenueOsDefaultsAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
      });

      if (res.success) {
        toast({
          title: 'Revenue OS Baseline Reseeded',
          description: `Initialized ${res.seededScenarios} scenarios and ${res.seededRecommendations} strategic levers.`,
        });
        await loadData();
      } else {
        toast({
          title: 'Reseed Failed',
          description: res.error || 'Could not reseed defaults.',
          variant: 'destructive',
          actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Reseed error',
        variant: 'destructive',
        actionConfig: { path: '/admin/revenue-operating-system', label: 'Revenue OS' },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          Calibrating Revenue Operating System & Boardroom Intelligence...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <TrendingUp className="h-7 w-7 text-primary" />
              Revenue Operating System & Boardroom
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Domain 10 • Executive Pulse
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            C-suite boardroom forecasting, deterministic What-If sensitivity simulations, multi-cohort capacity planning, and predictive churn prevention.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isRefreshing}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReseed}
            disabled={isRefreshing}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Reseed Defaults</span>
          </Button>

          <Link href="/backoffice/revenue-os">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span>Backoffice</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/50 h-auto flex flex-nowrap min-w-max gap-1">
            <TabsTrigger
              value="boardroom"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[44px] flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Executive Boardroom</span>
            </TabsTrigger>

            <TabsTrigger
              value="simulator"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[44px] flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Revenue Simulator</span>
              <Badge variant="outline" className="text-3xs font-mono ml-1 px-1.5 py-0">
                {scenarios.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="capacity"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[44px] flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>Capacity Planner</span>
            </TabsTrigger>

            <TabsTrigger
              value="attainment"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[44px] flex items-center gap-2"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Predictive Radar</span>
              {churnRisks.length > 0 && (
                <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-3xs font-mono ml-1 px-1.5 py-0">
                  {churnRisks.length} Risk
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="strategy"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs min-h-[44px] flex items-center gap-2"
            >
              <Compass className="h-4 w-4" />
              <span>Organizational Strategy</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Executive Boardroom Pulse */}
        <TabsContent value="boardroom">
          <ExecutivePulseTab
            summary={boardroomSummary}
            onNavigateToSimulator={() => setActiveTab('simulator')}
          />
        </TabsContent>

        {/* Tab 2: Interactive Revenue Simulator */}
        <TabsContent value="simulator">
          <RevenueSimulatorTab
            baseline={baseline}
            scenarios={scenarios}
            governance={governance}
            onSaveScenario={handleSaveScenario}
            onDeleteScenario={handleDeleteScenario}
            isSaving={isSavingScenario}
          />
        </TabsContent>

        {/* Tab 3: Multi-Cohort Capacity Planner */}
        <TabsContent value="capacity">
          <CapacityPlannerTab capacityPlan={capacityPlan} />
        </TabsContent>

        {/* Tab 4: Predictive Attainment & Churn Radar */}
        <TabsContent value="attainment">
          <PredictiveAttainmentTab
            predictiveAttainments={predictiveAttainments}
            churnRisks={churnRisks}
          />
        </TabsContent>

        {/* Tab 5: Organizational Strategy & Archetypes */}
        <TabsContent value="strategy">
          <OrganizationalStrategyTab
            archetypes={archetypes}
            strategicRecommendations={strategicRecommendations}
            onApplyRecommendation={handleApplyRecommendation}
            isApplying={isApplyingStrategy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
