'use client';

/**
 * @file src/components/page-builder/AdaptiveTrafficPanel.tsx
 * @description Studio Control Panel for Adaptive Traffic Routing & Multi-Armed Bandit Policies.
 * Renders real-time allocation gauges showing live arm traffic percentages (`currentWeight`) adjusting as conversions occur.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { BanditPolicy } from '@/lib/types';
import { GitBranch, Play, Pause, TrendingUp, Sparkles } from 'lucide-react';

export interface AdaptiveTrafficPanelProps {
  policy: BanditPolicy | null;
  onTogglePolicyStatus: () => void;
  onCreateArm?: () => void;
}

export const AdaptiveTrafficPanel: React.FC<AdaptiveTrafficPanelProps> = ({
  policy,
  onTogglePolicyStatus,
}) => {
  if (!policy) return null;

  const isRunning = policy.status === 'active';

  return (
    <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-4 shadow-sm">
      {/* Policy Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <GitBranch className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>Adaptive Traffic (Thompson Sampling)</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold">
                {policy.algorithm}
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Dynamic real-time traffic weighting based on conversion probability
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onTogglePolicyStatus}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isRunning
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" /> Pause Routing
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" /> Activate Routing
            </>
          )}
        </button>
      </div>

      {/* Traffic Arm Allocation Gauges */}
      <div className="space-y-2.5">
        {(policy.arms || []).map((arm) => {
          const weight = arm.currentWeight || 0;
          const cr =
            arm.impressions > 0
              ? Math.round((arm.conversions / arm.impressions) * 1000) / 10
              : 0;

          return (
            <div
              key={arm.id}
              className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{arm.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({arm.conversions} conv / {arm.impressions} views)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                    {weight}% traffic
                  </span>
                  <span className="text-muted-foreground text-[11px]">CR: {cr}%</span>
                </div>
              </div>

              {/* Allocation Progress Bar */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, weight)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Explanatory Note */}
      <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-muted-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
        <span>
          Traffic weights automatically adjust after every conversion to maximize overall page performance.
        </span>
      </div>
    </div>
  );
};
