'use client';

/**
 * @fileOverview Lightweight Cost & Latency Performance Visualizer (Phase 15 Milestone 5)
 *
 * Implements agents_mcp_ui.md lines 3645–3653 (Cost & Tokens and Latency & Performance Views):
 * - Pure SVG/CSS visualizations adhering to Rule 54 performance budgets (zero heavy chart libraries).
 * - Visualizes micro-USD cost per agent persona and 3-Tier model distribution (Rule 58).
 * - Visualizes P50, P90, and P99 latency percentiles across canonical MCP capabilities.
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive layout, touch targets >= 44px.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism & Rounding.
 * - Rule 54: Performance Budgets & Bundle Ceilings.
 * - Rule 58: Dynamic 3-Tier Model Routing Allocation.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Coins, Gauge, Sparkles, Zap, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  CostTokenMetricRecord,
  LatencyPercentileRecord,
} from '@/platform/evaluation/ui/evaluation-ui-types';

export interface CostLatencyChartProps {
  costMetrics: CostTokenMetricRecord[];
  latencyMetrics: LatencyPercentileRecord[];
}

export function CostLatencyChart({
  costMetrics,
  latencyMetrics,
}: CostLatencyChartProps): React.JSX.Element {
  // Aggregate cost stats
  const totalCost = React.useMemo(() => {
    return costMetrics.reduce((sum, item) => sum + item.totalCostUsd, 0);
  }, [costMetrics]);

  const maxCost = React.useMemo(() => {
    return Math.max(...costMetrics.map((c) => c.totalCostUsd), 0.01);
  }, [costMetrics]);

  const maxP99 = React.useMemo(() => {
    return Math.max(...latencyMetrics.map((l) => l.p99Ms), 100);
  }, [latencyMetrics]);

  // Model tier allocations
  const tierAllocations = React.useMemo(() => {
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    for (const c of costMetrics) {
      if (c.modelTier === 'TIER_1_LOW_COST') t1 += c.runCount;
      else if (c.modelTier === 'TIER_2_GENERAL_REASONING') t2 += c.runCount;
      else if (c.modelTier === 'TIER_3_HIGH_END') t3 += c.runCount;
    }
    const total = t1 + t2 + t3 || 1;
    return {
      t1Percent: Math.round((t1 / total) * 100),
      t2Percent: Math.round((t2 / total) * 100),
      t3Percent: Math.round((t3 / total) * 100),
      totalRuns: total,
    };
  }, [costMetrics]);

  return (
    <div className="space-y-6">
      {/* 1. COST & TOKENS PANEL */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Micro-USD Cost & Token Efficiency
                </span>
                <CardInfoTooltip text="Token spend across personas and 3-Tier model router distribution (Rule 58). Pure SVG/CSS visualization (Rule 54)." />
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Total Benchmark Spend: ${totalCost.toFixed(4)} USD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Tier 1: {tierAllocations.t1Percent}%</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Tier 2: {tierAllocations.t2Percent}%</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              <span>Tier 3: {tierAllocations.t3Percent}%</span>
            </div>
          </div>
        </div>

        {/* TIER ROUTER RATIO BAR */}
        <div className="space-y-1">
          <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${tierAllocations.t1Percent}%` }}
              title={`Tier 1 (Low Cost): ${tierAllocations.t1Percent}%`}
            />
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${tierAllocations.t2Percent}%` }}
              title={`Tier 2 (General Reasoning): ${tierAllocations.t2Percent}%`}
            />
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${tierAllocations.t3Percent}%` }}
              title={`Tier 3 (High End): ${tierAllocations.t3Percent}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>Fast Classification (Tier 1)</span>
            <span>Balanced Execution (Tier 2)</span>
            <span>Complex Synthesis (Tier 3)</span>
          </div>
        </div>

        {/* PERSONA COST BREAKDOWN BARS */}
        <div className="space-y-2.5 pt-2">
          {costMetrics.map((item) => {
            const barWidth = Math.min(100, Math.max(5, (item.totalCostUsd / maxCost) * 100));

            return (
              <div
                key={item.personaId}
                className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold font-mono text-foreground">
                      {item.personaId}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {item.modelTier}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-primary" />
                      <span>{(item.promptTokens + item.completionTokens).toLocaleString()} tok</span>
                    </div>
                    <span className="font-bold text-foreground">
                      ${item.totalCostUsd.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      item.modelTier === 'TIER_1_LOW_COST'
                        ? 'bg-emerald-500'
                        : item.modelTier === 'TIER_2_GENERAL_REASONING'
                        ? 'bg-blue-500'
                        : 'bg-indigo-500'
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. LATENCY & PERFORMANCE PANEL */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Latency Percentile Distribution
                </span>
                <CardInfoTooltip text="P50, P90, and P99 latency percentiles across capabilities. Evaluates SLA compliance under bounded load (Rule 54)." />
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {latencyMetrics.length} Canonical Capabilities Benchmarked
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>P50 (Median)</span>
            <span>·</span>
            <span>P90 (Tail)</span>
            <span>·</span>
            <span>P99 (SLA Boundary)</span>
          </div>
        </div>

        <div className="space-y-3">
          {latencyMetrics.map((item) => {
            const p50Width = Math.min(100, Math.max(3, (item.p50Ms / maxP99) * 100));
            const p90Width = Math.min(100, Math.max(5, (item.p90Ms / maxP99) * 100));
            const p99Width = Math.min(100, Math.max(7, (item.p99Ms / maxP99) * 100));

            return (
              <div
                key={item.capabilityId}
                className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold font-mono text-foreground">
                      {item.capabilityId}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">
                      {item.domain}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-muted-foreground">P50: {item.p50Ms}ms</span>
                    <span className="text-amber-500">P90: {item.p90Ms}ms</span>
                    <span className="text-destructive font-semibold">P99: {item.p99Ms}ms</span>
                  </div>
                </div>

                {/* LAYERED LATENCY BARS */}
                <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden relative">
                  {/* P99 Background Bar */}
                  <div
                    className="h-full bg-destructive/30 rounded-full absolute left-0"
                    style={{ width: `${p99Width}%` }}
                  />
                  {/* P90 Middle Bar */}
                  <div
                    className="h-full bg-amber-500/50 rounded-full absolute left-0"
                    style={{ width: `${p90Width}%` }}
                  />
                  {/* P50 Foreground Bar */}
                  <div
                    className="h-full bg-emerald-500 rounded-full absolute left-0"
                    style={{ width: `${p50Width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
