'use client';

/**
 * SmartSapp Finance 2.0 - Create Credit Note Modal
 * Dialog for issuing formal credit adjustments against invoices or customer accounts.
 * 
 * Invariants:
 * 1. Mobile & Accessibility: min-h-[44px] touch targets, clear focus outlines.
 * 2. Micro-interactions: active:scale-[0.97] on all buttons.
 * 3. Strict typing: zero 'any' usage.
 * 4. Actionable toast navigation: Relative path to invoice / ledger.
 */

import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CreditNoteReason, Invoice, FinancialAccount } from '@/lib/types';
import { createCreditNoteAction } from '@/lib/credit-note-actions';
import { Loader2, FileMinus, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: FinancialAccount | null;
  invoice?: Invoice | null;
  onSuccess?: () => void;
}

export function CreateCreditNoteModal({
  isOpen,
  onClose,
  account,
  invoice,
  onSuccess,
}: CreateCreditNoteModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [amount, setAmount] = React.useState<number>(0);
  const [reason, setReason] = React.useState<CreditNoteReason>('enrollment_decrease');
  const [reasonDetails, setReasonDetails] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Set default amount to invoice balance due if linked
  React.useEffect(() => {
    if (invoice && invoice.balanceDue !== undefined) {
      setAmount(invoice.balanceDue);
    } else if (account) {
      setAmount(Math.max(0, account.currentBalance || 0));
    }
  }, [invoice, account]);

  const targetAccountId = account?.id || invoice?.accountId || '';
  const currency = invoice?.currency || account?.currency || 'GHS';
  const invoiceDue = invoice ? Math.max(0, Number(invoice.balanceDue ?? invoice.totalPayable ?? 0)) : 0;

  const appliedToInvoice = invoice ? Math.min(amount, invoiceDue) : 0;
  const excessToCredit = invoice ? Math.max(0, Math.round((amount - appliedToInvoice) * 100) / 100) : amount;

  const handleIssue = async () => {
    if (!targetAccountId || amount <= 0 || !user?.uid || !activeWorkspaceId) {
      toast({
        title: 'Validation Error',
        description: 'Please specify a positive credit note amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCreditNoteAction({
        workspaceId: activeWorkspaceId,
        userId: user.uid,
        accountId: targetAccountId,
        amount,
        reason,
        reasonDetails,
        invoiceId: invoice?.id || undefined,
      });

      if (res.success && res.creditNote) {
        toast({
          title: 'Credit Note Issued',
          description: `Credit Note ${res.creditNote.creditNoteNumber} issued for ${currency} ${amount.toFixed(2)}.`,
          actionConfig: {
            path: `/admin/finance/invoices`,
            label: 'View Invoices',
          },
        });
        onSuccess?.();
        onClose();
      } else {
        toast({
          title: 'Issuance Failed',
          description: res.error || 'Failed to issue credit note.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error issuing credit note';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 border-border shadow-2xl bg-card">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <FileMinus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Issue Credit Note
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Formal credit adjustment for {account?.accountName || invoice?.entityName || 'Customer'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Info */}
          {invoice && (
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground">Target Invoice: {invoice.invoiceNumber}</p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Current Balance Due: {currency} {invoiceDue.toFixed(2)}
                </p>
              </div>
              <Badge variant="outline" className="font-bold uppercase text-[10px]">
                {invoice.paymentStatus || 'Issued'}
              </Badge>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5 text-left">
            <Label className="text-xs font-bold text-foreground">Credit Amount ({currency}) *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
            />
          </div>

          {/* Impact Preview */}
          {invoice && amount > 0 && (
            <div className="p-3 rounded-xl bg-background border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Applied to Invoice {invoice.invoiceNumber}:</span>
                <span className="font-bold text-foreground">{currency} {appliedToInvoice.toFixed(2)}</span>
              </div>
              {excessToCredit > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Excess to Available Credit:
                  </span>
                  <span className="font-bold">{currency} {excessToCredit.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Reason Code */}
          <div className="space-y-1.5 text-left">
            <Label className="text-xs font-bold text-foreground">Reason Code *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CreditNoteReason)}>
              <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="enrollment_decrease" className="text-xs">Enrollment / Headcount Decrease</SelectItem>
                <SelectItem value="billing_error" className="text-xs">Billing / Pricing Correction</SelectItem>
                <SelectItem value="goodwill_discount" className="text-xs">Goodwill / Relationship Discount</SelectItem>
                <SelectItem value="scholarship_adjustment" className="text-xs">Scholarship / Bursary Allowance</SelectItem>
                <SelectItem value="cancellation" className="text-xs">Service Cancellation</SelectItem>
                <SelectItem value="other" className="text-xs">Other Operational Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason Details */}
          <div className="space-y-1.5 text-left">
            <Label className="text-xs font-bold text-foreground">Reason Details & Memo</Label>
            <Input
              placeholder="e.g. Approved adjustment for 15 withdrew students in Term 1"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              className="rounded-xl h-11 min-h-[44px] bg-background font-medium text-xs"
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Issuing this credit note will immediately post a credit to the customer sub-ledger and adjust accounts receivable balances.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            className="h-11 min-h-[44px] rounded-xl px-5 text-xs font-bold active:scale-[0.97]"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="h-11 min-h-[44px] rounded-xl px-6 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.97]"
            onClick={handleIssue}
            disabled={isSubmitting || amount <= 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Issuing...
              </>
            ) : (
              'Confirm & Issue Credit Note'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
