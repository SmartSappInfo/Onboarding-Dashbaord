'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Mission Control Hub
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Supervisor Operations:
 *    - Unifies mission input, live DAG plan graph, step inspector, approval gating,
 *      result cards, and history table.
 * 2. Mobile Accessibility:
 *    - All interactive targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Smooth state changes and tactile buttons (`active:scale-[0.97]`).
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  History,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { SupervisorMissionInput } from './SupervisorMissionInput';
import { SupervisorPlanGraph } from './SupervisorPlanGraph';
import { SupervisorStepInspectorDrawer } from './SupervisorStepInspectorDrawer';
import { SupervisorApprovalBanner } from './SupervisorApprovalBanner';
import { SupervisorResultCard } from './SupervisorResultCard';
import { SupervisorRunsHistoryTable } from './SupervisorRunsHistoryTable';
import {
  startSupervisorMissionAction,
  resumeSupervisorMissionAction,
  cancelSupervisorMissionAction,
  listSupervisorRunsAction,
  executeProposedActionAction,
} from '@/lib/supervisor/actions/supervisor-actions';
import type {
  AgentRun,
  SupervisorPlanStep,
  AgentActionProposal,
} from '@/lib/supervisor/types';

export interface SupervisorMissionControlProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
  initialRuns?: AgentRun[];
  defaultSubjectId?: string;
  defaultSubjectType?: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
}

