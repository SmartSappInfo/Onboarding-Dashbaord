'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Obligations & Deliverables Rail Component (Phase 3 Task 8).
 * 2. Visual Invariants & Everyday Microcopy (Rule 7 Minimal Text):
 *    Surfaces clear status filters (All, Pending, Overdue, Fulfilled) and one-click
 *    completion controls with everyday labels ("Mark Done", "Due in X days").
 * 3. Emil Kowalski Micro-Interactions:
 *    Tactile check buttons with `active:scale-[0.97]` and smooth state transitions.
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react';
import { fulfillContractObligationAction } from '@/lib/documents/contract-actions';
import type { ContractObligation } from '@/lib/types/document-signing';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface ObligationsListRailProps {
  obligations: ContractObligation[];
  workspaceId: string;
  onObligationUpdated?: () => void;
  className?: string;
}

export default function ObligationsListRail({
  obligations,
  workspaceId,
  onObligationUpdated,
  className,
}: ObligationsListRailProps) {
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'overdue' | 'fulfilled'>('all');
  const [completingId, setCompletingId] = React.useState<string | null>(null);

  const filteredObligations = React.useMemo(() => {
    const now = Date.now();
    return obligations.filter((ob) => {
      const isDone = ob.status === 'fulfilled';
      const isPast = new Date(ob.dueDate).getTime() < now && !isDone;

      if (filter === 'pending') return !isDone && !isPast;
      if (filter === 'overdue') return isPast;
      if (filter === 'fulfilled') return isDone;
      return true;
    });
  }, [obligations, filter]);

  const handleMarkDone = async (ob: ContractObligation) => {
    if (completingId) return;
    try {
      setCompletingId(ob.id);
      const res = await fulfillContractObligationAction({
        workspaceId,
        obligationId: ob.id,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete deliverable.');
      }

      toast({
        title: 'Deliverable Completed',
        description: `"${ob.title}" is now marked fulfilled and synced with tasks.`,
      });

      onObligationUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error completing deliverable.';
      toast({ title: 'Action Failed', description: msg, variant: 'destructive' });
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Button
          type="button"
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className="h-7 px-2.5 text-xs font-medium active:scale-[0.97]"
        >
          All ({obligations.length})
        </Button>
        <Button
          type="button"
          variant={filter === 'pending' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('pending')}
          className="h-7 px-2.5 text-xs font-medium active:scale-[0.97]"
        >
          Pending
        </Button>
        <Button
          type="button"
          variant={filter === 'overdue' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('overdue')}
          className="h-7 px-2.5 text-xs font-medium text-rose-600 hover:text-rose-700 active:scale-[0.97]"
        >
          Overdue
        </Button>
        <Button
          type="button"
          variant={filter === 'fulfilled' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('fulfilled')}
          className="h-7 px-2.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 active:scale-[0.97]"
        >
          Completed
        </Button>
      </div>

      {/* Obligations List */}
      <div className="space-y-2.5">
        {filteredObligations.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-border/80 p-6 space-y-1 text-xs text-muted-foreground">
            <CheckSquare className="w-6 h-6 mx-auto text-muted-foreground/60 mb-2" />
            <p className="font-semibold text-foreground">No deliverables found</p>
            <p className="text-[11px]">All contractual obligations are up to date for this filter.</p>
          </div>
        ) : (
          filteredObligations.map((ob) => {
            const isDone = ob.status === 'fulfilled';
            const dueTime = new Date(ob.dueDate).getTime();
            const daysDiff = Math.ceil((dueTime - Date.now()) / (1000 * 60 * 60 * 24));
            const isPast = daysDiff < 0 && !isDone;

            return (
              <div
                key={ob.id}
                className={cn(
                  'p-3.5 rounded-xl border transition-all duration-200 space-y-2.5',
                  isDone
                    ? 'bg-muted/20 border-border/50 opacity-75'
                    : isPast
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : 'bg-card border-border/70 hover:border-border'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-semibold text-foreground',
                          isDone && 'line-through text-muted-foreground'
                        )}
                      >
                        {ob.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {ob.type}
                      </Badge>
                      {isPast && (
                        <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {Math.abs(daysDiff)}d Overdue
                        </Badge>
                      )}
                      {!isDone && !isPast && (
                        <Badge variant="secondary" className="text-[10px]">
                          Due in {daysDiff}d
                        </Badge>
                      )}
                    </div>

                    {ob.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {ob.description}
                      </p>
                    )}
                  </div>

                  {!isDone && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkDone(ob)}
                      disabled={completingId === ob.id}
                      className="min-h-[44px] sm:min-h-[32px] text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 active:scale-[0.97] shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Mark Done
                    </Button>
                  )}
                </div>

                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground/70" />
                      {new Date(ob.dueDate).toLocaleDateString()}
                    </span>

                    <span className="flex items-center gap-1 capitalize">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground/70" />
                      {ob.responsibleParty}
                    </span>
                  </div>

                  {ob.linkedTaskId && (
                    <Link
                      href="/admin/tasks"
                      className="flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <span>Task Queue</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
