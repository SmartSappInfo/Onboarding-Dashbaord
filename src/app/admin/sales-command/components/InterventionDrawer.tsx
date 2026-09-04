'use client';

/**
 * @fileoverview Manager Intervention Drawer for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 39 & UI Section 40:
 * - Slide-over drawer providing 1-click managerial interventions:
 *   1. Elevate to Hero: Flags deal/task with isManagerElevated = true, boosting its priority
 *      score to 100 in Phase 2 My Day ("DO THIS NOW" slot).
 *   2. Reassign: Reallocates deals or overburdened tasks to available peers.
 *   3. Strategic Guidance: Injects executive coaching instructions into deal context.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly record audit events via executeManagerInterventionAction.
 * - Mobile responsive: 44px min touch targets, active:scale-[0.97].
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Flame,
  UserCheck,
  MessageSquare,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type {
  AtRiskDeal,
  RepWorkloadSummary,
  ManagerInterventionType,
} from '@/lib/manager-command/types';
import { executeManagerInterventionAction } from '@/app/actions/manager-command-actions';

interface InterventionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetDeal?: AtRiskDeal | null;
  targetRep?: RepWorkloadSummary | null;
  availableReps: RepWorkloadSummary[];
  defaultType?: ManagerInterventionType;
  workspaceId: string;
  organizationId: string;
  managerId: string;
  managerName: string;
  onSuccess?: () => void;
}

export function InterventionDrawer({
  isOpen,
  onClose,
  targetDeal,
  targetRep,
  availableReps,
  defaultType = 'elevate_to_hero',
  workspaceId,
  organizationId,
  managerId,
  managerName,
  onSuccess,
}: InterventionDrawerProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = React.useState<ManagerInterventionType>(defaultType);
  const [targetRepId, setTargetRepId] = React.useState<string>('');
  const [newAssigneeId, setNewAssigneeId] = React.useState<string>('');
  const [reason, setReason] = React.useState<string>('');
  const [suggestedAction, setSuggestedAction] = React.useState<string>('');
  const [managerNote, setManagerNote] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Sync state whenever targets change
  React.useEffect(() => {
    if (defaultType) {
      setSelectedType(defaultType);
    }
    if (targetDeal) {
      setTargetRepId(targetDeal.assignedRepId);
      setReason(`Deal stalled for ${targetDeal.daysInCurrentStage} days in ${targetDeal.stageName}.`);
      setSuggestedAction('Immediate discovery call with C-suite stakeholder.');
      setManagerNote('');
    } else if (targetRep) {
      setTargetRepId(targetRep.userId);
      setReason(`${targetRep.userName} is currently at ${targetRep.capacityUtilizationPercent}% workload capacity.`);
      setSuggestedAction('');
      setManagerNote('');
    }
  }, [targetDeal, targetRep, defaultType]);

  const targetRepName = React.useMemo(() => {
    if (targetDeal?.assignedRepName) return targetDeal.assignedRepName;
    if (targetRep?.userName) return targetRep.userName;
    const rep = availableReps.find((r) => r.userId === targetRepId);
    return rep ? rep.userName : 'Representative';
  }, [targetDeal, targetRep, availableReps, targetRepId]);

  const otherReps = React.useMemo(() => {
    return availableReps.filter((r) => r.userId !== targetRepId);
  }, [availableReps, targetRepId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !managerId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Missing workspace or manager credentials.',
      });
      return;
    }

    if (!targetRepId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify the target representative.',
      });
      return;
    }

    if (selectedType === 'reassign' && !newAssigneeId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a new representative to receive this work.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newAssignee = availableReps.find((r) => r.userId === newAssigneeId);

      const res = await executeManagerInterventionAction({
        workspaceId,
        organizationId,
        managerId,
        managerName,
        type: selectedType,
        targetRepId,
        targetRepName,
        targetDealId: targetDeal?.id,
        targetDealName: targetDeal?.name,
        newAssigneeRepId: newAssignee?.userId,
        newAssigneeRepName: newAssignee?.userName,
        managerNote: selectedType === 'add_guidance' ? managerNote : undefined,
        reason: reason.trim() || 'Manager operational adjustment',
        suggestedAction: selectedType === 'elevate_to_hero' ? suggestedAction : undefined,
      });

      if (res.success) {
        toast({
          title: 'Intervention Executed',
          description:
            selectedType === 'elevate_to_hero'
              ? `Elevated to ${targetRepName}'s #1 Priority in My Day.`
              : selectedType === 'reassign'
              ? `Reassigned to ${newAssignee?.userName || 'colleague'}.`
              : 'Strategic guidance note added.',
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Intervention Failed',
          description: res.error || 'Failed to execute managerial intervention.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col justify-between bg-card text-card-foreground border-l shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SheetHeader className="space-y-2 border-b border-border/40 pb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                Phase 3 Intelligence
              </Badge>
              {targetDeal && (
                <Badge variant="destructive" className="text-xs">
                  {targetDeal.daysInCurrentStage}d Stalled
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl font-bold tracking-tight">
              Manager Operational Intervention
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Direct intervention into frontline workflows with full audit logging and instant priority injection.
            </SheetDescription>
          </SheetHeader>

          {/* Target Entity Banner */}
          <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Target Entity Context
            </span>
            {targetDeal ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">{targetDeal.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">
                    GHS {targetDeal.value.toLocaleString()}
                  </span>
                  <span>•</span>
                  <span>Stage: {targetDeal.stageName}</span>
                  <span>•</span>
                  <span>Rep: {targetRepName}</span>
                </div>
              </div>
            ) : targetRep ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">{targetRep.userName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Role: {targetRep.role}</span>
                  <span>•</span>
                  <span>Queue: {targetRep.activeQueueItemsCount} items</span>
                  <span>•</span>
                  <span>{targetRep.capacityUtilizationPercent}% Capacity</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">General Team Intervention</p>
            )}
          </div>

          {/* Intervention Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Action Directive
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType('elevate_to_hero')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 active:scale-[0.97] min-h-[54px] ${
                  selectedType === 'elevate_to_hero'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <Flame className="h-4 w-4 mb-1 text-primary" />
                <span className="text-[11px] leading-tight">Elevate to Hero</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('reassign')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 active:scale-[0.97] min-h-[54px] ${
                  selectedType === 'reassign'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <UserCheck className="h-4 w-4 mb-1 text-blue-500" />
                <span className="text-[11px] leading-tight">Reassign Rep</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('add_guidance')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 active:scale-[0.97] min-h-[54px] ${
                  selectedType === 'add_guidance'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4 mb-1 text-amber-500" />
                <span className="text-[11px] leading-tight">Add Guidance</span>
              </button>
            </div>
          </div>

          {/* Form Context by Action Type */}
          <form id="intervention-form" onSubmit={handleSubmit} className="space-y-4">
            {selectedType === 'elevate_to_hero' && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    Elevating this deal sets <span className="font-bold font-mono">isManagerElevated = true</span>.
                    It will immediately bypass standard heuristics and lock into {targetRepName}&apos;s #1
                    slot in their Phase 2 <span className="font-semibold">&quot;DO THIS NOW&quot;</span> queue.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="hero-action" className="text-xs font-semibold">
                    Mandated Directive for Rep
                  </Label>
                  <Input
                    id="hero-action"
                    value={suggestedAction}
                    onChange={(e) => setSuggestedAction(e.target.value)}
                    placeholder="e.g. Schedule C-suite demo by 3 PM today."
                    className="min-h-[44px] text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hero-reason" className="text-xs font-semibold">
                    Strategic Rationale
                  </Label>
                  <Textarea
                    id="hero-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide context on why this deal is critical."
                    className="min-h-[70px] text-xs bg-background"
                  />
                </div>
              </div>
            )}

            {selectedType === 'reassign' && (
              <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-rep" className="text-xs font-semibold">
                    Reassign Deal / Workload To
                  </Label>
                  <select
                    id="new-rep"
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select available sales representative...</option>
                    {otherReps.map((rep) => (
                      <option key={rep.userId} value={rep.userId}>
                        {rep.userName} — {rep.capacityUtilizationPercent}% Capacity ({rep.workloadStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reassign-reason" className="text-xs font-semibold">
                    Rebalance Justification
                  </Label>
                  <Textarea
                    id="reassign-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for reallocating this pipeline deal."
                    className="min-h-[70px] text-xs bg-background"
                  />
                </div>
              </div>
            )}

            {selectedType === 'add_guidance' && (
              <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guidance-note" className="text-xs font-semibold">
                    Executive Coaching & Strategy Note
                  </Label>
                  <Textarea
                    id="guidance-note"
                    value={managerNote}
                    onChange={(e) => setManagerNote(e.target.value)}
                    placeholder="Provide specific objection handling or closing tips..."
                    className="min-h-[90px] text-xs bg-background"
                    required
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Action Footer */}
        <SheetFooter className="p-4 sm:p-6 border-t border-border/40 bg-card/80 backdrop-blur-md flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[44px] rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="intervention-form"
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[44px] rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97] transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <span>Commit Intervention</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
