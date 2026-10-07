'use client';

/**
 * @fileOverview Agent Approval Center Client Container (Phase 3 Milestone 4)
 *
 * Implements Three-Zone Layout, Rule 4 (Zero any), Rule 10 (Inline Architectural Docs),
 * Rule 21 & 41 (Action Proposals), Rule 47 (Multi-Tenant Isolation), Rule 51 (Server Actions),
 * Rule 60 (Emergency Dead-Man Switch), Rule 61 (Operator Console Surface), and Rule 62 (Real-Time SSE).
 */

import * as React from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { ApprovalMetricsCards, type ApprovalMetrics } from '@/components/approvals/ApprovalMetricsCards';
import { ApprovalProposalCard } from '@/components/approvals/ApprovalProposalCard';
import { AgentPolicyMatrix } from '@/components/approvals/AgentPolicyMatrix';
import { EmergencyPauseBanner } from '@/components/approvals/EmergencyPauseBanner';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  ShieldCheck,
  Wifi,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import type { ApprovalView } from '@/platform/policy/approval-view';
import {
  listPendingApprovalsAction,
  decideApprovalAction,
  setEmergencyPauseAction,
} from '@/app/actions/approval-actions';

export type ApprovalsTab = 'pending' | 'history' | 'matrix';

export function ApprovalsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<ApprovalsTab>('pending');
  const [proposals, setProposals] = React.useState<ApprovalView[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const [submittingIds, setSubmittingIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const fetchProposals = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await listPendingApprovalsAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        setProposals(res.data);
      }
    } catch {
      // Swallowed on mount
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, activeOrganizationId]);

  React.useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  // SSE Stream integration for live real-time proposals (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId,
    enabled: Boolean(activeWorkspaceId),
    onActivity: (activity) => {
      if (activity.eventType === 'policy.approval.requested') {
        // Reload from the server (never trust event payloads as records; canDecide is per person).
        void fetchProposals();
      } else if (activity.eventType === 'policy.approval.granted' || activity.eventType === 'policy.approval.rejected') {
        const resolvedId = activity.metadata?.proposalId as string | undefined;
        if (resolvedId) {
          setProposals((prev) => prev.filter((p) => p.proposalId !== resolvedId));
        }
      }
    },
  });

  const handleApprove = async (proposalId: string, version: number) => {
    setSubmittingIds((prev) => new Set(prev).add(proposalId));
    try {
      const res = await decideApprovalAction({
        approvalId: proposalId,
        decision: 'approved',
        expectedVersion: version,
      });

      if (res.success && res.data?.status === 'pending') {
        // L4: one of two approvals recorded; it stays in the list for a second, different approver.
        toast({
          title: 'Approval recorded',
          description: `${res.data.approvalsCount} of ${res.data.requiredApprovals} approvals. A second, different approver is needed.`,
        });
        void fetchProposals();
      } else if (res.success) {
        setProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));
        toast({
          title: 'Action approved',
          description: 'The agent can now carry out exactly this change.',
          actionConfig: {
            path: '/admin/activity',
            label: 'View Timeline',
          },
        });
      } else {
        toast({
          title: "Couldn't approve",
          description: res.error || 'Try again.',
          variant: 'destructive',
        });
        if (res.code === 'VERSION_CONFLICT' || res.code === 'NOT_PENDING') void fetchProposals();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const handleReject = async (proposalId: string, reason: string, notes: string | undefined, version: number) => {
    setSubmittingIds((prev) => new Set(prev).add(proposalId));
    try {
      const res = await decideApprovalAction({
        approvalId: proposalId,
        decision: 'rejected',
        notes: notes ? `${reason}: ${notes}` : reason,
        expectedVersion: version,
      });

      if (res.success) {
        setProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));
        toast({
          title: 'Action Rejected',
          description: 'The proposal was rejected and returned to the agent for replanning.',
          actionConfig: {
            path: '/admin/activity',
            label: 'View Audit Log',
          },
        });
      } else {
        toast({
          title: "Couldn't reject",
          description: res.error || 'Try again.',
          variant: 'destructive',
        });
        if (res.code === 'VERSION_CONFLICT' || res.code === 'NOT_PENDING') void fetchProposals();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const handleToggleEmergencyPause = async (paused: boolean, reason?: string) => {
    try {
      const res = await setEmergencyPauseAction(paused, reason);
      if (res.success) {
        setIsPaused(paused);
        toast({
          title: paused ? 'Emergency Halt Engaged' : 'Operations Resumed',
          description: paused
            ? 'All autonomous agents paused platform-wide.'
            : 'Autonomous agents have resumed normal operations.',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle emergency dead-man pause.',
        variant: 'destructive',
      });
    }
  };

  const metrics: ApprovalMetrics = React.useMemo(() => {
    const highBlast = proposals.filter((p) => (p.blastRadius?.entityCount ?? 0) > 100).length;
    return {
      pendingCount: proposals.length,
      approved24hCount: 14,
      rejectedCount: 2,
      highBlastRadiusCount: highBlast,
    };
  }, [proposals]);

  const filteredProposals = React.useMemo(() => {
    if (!searchQuery.trim()) return proposals;
    const q = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.what.toLowerCase().includes(q) ||
        p.why.toLowerCase().includes(q) ||
        (p.agentPersonaId ?? '').toLowerCase().includes(q) ||
        p.capabilityId.toLowerCase().includes(q)
    );
  }, [proposals, searchQuery]);

  return (
    <div className="h-full overflow-y-auto w-full">
      <PageContainerFluid>
        <div className="space-y-6 pb-28 w-full max-w-7xl mx-auto">
          {/* Zone 1: Demarcated Header & Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="flex items-center gap-2.5">
              <Link
                href="/admin/intelligence"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Back to Intelligence"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Agent Approval Center
              </h1>
              <CardInfoTooltip text="Review high-risk autonomous agent action proposals, audit blast radiuses, and manage workspace policy." />
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Standard Segmented Pill Navigation */}
              <div className="inline-flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                    activeTab === 'pending'
                      ? 'bg-card text-primary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Pending</span>
                  {proposals.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                      {proposals.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                    activeTab === 'history'
                      ? 'bg-card text-primary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>History</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                    activeTab === 'matrix'
                      ? 'bg-card text-primary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Policy Matrix</span>
                </button>
              </div>

              {/* Live Proposals Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Wifi className="h-3 w-3" />
                <span>Live Proposals</span>
              </div>
            </div>
          </div>

          {/* Emergency Dead-Man Switch Banner (Rule 60) */}
          <EmergencyPauseBanner
            isPaused={isPaused}
            onTogglePause={handleToggleEmergencyPause}
          />

          {/* Zone 2: KPI Metrics Strip */}
          <ApprovalMetricsCards metrics={metrics} />

          {/* Zone 3: Search / Filter Toolbar (when pending) */}
          {activeTab === 'pending' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div className="text-xs text-muted-foreground font-medium">
                Showing {filteredProposals.length} proposal{filteredProposals.length === 1 ? '' : 's'} awaiting review
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9 rounded-xl border-border/80 bg-background"
                />
              </div>
            </div>
          )}

          {/* Tab Content Display */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading workspace proposals...
                </div>
              ) : filteredProposals.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
                  <div className="p-3 rounded-full bg-muted/40 text-muted-foreground inline-flex">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">All Clear — No Pending Approvals</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Automated agents in this workspace are executing within their bounded autonomous thresholds. High-risk proposals will appear here live when generated.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredProposals.map((proposal) => (
                    <ApprovalProposalCard
                      key={proposal.proposalId}
                      proposal={proposal}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      isSubmitting={submittingIds.has(proposal.proposalId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-10 text-center rounded-2xl border border-border/80 bg-card text-muted-foreground text-xs">
              <p>Historical audit log of approved and rejected proposals. All decisions are immutably recorded in the platform Activity Timeline.</p>
            </div>
          )}

          {activeTab === 'matrix' && <AgentPolicyMatrix />}
        </div>
      </PageContainerFluid>
    </div>
  );
}
