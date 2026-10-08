'use client';

/**
 * @fileOverview Human Baseline vs Agent Baseline Comparison Card (Phase 15 Milestone 5)
 *
 * Implements Roadmap §16 (Human vs Agent Baseline Benchmark Matrix):
 * - Task Time: 17m (Human) vs 2m (Agent) — 8.5x Speedup (88.2% faster)
 * - Error Rate: 8.0% (Human) vs 1.1% (Agent) — 7.3x Error Reduction (86.3% decrease)
 * - Context Sources: 4/9 (Human) vs 9/9 (Agent) — 2.25x Context Breadth (125% increase)
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive layout, touch targets >= 44px.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism & Micro-Cent Rounding.
 * - `theme.md` §8.3: Single-Circle Info Tooltip elevated at `z-[10050]`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Timer,
  AlertOctagon,
  Network,
  Users,
  Bot,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HumanVsAgentBaseline } from '@/platform/evaluation/contracts/evaluation-types';

export interface HumanAgentComparisonCardProps {
  baseline: HumanVsAgentBaseline;
}

export function HumanAgentComparisonCard({
  baseline,
}: HumanAgentComparisonCardProps): React.JSX.Element {
  return (
    <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                Human Baseline vs Autonomous Agent Performance
              </span>
              <CardInfoTooltip text="Empirical comparison between human knowledge workers and SmartSapp autonomous multi-agent swarm across 35 gold-standard enterprise tasks (Roadmap §16)." />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Roadmap §16 Verified Benchmarking Matrix
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>Human Baseline</span>
          </div>
          <span className="text-muted-foreground">vs</span>
          <div className="flex items-center gap-1 text-primary font-semibold">
            <Bot className="w-3.5 h-3.5" />
            <span>SmartSapp Swarm</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. TASK SPEEDUP */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Timer className="w-3.5 h-3.5 text-primary" />
              <span>Completion Velocity</span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
            >
              {baseline.speedupFactor.toFixed(1)}x FASTER
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block">Human</span>
              <span className="text-base font-bold font-mono text-muted-foreground line-through">
                {Math.round(baseline.humanTimeSeconds / 60)}m
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-bold">→</span>
            <div className="text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Agent</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {Math.round(baseline.agentTimeSeconds / 60)}m
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            88.2% reduction in end-to-end task turnaround time across all enterprise workflows.
          </p>
        </div>

        {/* 2. ERROR REDUCTION */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <AlertOctagon className="w-3.5 h-3.5 text-destructive" />
              <span>Error Rate</span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
            >
              {(baseline.humanErrorRate / Math.max(0.001, baseline.agentErrorRate)).toFixed(1)}x REDUCTION
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block">Human</span>
              <span className="text-base font-bold font-mono text-muted-foreground line-through">
                {baseline.humanErrorRate.toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-bold">→</span>
            <div className="text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Agent</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {baseline.agentErrorRate.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            86.3% decrease in data entry, calculation, and omission errors due to schema assertions.
          </p>
        </div>

        {/* 3. CONTEXT BREADTH */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Network className="w-3.5 h-3.5 text-blue-500" />
              <span>Context Sources</span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-blue-500/30 text-blue-600 bg-blue-500/10"
            >
              {baseline.contextBreadthFactor.toFixed(2)}x BREADTH
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block">Human</span>
              <span className="text-base font-bold font-mono text-muted-foreground">
                {baseline.humanSourcesConsulted}/9
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-bold">→</span>
            <div className="text-right">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block">Agent</span>
              <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {baseline.agentSourcesConsulted}/9
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Comprehensive 9-source cross-domain synthesis without cognitive tunnel vision.
          </p>
        </div>
      </div>
    </div>
  );
}
