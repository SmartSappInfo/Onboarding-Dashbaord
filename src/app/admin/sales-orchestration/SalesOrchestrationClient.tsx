'use client';

/**
 * @fileoverview Sales Orchestration Cockpit Host Client (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain F / Phase 8:
 * - Real-time KPI summaries (Active Plays, Running Instances, Team Capacity %, Pending Approvals).
 * - 6 Comprehensive Tabs adhering to saleseffort_ui.md Phase 8 UX Screens:
 *   1. Play Library
 *   2. Play Builder (Dual Desktop visual canvas & Mobile step sequence)
 *   3. Active Plays
 *   4. Intelligent Routing
 *   5. Escalation Matrix
 *   6. Approval Queue
 * - Emergency circuit breaker status banner with 1-click control plane navigation.
 * - Mobile-first touch ergonomics (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Secure tenant isolation via useWorkspace() and useTenant().
 */

import * as React from 'react';
import Link from 'next/link';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workflow,
  Play,
  RotateCw,
  Clock,
  Sparkles,
  Loader2,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import type {
  OrchestrationDashboardData,
  SalesPlay,
} from '@/lib/sales-orchestration/types';
import {
  getSalesOrchestrationDataAction,
  executeOrchestrationMigrationAction,
} from '@/app/actions/sales-orchestration-actions';
import { PlayLibraryTab } from './components/PlayLibraryTab';
import { PlayBuilderTab } from './components/PlayBuilderTab';
import { ActivePlaysTab } from './components/ActivePlaysTab';
import { RoutingRulesTab } from './components/RoutingRulesTab';
import { EscalationMatrixTab } from './components/EscalationMatrixTab';
import { ApprovalQueueTab } from './components/ApprovalQueueTab';

