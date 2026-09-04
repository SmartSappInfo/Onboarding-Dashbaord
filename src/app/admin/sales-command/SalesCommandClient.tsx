'use client';

/**
 * @fileoverview Manager Command Center Main Client Component (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Sections 36-40 & UI Sections 38-40:
 * - Central operational cockpit for sales leadership:
 *   1. Macro KPI Strip: Revenue won, active pipeline, weighted forecast, quota attainment, win rate, velocity.
 *   2. AI Executive Team Brief: Automated risk attribution and strategic guidance.
 *   3. 3-Tab Operational Workflow:
 *      - Tab 1: Command Center (Attention Items, Rep Health Matrix, At-Risk Deals Table).
 *      - Tab 2: Team Workload (Capacity Heatmap, Rebalancing Workbench).
 *      - Tab 3: 1:1 Coaching Studio (Dossiers, Phase 1 scorecards, Phase 2 velocity, Commitments).
 *   4. Instant Intervention Drawer: Hero priority elevation (into Phase 2 My Day), reassignment, guidance notes.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero 'any' or 'any[]'.
 * - Interactive elements must provide minimum 44px touch targets.
 * - Conforms to Emil Kowalski micro-interactions (active:scale-[0.97], sub-200ms transitions).
 */

import * as React from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ShieldCheck,
  RefreshCw,
  Flame,
  BarChart3,
  Calendar,
  Layers,
  Settings,
} from 'lucide-react';
import type {
  ManagerCommandOverview,
  AtRiskDeal,
  RepWorkloadSummary,
  ManagerInterventionType,
} from '@/lib/manager-command/types';
import { getManagerCommandOverviewAction } from '@/app/actions/manager-command-actions';
import { MacroKpiStrip } from './components/MacroKpiStrip';
import { AiTeamBriefCard } from './components/AiTeamBriefCard';
import { CommandCenterTab } from './components/CommandCenterTab';
import { TeamWorkloadTab } from './components/TeamWorkloadTab';
import { CoachingStudioTab } from './components/CoachingStudioTab';
import { InterventionDrawer } from './components/InterventionDrawer';

