'use client';

/**
 * @fileOverview Active Agent Runs Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 5 of the Global Context Rail:
 * - Active background agent runs associated with current entity
 * - Progress metrics (completed vs total steps)
 * - Persona and status badges
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 * - Rule 68 / §81 (No Dead Ends navigation)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Bot,
  PlayCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ActiveAgentRunSummary } from '@/platform/ui/context-rail';

export interface ActiveRunsModuleProps {
  runs: ActiveAgentRunSummary[];
}

export function ActiveRunsModule({ runs }: ActiveRunsModuleProps) {
  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'EXECUTING':
      case 'RUNNING':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            EXECUTING
          </Badge>
        );
      case 'PLANNING':
      case 'REPLANNING':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] flex items-center gap-1 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            PLANNING
          </Badge>
        );
      case 'AWAITING_APPROVAL':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] flex items-center gap-1 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            AWAITING APPROVAL
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {status}
          </Badge>
        );
    }
  };

  if (runs.length === 0) {
    return (
      <div
        data-testid="context-rail-runs-empty"
        className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1.5"
      >
        <Bot className="h-5 w-5 text-muted-foreground/60 mx-auto" />
        <p className="text-xs text-muted-foreground">No active agent runs for this object right now.</p>
      </div>
    );
  }

  return (
    <div data-testid="context-rail-runs-module" className="space-y-2.5">
      {runs.map((run) => {
        const progressPct =
          run.stepProgress.total > 0
            ? Math.round((run.stepProgress.completed / run.stepProgress.total) * 100)
            : 0;

        return (
          <Link
            key={run.runId}
            href={run.viewUrl}
            className="group block p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-border/90 transition-all active:scale-[0.98] min-h-[44px]"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {run.personaName}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {run.runId}
                  </div>
                </div>
              </div>

              <div className="shrink-0">{getStatusBadge(run.status)}</div>
            </div>

            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
              {run.goalDescription}
            </p>

            {/* Step Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Steps Progress</span>
                <span>
                  {run.stepProgress.completed}/{run.stepProgress.total} ({progressPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Footer link indication */}
            <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-primary pt-2 mt-1 border-t border-border/40 group-hover:underline">
              <span>View Execution Run</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
