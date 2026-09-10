'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Memory Consolidation Review Drawer / Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. AI Synthesis Review:
 *    - Surfaces proposed consolidations merging multiple fragmented memories into single canonical truths.
 * 2. Emil Kowalski Interaction Polish:
 *    - Smooth tactile feedback with `active:scale-[0.97]`.
 * 3. Mobile First:
 *    - All touch targets adhere to `min-h-[44px]`.
 * 4. Zero-`any` Standard:
 *    - Strictly typed with `ConsolidationCandidate`.
 */

import * as React from 'react';
import {
  GitMerge,
  Sparkles,
  Check,
  Loader2,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConsolidationCandidate } from '@/lib/memory/orchestrator-types';

export interface ConsolidationReviewDrawerProps {
  candidates: ConsolidationCandidate[];
  onApply: (candidate: ConsolidationCandidate) => Promise<void>;
  onDismiss?: (candidateId: string) => void;
  isApplyingId?: string | null;
  isLoading?: boolean;
}

export function ConsolidationReviewDrawer({
  candidates,
  onApply,
  onDismiss,
  isApplyingId,
  isLoading = false,
}: ConsolidationReviewDrawerProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-xs">Clustering redundant memories and synthesizing candidates...</p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 mb-3">
          <GitMerge className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">No Consolidation Candidates</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Memories are currently well-partitioned with no overlapping duplicates or fragmented clusters detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground">
          {candidates.length} {candidates.length === 1 ? 'cluster' : 'clusters'} recommended for consolidation
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {candidates.map((candidate) => {
          const isApplying = isApplyingId === candidate.id;

          return (
            <div
              key={candidate.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {candidate.proposedType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Merges {candidate.sourceMemoryIds.length} memories
                      </span>
                    </div>
                  </div>
                </div>

                <Badge variant="secondary" className="text-xs">
                  {Math.round(candidate.confidenceScore * 100)}% confidence
                </Badge>
              </div>

              {/* Proposed Synthesis */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Proposed Canonical Memory
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  {candidate.proposedTitle}
                </h4>
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {candidate.proposedContent}
                </p>
              </div>

              {/* AI Reasoning */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>{candidate.reasoning}</p>
              </div>

              {/* Topics & Entities */}
              {candidate.topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Topics:</span>
                  {candidate.topics.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] py-0 px-2">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isApplying}
                    onClick={() => onDismiss(candidate.id)}
                    className="min-h-[44px] text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                  >
                    Dismiss
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  disabled={isApplying}
                  onClick={() => onApply(candidate)}
                  className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
                >
                  {isApplying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Apply Consolidation
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
