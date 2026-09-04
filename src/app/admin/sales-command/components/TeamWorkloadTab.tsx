'use client';

/**
 * @fileoverview Team Workload & Capacity Rebalance Tab (Tab 2) for SmartSapp Manager Command Center.
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 39 & UI Section 40:
 * 1. Visual Workload Capacity Heatmap: 3-column triage of Overloaded, Optimal, and Underutilized reps.
 * 2. Rebalancing Workbench: Batch reallocates deals and tasks from burdened reps to available peers.
 * 3. Atomic Transaction Safety: Enforces <= 25 items per batch commit via rebalanceTeamWorkloadAction
 *    to prevent Firestore timeouts and memory exhaustion (Risk R5).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile responsive: responsive grid stacks on small screens.
 * - Interactive elements must provide minimum 44px touch targets.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';
import type {
  RepWorkloadSummary,
  AtRiskDeal,
  WorkloadRebalanceProposal,
} from '@/lib/manager-command/types';
import { rebalanceTeamWorkloadAction } from '@/app/actions/manager-command-actions';

interface TeamWorkloadTabProps {
  reps: RepWorkloadSummary[];
  atRiskDeals: AtRiskDeal[];
  workspaceId: string;
  organizationId: string;
  managerId: string;
  onWorkloadRebalanced?: () => void;
}

export function TeamWorkloadTab({
  reps,
  atRiskDeals,
  workspaceId,
  organizationId,
  managerId,
  onWorkloadRebalanced,
}: TeamWorkloadTabProps) {
  const { toast } = useToast();
  const [fromRepId, setFromRepId] = React.useState<string>('');
  const [toRepId, setToRepId] = React.useState<string>('');
  const [rebalanceReason, setRebalanceReason] = React.useState<string>('Capacity equalization and SLA risk mitigation');
  const [selectedDealIds, setSelectedDealIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Group reps by workload status
  const overloadedReps = React.useMemo(() => reps.filter((r) => r.workloadStatus === 'overloaded'), [reps]);
  const optimalReps = React.useMemo(() => reps.filter((r) => r.workloadStatus === 'optimal'), [reps]);
  const underutilizedReps = React.useMemo(() => reps.filter((r) => r.workloadStatus === 'underutilized'), [reps]);

  // If fromRepId not set and we have overloaded reps, default to first overloaded rep
  React.useEffect(() => {
    if (!fromRepId && overloadedReps.length > 0) {
      setFromRepId(overloadedReps[0].userId);
    }
  }, [overloadedReps, fromRepId]);

  // If toRepId not set and we have underutilized or optimal reps, pick the one with lowest capacity
  React.useEffect(() => {
    if (!toRepId) {
      const candidates = [...underutilizedReps, ...optimalReps].filter((r) => r.userId !== fromRepId);
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.capacityUtilizationPercent - b.capacityUtilizationPercent);
        setToRepId(candidates[0].userId);
      }
    }
  }, [underutilizedReps, optimalReps, fromRepId, toRepId]);

  // Deals belonging to the source rep
  const sourceDeals = React.useMemo(() => {
    if (!fromRepId) return [];
    return atRiskDeals.filter((d) => d.assignedRepId === fromRepId);
  }, [atRiskDeals, fromRepId]);

  const sourceRep = reps.find((r) => r.userId === fromRepId);
  const targetRep = reps.find((r) => r.userId === toRepId);

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]
    );
  };

  const handleExecuteRebalance = async () => {
    if (!workspaceId || !managerId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Missing workspace or manager credentials.',
      });
      return;
    }

    if (!fromRepId || !toRepId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select both a donor and recipient representative.',
      });
      return;
    }

    if (fromRepId === toRepId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Donor and recipient cannot be the same representative.',
      });
      return;
    }

    if (selectedDealIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select at least one deal to transfer.',
      });
      return;
    }

    const proposals: WorkloadRebalanceProposal[] = selectedDealIds.map((dealId) => {
      const d = sourceDeals.find((deal) => deal.id === dealId);
      return {
        itemId: dealId,
        itemType: 'deal',
        itemTitle: d?.name || 'Pipeline Deal',
        dealValue: d?.value,
        fromRepId,
        fromRepName: sourceRep?.userName || 'Representative',
        toRepId,
        toRepName: targetRep?.userName || 'Representative',
        reason: rebalanceReason,
      };
    });

    setIsSubmitting(true);

    try {
      const res = await rebalanceTeamWorkloadAction({
        workspaceId,
        organizationId,
        managerId,
        proposals,
      });

      if (res.success) {
        toast({
          title: 'Workload Rebalanced',
          description: `Successfully rebalanced ${res.reassignedCount} deals to ${targetRep?.userName}.`,
        });
        setSelectedDealIds([]);
        if (onWorkloadRebalanced) onWorkloadRebalanced();
      } else {
        toast({
          variant: 'destructive',
          title: 'Rebalance Failed',
          description: res.error || 'Failed to execute workload rebalance.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Rebalance Error',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Visual Capacity Heatmap */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            Workforce Capacity Heatmap
          </h3>
          <p className="text-xs text-muted-foreground">
            Categorized distribution of sales reps based on active lead thresholds and open deal limits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overloaded Column */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h4 className="text-xs font-bold text-destructive uppercase tracking-wider">
                  Overloaded (&gt;90%)
                </h4>
              </div>
              <Badge variant="destructive" className="font-mono text-[10px]">
                {overloadedReps.length}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {overloadedReps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No reps currently exceeding capacity.
                </p>
              ) : (
                overloadedReps.map((rep) => (
                  <Card key={rep.userId} className="p-3 rounded-xl border bg-card/80 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{rep.userName}</span>
                      <span className="font-mono font-bold text-destructive">
                        {rep.capacityUtilizationPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{rep.activeDealsCount} active deals</span>
                      <span>{rep.activeQueueItemsCount} tasks</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFromRepId(rep.userId)}
                      className="w-full h-8 min-h-[36px] text-[11px] font-semibold rounded-lg gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <ArrowRight className="h-3 w-3" />
                      <span>Rebalance From Rep</span>
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Optimal Column */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Optimal (50% - 90%)
                </h4>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-600">
                {optimalReps.length}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {optimalReps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No reps in optimal band.
                </p>
              ) : (
                optimalReps.map((rep) => (
                  <Card key={rep.userId} className="p-3 rounded-xl border bg-card/80 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{rep.userName}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rep.capacityUtilizationPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{rep.activeDealsCount} deals</span>
                      <span>{rep.activeQueueItemsCount} tasks</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Underutilized Column */}
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-sky-500" />
                <h4 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  Available Capacity (&lt;50%)
                </h4>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] border-sky-500/30 text-sky-600">
                {underutilizedReps.length}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {underutilizedReps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No reps underutilized.
                </p>
              ) : (
                underutilizedReps.map((rep) => (
                  <Card key={rep.userId} className="p-3 rounded-xl border bg-card/80 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{rep.userName}</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {rep.capacityUtilizationPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{rep.activeDealsCount} active deals</span>
                      <span>Available for pipeline</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setToRepId(rep.userId)}
                      className="w-full h-8 min-h-[36px] text-[11px] font-semibold rounded-lg gap-1 border-sky-500/30 text-sky-600 hover:bg-sky-500/10"
                    >
                      <ArrowRight className="h-3 w-3" />
                      <span>Select as Target</span>
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Workload Rebalancing Workbench */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40">
          <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span>Workload Rebalancing Workbench</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Select an overloaded representative, choose opportunities to redistribute, and assign them to an available peer.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Rep Pair Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                1. Transfer From (Overloaded Rep)
              </Label>
              <select
                value={fromRepId}
                onChange={(e) => {
                  setFromRepId(e.target.value);
                  setSelectedDealIds([]);
                }}
                className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select donor representative...</option>
                {reps.map((rep) => (
                  <option key={rep.userId} value={rep.userId}>
                    {rep.userName} — {rep.capacityUtilizationPercent}% Capacity ({rep.workloadStatus})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                2. Transfer To (Recipient Rep)
              </Label>
              <select
                value={toRepId}
                onChange={(e) => setToRepId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select recipient representative...</option>
                {reps
                  .filter((r) => r.userId !== fromRepId)
                  .map((rep) => (
                    <option key={rep.userId} value={rep.userId}>
                      {rep.userName} — {rep.capacityUtilizationPercent}% Capacity ({rep.workloadStatus})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Deal Selection List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                3. Select Deals to Transfer ({selectedDealIds.length} Selected)
              </Label>
              {sourceDeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDealIds.length === sourceDeals.length) {
                      setSelectedDealIds([]);
                    } else {
                      setSelectedDealIds(sourceDeals.map((d) => d.id));
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  {selectedDealIds.length === sourceDeals.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {sourceDeals.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground bg-muted/20">
                {fromRepId
                  ? 'No at-risk deals found for this representative.'
                  : 'Select a donor representative above to view transferable pipeline.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {sourceDeals.map((deal) => {
                  const isChecked = selectedDealIds.includes(deal.id);
                  return (
                    <div
                      key={deal.id}
                      onClick={() => toggleDealSelection(deal.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-2.5 min-h-[50px] ${
                        isChecked
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border/60 hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDealSelection(deal.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{deal.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono font-bold text-foreground">
                            GHS {deal.value.toLocaleString()}
                          </span>
                          <span>•</span>
                          <span>{deal.stageName}</span>
                          <span>•</span>
                          <span className="text-amber-600 font-semibold">{deal.daysInCurrentStage}d in stage</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Justification Note */}
          <div className="space-y-1.5">
            <Label htmlFor="rebalance-reason" className="text-xs font-semibold">
              Rebalance Justification (Recorded in Audit Ledger)
            </Label>
            <Textarea
              id="rebalance-reason"
              value={rebalanceReason}
              onChange={(e) => setRebalanceReason(e.target.value)}
              placeholder="Provide strategic rationale for this workload rebalance..."
              className="min-h-[60px] text-xs bg-background"
            />
          </div>

          {/* Submit Rebalance Action */}
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button
              onClick={handleExecuteRebalance}
              disabled={isSubmitting || selectedDealIds.length === 0 || !toRepId}
              className="min-h-[44px] px-6 rounded-xl text-xs font-semibold gap-2 active:scale-[0.97] transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Rebalance...</span>
                </>
              ) : (
                <>
                  <span>Transfer {selectedDealIds.length} Deals</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
