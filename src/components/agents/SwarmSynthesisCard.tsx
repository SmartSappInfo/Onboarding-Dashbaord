'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Swarm Multi-Perspective Synthesis Card
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Perspective Diversity:
 *    - Displays green consensus cards and red tension/divergence callouts side-by-side.
 * 2. Actionable Joint Proposals:
 *    - Allows 1-click execution of synthesized actions via `executeJointProposalAction`.
 * 3. Mobile Accessibility:
 *    - All action buttons maintain >= 44px touch targets (`min-h-[44px]`).
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Play,
  Clock,
  Layers,
  FileText,
} from 'lucide-react';
import type { SwarmRun, SwarmConsensus } from '@/lib/agents/domain-types';
import type { AgentActionProposal, AgentResult } from '@/lib/supervisor/types';
import { executeJointProposalAction } from '@/lib/agents/actions/domain-agent-actions';
import { useToast } from '@/hooks/use-toast';

export interface SwarmSynthesisCardProps {
  run: SwarmRun;
  workspaceId: string;
  userId: string;
}

export function SwarmSynthesisCard({ run, workspaceId, userId }: SwarmSynthesisCardProps) {
  const { toast } = useToast();
  const [executingActionId, setExecutingActionId] = React.useState<string | null>(null);
  const [executedActions, setExecutedActions] = React.useState<Set<string>>(new Set());

  const consensus = run.consensus;
  if (!consensus) return null;

  const handleExecuteProposal = async (action: AgentActionProposal, idx: number) => {
    const actionKey = `action_${idx}_${action.toolName}`;
    setExecutingActionId(actionKey);

    try {
      const res = await executeJointProposalAction({
        workspaceId,
        organizationId: run.organizationId,
        userId,
        toolName: action.toolName,
        parameters: action.arguments,
      });

      if (res.success) {
        setExecutedActions((prev) => new Set(prev).add(actionKey));
        toast({
          title: 'Proposed Action Executed',
          description: `Action "${action.title}" dispatched successfully.`,
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'View Swarms',
          },
        });
      } else {
        toast({
          title: 'Execution Failed',
          description: res.error || 'Failed to dispatch proposal.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'Retry',
          },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown execution exception.',
        variant: 'destructive',
      });
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden space-y-6 p-4 sm:p-6">
      {/* Header with status and timing */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/50">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Swarm Consensus Briefing
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Mission: {run.objective}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize bg-slate-50 dark:bg-slate-800">
            {run.mode.replace('_', ' ')}
          </Badge>
          <Badge
            variant="secondary"
            className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200"
          >
            {run.status}
          </Badge>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {run.metrics.durationMs}ms
          </span>
        </div>
      </div>

      {/* Section 1: Executive Summary */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Executive Briefing
        </span>
        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {consensus.executiveSummary}
        </div>
      </div>

      {/* Section 2: Consensus Points vs Divergence Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Consensus Column */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Points of Domain Consensus ({consensus.consensusPoints.length})
            </span>
          </div>
          <ul className="space-y-2 text-xs text-emerald-900 dark:text-emerald-200">
            {consensus.consensusPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">&bull;</span>
                <span className="leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Divergence / Tension Column */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Divergence & Tension Points ({consensus.divergencePoints.length})
            </span>
          </div>

          {consensus.divergencePoints.length === 0 ? (
            <p className="text-xs text-rose-700 dark:text-rose-400 italic">
              Zero conflicting viewpoints detected. All specialists aligned on priorities.
            </p>
          ) : (
            <div className="space-y-2.5">
              {consensus.divergencePoints.map((div, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/80 space-y-1.5"
                >
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    {div.topic}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {div.tensionSummary}
                  </p>
                  <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    &bull; Recommended Escalation: {div.recommendedEscalation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Side-by-Side Specialist Breakdown Tabs */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Layers className="w-4 h-4" /> Specialist Domain Perspectives
        </span>

        <Tabs defaultValue={Object.keys(run.specialistRuns)[0] || 'all'} className="w-full">
          <TabsList className="w-full flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
            {Object.keys(run.specialistRuns).map((specId) => (
              <TabsTrigger
                key={specId}
                value={specId}
                className="text-xs font-medium capitalize min-h-[36px] flex-1"
              >
                {specId.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(run.specialistRuns).map(([specId, result]: [string, AgentResult]) => (
            <TabsContent
              key={specId}
              value={specId}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 mt-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                  {specId.replace('_', ' ')} Findings ({result.findings.length})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {result.toolCalls.length} Tool Calls
                </Badge>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {result.answer}
              </p>

              {result.findings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  {result.findings.map((f, fi) => (
                    <div
                      key={fi}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs space-y-1"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {f.title}
                      </span>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {f.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Section 4: Joint Action Proposals */}
      {consensus.jointActions.length > 0 && (
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Synthesized Joint Proposals
          </span>

          <div className="space-y-2">
            {consensus.jointActions.map((action, idx) => {
              const actionKey = `action_${idx}_${action.toolName}`;
              const isExecuted = executedActions.has(actionKey);
              const isExecuting = executingActionId === actionKey;

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {action.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          action.riskLevel === 'high_risk'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {action.riskLevel.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {action.description}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    disabled={isExecuted || isExecuting}
                    onClick={() => handleExecuteProposal(action, idx)}
                    className={`min-h-[44px] text-xs font-medium rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5 shrink-0 ${
                      isExecuted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                    }`}
                  >
                    {isExecuted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Executed</span>
                      </>
                    ) : isExecuting ? (
                      <span>Dispatching...</span>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Execute Proposal</span>
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
