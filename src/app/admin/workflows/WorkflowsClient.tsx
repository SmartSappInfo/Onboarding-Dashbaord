'use client';

/**
 * @fileOverview Workflow Mission Control Operator Client (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile-first responsive touch targets (min-h-[44px]).
 * - Rule 8 & 47: Multi-tenant Anti-IDOR isolation using active workspace context.
 * - Rule 26: Cooperative cancellation trigger and state updates.
 * - Rule 51: Server Action integration with error handling and toasts.
 * - Rule 60: Rule 60 emergency pause banner and fail-closed state indicators.
 * - Rule 61: Backoffice operator control plane surfaces.
 * - Rule 62: Live SSE reactivity via useEventStream.
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  listWorkflowsAction,
  getWorkflowDetailsAction,
  cancelWorkflowInstanceAction,
  instantiateWorkflowTemplateAction,
  getWorkflowPlatformMetricsAction,
  listWorkflowTemplatesAction,
  type WorkflowPlatformMetrics,
} from '@/app/actions/workflow-admin-actions';
import type {
  WorkflowInstance,
  WorkflowStep,
  WorkflowCheckpoint,
  WorkflowState,
} from '@/platform/workflows/workflow-types';
import type { WorkflowTemplateDefinition } from '@/platform/workflows/templates/workflow-template-types';
import {
  WorkflowMetricsCards,
  WorkflowDeadManBanner,
  WorkflowFilterToolbar,
  WorkflowInstancesTable,
  LaunchTemplateModal,
  WorkflowDetailDrawer,
} from '@/components/workflows';

export function WorkflowsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const orgId = activeOrganizationId || 'org_default';
  const wsId = activeWorkspaceId || 'ws_default';

  // Filters & State
  const initialStatus = (searchParams.get('status') as WorkflowState | 'ALL') || 'ALL';
  const [statusFilter, setStatusFilter] = React.useState<WorkflowState | 'ALL'>(initialStatus);
  const [searchQuery, setSearchQuery] = React.useState('');

  const [metrics, setMetrics] = React.useState<WorkflowPlatformMetrics | null>(null);
  const [instances, setInstances] = React.useState<WorkflowInstance[]>([]);
  const [templates, setTemplates] = React.useState<WorkflowTemplateDefinition[]>([]);

  // Drawer & Modal State
  const [selectedInstance, setSelectedInstance] = React.useState<WorkflowInstance | null>(null);
  const [selectedSteps, setSelectedSteps] = React.useState<WorkflowStep[]>([]);
  const [selectedCheckpoints, setSelectedCheckpoints] = React.useState<WorkflowCheckpoint[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = React.useState(false);

  // Loading States
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = React.useState(false);

  // Sync status filter with URL
  const handleStatusFilterChange = (status: WorkflowState | 'ALL') => {
    setStatusFilter(status);
    if (status === 'ALL') {
      router.replace('/admin/workflows', { scroll: false });
    } else {
      router.replace(`/admin/workflows?status=${status}`, { scroll: false });
    }
  };

  const fetchAllData = React.useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [metricsRes, instancesRes, templatesRes] = await Promise.all([
        getWorkflowPlatformMetricsAction({ organizationId: orgId, workspaceId: wsId }),
        listWorkflowsAction({
          organizationId: orgId,
          workspaceId: wsId,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 100,
        }),
        listWorkflowTemplatesAction(),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (instancesRes.success && instancesRes.data) {
        setInstances(instancesRes.data.items);
      }
      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
      }
    } catch (err: unknown) {
      toast({
        title: 'Failed to load workflow data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orgId, wsId, statusFilter, toast]);

  React.useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Live SSE stream subscription for automated refresh with 500ms debounce (Rule 62)
  const sseRefreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEventStream({
    workspaceId: wsId,
    enabled: Boolean(wsId),
    onActivity: (activity) => {
      if (
        activity.eventType.startsWith('workflow.') ||
        activity.eventType.startsWith('governance.')
      ) {
        if (sseRefreshTimerRef.current) {
          clearTimeout(sseRefreshTimerRef.current);
        }
        sseRefreshTimerRef.current = setTimeout(() => {
          void fetchAllData(true);
        }, 500);
      }
    },
  });

  React.useEffect(() => {
    return () => {
      if (sseRefreshTimerRef.current) {
        clearTimeout(sseRefreshTimerRef.current);
      }
    };
  }, []);

  // Inspect details handler
  const handleInspect = async (workflowId: string) => {
    setIsDrawerLoading(true);
    try {
      const res = await getWorkflowDetailsAction({
        workflowId,
        organizationId: orgId,
        workspaceId: wsId,
      });

      if (res.success && res.data) {
        setSelectedInstance(res.data.instance);
        setSelectedSteps(res.data.steps);
        setSelectedCheckpoints(res.data.checkpoints);
        setIsDrawerOpen(true);
      } else {
        toast({
          title: 'Failed to load workflow details',
          description: res.error || 'Workflow not found',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Inspection failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDrawerLoading(false);
    }
  };

  // Cancel workflow handler
  const handleCancel = async (workflowId: string, reason?: string) => {
    try {
      const res = await cancelWorkflowInstanceAction({
        workflowId,
        organizationId: orgId,
        workspaceId: wsId,
        reason,
      });

      if (res.success && res.data) {
        toast({
          title: 'Workflow cancelled',
          description: `Instance ${workflowId} cooperative cancellation initiated.`,
        });
        // Optimistically update status
        setInstances((prev) =>
          prev.map((inst) =>
            inst.id === workflowId ? { ...inst, status: 'CANCELLED' } : inst
          )
        );
        if (selectedInstance && selectedInstance.id === workflowId) {
          setSelectedInstance((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
        }
      } else {
        toast({
          title: 'Cancellation failed',
          description: res.error || 'Failed to cancel workflow',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Cancellation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Launch template handler
  const handleLaunch = async (input: {
    templateId: string;
    title?: string;
    inputs: Record<string, unknown>;
    dryRun?: boolean;
  }) => {
    setIsLaunching(true);
    try {
      const res = await instantiateWorkflowTemplateAction({
        templateId: input.templateId,
        title: input.title,
        inputs: input.inputs,
        organizationId: orgId,
        workspaceId: wsId,
        dryRun: input.dryRun,
      });

      if (res.success && res.data) {
        toast({
          title: input.dryRun ? 'Simulation complete' : 'Workflow launched',
          description: `Workflow ${res.data.workflowId} (${res.data.definitionId}) created with status: ${res.data.status}.`,
        });
        void fetchAllData(true);
      } else {
        throw new Error(res.error || 'Failed to launch workflow');
      }
    } finally {
      setIsLaunching(false);
    }
  };

  // Client-side search filtering
  const filteredInstances = React.useMemo(() => {
    let result = instances;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inst) =>
          inst.title.toLowerCase().includes(q) ||
          inst.definitionId.toLowerCase().includes(q) ||
          inst.id.toLowerCase().includes(q) ||
          inst.initiator.actorId.toLowerCase().includes(q) ||
          inst.idempotencyKey.toLowerCase().includes(q)
      );
    }
    return result;
  }, [instances, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-foreground">
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Workflow Mission Control
              </h1>
              <CardInfoTooltip text="Enterprise control plane for deterministic business workflow DAGs, Cloud Tasks execution, human approval pauses, and emergency governance." />
            </div>
            <p className="text-sm text-muted-foreground">
              Monitor, launch, inspect, and manage multi-step business workflows with idempotent guarantees.
            </p>
          </div>
        </div>

        {/* Rule 60 Emergency Dead-Man Banner */}
        <WorkflowDeadManBanner
          active={Boolean(metrics?.isDeadManPaused)}
          onRefresh={() => void fetchAllData(true)}
        />

        {/* ZONE 1: Executive KPI Metrics Cards */}
        <WorkflowMetricsCards metrics={metrics} isLoading={isLoading} />

        {/* ZONE 2: Filter & Actions Toolbar */}
        <WorkflowFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onLaunchClick={() => setIsLaunchModalOpen(true)}
          onRefresh={() => void fetchAllData(true)}
          isRefreshing={isRefreshing}
        />

        {/* ZONE 3: Workflow Instances Table */}
        <WorkflowInstancesTable
          instances={filteredInstances}
          onInspect={handleInspect}
          onCancel={(id) => void handleCancel(id)}
          isLoading={isLoading}
        />

        {/* Launch Template Modal (theme.md Section 8) */}
        <LaunchTemplateModal
          open={isLaunchModalOpen}
          onOpenChange={setIsLaunchModalOpen}
          templates={templates}
          onLaunch={handleLaunch}
          isLaunching={isLaunching}
        />

        {/* Workflow Detail Drawer (theme.md Section 8) */}
        <WorkflowDetailDrawer
          instance={selectedInstance}
          steps={selectedSteps}
          checkpoints={selectedCheckpoints}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          onCancel={handleCancel}
          isProcessing={isDrawerLoading}
        />
      </div>
    </div>
  );
}
