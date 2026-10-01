'use client';

/**
 * SmartSapp Finance 2.0 - Void Invoice Modal
 * Controlled cancellation and sub-ledger compensating reversal modal.
 * Requires explicit audit reason and releases partial payments to available credit.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { AlertTriangle, Loader2, RefreshCcw, ShieldAlert, ArrowDownLeft } from 'lucide-react';
import { Invoice } from '@/lib/types';
import { voidInvoiceAction } from '@/lib/billing-actions';

export interface VoidInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onVoidSuccess?: () => void;
}

export const VoidInvoiceModal: React.FC<VoidInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onVoidSuccess,
}) => {
  const { user } = useUser();
  const { toast } = useToast();

  const [voidReason, setVoidReason] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isOpen) {
      setVoidReason('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!invoice) return null;

  const totalPayable = Math.round((Number(invoice.totalPayable) || 0) * 100) / 100;
  const amountPaid = Math.round((Number(invoice.amountPaid) || 0) * 100) / 100;
  const currency = invoice.currency || 'GHS';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to void an invoice.',
      });
      return;
    }

    if (!voidReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Audit Reason Required',
        description: 'Please provide a formal justification for voiding this invoice.',
      });
      return;
    }

    setIsSubmitting(true);

    // Identity and display name both come from the verified session now (audit F2) —
    // the void audit trail must not record a name the caller chose.
    const res = await voidInvoiceAction(invoice.id, voidReason.trim());

    if (res.success) {
      if (res.data?.requiresApproval) {
        toast({
          title: 'Approval Requested',
          description: `Voiding request for ${invoice.invoiceNumber} has been routed to the managerial approval queue.`,
        });
      } else {
        toast({
          title: 'Invoice Voided',
          description: `Invoice ${invoice.invoiceNumber} has been voided. Compensating ledger reversal posted.`,
        });
      }
      if (onVoidSuccess) {
        onVoidSuccess();
      }
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Void Failed',
        description: res.error || 'Could not void invoice.',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Void Invoice {invoice.invoiceNumber}
            </DialogTitle>
            <CardInfoTooltip text="Voiding an issued invoice is an immutable accounting event. The invoice will not be deleted." />
          </div>
          <DialogDescription className="sr-only">
            Voiding an issued invoice is an immutable accounting event. The invoice will not be deleted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Reversal Summary Box */}
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Sub-Ledger Reversal Impact
              </div>
              <div className="space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <div className="flex justify-between items-center text-foreground font-semibold">
                  <span>Ledger Debit Reversal:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    -{currency} {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {amountPaid > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-rose-500/20">
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="h-3 w-3" /> Allocated Payment Release:
                    </span>
                    <span>
                      +{currency} {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} (To Available Credit)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-semibold">
                Formal Audit Reason / Cancellation Justification *
              </Label>
              <Textarea
                required
                rows={3}
                placeholder="e.g. Billing terms renegotiated, service cancelled prior to fulfillment, duplicate issuance..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="rounded-xl text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !voidReason.trim()}
              className="rounded-xl h-10 min-h-[44px] text-xs font-bold px-6 bg-destructive text-white hover:bg-destructive/90 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Posting Reversal...
                </>
              ) : (
                <>
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Confirm Void & Reversal
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
