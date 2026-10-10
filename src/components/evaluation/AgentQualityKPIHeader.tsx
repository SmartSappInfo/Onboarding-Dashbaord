'use client';

/**
 * @fileOverview Zone 1 Agent Quality KPI Header (Phase 15 Milestone 5)
 *
 * Implements agents_mcp_ui.md lines 3658–3665:
 * - Operating Principle: "The important metric is not 'AI confidence'. It is actual task performance."
 * - 5 Canonical Quality Metrics:
 *   1. Task Success Rate (96.2% vs target >= 96.0%)
 *   2. Tool Correctness (98.7% vs target >= 98.0%)
 *   3. Policy Violations (0 vs target 0 - Zero Tolerance)
 *   4. Human Correction Rate (4.8% vs target <= 5.0%)
 *   5. Median Runtime (18s vs target <= 30s)
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive layout, touch targets >= 44px.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism & Rounding.
 * - `theme.md` §8.3: Single-Circle Info Tooltip elevated at `z-[10050]`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  CheckCircle2,
  Wrench,
  ShieldCheck,
  UserCheck,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentQualityKPIs } from '@/platform/evaluation/ui/evaluation-ui-types';

export interface AgentQualityKPIHeaderProps {
  kpis: AgentQualityKPIs;
}

export function AgentQualityKPIHeader({
  kpis,
}: AgentQualityKPIHeaderProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {/* 5 CANONICAL METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. TASK SUCCESS */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Task Success</span>
              <CardInfoTooltip text="Percentage of automated tasks where final state invariants and goal conditions were completely satisfied. Target: >= 96.0%." />
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {kpis.taskSuccessRate.toFixed(1)}%
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                kpis.taskSuccessRate >= 96.0
                  ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                  : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
              )}
            >
              {kpis.taskSuccessRate >= 96.0 ? 'HEALTHY' : 'BELOW_TARGET'}
            </Badge>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.taskSuccessRate))}%` }}
            />
          </div>
        </div>

        {/* 2. TOOL CORRECTNESS */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Tool Correctness</span>
              <CardInfoTooltip text="Precision and recall of MCP capabilities selected against canonical schemas. Penalizes forbidden tools and unnecessary mutations (Rule 59). Target: >= 98.0%." />
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                {kpis.toolCorrectnessRate.toFixed(1)}%
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                kpis.toolCorrectnessRate >= 98.0
                  ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                  : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
              )}
            >
              {kpis.toolCorrectnessRate >= 98.0 ? 'EXEMPLARY' : 'ATTENTION'}
            </Badge>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.toolCorrectnessRate))}%` }}
            />
          </div>
        </div>

        {/* 3. POLICY VIOLATIONS */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Policy Violations</span>
              <CardInfoTooltip text="Total security boundary, RBAC, Anti-IDOR, and non-delegable policy breaches. Hard target is strictly ZERO (Rule 68 Five Non-Negotiables)." />
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {kpis.policyViolationsCount}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                kpis.policyViolationsCount === 0
                  ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                  : 'border-destructive/30 text-destructive bg-destructive/10'
              )}
            >
              {kpis.policyViolationsCount === 0 ? 'ZERO_TOLERANCE' : 'BREACH'}
            </Badge>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                kpis.policyViolationsCount === 0 ? 'bg-emerald-500' : 'bg-destructive'
              )}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* 4. HUMAN CORRECTION RATE */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Human Correction</span>
              <CardInfoTooltip text="Percentage of agent proposals or actions rejected or modified during human-in-the-loop review. Target: <= 5.0%." />
            </div>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                {kpis.humanCorrectionRate.toFixed(1)}%
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                kpis.humanCorrectionRate <= 5.0
                  ? 'border-indigo-500/30 text-indigo-600 bg-indigo-500/10'
                  : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
              )}
            >
              {kpis.humanCorrectionRate <= 5.0 ? 'OPTIMAL' : 'HIGH_REVIEW'}
            </Badge>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.humanCorrectionRate * 10))}%` }}
            />
          </div>
        </div>

        {/* 5. MEDIAN RUNTIME */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Median Runtime</span>
              <CardInfoTooltip text="Median end-to-end mission and task completion duration in seconds across all agent personas. Target: <= 30s." />
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {kpis.medianRuntimeSeconds}s
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                kpis.medianRuntimeSeconds <= 30
                  ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                  : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
              )}
            >
              {kpis.medianRuntimeSeconds <= 30 ? 'FAST' : 'LATENCY_WARN'}
            </Badge>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, (kpis.medianRuntimeSeconds / 60) * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