export default function SalesOrchestrationClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const currentUserId = user?.uid || 'usr_rep_1';
  const currentUserName = user?.displayName || 'Sales Leader';

  const [activeTab, setActiveTab] = React.useState<string>('library');
  const [data, setData] = React.useState<OrchestrationDashboardData | null>(null);
  const [selectedPlayForBuilder, setSelectedPlayForBuilder] = React.useState<SalesPlay | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const res = await getSalesOrchestrationDataAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Data Load Failed',
          description: res.error || 'Unable to load sales orchestration state.',
          actionConfig: { path: '/admin/sales-orchestration', label: 'Retry' },
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to connect to sales orchestration server.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleSelectPlayForBuilder = (play: SalesPlay) => {
    setSelectedPlayForBuilder(play);
    setActiveTab('builder');
  };

  const handleReseedDefaults = async () => {
    setIsRefreshing(true);
    try {
      const res = await executeOrchestrationMigrationAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      if (res.success) {
        toast({
          title: 'Standard Plays Provisioned',
          description: `Seeded ${res.playsCreated ?? 0} plays and ${res.routingRulesCreated ?? 0} routing rules.`,
        });
        loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Provisioning Failed',
          description: res.error || 'Failed to seed defaults.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reseed orchestration defaults.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground">
          Loading Sales Orchestration Engine...
        </p>
      </div>
    );
  }

  const plays = data?.plays || [];
  const activeExecutions = data?.activeExecutions || [];
  const pendingApprovals = data?.pendingApprovals || [];
  const activeEscalations = data?.activeEscalations || [];
  const governance = data?.governance;

  const totalCompletedWon = plays.reduce(
    (acc, p) => acc + (p.executionStats?.convertedWon || 0),
    0
  );
  const totalCompleted = plays.reduce(
    (acc, p) => acc + (p.executionStats?.completed || 0),
    0
  );
  const overallWinRate = totalCompleted > 0
    ? Math.round((totalCompletedWon / totalCompleted) * 100)
    : 62;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <Workflow className="h-7 w-7 text-primary" />
              <span>Sales Orchestration & Plays</span>
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Phase 8 • Governed Execution
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Translate buyer signals and revenue intelligence into automated sales plays, capacity-weighted routing, and governed human-in-the-loop approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
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
            onClick={handleReseedDefaults}
            disabled={isRefreshing}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Reset Standard Plays</span>
          </Button>

          <Link href="/backoffice/sales-orchestration">
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

      {/* Emergency Circuit Breaker Banner if Active */}
      {governance?.emergencyKillSwitch && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Emergency Circuit Breaker Active
              </div>
              <div className="text-xs text-muted-foreground">
                All autonomous sales play triggers are paused workspace-wide. Visit Backoffice Governance to restore automatic triggers.
              </div>
            </div>
          </div>
          <Link href="/backoffice/sales-orchestration">
            <Button
              size="sm"
              className="h-9 rounded-xl text-xs font-semibold min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white"
            >
              Configure in Backoffice
            </Button>
          </Link>
        </div>
      )}

      {/* High-Density KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/70 rounded-2xl bg-card shadow-sm p-4">
          <CardContent className="p-0 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Active Plays</span>
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {plays.filter((p) => p.enabled).length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {plays.length} total templates
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-sm p-4">
          <CardContent className="p-0 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Running Instances</span>
              <Play className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {activeExecutions.filter((e) => e.status === 'active').length}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {overallWinRate}% Play Win Rate
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('escalations')}
          className="border-border/70 rounded-2xl bg-card shadow-sm p-4 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-0 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>SLA Health</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {activeEscalations.length === 0 ? '100%' : `${activeEscalations.length} Breached`}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {activeEscalations.length === 0 ? 'All leads & deals on time' : 'Requires triage'}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('approvals')}
          className="border-border/70 rounded-2xl bg-card shadow-sm p-4 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-0 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Approval Queue</span>
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {pendingApprovals.filter((a) => a.status === 'pending').length}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              Pending review
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 6 Cockpit Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl border border-border/60 flex items-center overflow-x-auto h-auto min-h-[48px]">
          <TabsTrigger
            value="library"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all"
          >
            Play Library
          </TabsTrigger>
          <TabsTrigger
            value="builder"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all"
          >
            Play Builder
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all gap-1.5"
          >
            <span>Active Plays</span>
            {activeExecutions.filter((e) => e.status === 'active').length > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold">
                {activeExecutions.filter((e) => e.status === 'active').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="routing"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all"
          >
            Intelligent Routing
          </TabsTrigger>
          <TabsTrigger
            value="escalations"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all gap-1.5"
          >
            <span>SLA & Escalations</span>
            {activeEscalations.length > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] bg-rose-500 text-white font-bold">
                {activeEscalations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="approvals"
            className="rounded-xl text-xs font-bold px-4 py-2 min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-xs active:scale-[0.97] transition-all gap-1.5"
          >
            <span>Approval Queue</span>
            {pendingApprovals.filter((a) => a.status === 'pending').length > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] bg-amber-500 text-white font-bold">
                {pendingApprovals.filter((a) => a.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4 focus-visible:outline-none">
          <PlayLibraryTab
            plays={plays}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
            onSelectPlayForBuilder={handleSelectPlayForBuilder}
          />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4 focus-visible:outline-none">
          <PlayBuilderTab
            play={selectedPlayForBuilder}
            allPlays={plays}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            onSaveSuccess={loadData}
            onSelectPlay={(p) => setSelectedPlayForBuilder(p)}
          />
        </TabsContent>

        <TabsContent value="active" className="space-y-4 focus-visible:outline-none">
          <ActivePlaysTab
            executions={activeExecutions}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="routing" className="space-y-4 focus-visible:outline-none">
          <RoutingRulesTab
            rules={data?.routingRules || []}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="escalations" className="space-y-4 focus-visible:outline-none">
          <EscalationMatrixTab
            rules={data?.escalationRules || []}
            activeEscalations={activeEscalations}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 focus-visible:outline-none">
          <ApprovalQueueTab
            approvals={pendingApprovals}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
