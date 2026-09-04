'use client';

/**
 * @fileoverview AI Sales Workforce Cockpit Host Client (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 9 / Phase 9:
 * - Fleet status header with master kill switch monitoring.
 * - 4 High-Density KPI summary cards.
 * - 6 Comprehensive Tabs adhering to saleseffort_ui.md Phase 9 UX Screens:
 *   1. Agent Fleet (8 specialized agents)
 *   2. Recommendations (Next-Best-Action queue)
 *   3. Approvals (Human-in-the-Loop sensitive action queue)
 *   4. CRM Hygiene (CleanSweep automated audit & repair)
 *   5. Agent Activity (Real-time telemetry stream)
 *   6. AI Impact (Commercial ROI & time recaptured analytics)
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
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
  Bot,
  Zap,
  Lock,
  ShieldCheck,
  Activity,
  TrendingUp,
  RotateCw,
  Sparkles,
  Sliders,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Cpu,
  Loader2,
} from 'lucide-react';
import type {
  AiAgentProfile,
  AiWorkforceGovernancePolicy,
  AiSalesRecommendation,
  AiSalesApproval,
  AiCrmHygieneIssue,
  AiExecutionAuditDoc,
  AiFleetMetrics,
} from '@/lib/ai-sales-workforce/types';
import {
  getAiWorkforceDashboardDataAction,
  reseedAiWorkforceDefaultsAction,
} from '@/app/actions/ai-sales-workforce-actions';
import { AgentFleetTab } from './components/AgentFleetTab';
import { RecommendationsTab } from './components/RecommendationsTab';
import { AiApprovalsTab } from './components/AiApprovalsTab';
import { CrmHygieneTab } from './components/CrmHygieneTab';
import { AgentActivityTab } from './components/AgentActivityTab';
import { AiImpactTab } from './components/AiImpactTab';

export default function AiSalesWorkforceClient() {
  const { currentTenant } = useTenant();
  const { currentWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = currentWorkspace?.id || 'default-workspace';
  const organizationId = currentTenant?.id || 'default-org';
  const currentUserId = user?.uid || 'system_user';
  const currentUserName = user?.displayName || user?.email || 'Sales Operations Leader';

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('fleet');

  const [agents, setAgents] = React.useState<AiAgentProfile[]>([]);
  const [governance, setGovernance] = React.useState<AiWorkforceGovernancePolicy | null>(null);
  const [recommendations, setRecommendations] = React.useState<AiSalesRecommendation[]>([]);
  const [approvals, setApprovals] = React.useState<AiSalesApproval[]>([]);
  const [hygieneIssues, setHygieneIssues] = React.useState<AiCrmHygieneIssue[]>([]);
  const [executions, setExecutions] = React.useState<AiExecutionAuditDoc[]>([]);
  const [metrics, setMetrics] = React.useState<AiFleetMetrics>({
    autonomousActionsTotal: 0,
    hoursSavedEstimate: 0,
    humanApprovalRate: 100,
    activeRecommendationsCount: 0,
    healthIndex: 95,
    activeAgentsCount: 8,
  });

  const loadData = React.useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await getAiWorkforceDashboardDataAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
      });

      if (res.success && res.data) {
        setAgents(res.data.agents);
        setGovernance(res.data.governance);
        setRecommendations(res.data.recommendations);
        setApprovals(res.data.approvals);
        setHygieneIssues(res.data.hygieneIssues);
        setExecutions(res.data.executions);
        setMetrics(res.data.metrics);
      } else {
        toast({
          title: 'Failed to load AI Workforce data',
          description: res.error || 'Check permissions or workspace setup.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown load error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReseed = async () => {
    try {
      setIsRefreshing(true);
      const res = await reseedAiWorkforceDefaultsAction({
        workspaceId,
        organizationId,
        actorId: currentUserId,
      });

      if (res.success) {
        toast({
          title: 'Swarm Reseeded',
          description: `Initialized ${res.seededAgents} standard enterprise AI sales agents.`,
        });
        await loadData();
      } else {
        toast({
          title: 'Reseed Failed',
          description: res.error || 'Could not reseed AI workforce.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Reseed failed',
        variant: 'destructive',
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
          Initializing AI Sales Workforce Swarm...
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
              <Bot className="h-7 w-7 text-primary" />
              AI Sales Workforce
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Domain 9 • Enterprise Swarm
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Specialized autonomous sales agents, next-best-action prioritization, human-in-the-loop approvals, and CRM hygiene.
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
            <span>Reseed Agents</span>
          </Button>

          <Link href="/backoffice/ai-sales-workforce">
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
                AI Autonomous Kill Switch Active
              </div>
              <div className="text-xs text-muted-foreground">
                All autonomous agent actions are frozen workspace-wide. Agents are restricted to advisory recommendations only.
              </div>
            </div>
          </div>
          <Link href="/backoffice/ai-sales-workforce">
            <Button
              size="sm"
              className="h-9 rounded-xl text-xs font-semibold min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white"
            >
              Configure in Backoffice
            </Button>
          </Link>
        </div>
      )}

      {/* High-Density Fleet KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-4 sm:p-5 space-y-1">
          <span className="text-2xs sm:text-xs font-semibold text-muted-foreground">
            Autonomous Actions
          </span>
          <div className="text-xl sm:text-2xl font-black text-foreground">
            {metrics.autonomousActionsTotal.toLocaleString()}
          </div>
          <div className="text-2xs text-muted-foreground">
            Executed at Level 4 Autonomy
          </div>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-4 sm:p-5 space-y-1">
          <span className="text-2xs sm:text-xs font-semibold text-muted-foreground">
            Seller Hours Saved
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
            {metrics.hoursSavedEstimate}h
          </div>
          <div className="text-2xs text-muted-foreground">
            ~21 mins per automated task
          </div>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-4 sm:p-5 space-y-1">
          <span className="text-2xs sm:text-xs font-semibold text-muted-foreground">
            Approval Sign-Off Rate
          </span>
          <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
            {metrics.humanApprovalRate}%
          </div>
          <div className="text-2xs text-muted-foreground">
            Level 3 proposals approved
          </div>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-4 sm:p-5 space-y-1">
          <span className="text-2xs sm:text-xs font-semibold text-muted-foreground">
            Pending Recommendations
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-500">
            {metrics.activeRecommendationsCount}
          </div>
          <div className="text-2xs text-muted-foreground">
            Awaiting rep action in My Day
          </div>
        </Card>
      </div>

      {/* 6 Responsive Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
          <TabsTrigger
            value="fleet"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <Bot className="h-4 w-4 text-primary" />
            <span>Agent Fleet ({agents.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="recommendations"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Next-Best Actions</span>
            {recommendations.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-2xs px-1.5 py-0">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="approvals"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <Lock className="h-4 w-4 text-purple-500" />
            <span>Approvals Queue</span>
            {approvals.length > 0 && (
              <Badge className="bg-purple-500 text-white text-2xs px-1.5 py-0">
                {approvals.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="hygiene"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-500" />
            <span>CRM Hygiene</span>
            {hygieneIssues.length > 0 && (
              <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-2xs px-1.5 py-0">
                {hygieneIssues.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="activity"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <Activity className="h-4 w-4 text-primary" />
            <span>Agent Activity</span>
          </TabsTrigger>

          <TabsTrigger
            value="impact"
            className="rounded-xl text-xs font-semibold px-4 py-2 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2"
          >
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span>ROI & Impact</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-4 focus-visible:outline-none">
          <AgentFleetTab
            agents={agents}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 focus-visible:outline-none">
          <RecommendationsTab
            recommendations={recommendations}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 focus-visible:outline-none">
          <AiApprovalsTab
            approvals={approvals}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="hygiene" className="space-y-4 focus-visible:outline-none">
          <CrmHygieneTab
            hygieneIssues={hygieneIssues}
            workspaceId={workspaceId}
            organizationId={organizationId}
            actorId={currentUserId}
            actorName={currentUserName}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 focus-visible:outline-none">
          <AgentActivityTab executions={executions} />
        </TabsContent>

        <TabsContent value="impact" className="space-y-4 focus-visible:outline-none">
          <AiImpactTab metrics={metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
