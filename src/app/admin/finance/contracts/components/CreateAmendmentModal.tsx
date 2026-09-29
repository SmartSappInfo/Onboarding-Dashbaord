'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Interactive Amendment Creation Modal for Contracts (Phase 3 Task 7).
 * 2. Non-Destructive Ledger Guarantee:
 *    Calls `createContractAmendmentAction` to spawn a distinct child contract linked
 *    via `ContractRelationship` without mutating or overwriting the parent agreement's
 *    authoritative executed vector PDF or cryptographic certificates.
 * 3. Everyday Minimal UI English (Rule 7 Minimal Text):
 *    Uses simple labels ("Amendment title", "Description of changes", "Commercial value").
 * 4. Micro-Interactions & Touch Accessibility:
 *    Touch targets >= 44x44px (`min-h-[44px]`), tactile depression via `active:scale-[0.97]`.
 * 5. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createContractAmendmentAction } from '@/lib/documents/contract-actions';
import type { ContractRecord } from '@/lib/types/document-signing';

export interface CreateAmendmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentContract: ContractRecord | null;
  workspaceId: string;
  onSuccess: (result: {
    amendmentContract: ContractRecord;
    updatedParentContract: ContractRecord;
  }) => void;
}

export default function CreateAmendmentModal({
  isOpen,
  onClose,
  parentContract,
  workspaceId,
  onSuccess,
}: CreateAmendmentModalProps) {
  const { toast } = useToast();

  const [amendmentTitle, setAmendmentTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState<string>('');
  const [cadence, setCadence] = React.useState<'one_off' | 'monthly' | 'quarterly' | 'annually'>('annually');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize title when parentContract changes
  React.useEffect(() => {
    if (parentContract) {
      setAmendmentTitle(`Amendment: ${parentContract.title}`);
      if (parentContract.contractValue) {
        setAmount(String(parentContract.contractValue.amount));
        setCadence(parentContract.contractValue.cadence);
      } else {
        setAmount('');
        setCadence('annually');
      }
      setDescription('');
    }
  }, [parentContract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentContract || isSubmitting) return;

    if (!amendmentTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for the amendment.',
        variant: 'destructive',
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: 'Description required',
        description: 'Please provide a brief explanation of the terms being amended.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const numAmount = amount ? Number(amount) : undefined;
      const customValue =
        numAmount !== undefined && !Number.isNaN(numAmount)
          ? {
              amount: numAmount,
              currency: parentContract.contractValue?.currency || 'USD',
              cadence,
            }
          : undefined;

      const result = await createContractAmendmentAction({
        workspaceId,
        parentContractId: parentContract.id,
        amendmentTitle: amendmentTitle.trim(),
        description: description.trim(),
        customContractValue: customValue,
      });

      if (!result.success || !result.amendmentContract || !result.updatedParentContract) {
        throw new Error(result.error || 'Failed to create contract amendment.');
      }

      toast({
        title: 'Amendment Draft Created',
        description: 'The amendment has been linked to the parent agreement.',
        actionConfig: {
          path: '/admin/finance/contracts',
          label: 'View Contracts',
        },
      });

      onSuccess({
        amendmentContract: result.amendmentContract,
        updatedParentContract: result.updatedParentContract,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create amendment.';
      toast({
        title: 'Action Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!parentContract) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                Non-Destructive Update
              </Badge>
              <span className="text-xs text-muted-foreground truncate">
                Parent: {parentContract.title}
              </span>
            </div>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Create Contract Amendment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a child agreement linked to the existing contract without altering previously signed PDFs.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Amendment Title */}
            <div className="space-y-1.5">
              <Label htmlFor="amendmentTitle" className="text-xs font-medium text-foreground">
                Amendment Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="amendmentTitle"
                value={amendmentTitle}
                onChange={(e) => setAmendmentTitle(e.target.value)}
                placeholder="e.g., Amendment #1: Extended SLA Scope"
                className="text-xs min-h-[44px] sm:min-h-[38px]"
                required
              />
            </div>

            {/* Description of Changes */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-foreground">
                Description of Terms Modified <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize the changes (e.g. increase liability cap, extend term by 6 months, adjust pricing schedule)."
                rows={3}
                className="text-xs resize-none"
                required
              />
            </div>

            {/* Value adjustment (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-xs font-medium text-foreground">
                  Updated Value (USD)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 75000"
                  className="text-xs min-h-[44px] sm:min-h-[38px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cadence" className="text-xs font-medium text-foreground">
                  Billing Cadence
                </Label>
                <Select
                  value={cadence}
                  onValueChange={(val: 'one_off' | 'monthly' | 'quarterly' | 'annually') => setCadence(val)}
                >
                  <SelectTrigger id="cadence" className="text-xs min-h-[44px] sm:min-h-[38px]">
                    <SelectValue placeholder="Select billing cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One-off Payment</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !amendmentTitle.trim() || !description.trim()}
              className="min-h-[44px] sm:min-h-[36px] px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Create Amendment Draft
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
