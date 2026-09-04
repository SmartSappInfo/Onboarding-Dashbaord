'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Memory Health & Governance Ribbon
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Unified Health Visibility:
 *    - Real-time KPI cards across all 3 stores (Transactional, Vector, Graph).
 * 2. Emil Kowalski Interaction Standards:
 *    - Tactile button states with `active:scale-[0.97]` and smooth focus outlines.
 * 3. Mobile First:
 *    - Touch targets with `min-h-[44px]` and responsive 2-to-5 column grid layout.
 * 4. Zero-`any` Standard:
 *    - Strictly typed props and metric interfaces.
 */

import * as React from 'react';
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { MemoryHealthMetrics } from '@/lib/memory/orchestrator-types';

export type HealthRibbonTab = 'all' | 'verified' | 'conflicts' | 'stale' | 'consolidation';

export interface MemoryHealthRibbonProps {
  metrics: MemoryHealthMetrics;
  isLoading?: boolean;
  activeTab?: HealthRibbonTab;
  onTabChange?: (tab: HealthRibbonTab) => void;
  onTriggerScan?: () => void;
  isScanning?: boolean;
}

export function MemoryHealthRibbon({
  metrics,
  isLoading = false,
  activeTab = 'all',
  onTabChange,
  onTriggerScan,
  isScanning = false,
}: MemoryHealthRibbonProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'all' as const,
      label: 'Total Knowledge',
      value: metrics.totalMemories,
      icon: Brain,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
      badge: null,
    },
    {
      id: 'verified' as const,
      label: 'Verified Truth',
      value: metrics.verifiedTruthCount,
      icon: ShieldCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
      badge: `${metrics.totalMemories > 0 ? Math.round((metrics.verifiedTruthCount / metrics.totalMemories) * 100) : 0}%`,
    },
    {
      id: 'conflicts' as const,
      label: 'Contradictions',
      value: metrics.unresolvedConflictCount,
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
      badge: metrics.unresolvedConflictCount > 0 ? 'Needs Review' : 'Clean',
      badgeColor:
        metrics.unresolvedConflictCount > 0
          ? 'bg-rose-500 text-white animate-pulse'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    },
    {
      id: 'stale' as const,
      label: 'Decaying / Stale',
      value: metrics.staleMemoryCount,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      badge: metrics.staleMemoryCount > 0 ? 'Reconfirm' : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'consolidation' as const,
      label: 'Sync Health',
      value: `${metrics.syncHealthPercentage}%`,
      icon: Activity,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
      badge: `${metrics.qdrantIndexedCount} Vectors`,
    },
  ];

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeTab === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onTabChange?.(card.id)}
              className={cn(
                'group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150',
                'min-h-[44px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'active:scale-[0.97]',
                isSelected
                  ? 'ring-2 ring-primary border-transparent shadow-sm bg-background'
                  : 'bg-card hover:bg-muted/40 border-border'
              )}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                  {card.label}
                </span>
                <div
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-lg border',
                    card.bg
                  )}
                >
                  <Icon className={cn('w-4 h-4', card.color)} />
                </div>
              </div>

              <div className="flex items-baseline justify-between w-full mt-1">
                <span className="text-xl font-bold tracking-tight text-foreground">
                  {card.value}
                </span>

                {card.badge && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      card.badgeColor ||
                        'bg-muted text-muted-foreground border border-border'
                    )}
                  >
                    {card.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {onTriggerScan && (
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onTriggerScan}
            disabled={isScanning}
            className="min-h-[44px] sm:min-h-[36px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
            {isScanning ? 'Auditing Memories...' : 'Scan Memory Contradictions'}
          </Button>
        </div>
      )}
    </div>
  );
}
