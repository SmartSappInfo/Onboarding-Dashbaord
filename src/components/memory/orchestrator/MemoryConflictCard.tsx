'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Memory Conflict Card
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Side-by-Side Visual Comparison:
 *    - Renders contradictory claims from Memory A and Memory B clearly for human decision-makers.
 * 2. Mobile Responsive Layout:
 *    - Desktop displays 2-column comparative layout; mobile devices (< 768px) stack smoothly.
 * 3. Emil Kowalski Interaction Polish:
 *    - Action buttons feature `active:scale-[0.97]` and visible focus indicators.
 * 4. Touch Target Accessibility:
 *    - All interactive resolution buttons adhere to the `min-h-[44px]` standard.
 * 5. Zero-`any` Invariant:
 *    - Fully typed with `MemoryConflict` and `ConflictResolutionChoice`.
 */

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  ArrowRight,
  User,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  MemoryConflict,
  ConflictResolutionChoice,
} from '@/lib/memory/orchestrator-types';

export interface MemoryConflictCardProps {
  conflict: MemoryConflict;
  onResolve: (choice: ConflictResolutionChoice, notes?: string) => Promise<void>;
  onOpenModal: (conflict: MemoryConflict) => void;
  isResolving?: boolean;
}

export function MemoryConflictCard({
  conflict,
  onResolve,
  onOpenModal,
  isResolving = false,
}: MemoryConflictCardProps) {
  const isResolved = conflict.status === 'resolved';

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all duration-150 shadow-sm',
        isResolved
          ? 'bg-muted/30 border-border opacity-75'
          : 'bg-card border-rose-200 dark:border-rose-900/50 hover:shadow-md'
      )}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg',
              isResolved
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-600'
            )}
          >
            {isResolved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant={isResolved ? 'outline' : 'destructive'}
                className="text-[10px] uppercase tracking-wider font-semibold"
              >
                {conflict.conflictType.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round(conflict.confidenceScore * 100)}% confidence
              </span>
            </div>
          </div>
        </div>

        {isResolved && conflict.resolution && (
          <Badge variant="secondary" className="text-xs capitalize">
            Resolved: {conflict.resolution.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {/* Conflict Summary */}
      <div className="py-3">
        <p className="text-sm font-semibold text-foreground">{conflict.summary}</p>

        {conflict.opposingAspects && conflict.opposingAspects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-muted-foreground">Opposing aspects:</span>
            {conflict.opposingAspects.map((aspect) => (
              <Badge key={aspect} variant="outline" className="text-[11px] py-0 px-2">
                {aspect}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
        {/* Memory A */}
        <div className="flex flex-col justify-between p-4 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-primary tracking-wider uppercase">
                Claim A
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {conflict.evidenceA.sourceType.replace('_', ' ')}
              </Badge>
            </div>

            <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
              {conflict.evidenceA.title}
            </h4>

            <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2.5 my-2">
              &quot;{conflict.evidenceA.quote}&quot;
            </blockquote>
          </div>

          <div className="pt-3 mt-2 border-t border-border/40">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {conflict.evidenceA.authorName || 'Note Author'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(conflict.evidenceA.createdAt).toLocaleDateString()}
              </span>
            </div>

            {!isResolved && (
              <Button
                variant="outline"
                size="sm"
                disabled={isResolving}
                onClick={() => onResolve('confirm_a')}
                className="w-full min-h-[44px] text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 active:scale-[0.97] transition-all"
              >
                Confirm Claim A (Supersede B)
              </Button>
            )}
          </div>
        </div>

        {/* Memory B */}
        <div className="flex flex-col justify-between p-4 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-primary tracking-wider uppercase">
                Claim B
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {conflict.evidenceB.sourceType.replace('_', ' ')}
              </Badge>
            </div>

            <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
              {conflict.evidenceB.title}
            </h4>

            <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2.5 my-2">
              &quot;{conflict.evidenceB.quote}&quot;
            </blockquote>
          </div>

          <div className="pt-3 mt-2 border-t border-border/40">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {conflict.evidenceB.authorName || 'Source Record'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(conflict.evidenceB.createdAt).toLocaleDateString()}
              </span>
            </div>

            {!isResolved && (
              <Button
                variant="outline"
                size="sm"
                disabled={isResolving}
                onClick={() => onResolve('confirm_b')}
                className="w-full min-h-[44px] text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 active:scale-[0.97] transition-all"
              >
                Confirm Claim B (Supersede A)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Choice Adjudication Toolbar */}
      {!isResolved && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isResolving}
              onClick={() => onResolve('keep_both')}
              className="min-h-[44px] text-xs active:scale-[0.97] transition-transform"
            >
              Keep Both (Harmonious)
            </Button>

            <Button
              variant="default"
              size="sm"
              disabled={isResolving}
              onClick={() => onOpenModal(conflict)}
              className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Resolve Manually...
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={isResolving}
            onClick={() => onResolve('dismiss')}
            className="min-h-[44px] text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            Dismiss Dispute
          </Button>
        </div>
      )}

      {/* Resolution Notes Audit */}
      {isResolved && conflict.resolutionNotes && (
        <div className="mt-3 p-3 rounded-lg bg-muted text-xs text-muted-foreground border border-border">
          <span className="font-semibold text-foreground">Resolution note:</span>{' '}
          {conflict.resolutionNotes}
        </div>
      )}
    </div>
  );
}