export function SupervisorMissionControl({
  workspaceId,
  organizationId,
  userId,
  initialRuns = [],
  defaultSubjectId,
  defaultSubjectType,
}: SupervisorMissionControlProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'mission' | 'history'>('mission');
  const [runs, setRuns] = React.useState<AgentRun[]>(initialRuns);
  const [activeRun, setActiveRun] = React.useState<AgentRun | null>(null);
  const [selectedStep, setSelectedStep] = React.useState<SupervisorPlanStep | null>(null);
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [isAdjudicating, setIsAdjudicating] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isExecutingAction, setIsExecutingAction] = React.useState(false);

  // Load past runs on initial mount if not provided
  const loadRuns = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await listSupervisorRunsAction({ workspaceId, userId, limit: 30 });
      if (res.success && res.data) {
        setRuns(res.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [workspaceId, userId]);

  React.useEffect(() => {
    if (initialRuns.length === 0) {
      void loadRuns();
    }
  }, [loadRuns, initialRuns.length]);

  // Launch a new mission
  const handleLaunchMission = async (params: {
    objective: string;
    subjectId?: string;
    subjectType?: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
    executionMode: 'autonomous' | 'step_by_step';
    maxSteps: number;
  }) => {
    setIsLaunching(true);
    try {
      const res = await startSupervisorMissionAction({
        workspaceId,
        organizationId,
        userId,
        ...params,
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Mission Launch Failed',
          description: res.error || 'Failed to start supervisor mission.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
        return;
      }

      setActiveRun(res.data);
      setRuns((prev) => [res.data as AgentRun, ...prev.filter((r) => r.id !== res.data?.id)]);

      if (res.data.status === 'needs_approval') {
        toast({
          title: 'Approval Required',
          description: 'Mission paused: a step requires human administrator sign-off.',
        });
      } else if (res.data.status === 'completed') {
        toast({
          title: 'Mission Completed',
          description: 'The Supervisor Agent has finished executing the synthesized plan.',
        });
      }
    } finally {
      setIsLaunching(false);
    }
  };

  // Approve a paused step
  const handleApproveStep = async () => {
    if (!activeRun || !activeRun.pendingApprovalId) return;

    setIsAdjudicating(true);
    try {
      const res = await resumeSupervisorMissionAction({
        workspaceId,
        userId,
        runId: activeRun.id,
        approvalId: activeRun.pendingApprovalId,
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Resumption Failed',
          description: res.error || 'Failed to resume mission after approval.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
        return;
      }

      setActiveRun(res.data);
      setRuns((prev) => [res.data as AgentRun, ...prev.filter((r) => r.id !== res.data?.id)]);
      toast({
        title: 'Step Approved & Mission Resumed',
        description: 'Execution continued successfully.',
      });
    } finally {
      setIsAdjudicating(false);
    }
  };

  // Cancel an active or paused run
  const handleCancelRun = async () => {
    if (!activeRun) return;

    setIsAdjudicating(true);
    try {
      const res = await cancelSupervisorMissionAction({
        workspaceId,
        userId,
        runId: activeRun.id,
        reason: 'Cancelled by operator from Mission Control.',
      });

      if (res.success && res.data) {
        setActiveRun(res.data);
        setRuns((prev) => [res.data as AgentRun, ...prev.filter((r) => r.id !== res.data?.id)]);
        toast({
          title: 'Mission Cancelled',
          description: 'The execution has been stopped.',
        });
      }
    } finally {
      setIsAdjudicating(false);
    }
  };

  // Execute a recommended action from result card
  const handleExecuteAction = async (action: AgentActionProposal) => {
    setIsExecutingAction(true);
    try {
      const res = await executeProposedActionAction({
        workspaceId,
        organizationId,
        userId,
        action,
      });

      if (res.success) {
        toast({
          title: 'Action Executed',
          description: `Successfully executed "${action.title}".`,
        });
      } else {
        toast({
          title: 'Execution Failed',
          description: res.error || 'Failed to execute proposed action.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } finally {
      setIsExecutingAction(false);
    }
  };

  const pausedStep = activeRun?.steps.find((s) => s.status === 'needs_approval') || null;

  return (
    <div className="space-y-6 font-figtree">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Supervisor Agent Mission Control
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Autonomous, governed mission orchestration across SmartSapp memory, CRM, deals, and tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadRuns}
            disabled={isRefreshing}
            className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'mission' | 'history')}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl min-h-[44px]">
          <TabsTrigger
            value="mission"
            className="gap-2 text-xs font-semibold min-h-[38px] rounded-lg active:scale-[0.97]"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Active Mission</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2 text-xs font-semibold min-h-[38px] rounded-lg active:scale-[0.97]"
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Mission History ({runs.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Mission Hub */}
        <TabsContent value="mission" className="space-y-6 pt-1">
          {/* Input Launcher */}
          <SupervisorMissionInput
            onLaunch={handleLaunchMission}
            isLoading={isLaunching}
            defaultSubjectId={defaultSubjectId}
            defaultSubjectType={defaultSubjectType}
          />

          {/* Active Mission Progression */}
          {activeRun && (
            <div className="space-y-6 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mission Progression & Timeline
                </span>
                <span className="font-mono text-xs text-slate-400">ID: {activeRun.id}</span>
              </div>

              {/* Approval Interception Banner */}
              {activeRun.status === 'needs_approval' && (
                <SupervisorApprovalBanner
                  pausedStep={pausedStep}
                  pendingApprovalId={activeRun.pendingApprovalId}
                  onApprove={handleApproveStep}
                  onCancel={handleCancelRun}
                  isAdjudicating={isAdjudicating}
                />
              )}

              {/* Decomposed Plan Graph */}
              <SupervisorPlanGraph
                steps={activeRun.steps}
                onSelectStep={(step) => setSelectedStep(step)}
                selectedStepNumber={selectedStep?.stepNumber}
              />

              {/* Executive Result Briefing */}
              {activeRun.result && (
                <SupervisorResultCard
                  result={activeRun.result}
                  onExecuteAction={handleExecuteAction}
                  isExecutingAction={isExecutingAction}
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Mission History */}
        <TabsContent value="history" className="space-y-4 pt-1">
          <SupervisorRunsHistoryTable
            runs={runs}
            onSelectRun={(run) => {
              setActiveRun(run);
              setActiveTab('mission');
            }}
            isLoading={isRefreshing}
          />
        </TabsContent>
      </Tabs>

      {/* Step Inspector Drawer */}
      <SupervisorStepInspectorDrawer
        step={selectedStep}
        isOpen={Boolean(selectedStep)}
        onClose={() => setSelectedStep(null)}
      />
    </div>
  );
}
