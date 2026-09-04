'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Master Autonomous Workflows Hub
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Unified Control Plane:
 *    - Connects active workflows, live step monitors, approval gates, and turnkey blueprints.
 * 2. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - All states and action dispatches are strictly typed with domain models.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Smooth tab transitions, tactile buttons with `active:scale-[0.97]`.
 * 4. Mobile First & Accessibility:
 *    - All touch targets satisfy >= 44px (`min-h-[44px] sm:min-h-[36px]`).
 *
 * @testability Tested in `src/lib/workflows/__tests__/workflow-engine.test.ts`.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Workflow,
  Activity,
  Sparkles,
  ShieldAlert,
  Play,
  FlaskConical,
  Plus,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowSimulationResult,
} from '@/lib/workflows/types';
import type { McpPayloadValue } from '@/lib/mcp/types';
import {
  listWorkflowsAction,
  saveWorkflowAction,
  startWorkflowRunAction,
  listWorkflowRunsAction,
  resumeWorkflowRunAction,
  simulateWorkflowAction,
  installBlueprintAction,
} from '@/lib/workflows/actions/workflow-actions';
import { WorkflowApprovalGateBanner } from './WorkflowApprovalGateBanner';
import { WorkflowRunMonitor } from './WorkflowRunMonitor';
import { WorkflowBuilderCanvas } from './WorkflowBuilderCanvas';
import { WorkflowSimulatorModal } from './WorkflowSimulatorModal';
import { WorkflowGalleryGrid } from './WorkflowGalleryGrid';

export interface CompanyBrainWorkflowsHubProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
  initialWorkflows?: WorkflowDefinition[];
  initialRuns?: WorkflowRun[];
}

