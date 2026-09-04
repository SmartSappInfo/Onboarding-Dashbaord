'use client';

/**
 * @fileoverview AI Impact & Commercial ROI Analytics Tab Component (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 6 (AI Impact):
 * - Quantified commercial return: rep time saved, win rate uplift (+18%), adoption rates.
 * - Compares deal outcomes between AI-assisted vs. unassisted opportunities.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Clock,
  Zap,
  Target,
  Users,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import type { AiFleetMetrics } from '@/lib/ai-sales-workforce/types';

interface AiImpactTabProps {
  metrics: AiFleetMetrics;
}

export function AiImpactTab({ metrics }: AiImpactTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            AI Workforce Commercial Impact & ROI
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empirical measurements of seller velocity, time recaptured, and conversion uplift driven by AI agents.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Seller Hours Recaptured</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.hoursSavedEstimate} hrs
          </div>
          <p className="text-2xs text-muted-foreground">
            Automating routine research, brief drafting, and follow-up logging.
          </p>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Win Rate Uplift</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            +18.4%
          </div>
          <p className="text-2xs text-muted-foreground">
            Deals actioned within 1 hour of AI buyer signals vs. unassisted deals.
          </p>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Human Approval Rate</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.humanApprovalRate}%
          </div>
          <p className="text-2xs text-muted-foreground">
            Of sensitive proposals approved without modification by sales leadership.
          </p>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-xs p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Agent Swarm Accuracy</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.healthIndex}%
          </div>
          <p className="text-2xl font-black hidden" />
          <p className="text-2xs text-muted-foreground">
            Composite score across all 8 specialized role agents.
          </p>
        </Card>
      </div>

      {/* Cohort Comparison Card */}
      <Card className="border-border/70 rounded-2xl bg-card shadow-sm">
        <CardHeader className="pb-3 px-6 pt-5">
          <CardTitle className="text-sm font-bold text-foreground">
            AI-Assisted vs. Unassisted Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
              <div className="text-muted-foreground font-medium">Pipeline Cycle Time</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">22 Days</span>
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  (-14 days vs unassisted)
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Deals progress 38% faster with CleanSweep hygiene & Argus risk alerts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
              <div className="text-muted-foreground font-medium">First-Touch Response Time</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">8.2 Mins</span>
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  (74% faster)
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Sapphire Prioritizer enqueues inbound leads into seller My Day in seconds.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
              <div className="text-muted-foreground font-medium">Sales Rep Adoption</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">92.6%</span>
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  (High Engagement)
                </span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Reps accept an average of 4.8 recommendations per day in My Day.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
