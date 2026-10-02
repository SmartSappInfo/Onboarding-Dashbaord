'use client';

/**
 * @fileOverview Company Brain KPI Metrics Cards (Phase 4 Milestone 4)
 *
 * Implements Rule 7 (Mobile Optimized), Rule 31 (Observability & Telemetry),
 * Rule 61 (Operator Console Surface), and Rule 64 (Emil Kowalski Tactile Micro-Interactions).
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Cpu, FileText, Inbox } from 'lucide-react';
import type { MemoryStats } from '@/platform/memory';

export interface CompanyBrainMetricsProps {
  stats: MemoryStats | null;
  isLoading?: boolean;
}

export function CompanyBrainMetrics({ stats, isLoading = false }: CompanyBrainMetricsProps) {
  const total = stats?.totalIndexed ?? 0;
  const vectors = stats?.semanticVectors ?? 0;
  const sources = stats?.activeSources ?? 0;
  const pending = stats?.inboxPending ?? 0;
  const isHealthy = stats?.healthStatus === 'healthy';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Total Indexed */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm hover:border-border transition-all">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Total Knowledge</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isLoading ? '...' : total.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across all 5 memory tiers</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Semantic Vectors */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm hover:border-border transition-all">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Vector Embeddings</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              {isLoading ? '...' : vectors.toLocaleString()}
              <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-blue-500/30 text-blue-600">
                768-D
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Qdrant dense index</p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Active Sources */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm hover:border-border transition-all">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Active Sources</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isLoading ? '...' : sources.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Notes, calls, deals & docs</p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Inbox Items Pending */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur shadow-sm hover:border-border transition-all">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Inbox Triage</span>
            <div className="relative p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Inbox className="h-4 w-4" />
              {pending > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              {isLoading ? '...' : pending.toLocaleString()}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="capitalize">{stats?.healthStatus || 'Online'}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pending operator review</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
