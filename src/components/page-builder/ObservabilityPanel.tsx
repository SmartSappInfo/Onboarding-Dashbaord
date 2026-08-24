'use client';

/**
 * @file src/components/page-builder/ObservabilityPanel.tsx
 * @description Studio Control Panel for Platform Production Hardening & Global Observability.
 * Displays real-time platform health status, uptime percentages, edge CDN hit rates, and edge cache purging controls.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { SystemObservabilitySummary } from '@/lib/types';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Database, Server, Zap } from 'lucide-react';

export interface ObservabilityPanelProps {
  summary: SystemObservabilitySummary;
  onPurgeEdgeCache: () => void;
}

export const ObservabilityPanel: React.FC<ObservabilityPanelProps> = React.memo(({
  summary,
  onPurgeEdgeCache,
}) => {
  const isHealthy = summary.status === 'healthy';

  return (
    <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-4 shadow-sm">
      {/* Header & Edge Cache Purge Button */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`p-2 rounded-xl ${
            isHealthy
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <Activity className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>Platform Health & Edge CDN</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                isHealthy
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {summary.status}
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Global SLA Uptime: {summary.uptimePercent}%
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onPurgeEdgeCache}
          className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.97] transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Purge Edge Cache
        </button>
      </div>

      {/* Global Health Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-500" /> Edge Hit Rate
          </span>
          <p className="text-sm font-bold text-foreground">{summary.edgeHitRate}%</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Server className="w-3 h-3 text-blue-500" /> Active Pages
          </span>
          <p className="text-sm font-bold text-foreground">{summary.activePages}</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Database className="w-3 h-3 text-purple-500" /> DB Latency
          </span>
          <p className="text-sm font-bold text-foreground">14ms</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> SLA Target
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">99.9%</p>
        </div>
      </div>

      {/* Subsystem Metrics Feed */}
      <div className="space-y-2">
        <h5 className="font-semibold text-xs text-foreground">Subsystem Observability Feeds</h5>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(summary.metrics || []).map((m, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                {m.status === 'healthy' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : m.status === 'degraded' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span className="font-medium text-foreground">{m.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{m.latencyMs}ms</span>
                <span>Err: {(m.errorRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

ObservabilityPanel.displayName = 'ObservabilityPanel';