export function CompanyBrainWorkflowsHub({
  workspaceId,
  organizationId,
  userId,
  initialWorkflows = [],
  initialRuns = [],
}: CompanyBrainWorkflowsHubProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<string>('workflows');
  const [workflows, setWorkflows] = React.useState<WorkflowDefinition[]>(initialWorkflows);
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string>(
    initialWorkflows[0]?.id || ''
  );
  const [runs, setRuns] = React.useState<WorkflowRun[]>(initialRuns);
  const [selectedRunId, setSelectedRunId] = React.useState<string>(initialRuns[0]?.id || '');

  // Loading & Action States
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [isExecuting, setIsExecuting] = React.useState<boolean>(false);
  const [isAdjudicating, setIsAdjudicating] = React.useState<boolean>(false);
  const [installingBlueprintId, setInstallingBlueprintId] = React.useState<string | null>(null);

  // Simulation Modal State
  const [simulatorWorkflow, setSimulatorWorkflow] = React.useState<WorkflowDefinition | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = React.useState<boolean>(false);

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || workflows[0] || null;
  const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0] || null;
  const pendingApprovalRun = runs.find((r) => r.status === 'waiting_approval') || null;

  // Refresh workflows and runs on mount if empty
  const fetchWorkflowsAndRuns = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [wfRes, runsRes] = await Promise.all([
        listWorkflowsAction({ workspaceId, userId }),
        listWorkflowRunsAction({ workspaceId, userId, limit: 30 }),
      ]);

      if (wfRes.success && wfRes.data) {
        setWorkflows(wfRes.data);
        if (!selectedWorkflowId && wfRes.data.length > 0) {
          setSelectedWorkflowId(wfRes.data[0].id);
        }
      }

      if (runsRes.success && runsRes.data) {
        setRuns(runsRes.data);
        if (!selectedRunId && runsRes.data.length > 0) {
          setSelectedRunId(runsRes.data[0].id);
        }
      }
    } catch {
      toast({
        title: 'Sync Error',
        description: 'Failed to refresh workflow pipelines.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, userId, selectedWorkflowId, selectedRunId, toast]);

  React.useEffect(() => {
    if (workflows.length === 0) {
      void fetchWorkflowsAndRuns();
    }
  }, [fetchWorkflowsAndRuns, workflows.length]);

  // Handle Save Workflow
  const handleSaveWorkflow = async (updated: WorkflowDefinition) => {
    setIsSaving(true);
    try {
      const res = await saveWorkflowAction({ workflow: updated, userId });
      if (res.success && res.data) {
        toast({
          title: 'Workflow Saved',
          description: `Pipeline "${res.data.title}" updated successfully.`,
        });
        setWorkflows((prev) => {
          const idx = prev.findIndex((w) => w.id === res.data!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data!;
            return next;
          }
          return [res.data!, ...prev];
        });
        setSelectedWorkflowId(res.data.id);
      } else {
        toast({
          title: 'Failed to Save',
          description: res.error || 'Validation error while saving pipeline.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save pipeline.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Execute Run
  const handleExecuteWorkflow = async (wf: WorkflowDefinition) => {
    setIsExecuting(true);
    try {
      const res = await startWorkflowRunAction({
        workflowId: wf.id,
        workspaceId,
        userId,
        initialPayload: { manualTriggerTime: new Date().toISOString() },
      });

      if (res.success && res.data) {
        toast({
          title: 'Workflow Initiated',
          description: `Run ${res.data.id} is now executing.`,
        });
        setRuns((prev) => [res.data!, ...prev]);
        setSelectedRunId(res.data.id);
        setActiveTab('monitor');
      } else {
        toast({
          title: 'Execution Failed',
          description: res.error || 'Failed to start pipeline run.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Execution error.',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Adjudicate Approval
  const handleAdjudicateApproval = async (
    runId: string,
    approvalId: string,
    adjudication: 'approved' | 'rejected'
  ) => {
    setIsAdjudicating(true);
    try {
      const res = await resumeWorkflowRunAction({
        runId,
        workspaceId,
        approvalId,
        adjudication,
        userId,
      });

      if (res.success && res.data) {
        toast({
          title: adjudication === 'approved' ? 'Run Approved & Resumed' : 'Run Rejected',
          description: `Workflow run ${runId} has resumed execution.`,
        });
        setRuns((prev) => prev.map((r) => (r.id === runId ? res.data! : r)));
        setSelectedRunId(runId);
        setActiveTab('monitor');
      } else {
        toast({
          title: 'Adjudication Error',
          description: res.error || 'Failed to adjudicate human sign-off.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to adjudicate.',
        variant: 'destructive',
      });
    } finally {
      setIsAdjudicating(false);
    }
  };

  // Handle Dry-Run Simulation
  const handleSimulate = (wf: WorkflowDefinition) => {
    setSimulatorWorkflow(wf);
    setIsSimulatorOpen(true);
  };

  const handleExecuteSimulation = async (
    wf: WorkflowDefinition,
    payload: Record<string, McpPayloadValue>
  ): Promise<WorkflowSimulationResult | null> => {
    const res = await simulateWorkflowAction({
      workflow: wf,
      workspaceId,
      userId,
      simulatedPayload: payload,
    });

    if (res.success && res.data) {
      toast({
        title: 'Simulation Complete',
        description: `Traversed ${res.data.simulatedPath.length} steps without mutating data.`,
      });
      return res.data;
    } else {
      toast({
        title: 'Simulation Error',
        description: res.error || 'Dry-run failed.',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Handle Install Blueprint
  const handleInstallBlueprint = async (blueprintId: string) => {
    setInstallingBlueprintId(blueprintId);
    try {
      const res = await installBlueprintAction({
        blueprintId,
        workspaceId,
        organizationId,
        userId,
      });

      if (res.success && res.data) {
        toast({
          title: 'Blueprint Installed',
          description: `Blueprint "${res.data.title}" successfully installed.`,
        });
        setWorkflows((prev) => [res.data!, ...prev]);
        setSelectedWorkflowId(res.data.id);
        setActiveTab('workflows');
      } else {
        toast({
          title: 'Installation Failed',
          description: res.error || 'Failed to install blueprint.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Blueprint installation failed.',
        variant: 'destructive',
      });
    } finally {
      setInstallingBlueprintId(null);
    }
  };

  const handleCreateNewWorkflow = () => {
    const newWf: WorkflowDefinition = {
      id: `wf_${Date.now()}`,
      workspaceId,
      organizationId,
      title: 'New Custom Workflow',
      description: 'Configure trigger, specialist agents, context dossiers, and actions.',
      trigger: {
        type: 'event',
        eventType: 'crm.deal.stalled',
      },
      nodes: [
        {
          id: 'node_spec_1',
          title: 'Revenue Specialist Analysis',
          nodeType: 'specialist',
          specialistId: 'revenue_specialist',
          nextNodeIds: [],
        },
      ],
      status: 'draft',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    setWorkflows((prev) => [newWf, ...prev]);
    setSelectedWorkflowId(newWf.id);
    setActiveTab('workflows');
  };

  const activeCount = workflows.filter((w) => w.status === 'active').length;
  const pendingCount = runs.filter((r) => r.status === 'waiting_approval').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Telemetry Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Autonomous Workflows & Background Triggers
            </h2>
            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-900 font-medium">
              Phase 9 Apex
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
            Event-driven multi-agent orchestration pipelines coordinating domain specialists, token-budget context dossiers, branching decisions, and human approval gates.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchWorkflowsAndRuns}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setActiveTab('blueprints')}
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.97] gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Blueprint Gallery
          </Button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 border-slate-200 bg-white">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Active Workflows
          </span>
          <span className="text-xl font-bold text-slate-900">{activeCount}</span>
        </Card>
        <Card className="p-3.5 border-slate-200 bg-white">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Pipelines
          </span>
          <span className="text-xl font-bold text-slate-900">{workflows.length}</span>
        </Card>
        <Card className="p-3.5 border-slate-200 bg-white">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Pending Human Gates
          </span>
          <span className={`text-xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {pendingCount}
          </span>
        </Card>
        <Card className="p-3.5 border-slate-200 bg-white">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Runs Recorded
          </span>
          <span className="text-xl font-bold text-slate-900">{runs.length}</span>
        </Card>
      </div>

      {/* Prominent Human Approval Banner if any run is halted */}
      {pendingApprovalRun && (
        <WorkflowApprovalGateBanner
          run={pendingApprovalRun}
          onAdjudicate={handleAdjudicateApproval}
          isAdjudicating={isAdjudicating}
        />
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap">
          <TabsTrigger
            value="workflows"
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
          >
            <Workflow className="w-3.5 h-3.5 mr-1.5" />
            Workflows & Visual Builder
          </TabsTrigger>
          <TabsTrigger
            value="monitor"
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Execution Runs & Monitor ({runs.length})
          </TabsTrigger>
          <TabsTrigger
            value="blueprints"
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Turnkey Blueprints
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Workflows & Visual Builder */}
        <TabsContent value="workflows" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">Select Pipeline:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {workflows.map((wf) => (
                  <Button
                    key={wf.id}
                    type="button"
                    variant={selectedWorkflowId === wf.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedWorkflowId(wf.id)}
                    className={`min-h-[44px] sm:min-h-[32px] text-xs font-medium active:scale-[0.97] transition-all ${
                      selectedWorkflowId === wf.id
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {wf.title}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateNewWorkflow}
              className="min-h-[44px] sm:min-h-[32px] text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Pipeline
            </Button>
          </div>

          {selectedWorkflow ? (
            <WorkflowBuilderCanvas
              workflow={selectedWorkflow}
              onSaveWorkflow={handleSaveWorkflow}
              onSimulate={handleSimulate}
              onExecute={handleExecuteWorkflow}
              isSaving={isSaving}
              isExecuting={isExecuting}
            />
          ) : (
            <Card className="p-8 text-center bg-slate-50/50 border-dashed">
              <Workflow className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">No workflows configured yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Install a turnkey blueprint or create a custom pipeline to get started.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => setActiveTab('blueprints')}
                  className="min-h-[44px] text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Install Blueprint
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Execution Runs & Monitor */}
        <TabsContent value="monitor" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Runs List */}
            <Card className="p-4 border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-900">Execution Runs</span>
                <Badge variant="outline" className="text-[10px]">
                  {runs.length} recorded
                </Badge>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {runs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No runs recorded yet.</p>
                ) : (
                  runs.map((r) => {
                    const isSelected = selectedRunId === r.id;
                    const matchingWf = workflows.find((w) => w.id === r.workflowId);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRunId(r.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs min-h-[44px] active:scale-[0.98] ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold text-slate-900 truncate">
                            {matchingWf?.title || r.workflowId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(r.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-500 text-[10px]">
                            {r.id.substring(0, 14)}...
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Right: Detailed Run Monitor */}
            <div className="lg:col-span-2">
              <WorkflowRunMonitor
                run={selectedRun}
                workflow={workflows.find((w) => w.id === selectedRun?.workflowId) || null}
                onRefresh={fetchWorkflowsAndRuns}
                isLoading={isLoading}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Turnkey Blueprints */}
        <TabsContent value="blueprints" className="space-y-4">
          <WorkflowGalleryGrid
            onInstallBlueprint={handleInstallBlueprint}
            installingId={installingBlueprintId}
            installedBlueprintIds={workflows.map((w) => w.id)}
          />
        </TabsContent>
      </Tabs>

      {/* Dry-Run Simulator Modal */}
      <WorkflowSimulatorModal
        workflow={simulatorWorkflow}
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSimulate={handleExecuteSimulation}
      />
    </div>
  );
}
