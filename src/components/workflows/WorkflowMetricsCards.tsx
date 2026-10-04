'use client';

/**
 * @fileOverview Workflow Platform Metrics KPI Cards (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 61: Backoffice operator control plane visualization.
 * - Responsive 4-card grid displaying live workflow telemetry and operational health.
 * - Semantic token binding to card and border tokens (theme.md).
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, Play, Clock, AlertTriangle } from 'lucide-react';
import type { WorkflowPlatformMetrics } from '@/app/actions/workflow-admin-actions';

export interface WorkflowMetricsCardsProps {
  metrics: WorkflowPlatformMetrics | null;
  isLoading?: boolean;
}

export function WorkflowMetricsCards({ metrics, isLoading = false }: WorkflowMetricsCardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-muted/30 border-border/60">
            <CardContent className="p-4 sm:p-5 h-24" />
          </Card>
        ))}
      </div>
    );
  }

  const successRate = metrics.totalWorkflows > 0
    ? Math.round((metrics.completedWorkflows / metrics.totalWorkflows) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Workflows */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Instances
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{metrics.totalWorkflows}</span>
              <span className="text-xs text-muted-foreground">workflows</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Active Workflows */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              In-Flight Active
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {metrics.activeWorkflows}
              </span>
              {metrics.activeWorkflows > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              )}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Play className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Waiting for Approval */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Awaiting Approval
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {metrics.waitingWorkflows}
              </span>
              {metrics.waitingWorkflows > 0 && (
                <span className="text-xs text-amber-600/80 font-medium">pending</span>
              )}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Failed / DLQ */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Failed / DLQ
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-destructive">
                {metrics.failedWorkflows}
              </span>
              <span className="text-xs text-muted-foreground">
                ({successRate}% success)
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
