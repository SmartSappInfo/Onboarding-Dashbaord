/**
 * @fileoverview Interactive Stage Transition & Entry Gate Checklist Modal
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & UI Section 19):
 * - Displays a structured transition modal verifying entry gate criteria before moving a deal.
 * - Shows checklist status (e.g. decision maker assigned, close date present, deal value set).
 * - Enforces loss reason capture on transition to terminal Lost stage.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Strict zero 'any' / zero 'any[]'.
 * - Accessible touch targets >= 44px on mobile viewports.
 * - Actionable toasts with relative paths on transition errors.
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trophy,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Deal, OnboardingStage } from '@/lib/types';
import { validateStageGateEntry } from '@/lib/deals/deal-stage-validation';
import { updateDealStageAction } from '@/app/actions/deal-actions';

interface MoveDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  stages: OnboardingStage[];
  userId: string;
  onSuccess?: (newStageId: string) => void;
}

export default function MoveDealModal({
  isOpen,
  onClose,
  deal,
  stages,
  userId,
  onSuccess,
}: MoveDealModalProps) {
  const { toast } = useToast();
  const [selectedStageId, setSelectedStageId] = React.useState<string>('');
  const [lossReason, setLossReason] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (deal) {
      setSelectedStageId(deal.stageId || (stages[0]?.id ?? ''));
      setLossReason(deal.lostReason || '');
    }
  }, [deal, stages]);

  if (!deal) return null;

  const currentStage = stages.find(s => s.id === deal.stageId);
  const targetStage = stages.find(s => s.id === selectedStageId);

  // Validate entry gate requirements
  const validationResult = targetStage
    ? validateStageGateEntry(deal, targetStage)
    : { allowed: true, errors: [], warnings: [] };

  const isTerminalLost = targetStage?.terminalType === 'lost';
  const isTerminalWon = targetStage?.terminalType === 'won';

  const handleConfirmMove = async () => {
    if (!targetStage) return;

    if (!validationResult.allowed) {
      toast({
        title: 'Stage Entry Gate Blocked',
        description: validationResult.errors[0] || 'Requirements not satisfied.',
        variant: 'destructive',
      });
      return;
    }

    if (isTerminalLost && !lossReason.trim()) {
      toast({
        title: 'Loss Reason Required',
        description: 'Please specify the reason this opportunity was lost.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateDealStageAction(
        deal.id,
        targetStage.id,
        userId,
        isTerminalLost ? lossReason.trim() : undefined
      );

      if (res.success) {
        toast({
          title: isTerminalWon ? '🎉 Deal Won!' : 'Stage Updated',
          description: `Moved "${deal.name}" to ${targetStage.name}.`,
          actionConfig: { path: `/admin/deals/${deal.id}`, label: 'View Workspace' },
        });
        onSuccess?.(targetStage.id);
        onClose();
      } else {
        toast({
          title: 'Transition Failed',
          description: res.error || 'Failed to update stage.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl border-border p-6 shadow-2xl space-y-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Move Opportunity Stage
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Review entry gate criteria and confirm stage transition for &ldquo;{deal.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {/* Stage Selection Pills */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Target Stage
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
            {stages.map(stage => {
              const isSelected = stage.id === selectedStageId;
              const isCurrent = stage.id === deal.stageId;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setSelectedStageId(stage.id)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl border text-left transition-all min-h-[44px]',
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs'
                      : 'border-border text-foreground hover:bg-muted/40 font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color || '#3b82f6' }}
                    />
                    <span className="text-xs truncate">{stage.name}</span>
                  </div>
                  {isCurrent && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
                      Current
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gate Requirements Checklist */}
        {targetStage && (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Stage Requirements Checklist</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 border-none',
                  validationResult.allowed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                )}
              >
                {validationResult.allowed ? 'Requirements Met' : 'Action Required'}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                {(deal.value ?? 0) > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  Commercial deal value is set ({deal.value ? `$${deal.value.toLocaleString()}` : 'Unset'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {deal.expectedCloseDate ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  Expected close date defined ({deal.expectedCloseDate || 'Unset'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {deal.focalContacts && deal.focalContacts.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  Decision maker / focal contact attached ({deal.focalContacts?.length || 0})
                </span>
              </div>
            </div>

            {/* Validation Errors */}
            {!validationResult.allowed && validationResult.errors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold space-y-1">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Terminal Lost Reason Input */}
        {isTerminalLost && (
          <div className="space-y-1.5 p-3 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900">
            <Label className="text-xs font-bold text-rose-700 dark:text-rose-400">
              Loss Reason (Required)
            </Label>
            <Input
              value={lossReason}
              onChange={e => setLossReason(e.target.value)}
              placeholder="e.g. Budget constraints, Competitor chosen (Vendor X)"
              className="h-9 rounded-lg text-xs bg-background"
              autoFocus
            />
          </div>
        )}

        {/* Terminal Won Celebration Callout */}
        {isTerminalWon && (
          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
            <Trophy className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs font-semibold leading-tight">
              Moving to Closed Won will mark probability as 100% and emit commercial fulfillment workflows.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmMove}
            disabled={isSubmitting || selectedStageId === deal.stageId || !validationResult.allowed}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs active:scale-[0.97]"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
            )}
            Move to {targetStage?.name || 'Stage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
