'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Stale Memory Governance List
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 1-Click Truth Reconfirmation:
 *    - Allows operators to instantly re-validate decayed memories back to 100% freshness.
 * 2. Visual Staleness Spectrum:
 *    - Renders color-coded progress bars and indicators indicating decay severity.
 * 3. Mobile First:
 *    - Interactive buttons adhere to `min-h-[44px]` touch targets.
 * 4. Zero-`any` Standard:
 *    - Strongly typed with `MemoryObject` and `MemoryFreshnessInfo`.
 */

import * as React from 'react';
import {
  Clock,
  ShieldCheck,
  Archive,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { MemoryObject } from '@/lib/memory/types';
import type { MemoryFreshnessInfo } from '@/lib/memory/orchestrator-types';

export interface StaleMemoryListProps {
  staleItems: { memory: MemoryObject; freshness: MemoryFreshnessInfo }[];
  onReconfirm: (memoryId: string) => Promise<void>;
  onArchive?: (memoryId: string) => Promise<void>;
  processingId?: string | null;
  isLoading?: boolean;
}

export function StaleMemoryList({
  staleItems,
  onReconfirm,
  onArchive,
  processingId,
  isLoading = false,
}: StaleMemoryListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-xs">Analyzing knowledge staleness and decay curves...</p>
      </div>
    );
  }

  if (staleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">All Memories Are Fresh</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No organizational memories currently exceed their freshness threshold. Your institutional knowledge base is fully up to date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground">
          {staleItems.length} {staleItems.length === 1 ? 'memory' : 'memories'} requiring verification
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {staleItems.map(({ memory, freshness }) => {
          const isProcessing = processingId === memory.id;
          const freshnessPercent = Math.round(freshness.freshnessScore * 100);

          return (
            <div
              key={memory.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all"
            >
              {/* Main Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                    {memory.type}
                  </Badge>
                  <h4 className="text-sm font-semibold text-foreground truncate">
                    {memory.title || `${memory.type.toUpperCase()} Knowledge`}
                  </h4>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {memory.content}
                </p>

                {/* Freshness Bar & Attribution */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <Progress value={freshnessPercent} className="h-1.5 w-16" />
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {freshnessPercent}% fresh
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Confirmed: {new Date(freshness.lastConfirmedAt).toLocaleDateString()}
                  </span>

                  {freshness.daysRemaining === 0 ? (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      Expired ({freshness.ttlDays}d TTL)
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {freshness.daysRemaining} days remaining
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                <Button
                  variant="default"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => onReconfirm(memory.id)}
                  className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  Reconfirm Truth
                </Button>

                {onArchive && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => onArchive(memory.id)}
                    className="min-h-[44px] text-xs text-muted-foreground hover:text-rose-600 active:scale-[0.97]"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
