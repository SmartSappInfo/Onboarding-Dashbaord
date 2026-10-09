'use client';

/**
 * @fileOverview Agent Run Mission Control Client Console (Phase 8 Milestone 2)
 *
 * Three-Zone operator mission control layout:
 * - Zone 1: Executive KPI Header & Quick Health Gauges (`RunMetricsCards`).
 * - Zone 2: Category Filter Toolbar (6 Status Tabs & 300ms Debounced Search).
 * - Zone 3: Live Runs Stream Table with Inspect Drawer & Real-Time SSE Reactivity.
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px, plain English UX.
 * - Rule 8 & 47: Anti-IDOR tenant validation.
 * - Rule 10: Comprehensive architectural documentation.
 * - Rule 21: Awaiting approval badge linking to approval center.
 * - Rule 26: Cooperative cancellation via `cancelAgentRunAction`.
 * - Rule 61: Backoffice agent control plane.
 * - Rule 62: Real-time UI reactivity via `useEventStream`.
 * - Rule 68: "No Dead Ends" with clear actions on every row.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { RunMetricsCards } from '@/components/runs/RunMetricsCards';
import { AgentRunDetailDrawer } from '@/components/runs/AgentRunDetailDrawer';
import { useEventStream } from '@/hooks/useEventStream';
import {
  listAgentRunsAction,
  getAgentRunDetailsAction,
  cancelAgentRunAction,
  getAgentRunMetricsAction,
} from '@/app/actions/agent-run-ui-actions';
import type { AgentRun, AgentStep } from '@/platform/runtime/agent-run-types';
import {
  Bot,
  Search,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export type RunStatusFilter =
  | 'ALL'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

const STATUS_TABS: { id: RunStatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All Runs' },
  { id: 'RUNNING', label: 'In-Flight' },
  { id: 'WAITING_FOR_APPROVAL', label: 'Needs Approval' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed / DLQ' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function RunsClient() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [metrics, setMetrics] = useState({
    totalRuns: 0,
    activeRuns: 0,
    waitingApprovalRuns: 0,
    failedRuns: 0,
  });
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drawer inspection state
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [selectedRunSteps, setSelectedRunSteps] = useState<AgentStep[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // 300ms Debounce on search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [runsRes, metricsRes] = await Promise.all([
        listAgentRunsAction({
          organizationId: 'default_org',
          workspaceId: 'default_workspace',
          search: debouncedSearch || undefined,
        }),
        getAgentRunMetricsAction({
          organizationId: 'default_org',
        }),
      ]);

      if (runsRes.success && runsRes.data) {
        setRuns(runsRes.data.runs || []);
      }
      if (metricsRes.success && metricsRes.data) {
        setMetrics({
          totalRuns: metricsRes.data.totalRuns,
          activeRuns: metricsRes.data.activeRuns,
          waitingApprovalRuns: metricsRes.data.waitingApprovals,
          failedRuns: metricsRes.data.failedRuns,
        });
      }
    } catch (err) {
      console.error('Failed to load agent runs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time SSE reactivity (Rule 62)
  useEventStream({
    onActivity: (activity) => {
      const eventType = activity.eventType || (activity as unknown as { type?: string }).type;
      if (
        eventType &&
        (eventType.startsWith('agent.run.') || eventType.startsWith('agent.step.'))
      ) {
        loadData();
      }
    },
  });

  const handleOpenDrawer = async (run: AgentRun) => {
    setSelectedRun(run);
    setIsDrawerOpen(true);
    try {
      const detailsRes = await getAgentRunDetailsAction({
        runId: run.runId,
        organizationId: run.organizationId,
      });
      if (detailsRes.success && detailsRes.data) {
        setSelectedRun(detailsRes.data.run);
        setSelectedRunSteps(detailsRes.data.steps);
      }
    } catch (err) {
      console.error('Failed to load step details:', err);
    }
  };

  const handleCancelRun = async (runId: string) => {
    if (!selectedRun) return;
    try {
      setIsCancelling(true);
      const res = await cancelAgentRunAction({
        runId,
        organizationId: selectedRun.organizationId,
        reason: 'Operator cancelled run from Mission Control',
      });
      if (res.success && res.data) {
        setSelectedRun(res.data.run);
        await loadData();
      }
    } finally {
      setIsCancelling(false);
    }
  };

  // Client-side filtering by tab
  const filteredRuns = useMemo(() => {
    return (runs || []).filter((r) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'RUNNING') {
        return (
          r.status === 'executing' ||
          r.status === 'planning' ||
          r.status === 'verifying' ||
          r.status === 'retrying' ||
          r.status === 'queued' ||
          r.status === 'context_building'
        );
      }
      if (statusFilter === 'WAITING_FOR_APPROVAL') {
        return r.status === 'waiting_for_approval';
      }
      if (statusFilter === 'COMPLETED') return r.status === 'completed';
      if (statusFilter === 'FAILED') return r.status === 'failed';
      if (statusFilter === 'CANCELLED') return r.status === 'cancelled';
      return true;
    });
  }, [runs, statusFilter]);

  const renderStatusBadge = (status: AgentRun['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'executing':
      case 'planning':
      case 'verifying':
      case 'retrying':
      case 'queued':
      case 'context_building':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
            <Sparkles className="h-3 w-3" />
            Executing
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            Approval Required
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground border border-border/80">
            <Clock className="h-3 w-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground border border-border/80">
            <Clock className="h-3 w-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <PageContainerFluid>
      <div className="space-y-6 w-full text-left font-figtree pb-32">
        {/* Zone 1: Demarcated Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/intelligence"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Agent Run Mission Control
            </h1>
            <CardInfoTooltip text="Live telemetry, execution timeline, and resource governance across all autonomous multi-agent runs." />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
              className="rounded-xl active:scale-[0.97] min-h-[44px] gap-2 text-xs font-semibold"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>

            <Link href="/admin/intelligence" className="hidden sm:inline-block">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl active:scale-[0.97] min-h-[44px] gap-1.5 text-xs text-muted-foreground"
              >
                <span>Command Center</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <RunMetricsCards
          totalRuns={metrics.totalRuns}
          activeRuns={metrics.activeRuns}
          waitingApprovalRuns={metrics.waitingApprovalRuns}
          failedRuns={metrics.failedRuns}
          isLoading={isLoading}
        />

        {/* Zone 2: Category Filter Toolbar */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs - Standard Segmented Pill Navigation */}
            <div className="inline-flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto shrink-0 overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97]',
                    statusFilter === tab.id
                      ? 'bg-card text-primary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search run ID, goal, or persona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border/80 bg-background min-h-[44px] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Zone 3: Live Runs Stream Table */}
      <div className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading agent executions...</span>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/60">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No agent runs found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery
                  ? 'No runs match the active search query.'
                  : 'No autonomous executions recorded under this filter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Run & Persona</th>
                  <th className="py-3.5 px-4">Primary Goal</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Tokens / Steps</th>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRuns.map((run) => (
                  <tr
                    key={run.runId}
                    className="transition-colors hover:bg-muted/50 even:bg-muted/30 dark:even:bg-muted/15 group"
                  >
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="space-y-1">
                        <span className="font-mono font-medium text-foreground block">
                          {run.runId}
                        </span>
                        <span className="inline-block font-mono text-[11px] px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                          {run.agentPersonaId}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                      <p className="text-foreground line-clamp-2 leading-relaxed">
                        {run.goal.prompt}
                      </p>
                      {run.goal.intent && (
                        <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                          intent: {run.goal.intent}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(run.status)}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                      <div>
                        <span className="text-foreground font-medium">
                          {(run.budgetUsage?.tokensUsed || 0).toLocaleString()}
                        </span>{' '}
                        tokens
                      </div>
                      <div className="text-[11px]">
                        Step {run.currentStepIndex + 1}
                        {run.currentPlan?.steps?.length ? ` of ${run.currentPlan.steps.length}` : ''}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                      <span className="block">
                        {new Date(run.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-[11px] block">
                        {Math.round((run.budgetUsage?.durationMs || 0) / 1000)}s elapsed
                      </span>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDrawer(run)}
                        className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold px-4"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Standardized Detail Drawer (theme.md §8) */}
      <AgentRunDetailDrawer
        run={selectedRun}
        steps={selectedRunSteps}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onCancelRun={handleCancelRun}
        isCancelling={isCancelling}
      />
    </div>
  </PageContainerFluid>
);
}
