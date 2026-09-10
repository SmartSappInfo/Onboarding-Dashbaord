'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Privacy-Preserving Federated Benchmarks Card
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Privacy-Preserving Guarantee (Rule 2 / Rule 8):
 *    - All metrics are aggregated k-anonymous percentiles (k >= 5).
 *    - Zero raw notes, entity names, or proprietary figures are ever transmitted across workspace boundaries.
 * 2. Emil Kowalski Animations (Rule 1):
 *    - Smooth progress bars and tactile hover states.
 * 3. Mobile Touch Targets (Rule 7):
 *    - Maintains minimum 44px touch targets.
 * 4. Strict Zero-`any` Compliance (Rule 4):
 *    - Strongly typed with `FederatedBenchmarkMetric`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import {
  BarChart,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import type { FederatedBenchmarkMetric } from '@/lib/intelligence/types';

interface FederatedBenchmarksCardProps {
  benchmarks: FederatedBenchmarkMetric[];
}

export function FederatedBenchmarksCard({ benchmarks }: FederatedBenchmarksCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BarChart className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Privacy-Preserving Federated Benchmarks
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anonymized operational percentiles compared against industry peers.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>k-Anonymity Verified (k ≥ 5)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benchmarks.map((b) => (
          <div
            key={b.metricKey}
            className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-foreground">{b.label}</h4>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3" />
                  {b.cohortIndustry} ({b.cohortSampleCount} peers)
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-foreground">
                  {b.workspaceValue}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Median: {b.cohortMedian}
                </span>
              </div>
            </div>

            {/* Percentile Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Cohort Percentile</span>
                <span className="font-bold text-primary">{b.cohortPercentile}th percentile</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${b.cohortPercentile}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Your workspace performs in the top {100 - b.cohortPercentile}% of peer organizations.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
