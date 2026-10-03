'use client';

/**
 * @fileOverview MCP Platform Metrics KPI Cards (Phase 5 Milestone 4 Task 4)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 61: Backoffice operator control plane visualization.
 * - Responsive 4-card grid displaying live telemetry and health.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, CheckCircle2, AlertTriangle, Server } from 'lucide-react';
import type { McpPlatformMetrics } from '@/app/actions/mcp-actions';

export interface McpMetricsCardsProps {
  metrics: McpPlatformMetrics | null;
  isLoading?: boolean;
}

export function McpMetricsCards({ metrics, isLoading = false }: McpMetricsCardsProps) {
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

  const verifiedPercent = metrics.totalCapabilities > 0
    ? Math.round((metrics.verifiedFingerprints / metrics.totalCapabilities) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Capabilities */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Platform Tools
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{metrics.totalCapabilities}</span>
              <span className="text-xs text-muted-foreground">capabilities</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Wrench className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Verified Fingerprints */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Verified Schemas
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {metrics.verifiedFingerprints}
              </span>
              <span className="text-xs text-emerald-600/80 font-medium">({verifiedPercent}%)</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Drift Alerts */}
      <Card
        className={`border shadow-sm hover:shadow-md transition-shadow ${
          metrics.driftedCapabilities > 0
            ? 'border-destructive/50 bg-destructive/5'
            : 'border-border/80 bg-card/60 backdrop-blur-sm'
        }`}
      >
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Schema Drift
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  metrics.driftedCapabilities > 0 ? 'text-destructive' : 'text-foreground'
                }`}
              >
                {metrics.driftedCapabilities}
              </span>
              <span className="text-xs text-muted-foreground">drift alerts</span>
            </div>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              metrics.driftedCapabilities > 0
                ? 'bg-destructive/15 text-destructive animate-pulse'
                : 'bg-muted/30 text-muted-foreground'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Allowlisted Servers */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              External Servers
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{metrics.externalServers}</span>
              <span className="text-xs text-muted-foreground">allowlisted</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Server className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
