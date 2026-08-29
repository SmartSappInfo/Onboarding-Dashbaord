'use client';

/**
 * @fileoverview Process Gate Resolution Modal
 *
 * ARCHITECTURAL POINTER (Phase 2 — Pipeline Process Gate UX):
 * Renders when a deal transition is blocked by stage entry criteria (PRD Section 16).
 * Allows operators to quickly supply missing commercial data inline:
 * - Missing Value ($ > 0)
 * - Missing Expected Close Date
 * - Missing Next Step
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Strict typing: Zero 'any' or 'any[]'.
 * - Actionable navigation: Actionable toast fallback with relative path.
 * - Mobile accessibility: Min 44px touch targets for inputs & buttons.
 */

import * as React from 'react';
import type { Deal, OnboardingStage, StageRequiredField } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { updateDealAction, updateDealStageAction } from '@/app/actions/deal-actions';
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
import {
  AlertTriangle,
  Loader2,
  ArrowRight,
  DollarSign,
  Calendar,
  UserCheck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface StageValidationModalProps {
  deal: Deal | null;
  targetStage: OnboardingStage | null;
  missingFields: StageRequiredField[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function StageValidationModal({
  deal,
  targetStage,
  missingFields,
  isOpen,
  onClose,
  onSuccess,
}: StageValidationModalProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [value, setValue] = React.useState<number | ''>('');
  const [expectedCloseDate, setExpectedCloseDate] = React.useState('');
  const [nextStep, setNextStep] = React.useState('');

  React.useEffect(() => {
    if (deal) {
      setValue(typeof deal.value === 'number' && deal.value > 0 ? deal.value : '');
      setExpectedCloseDate(
        deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : ''
      );
      const currentStep = deal.nextStep;
      if (typeof currentStep === 'string') {
        setNextStep(currentStep);
      } else if (currentStep && typeof currentStep === 'object' && 'title' in currentStep) {
        setNextStep(currentStep.title || '');
      } else {
        setNextStep('');
      }
    }
  }, [deal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !targetStage) return;

    setIsSubmitting(true);
    try {
      // 1. Update deal with supplied fields if needed
      const updateData: Partial<Deal> = {};
      if (missingFields.includes('value') && typeof value === 'number' && value > 0) {
        updateData.value = value;
      }
      if (missingFields.includes('expectedCloseDate') && expectedCloseDate.trim()) {
        updateData.expectedCloseDate = new Date(expectedCloseDate).toISOString();
      }
      if (missingFields.includes('nextStep') && nextStep.trim()) {
        updateData.nextStep = {
          type: 'follow_up',
          title: nextStep.trim(),
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        };
      }

      if (Object.keys(updateData).length > 0) {
        const updateRes = await updateDealAction(deal.id, updateData, user?.uid || '');
        if (!updateRes.success) {
          throw new Error(updateRes.error || 'Failed to update deal fields');
        }
      }

      // 2. Perform the stage transition
      const stageRes = await updateDealStageAction(deal.id, targetStage.id, {
        userId: user?.uid,
      });

      if (!stageRes.success) {
        throw new Error(stageRes.error || 'Failed to advance stage');
      }

      toast({
        title: 'Stage Gate Passed',
        description: `Successfully moved "${deal.name}" to "${targetStage.name}".`,
        actionConfig: {
          path: `/admin/deals/${deal.id}`,
          label: 'View Deal',
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Stage transition blocked';
      toast({
        variant: 'destructive',
        title: 'Transition Failed',
        description: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!deal || !targetStage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-background border border-border shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span>Process Gate: {targetStage.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This stage requires additional commercial details before &quot;{deal.name}&quot; can enter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Value Required */}
            {missingFields.includes('value') && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/60">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Deal Value ($) *</span>
                </Label>
                <Input
                  required
                  type="number"
                  min={1}
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 15000"
                  className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
                />
              </div>
            )}

            {/* Expected Close Date Required */}
            {missingFields.includes('expectedCloseDate') && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/60">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                  <span>Expected Close Date *</span>
                </Label>
                <Input
                  required
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
                />
              </div>
            )}

            {/* Next Step Required */}
            {missingFields.includes('nextStep') && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/60">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
                  <span>Next Action / Follow-up *</span>
                </Label>
                <Input
                  required
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="e.g. Schedule commercial pricing review"
                  className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
                />
              </div>
            )}

            {/* Contacts / Decision Maker notice */}
            {(missingFields.includes('primaryContact') || missingFields.includes('decisionMaker')) && (
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs flex items-start gap-2.5">
                <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Stakeholder Assignment Required</span>
                  <p className="text-[11px] opacity-90">
                    This stage requires a linked contact or designated decision maker. Please link a stakeholder in the deal workspace.
                  </p>
                  <Link
                    href={`/admin/deals/${deal.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 pt-1"
                  >
                    <span>Open Deal Workspace</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Complete &amp; Advance Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
