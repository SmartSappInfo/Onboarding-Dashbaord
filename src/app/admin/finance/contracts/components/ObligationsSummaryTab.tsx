'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Obligations & Milestones Tab for Agreements Hub (Phase 3 Task 9).
 * 2. Visual Invariants & Everyday Microcopy (Rule 7 Minimal Text):
 *    Surfaces cross-contract compliance milestones, payment deliverables,
 *    and reporting schedules with instant status counters and one-click fulfillment.
 * 3. Emil Kowalski Micro-Interactions:
 *    Spring animated counters and tactile action buttons (`active:scale-[0.97]`).
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import ObligationsListRail from './ObligationsListRail';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { ContractObligation } from '@/lib/types/document-signing';
import { cn } from '@/lib/utils';

export interface ObligationsSummaryTabProps {
  workspaceId: string;
  onOpenCreateObligation?: () => void;
  className?: string;
}

export default function ObligationsSummaryTab({
  workspaceId,
  onOpenCreateObligation,
  className,
}: ObligationsSummaryTabProps) {
  const firestore = useFirestore();

  // Fetch all obligations in this workspace
  const obligationsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'contract_obligations'),
      where('workspaceId', '==', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: rawObligations, isLoading } = useCollection<ContractObligation>(obligationsQuery);
  const obligations = React.useMemo(() => rawObligations || [], [rawObligations]);

  // Metrics calculation
  const metrics = React.useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let overdue = 0;
    let dueNext7Days = 0;
    let fulfilled = 0;

    for (const ob of obligations) {
      if (ob.status === 'fulfilled') {
        fulfilled++;
      } else {
        const dueTime = new Date(ob.dueDate).getTime();
        const diff = dueTime - now;

        if (diff < 0) {
          overdue++;
        } else if (diff <= sevenDaysMs) {
          dueNext7Days++;
        }
      }
    }

    return {
      total: obligations.length,
      overdue,
      dueNext7Days,
      fulfilled,
    };
  }, [obligations]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Deliverables</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{metrics.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold tracking-tight text-rose-600">{metrics.overdue}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Due This Week</p>
              <p className="text-2xl font-bold tracking-tight text-amber-600">{metrics.dueNext7Days}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600">{metrics.fulfilled}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List and Action */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active Contract Deliverables</h3>
            <p className="text-xs text-muted-foreground">
              Review and complete upcoming contractual milestones synced with team task queues.
            </p>
          </div>

          {onOpenCreateObligation && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenCreateObligation}
              className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Deliverable
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
        ) : (
          <ObligationsListRail
            obligations={obligations}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
}
