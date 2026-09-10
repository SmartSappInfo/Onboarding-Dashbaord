'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Swarm Runs History Table
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Historical Telemetry:
 *    - Lists past swarm runs with latency, specialist count, status, and inspector triggers.
 * 2. Mobile Accessibility:
 *    - Responsive layout switching between table (desktop) and stacked cards (mobile).
 * 3. Emil Kowalski Micro-Interactions:
 *    - `active:scale-[0.97]` on all buttons.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Eye,
  Users,
  RotateCw,
} from 'lucide-react';
import type { SwarmRun } from '@/lib/agents/domain-types';

export interface SwarmRunsHistoryTableProps {
  runs: SwarmRun[];
  onSelectRun: (run: SwarmRun) => void;
  isLoading?: boolean;
}

export function SwarmRunsHistoryTable({
  runs,
  onSelectRun,
  isLoading,
}: SwarmRunsHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-2">
        <RotateCw className="w-4 h-4 animate-spin text-purple-600" />
        <span>Loading mission history...</span>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
        No swarm missions recorded in this workspace yet. Launch a mission above to begin.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {runs.map((run) => (
          <div
            key={run.id}
            className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-md">
                  {run.objective}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-semibold text-slate-600"
                >
                  {run.mode.replace('_', ' ')}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-medium capitalize ${
                    run.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : run.status === 'needs_approval'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {run.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <span>{run.specialistIds.length} Specialists</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{run.metrics.durationMs}ms</span>
                </span>
                <span>&bull;</span>
                <span>{new Date(run.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectRun(run)}
              className="min-h-[44px] text-xs font-medium rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all flex items-center gap-1.5 shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Inspect Briefing</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