export default function SalesCommandClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'command' | 'workload' | 'coaching'>('command');
  const [selectedTeamId, _setSelectedTeamId] = React.useState<string | undefined>(undefined);
  const [overview, setOverview] = React.useState<ManagerCommandOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Intervention drawer state
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);
  const [targetDeal, setTargetDeal] = React.useState<AtRiskDeal | null>(null);
  const [targetRep, setTargetRep] = React.useState<RepWorkloadSummary | null>(null);
  const [interventionType, setInterventionType] = React.useState<ManagerInterventionType>('elevate_to_hero');

  // Coaching Studio active rep
  const [selectedCoachingRepId, setSelectedCoachingRepId] = React.useState<string | undefined>(undefined);

  const organizationId = activeWorkspace?.organizationId || activeWorkspaceId || '';
  const managerId = user?.uid || 'manager_admin';
  const managerName = user?.displayName || user?.email || 'Sales Manager';

  // Load Overview Data
  const loadOverview = React.useCallback(
    async (isBackground = false) => {
      if (!activeWorkspaceId) return;

      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const res = await getManagerCommandOverviewAction({
          workspaceId: activeWorkspaceId,
          organizationId,
          teamId: selectedTeamId,
        });

        if (res.success && res.data) {
          setOverview(res.data);
          if (!selectedCoachingRepId && res.data.reps.length > 0) {
            setSelectedCoachingRepId(res.data.reps[0].userId);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Command Intelligence Error',
            description: res.error || 'Failed to load manager command intelligence.',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          variant: 'destructive',
          title: 'Command Intelligence Error',
          description: `Error loading command overview: ${msg}`,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeWorkspaceId, organizationId, selectedTeamId, selectedCoachingRepId, toast]
  );

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleOpenIntervention = (params: {
    targetDeal?: AtRiskDeal;
    targetRep?: RepWorkloadSummary;
    defaultType?: ManagerInterventionType;
  }) => {
    setTargetDeal(params.targetDeal || null);
    setTargetRep(params.targetRep || null);
    setInterventionType(params.defaultType || 'elevate_to_hero');
    setIsDrawerOpen(true);
  };

  const handleSelectRepForCoaching = (repId: string) => {
    setSelectedCoachingRepId(repId);
    setActiveTab('coaching');
  };

  const handleNavigateToWorkload = () => {
    setActiveTab('workload');
  };

  if (isLoading && !overview) {
    return (
      <PageContainer className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Manager Command Center
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
              Phase 3 Intelligence
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {overview?.dateString || 'Today'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pipeline health, proactive risk intervention, and team capacity orchestration.
          </p>
        </div>

        {/* Action Header Nav */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOverview(true)}
            disabled={isRefreshing}
            className="h-10 min-h-[44px] sm:min-h-[40px] px-3 text-xs font-semibold rounded-xl gap-1.5 active:scale-[0.97]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/admin/my-day">
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-semibold rounded-xl gap-1.5 active:scale-[0.97]"
            >
              <Flame className="h-3.5 w-3.5 text-primary" />
              <span>Seller View (My Day)</span>
            </Button>
          </Link>

          <Link href="/admin/analytics/sales-effort">
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-semibold rounded-xl gap-1.5 active:scale-[0.97]"
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span>Scorecards & Rules</span>
            </Button>
          </Link>

          <Link href="/backoffice/sales-teams">
            <Button
              variant="secondary"
              size="sm"
              className="h-10 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-semibold rounded-xl gap-1.5 active:scale-[0.97]"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Team Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {overview && (
        <>
          {/* 2. Bento Macro KPI Metric Strip */}
          <MacroKpiStrip kpis={overview.teamMacroKPIs} />

          {/* 3. Executive AI Intelligence Brief */}
          <AiTeamBriefCard
            brief={overview.aiTeamBrief}
            onReviewRisksClick={() => setActiveTab('command')}
          />

          {/* 4. 3-Tab Operational Cockpit */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'command' | 'workload' | 'coaching')}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-3 h-12 rounded-2xl bg-muted/50 p-1 border border-border/40">
              <TabsTrigger
                value="command"
                className="rounded-xl text-xs sm:text-sm font-bold min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Command Center</span>
                  {overview.attentionItems.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
                      {overview.attentionItems.length}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="workload"
                className="rounded-xl text-xs sm:text-sm font-bold min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <span>Team Workload</span>
                  {overview.teamMacroKPIs.overloadedRepsCount > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold border-destructive/40 text-destructive">
                      {overview.teamMacroKPIs.overloadedRepsCount} Over
                    </Badge>
                  )}
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="coaching"
                className="rounded-xl text-xs sm:text-sm font-bold min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <span>1:1 Coaching Studio</span>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Command Center */}
            <TabsContent value="command" className="space-y-6">
              <CommandCenterTab
                attentionItems={overview.attentionItems}
                reps={overview.reps}
                atRiskDeals={overview.atRiskDeals}
                onTriggerIntervention={handleOpenIntervention}
                onSelectRepForCoaching={handleSelectRepForCoaching}
                onNavigateToWorkload={handleNavigateToWorkload}
              />
            </TabsContent>

            {/* Tab 2: Team Workload */}
            <TabsContent value="workload" className="space-y-6">
              <TeamWorkloadTab
                reps={overview.reps}
                atRiskDeals={overview.atRiskDeals}
                workspaceId={activeWorkspaceId || ''}
                organizationId={organizationId}
                managerId={managerId}
                onWorkloadRebalanced={() => loadOverview(true)}
              />
            </TabsContent>

            {/* Tab 3: Coaching Studio */}
            <TabsContent value="coaching" className="space-y-6">
              <CoachingStudioTab
                reps={overview.reps}
                selectedRepId={selectedCoachingRepId}
                onSelectRep={setSelectedCoachingRepId}
                workspaceId={activeWorkspaceId || ''}
                organizationId={organizationId}
                onTriggerIntervention={handleOpenIntervention}
              />
            </TabsContent>
          </Tabs>

          {/* 5. Slide-over Intervention Drawer */}
          <InterventionDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            targetDeal={targetDeal}
            targetRep={targetRep}
            availableReps={overview.reps}
            defaultType={interventionType}
            workspaceId={activeWorkspaceId || ''}
            organizationId={organizationId}
            managerId={managerId}
            managerName={managerName}
            onSuccess={() => loadOverview(true)}
          />
        </>
      )}
    </PageContainer>
  );
}
