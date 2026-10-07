'use client';

/**
 * @fileOverview Standardized Knowledge Conflict Resolution Modal (Phase 11 M3 · T7)
 *
 * Implements theme.md §8 (Standardized Modal & Dialog System Architecture),
 * Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 17 (Human-only Decider for conflict resolutions), Rule 29 (Immutable Temporal Fact Supersession),
 * and Rule 30 (Untrusted Reference Data XML containerization).
 *
 * Invariants:
 * - Demarcated Header: <DialogHeader demarcated> with min-h-[52px], bg-muted/20, border-b.
 * - Single-Circle Info Tooltip: <CardInfoTooltip text="..."> at z-[10050].
 * - Zero Raw Visual Descriptions: <DialogDescription className="sr-only">.
 * - Demarcated Footer: px-6 py-3.5, border-t, bg-muted/15, with tactile rounded-xl buttons.
 * - 3 Resolution Primitives: [Supersede Existing], [Keep Both Distinct], [Reject Candidate].
 */

import * as React from 'react';
import {
  AlertTriangle,
  GitCompare,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Database,
  X,
  Check,
  Split,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  KnowledgeCandidate,
  KnowledgeConflict,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

export interface KnowledgeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: KnowledgeConflict | null;
  candidate: KnowledgeCandidate | null;
  existingMemoryContent?: string;
  onResolve?: (
    conflictId: string,
    resolution: 'supersede_existing' | 'keep_both_distinct' | 'keep_both' | 'reject_candidate',
    expectedVersion: number
  ) => void;
  className?: string;
}

export function KnowledgeConflictModal({
  isOpen,
  onClose,
  conflict,
  candidate,
  existingMemoryContent,
  onResolve,
  className,
}: KnowledgeConflictModalProps) {
  if (!conflict || !candidate) return null;

  const conflictTypeLabel =
    conflict.conflictType === 'contradiction'
      ? 'Contradiction Detected'
      : conflict.conflictType === 'outdated'
        ? 'Outdated Memory Detected'
        : conflict.conflictType === 'duplicate'
          ? 'Duplicate Memory Detected'
          : 'Policy Divergence Detected';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden flex flex-col',
          className
        )}
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader
          demarcated
          className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                {conflictTypeLabel}
              </DialogTitle>
              <CardInfoTooltip text="AI detected a factual divergence between this incoming candidate and institutional memory. Per Rule 17, conflict resolution is strictly human-governed." />
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize"
          >
            {conflict.conflictType.replace('_', ' ')}
          </Badge>
          <DialogDescription className="sr-only">
            Resolve factual contradiction between candidate knowledge item and existing institutional memory.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body: Side-by-Side Comparison */}
        <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
          <div className="text-xs text-muted-foreground leading-relaxed">
            The candidate statement conflicts with an existing verified memory record. Choose whether to supersede the historical fact (Rule 29: immutable temporal versioning), retain both as parallel viewpoints, or discard the candidate.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Existing Memory Record */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    Existing Memory
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {conflict.existingMemoryId}
                  </span>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-foreground/90 font-mono leading-relaxed">
                  {existingMemoryContent || 'Existing memory record verified in enterprise knowledge graph.'}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Currently marked as active fact.
              </div>
            </div>

            {/* Incoming Candidate Claim */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.03] p-4 space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    Incoming Candidate
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {candidate.id}
                  </span>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-card p-3 text-xs text-foreground font-mono leading-relaxed">
                  {candidate.content}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Source: {candidate.source.type}:{candidate.source.id} &middot; {Math.round(candidate.confidence * 100)}% conf
              </div>
            </div>
          </div>
        </div>

        {/* Demarcated Footer with 3 Tactile Resolution Actions (theme.md §8.4) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-wrap items-center justify-end gap-2.5">
          <Button
            variant="outline"
            onClick={() => onResolve?.(conflict.id, 'reject_candidate', conflict.version)}
            className="min-h-[44px] px-4 rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.97] transition-all text-xs font-medium"
          >
            <X className="h-4 w-4 mr-1.5" />
            Reject Candidate
          </Button>

          <Button
            variant="outline"
            onClick={() => onResolve?.(conflict.id, 'keep_both_distinct', conflict.version)}
            className="min-h-[44px] px-4 rounded-xl border-border/80 text-foreground hover:bg-muted/40 active:scale-[0.97] transition-all text-xs font-medium"
          >
            <Split className="h-4 w-4 mr-1.5" />
            Keep Both Distinct
          </Button>

          <Button
            onClick={() => onResolve?.(conflict.id, 'supersede_existing', conflict.version)}
            className="min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all text-xs font-medium shadow-sm"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Supersede Existing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
