'use client';

/**
 * @fileOverview Standardized Agent Run Detail Drawer Component (Phase 8 Milestone 2)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>`
 * - Zero Raw Descriptions: routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5`
 * - Tactile mechanical feedback: `active:scale-[0.97]`
 *
 * Security & Governance Rules:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile touch targets >= 44px.
 * - Rule 23: Multi-dimensional budget usage indicators (tokens, calls, duration, mutations).
 * - Rule 26: Cooperative cancellation workflow (`isCancellableState`).
 * - Rule 30: Untrusted content wrapped in `<untrusted_reference_data>`.
 * - Rule 40: Immutable state history audit display.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentRunTimeline } from './AgentRunTimeline';
import { ToolCallCard } from './ToolCallCard';
import { isCancellableState } from '@/platform/runtime/agent-state-machine';
import type { AgentRun, AgentStep } from '@/platform/runtime/agent-run-types';
import {
  Bot,
  Sparkles,
  Clock,
  Layers,
  Wrench,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
} from 'lucide-react';

export interface AgentRunDetailDrawerProps {
  run: AgentRun | null;
  steps: AgentStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelRun?: (runId: string) => Promise<void>;
  isCancelling?: boolean;
}

export function AgentRunDetailDrawer({
  run,
  steps,
  open,
  onOpenChange,
  onCancelRun,
  isCancelling = false,
}: AgentRunDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'context' | 'tools' | 'budgets'>('timeline');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!run) return null;

  const isCancellable = isCancellableState(run.status);
  const toolSteps = steps.filter((s) => s.type === 'tool_call');

  const handleConfirmCancel = async () => {
    if (!onCancelRun) return;
    try {
      setCancelError(null);
      await onCancelRun(run.runId);
      setShowCancelConfirm(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel run.');
    }
  };

  const getStatusBadge = () => {
    switch (run.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </span>
        );
      case 'executing':
      case 'planning':
      case 'verifying':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
            Executing
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5" />
            Approval Required
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground border border-border/80">
            <Clock className="h-3.5 w-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground border border-border/80">
            <Clock className="h-3.5 w-3.5" />
            {run.status}
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh] font-figtree">
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2.5 pr-8 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Bot className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base">{run.runId}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border hidden sm:inline-block">
                {run.agentPersonaId}
              </span>
            </DialogTitle>
            <CardInfoTooltip text="Granular execution telemetry, step timeline, prompt context, and budget governance for this autonomous agent run." />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {getStatusBadge()}
          </div>
          <DialogDescription className="sr-only">
            Detailed run trace and control panel for {run.runId}
          </DialogDescription>
        </DialogHeader>

        {/* Tabbed Navigation Bar */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as typeof activeTab)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="px-6 border-b border-border/60 bg-muted/10 shrink-0">
            <TabsList className="bg-transparent h-11 p-0 gap-4 sm:gap-6 flex-wrap">
              <TabsTrigger
                value="timeline"
                onClick={() => setActiveTab('timeline')}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Timeline & Steps ({steps.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="context"
                onClick={() => setActiveTab('context')}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Context & Memory</span>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                onClick={() => setActiveTab('tools')}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Tools & Audit ({toolSteps.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="budgets"
                onClick={() => setActiveTab('budgets')}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Budgets & Cost</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Panel 1: Timeline & Steps */}
          <TabsContent value="timeline" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0">
            <AgentRunTimeline steps={steps} />
          </TabsContent>

          {/* Panel 2: Context & Memory */}
          <TabsContent value="context" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0 space-y-4">
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Primary Goal & Objective
              </span>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {run.goal.prompt}
              </p>
              {run.goal.intent && (
                <div className="pt-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border">
                    Intent: {run.goal.intent}
                  </span>
                </div>
              )}
            </div>

            {/* Context Budget Ceiling (Rule 28) */}
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Working Memory Context Budget</span>
                <span className="font-mono text-muted-foreground">
                  Ceiling: 4,000 tokens (Rule 28)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((run.budgetUsage?.tokensUsed || 0) / 4000) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Context is compressed via knapsack optimization when token capacity nears limit.
              </p>
            </div>
          </TabsContent>

          {/* Panel 3: Tools & Audit */}
          <TabsContent value="tools" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0 space-y-4">
            {toolSteps.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground text-sm">
                No external tool calls have been executed in this run yet.
              </div>
            ) : (
              toolSteps.map((toolStep) => (
                <ToolCallCard key={toolStep.stepId} step={toolStep} />
              ))
            )}

            {/* State History Audit Trail (Rule 40) */}
            {run.stateHistory && run.stateHistory.length > 0 && (
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3 pt-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>State History Audit Trail (Rule 40)</span>
                </div>
                <div className="space-y-2">
                  {run.stateHistory.map((hist, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-muted/20 border border-border/60 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{hist.from}</span>
                        <span>&rarr;</span>
                        <span className="font-semibold text-foreground">{hist.to}</span>
                        {hist.reason && (
                          <span className="text-muted-foreground/80 font-sans ml-2">
                            ({hist.reason})
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(hist.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Panel 4: Budgets & Cost */}
          <TabsContent value="budgets" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tokens Gauge */}
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Tokens Consumed</span>
                  <span className="font-mono text-muted-foreground">
                    {(run.budgetUsage?.tokensUsed || 0).toLocaleString()} / {(run.budgets.maxTokens || 0).toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((run.budgetUsage?.tokensUsed || 0) / (run.budgets.maxTokens || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Tool Calls Gauge */}
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Tool Calls Executed</span>
                  <span className="font-mono text-muted-foreground">
                    {run.budgetUsage?.toolCallsExecuted || 0} / {run.budgets.maxToolCalls}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((run.budgetUsage?.toolCallsExecuted || 0) / (run.budgets.maxToolCalls || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Duration Gauge */}
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Elapsed Duration</span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round((run.budgetUsage?.durationMs || 0) / 1000)}s / {Math.round(run.budgets.maxDurationMs / 1000)}s
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((run.budgetUsage?.durationMs || 0) / (run.budgets.maxDurationMs || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Records Mutated Gauge */}
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Records Mutated</span>
                  <span className="font-mono text-muted-foreground">
                    {run.budgetUsage?.recordsMutated || 0} / {run.budgets.maxRecordsMutated}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((run.budgetUsage?.recordsMutated || 0) / (run.budgets.maxRecordsMutated || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Demarcated Footer (theme.md §8.5) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0 min-h-[56px]">
          <div>
            {isCancellable && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isCancelling}
                className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold"
              >
                Cancel Run
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold px-5"
          >
            Close
          </Button>
        </div>

        {/* Cancellation Confirmation Modal (theme.md §8) */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Cancel Agent Run
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cooperative cancellation token will be dispatched.
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to cancel this agent run? In-flight tool calls will be aborted and reverse-LIFO saga compensating actions will be triggered where applicable.
              </p>

              {cancelError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs">
                  {cancelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isCancelling}
                  className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold"
                >
                  Keep Running
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
