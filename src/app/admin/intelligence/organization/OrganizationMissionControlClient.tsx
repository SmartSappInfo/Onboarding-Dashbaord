'use client';

/**
 * @fileOverview Three-Zone Organization Mission Control Cockpit (Phase 13 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 7 (Mobile-first responsive touch targets >= 44px)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Verification)
 * - Rule 24 (Tri-State Circuit Breakers: CLOSED / OPEN / HALF_OPEN)
 * - Rule 25 (Dead-Letter Queue DLQ Reprocessing Desk)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Compensation Rollback Visualizer)
 * - Rule 28 & 56 (Knapsack Token Budgeting)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation & Fail-Closed Halting)
 * - Rule 61 (Three-Zone Enterprise Mission Control Cockpit)
 * - Rule 62 (Real-Time SSE Reactivity via useEventStream)
 * - theme.md §8 (Standardized Modal & Dialog System for prompts and modals)
 */

import * as React from 'react';
import {
  Network,
  Bot,
  Activity,
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  RotateCcw,
  StopCircle,
  RefreshCw,
  Clock,
  Zap,
  Server,
  Key,
  Share2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import {
  getSupervisorTelemetryAction,
  cancelSupervisorMissionAction,
  resubmitDlqMessageAction,
  toggleSupervisorDeadManSwitchAction,
  type SupervisorTelemetryData,
} from '@/app/actions/supervisor-actions';
import { SupervisorMissionModal } from '@/components/supervisor/SupervisorMissionModal';
import { DelegationTreeModal } from '@/components/supervisor/DelegationTreeModal';
import { GraphReasoningModal } from '@/components/supervisor/GraphReasoningModal';

import { useWorkspace } from '@/context/WorkspaceContext';

export interface OrganizationMissionControlClientProps {
  organizationId?: string;
  workspaceId?: string;
}

export function OrganizationMissionControlClient({
  organizationId: propOrgId,
  workspaceId: propWsId,
}: OrganizationMissionControlClientProps = {}): React.JSX.Element {
  let contextOrgId = 'org_default';
  let contextWsId = 'ws_default';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ws = useWorkspace();
    if (ws?.currentWorkspace?.organizationId) contextOrgId = ws.currentWorkspace.organizationId;
    if (ws?.activeWorkspaceId) contextWsId = ws.activeWorkspaceId;
  } catch {
    // Isolated tests or SSR
  }

  const organizationId = propOrgId || contextOrgId;
  const workspaceId = propWsId || contextWsId;
  // Telemetry & Cockpit State
  const [telemetry, setTelemetry] = React.useState<SupervisorTelemetryData | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = React.useState<boolean>(true);

  // Modal Open States
  const [missionModalOpen, setMissionModalOpen] = React.useState<boolean>(false);
  const [delegationModalOpen, setDelegationModalOpen] = React.useState<boolean>(false);
  const [graphModalOpen, setGraphModalOpen] = React.useState<boolean>(false);

  // Dead-Man Switch Prompt State
  const [deadManDialogOpen, setDeadManDialogOpen] = React.useState<boolean>(false);
  const [deadManReason, setDeadManReason] = React.useState<string>('');
  const [isTogglingDeadMan, setIsTogglingDeadMan] = React.useState<boolean>(false);

  // Actions in flight
  const [isCancellingMission, setIsCancellingMission] = React.useState<boolean>(false);
  const [resubmittingDlqId, setResubmittingDlqId] = React.useState<string | null>(null);

  // Fetch telemetry
  const fetchTelemetry = React.useCallback(async (): Promise<void> => {
    try {
      const res = await getSupervisorTelemetryAction(organizationId);
      if (res.success && res.data) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void fetchTelemetry();
  }, [fetchTelemetry]);

  // Real-Time SSE Stream Reactivity (Rule 62)
  const { status: streamStatus } = useEventStream({
    workspaceId,
    eventTypes: ['supervisor.*', 'mesh.*', 'identity.delegation.*'],
    onEvent: (event?: unknown) => {
      // Auto-refresh telemetry on relevant supervisor/mesh/delegation events
      const evt = event as { type?: string };
      if (
        evt?.type?.startsWith('supervisor.') ||
        evt?.type?.startsWith('mesh.') ||
        evt?.type?.startsWith('identity.delegation.')
      ) {
        void fetchTelemetry();
      }
    },
  });

  // Cooperative Cancellation (Rule 26)
  const handleCancelMission = async (missionId: string): Promise<void> => {
    setIsCancellingMission(true);
    try {
      const res = await cancelSupervisorMissionAction(
        missionId,
        organizationId,
        'Operator requested manual cooperative cancellation from cockpit'
      );
      if (!res.success || !res.data) {
        toast({
          title: 'Cancellation Failed',
          description: res.error || 'Failed to cancel supervisor mission.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Cockpit',
          },
        });
        return;
      }

      toast({
        title: 'Mission Cancelled',
        description: `Mission ${missionId} has been cooperatively cancelled. Reverse-LIFO rollback initiated.`,
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Cockpit',
        },
      });

      await fetchTelemetry();
    } catch (err) {
      toast({
        title: 'Cancellation Error',
        description: err instanceof Error ? err.message : 'Unknown cancellation error',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingMission(false);
    }
  };

  // DLQ Resubmission (Rule 25)
  const handleResubmitDlq = async (messageId: string): Promise<void> => {
    setResubmittingDlqId(messageId);
    try {
      const res = await resubmitDlqMessageAction(organizationId, messageId);
      if (!res.success || !res.data) {
        toast({
          title: 'Resubmit Failed',
          description: res.error || 'Failed to resubmit message to swarm.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Cockpit',
          },
        });
        return;
      }

      toast({
        title: 'Message Resubmitted',
        description: `DLQ message ${messageId} successfully returned to swarm mesh for delivery.`,
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Cockpit',
        },
      });

      await fetchTelemetry();
    } catch (err) {
      toast({
        title: 'Resubmission Error',
        description: err instanceof Error ? err.message : 'Unknown resubmit error',
        variant: 'destructive',
      });
    } finally {
      setResubmittingDlqId(null);
    }
  };

  // Dead-Man Switch Toggle (Rule 60 & 61)
  const handleConfirmDeadManToggle = async (): Promise<void> => {
    if (deadManReason.trim().length < 5 || isTogglingDeadMan) return;

    setIsTogglingDeadMan(true);
    const targetPaused = !telemetry?.deadManSwitchEngaged;
    try {
      const res = await toggleSupervisorDeadManSwitchAction(
        organizationId,
        targetPaused,
        deadManReason.trim()
      );

      if (!res.success || !res.data) {
        toast({
          title: 'Dead-Man Toggle Failed',
          description: res.error || 'Failed to toggle emergency dead-man switch.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Cockpit',
          },
        });
        return;
      }

      toast({
        title: targetPaused ? 'Emergency Halt Engaged' : 'Emergency Halt Disengaged',
        description: targetPaused
          ? 'Autonomous agent execution has been halted platform-wide (Rule 60).'
          : 'Autonomous agent execution has been safely resumed.',
        variant: targetPaused ? 'destructive' : 'default',
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Cockpit',
        },
      });

      setDeadManDialogOpen(false);
      setDeadManReason('');
      await fetchTelemetry();
    } catch (err) {
      toast({
        title: 'Dead-Man Error',
        description: err instanceof Error ? err.message : 'Unknown dead-man error',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingDeadMan(false);
    }
  };

  const activeMission = telemetry?.activeMissions?.[0] ?? null;

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        {/* Cockpit Top Bar & Action Launcher Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Organization Swarm Mission Control
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                Phase 13 Swarm Mesh
              </Badge>
            </h1>
            <CardInfoTooltip text="Autonomous multi-agent orchestration, mathematical authority trees, and live topological DAG telemetry." />
          </div>

        {/* Toolbar & Status Dot */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real-time SSE status indicator (Rule 62) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/20 text-xs font-mono text-muted-foreground">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                streamStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              )}
            />
            <span className="capitalize">{streamStatus}</span>
          </div>

          {/* Modal Launchers */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setDelegationModalOpen(true)}
            className="min-h-[44px] rounded-xl active:scale-[0.97] text-xs font-medium border-border/80 text-foreground"
          >
            <Key className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Delegation Tree
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setGraphModalOpen(true)}
            className="min-h-[44px] rounded-xl active:scale-[0.97] text-xs font-medium border-border/80 text-foreground"
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
            Graph Reasoning
          </Button>

          <Button
            type="button"
            onClick={() => setMissionModalOpen(true)}
            className="min-h-[44px] rounded-xl active:scale-[0.97] text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Launch Mission
          </Button>
        </div>
      </div>

      {/* ZONE 1: Executive Telemetry & Topology Status Grid (Rule 61) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Missions */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Missions</span>
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-foreground">
              {telemetry?.activeMissionsCount ?? 0}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                (telemetry?.activeMissionsCount ?? 0) > 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}
            >
              {(telemetry?.activeMissionsCount ?? 0) > 0 ? 'Executing' : 'Idle'}
            </Badge>
          </div>
        </div>

        {/* Card 2: Active Delegations */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Delegations</span>
            <Key className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-foreground">
              {telemetry?.activeDelegationsCount ?? 0}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Depth &le; 3 (Rule 9)
            </span>
          </div>
        </div>

        {/* Card 3: Knapsack Token Budget */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Token Budget</span>
            <Cpu className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-foreground">
              {telemetry ? `${(telemetry.tokensUsed / 1000).toFixed(1)}k / ${(telemetry.tokenCeiling / 1000).toFixed(0)}k` : '0k / 50k'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Knapsack
            </span>
          </div>
        </div>

        {/* Card 4: Swarm Mesh Health & Circuit Breaker */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Mesh Health</span>
            <Server className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Mesh Healthy
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                telemetry?.circuitBreakerState === 'CLOSED'
                  ? 'border-emerald-500/30 text-emerald-600'
                  : 'border-destructive/30 text-destructive'
              )}
            >
              Circuit: {telemetry?.circuitBreakerState ?? 'CLOSED'}
            </Badge>
          </div>
        </div>
      </div>

      {/* ZONE 2: Mission Command Deck & Topological DAG Execution HUD (Rules 26, 27, 61) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Topological DAG Mission Command Deck
            </h2>
          </div>

          {activeMission && activeMission.status === 'RUNNING' && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleCancelMission(activeMission.missionId)}
              disabled={isCancellingMission}
              className="h-8 text-xs font-medium active:scale-[0.97]"
            >
              {isCancellingMission ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Cancelling...
                </>
              ) : (
                <>
                  <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Mission
                </>
              )}
            </Button>
          )}
        </div>

        {activeMission ? (
          <div className="space-y-4">
            {/* Active Mission Details Header */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  ID: <span className="text-foreground">{activeMission.missionId}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono font-semibold">
                    {activeMission.priorityLevel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-mono font-semibold',
                      activeMission.status === 'RUNNING'
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : activeMission.status === 'COMPLETED'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                        : 'border-destructive/40 bg-destructive/10 text-destructive'
                    )}
                  >
                    {activeMission.status}
                  </Badge>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                {activeMission.goal}
              </p>
            </div>

            {/* Reverse-LIFO Compensation Banner (Rule 27) */}
            {activeMission.status === 'CANCELLED' && (
              <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span className="font-medium">
                  Reverse-LIFO Rollback Engaged · Rewinding execution steps in inverse order (Rule 27)
                </span>
              </div>
            )}

            {/* Wave-by-Wave DAG Step Visualization */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Topological Waves Execution Pipeline:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeMission.dag?.waveGroups?.map((waveStepIds: string[], wIdx: number) => {
                  const waveNodes = activeMission.dag.nodes.filter((n) => waveStepIds.includes(n.stepId));
                  return (
                    <div
                      key={`wave_${wIdx}`}
                      className="p-3.5 rounded-xl border border-border/60 bg-card space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="text-xs font-bold text-foreground font-mono">
                          Wave {wIdx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {waveNodes.length} {waveNodes.length === 1 ? 'Step' : 'Steps'}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {waveNodes.map((node) => (
                          <div
                            key={node.stepId}
                            className="p-2.5 rounded-lg border border-border/40 bg-muted/10 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground font-mono">
                                {node.stepId}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[9px] font-mono',
                                  node.status === 'COMPLETED'
                                    ? 'border-emerald-500/40 text-emerald-600'
                                    : node.status === 'RUNNING'
                                    ? 'border-indigo-500/40 text-indigo-600'
                                    : 'border-muted text-muted-foreground'
                                )}
                              >
                                {node.status}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              {node.assignedPersona} &rarr; {node.capabilityId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed rounded-xl p-8">
            <Bot className="h-9 w-9 stroke-1 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">No Mission Currently Running</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Launch a new supervisor mission using the toolbar above to observe real-time topological DAG execution.
            </p>
          </div>
        )}
      </div>

      {/* ZONE 3: Swarm Mesh Topology, DLQ Reprocessing & Emergency Dead-Man Switch (Rules 24, 25, 60, 61) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Swarm Mesh Peer Topology */}
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Swarm Mesh Peer Network
              </h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {telemetry?.meshPeers?.length ?? 0} Connected Nodes
            </span>
          </div>

          <div className="space-y-2">
            {telemetry?.meshPeers?.map((peer) => (
              <div
                key={peer.peerId}
                className="p-3 rounded-lg border border-border/60 transition-colors hover:bg-muted/50 even:bg-muted/30 dark:even:bg-muted/15 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground font-mono">
                      {peer.peerId}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      {peer.personaId}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                    {peer.endpoint}
                  </span>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                    {peer.latencyMs}ms
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dead-Letter Queue (DLQ) & Dead-Man Switch Panel */}
        <div className="space-y-4">
          {/* DLQ Triage Desk (Rule 25) */}
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Dead-Letter Queue (DLQ) Desk
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {telemetry?.dlqMessages?.length ?? 0} Messages
              </Badge>
            </div>

            {telemetry?.dlqMessages && telemetry.dlqMessages.length > 0 ? (
              <div className="space-y-2">
                {telemetry.dlqMessages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex flex-wrap items-center justify-between gap-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground font-mono">
                        {msg.messageId}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {msg.errorMessage}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleResubmitDlq(msg.messageId)}
                      disabled={resubmittingDlqId === msg.messageId}
                      className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 active:scale-[0.97]"
                    >
                      {resubmittingDlqId === msg.messageId ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Resubmitting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resubmit
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2 text-center">
                DLQ is clean. Zero failed message deliveries detected.
              </p>
            )}
          </div>

          {/* Emergency Dead-Man Switch (Rule 60) */}
          <div
            className={cn(
              'rounded-xl border p-4 transition-all shadow-xs',
              telemetry?.deadManSwitchEngaged
                ? 'border-destructive/60 bg-destructive/10'
                : 'border-border/80 bg-card'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    telemetry?.deadManSwitchEngaged
                      ? 'bg-destructive text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Emergency Dead-Man Switch (Rule 60)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {telemetry?.deadManSwitchEngaged
                      ? 'Emergency halt is ACTIVE. All subagent missions and executions are fail-closed.'
                      : 'Normal operational state. Background agent processing is fully enabled.'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant={telemetry?.deadManSwitchEngaged ? 'default' : 'destructive'}
                size="sm"
                onClick={() => setDeadManDialogOpen(true)}
                className="h-8 text-xs font-semibold active:scale-[0.97] shrink-0"
              >
                {telemetry?.deadManSwitchEngaged ? 'Disengage Halt' : 'Engage Emergency Halt'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dead-Man Switch Confirmation Modal (theme.md §8 & Rule 61) */}
      <Dialog open={deadManDialogOpen} onOpenChange={setDeadManDialogOpen}>
        <DialogContent className="max-w-md border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader
            demarcated
            className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Confirm Emergency Dead-Man Switch
              </DialogTitle>
              <CardInfoTooltip text="Halts all autonomous subagent missions, approvals, and queue processing platform-wide. Requires mandatory >= 5 character audit log (Rule 61)." />
            </div>
            <DialogDescription className="sr-only">
              Confirm emergency kill switch status change with mandatory audit justification.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deadman-reason" className="text-xs font-semibold text-foreground">
                Mandatory Reason / Justification (&ge; 5 chars)
              </Label>
              <Input
                id="deadman-reason"
                type="text"
                placeholder="Reason for emergency halt (e.g., Downstream gateway timeout)..."
                value={deadManReason}
                onChange={(e) => setDeadManReason(e.target.value)}
                disabled={isTogglingDeadMan}
                className="h-10 text-xs"
              />
              <span className="text-[10px] font-mono text-muted-foreground block text-right">
                {deadManReason.length} / 5 min
              </span>
            </div>
          </div>

          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeadManDialogOpen(false)}
              disabled={isTogglingDeadMan}
              className="min-h-[44px] rounded-xl active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeadManToggle}
              disabled={isTogglingDeadMan || deadManReason.trim().length < 5}
              className="min-h-[44px] rounded-xl active:scale-[0.97] font-semibold"
            >
              {isTogglingDeadMan ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                'Confirm Emergency Halt'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Modals */}
      <SupervisorMissionModal
        open={missionModalOpen}
        onOpenChange={setMissionModalOpen}
        organizationId={organizationId}
        workspaceId={workspaceId}
        onMissionStarted={() => void fetchTelemetry()}
      />

      <DelegationTreeModal
        open={delegationModalOpen}
        onOpenChange={setDelegationModalOpen}
        organizationId={organizationId}
        workspaceId={workspaceId}
        onTokenRevoked={() => void fetchTelemetry()}
      />

      <GraphReasoningModal
        open={graphModalOpen}
        onOpenChange={setGraphModalOpen}
        organizationId={organizationId}
        workspaceId={workspaceId}
      />
      </div>
    </PageContainerFluid>
  );
}
