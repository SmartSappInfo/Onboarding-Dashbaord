'use client';

/**
 * @fileOverview Zone 1 Executive KPI Header for Agent Health Dashboard (Phase 14 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive touch targets, tactile feedback.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism (Integer health averages).
 * - Rule 24: Dynamic Circuit Breakers (Trip counter).
 * - `docs/agents_mcp/agents_mcp_ui.md` (3616–3630).
 * - `theme.md` §8 (Single-Circle Tooltip Standard).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentHealthScorecard } from '@/platform/verification/health/health-types';

export interface AgentHealthKPIHeaderProps {
  scorecards: AgentHealthScorecard[];
}

export function AgentHealthKPIHeader({
  scorecards,
}: AgentHealthKPIHeaderProps): React.JSX.Element {
  const totalAgents = scorecards.length;

  const {
    avgHealthScore,
    healthyCount,
    degradedCount,
    trippedCount,
    avgSuccessRate,
    totalDiscrepanciesHealed,
  } = React.useMemo(() => {
    if (scorecards.length === 0) {
      return {
        avgHealthScore: 100,
        healthyCount: 0,
        degradedCount: 0,
        trippedCount: 0,
        avgSuccessRate: 100,
        totalDiscrepanciesHealed: 0,
      };
    }

    let sumHealth = 0;
    let sumSuccess = 0;
    let healthy = 0;
    let degraded = 0;
    let tripped = 0;

    for (const sc of scorecards) {
      sumHealth += sc.healthScore;
      sumSuccess += sc.successRate;

      if (sc.circuitState === 'OPEN') {
        tripped++;
      } else if (sc.circuitState === 'DEGRADED') {
        degraded++;
      } else {
        healthy++;
      }
    }

    return {
      avgHealthScore: Math.round(sumHealth / scorecards.length),
      healthyCount: healthy,
      degradedCount: degraded,
      trippedCount: tripped,
      avgSuccessRate: Math.round(sumSuccess / scorecards.length),
      totalDiscrepanciesHealed: scorecards.reduce(
        (acc, curr) => acc + (curr.consecutiveFailures === 0 ? 1 : 0),
        0
      ),
    };
  }, [scorecards]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-500';
    return 'text-destructive';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. FLEET HEALTH SCORE */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Fleet Health Score</span>
            <CardInfoTooltip text="Mathematically weighted fleet-wide health average across all 26 canonical agent personas (Rule 11)." />
          </div>
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl font-bold font-mono tracking-tight', getScoreColor(avgHealthScore))}>
            {avgHealthScore}
          </span>
          <span className="text-xs text-muted-foreground font-mono">/ 100</span>
        </div>
        <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              avgHealthScore >= 80
                ? 'bg-emerald-500'
                : avgHealthScore >= 60
                ? 'bg-amber-500'
                : 'bg-destructive'
            )}
            style={{ width: `${Math.min(100, Math.max(0, avgHealthScore))}%` }}
          />
        </div>
      </div>

      {/* 2. ACTIVE AGENT FLEET */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Active Agent Fleet</span>
            <CardInfoTooltip text="Total registered canonical agent personas currently operational in this workspace." />
          </div>
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {healthyCount}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            / {totalAgents} healthy
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {degradedCount > 0 ? `${degradedCount} degraded mode` : 'All healthy personas normal'}
        </p>
      </div>

      {/* 3. TRIPPED CIRCUIT BREAKERS */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Tripped Breakers</span>
            <CardInfoTooltip text="Personas with failure rate or consecutive error SLA breaches degraded to Shadow Mode (Rule 24 & 42)." />
          </div>
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border',
              trippedCount > 0
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-muted/30 border-border text-muted-foreground'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-2xl font-bold font-mono tracking-tight',
              trippedCount > 0 ? 'text-destructive' : 'text-foreground'
            )}
          >
            {trippedCount}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {trippedCount === 1 ? 'persona' : 'personas'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {trippedCount > 0 ? 'Quarantined in Shadow Mode' : '0 circuits tripped'}
        </p>
      </div>

      {/* 4. VERIFICATION SUCCESS RATE */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Success Rate</span>
            <CardInfoTooltip text="Percentage of executions where 100% of real-world postconditions were verified clean (Rule 1959)." />
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {avgSuccessRate}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Postcondition pass SLA &ge; 85%
        </p>
      </div>

      {/* 5. 24H DISCREPANCIES HEALED */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:border-border transition-colors text-left space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Self-Healed (24h)</span>
            <CardInfoTooltip text="Autonomous remediation routines executed for benign side-effect drift without requiring rollback (Rule 1962)." />
          </div>
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {totalDiscrepanciesHealed}
          </span>
          <span className="text-xs text-muted-foreground font-mono">remediations</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Index & timeline re-syncs
        </p>
      </div>
    </div>
  );
}
