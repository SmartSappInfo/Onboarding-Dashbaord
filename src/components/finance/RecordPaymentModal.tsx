'use client';

/**
 * SmartSapp Finance 2.0 - Record Payment Modal
 * Allows recording cash, bank transfer, mobile money, and cheque receipts,
 * with real-time multi-invoice allocation and account credit calculation.
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { Loader2, CreditCard, CheckCircle2, DollarSign, Split, Info } from 'lucide-react';
import { PaymentMethod, Invoice } from '@/lib/types';
import { recordPaymentAction, getUnpaidInvoicesForEntityAction } from '@/lib/finance-actions';

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  workspaceId: string;
  organizationId: string;
  accountId: string;
  currency?: string;
  preselectedInvoiceId?: string;
  preselectedInvoiceNumber?: string;
  preselectedBalanceDue?: number;
  onPaymentSuccess?: (paymentId: string) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  entityId,
  entityName,
  workspaceId,
  organizationId,
  accountId,
  currency = 'GHS',
  preselectedInvoiceId,
  preselectedBalanceDue,
  onPaymentSuccess,
}) => {
  const { user } = useUser();
  const { toast } = useToast();

  const [amount, setAmount] = React.useState<string>(
    preselectedBalanceDue ? preselectedBalanceDue.toString() : ''
  );
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = React.useState<string>('');
  const [payerName, setPayerName] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = React.useState<boolean>(false);
  const [unpaidInvoices, setUnpaidInvoices] = React.useState<Invoice[]>([]);
  const [allocations, setAllocations] = React.useState<Record<string, number>>({});

  // Reset or load initial data when modal opens
  React.useEffect(() => {
    if (!isOpen) return;

    if (preselectedInvoiceId && preselectedBalanceDue) {
      setAmount(preselectedBalanceDue.toString());
      setAllocations({ [preselectedInvoiceId]: preselectedBalanceDue });
    } else {
      setAmount('');
      setAllocations({});
    }

    const fetchInvoices = async () => {
      if (!entityId || !workspaceId) return;
      setIsLoadingInvoices(true);
      const res = await getUnpaidInvoicesForEntityAction(entityId, workspaceId);
      if (res.success && res.data) {
        setUnpaidInvoices(res.data);
      }
      setIsLoadingInvoices(false);
    };

    fetchInvoices();
  }, [isOpen, entityId, workspaceId, preselectedInvoiceId, preselectedBalanceDue]);

  const numAmount = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const totalAllocated = Object.values(allocations).reduce(
    (sum, val) => sum + (Math.round((Number(val) || 0) * 100) / 100),
    0
  );
  const unallocatedAmount = Math.max(0, Math.round((numAmount - totalAllocated) * 100) / 100);

  // Auto-allocates payment amount across unpaid invoices in FIFO order
  const handleAutoAllocate = () => {
    let remaining = numAmount;
    const nextAllocations: Record<string, number> = {};

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const invBalance = Number(inv.balanceDue ?? (inv.totalPayable - (inv.amountPaid || 0)));
      if (invBalance <= 0) continue;

      const alloc = Math.min(remaining, invBalance);
      nextAllocations[inv.id] = Math.round(alloc * 100) / 100;
      remaining = Math.round((remaining - alloc) * 100) / 100;
    }

    setAllocations(nextAllocations);
  };

  const handleAllocationChange = (invoiceId: string, valStr: string) => {
    const val = Math.max(0, Number(valStr) || 0);
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: Math.round(val * 100) / 100,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please sign in to record payments.' });
      return;
    }

    if (numAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid payment amount.' });
      return;
    }

    if (totalAllocated > numAmount) {
      toast({
        variant: 'destructive',
        title: 'Allocation Overflow',
        description: 'Allocated sum cannot exceed total payment amount.',
      });
      return;
    }

    setIsSubmitting(true);

    const allocationList = Object.entries(allocations)
      .filter(([, val]) => val > 0)
      .map(([invId, val]) => ({ invoiceId: invId, amount: val }));

    const res = await recordPaymentAction(
      {
        organizationId: organizationId || 'default',
        workspaceId,
        accountId,
        entityId,
        amount: numAmount,
        currency,
        paymentMethod,
        reference: reference.trim() || undefined,
        payerName: payerName.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocationList,
      },
      user.uid
    );

    if (res.success && res.data?.paymentId) {
      toast({
        title: 'Payment Recorded',
        description: `Successfully posted ${currency} ${numAmount.toLocaleString()} to ledger.`,
      });
      if (onPaymentSuccess) {
        onPaymentSuccess(res.data.paymentId);
      }
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: res.error || 'Could not record payment.',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <CreditCard className="h-4 w-4" />
            Financial Settlement
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Record Payment</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Recording remittance for <span className="font-semibold text-foreground">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Top Payment Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Amount ({currency}) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9 rounded-xl h-10 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}>
                <SelectTrigger className="rounded-xl h-10 font-semibold">
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="bank_transfer">Bank Wire / Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cash">Cash Settlement</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Debit / Credit Card</SelectItem>
                  <SelectItem value="manual">Manual Adjustment</SelectItem>
                  <SelectItem value="other">Other Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Transaction Reference / Receipt #</Label>
              <Input
                placeholder="e.g. TXN-948292 or Cheque #1029"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payer / Remitter Name</Label>
              <Input
                placeholder="Name on bank transfer or MoMo"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Payment Notes / Memo (Optional)</Label>
              <Input
                placeholder="Internal memo, settlement reason, or bank account notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>
          </div>

          {/* Allocation Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Split className="h-4 w-4 text-primary" />
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Invoice Allocation Breakdown
                </Label>
              </div>
              {unpaidInvoices.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAutoAllocate}
                  className="h-7 text-xs font-semibold rounded-lg active:scale-[0.97]"
                >
                  Auto-Allocate (FIFO)
                </Button>
              )}
            </div>

            {isLoadingInvoices ? (
              <div className="p-4 border rounded-xl flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading open invoices...
              </div>
            ) : unpaidInvoices.length === 0 ? (
              <div className="p-4 border border-dashed rounded-xl text-center space-y-1 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground">
                  No unpaid invoices found for this entity.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Payment will be credited directly to the account balance as Available Credit.
                </p>
              </div>
            ) : (
              <div className="border rounded-xl divide-y max-h-44 overflow-y-auto bg-card">
                {unpaidInvoices.map((inv) => {
                  const invBalance = Number(inv.balanceDue ?? (inv.totalPayable - (inv.amountPaid || 0)));
                  return (
                    <div key={inv.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Due: {currency} {invBalance.toLocaleString()} (Total: {currency}{' '}
                          {inv.totalPayable.toLocaleString()})
                        </div>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invBalance}
                          placeholder="0.00"
                          value={allocations[inv.id] ?? ''}
                          onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                          className="h-8 text-xs font-semibold text-right rounded-lg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reconciliation Snapshot Pills */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 bg-muted/40 rounded-xl border">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Payment</div>
                <div className="text-xs font-bold text-foreground">
                  {currency} {numAmount.toLocaleString()}
                </div>
              </div>
              <div className="p-2 bg-primary/5 rounded-xl border border-primary/20">
                <div className="text-[10px] text-primary uppercase font-bold">Allocated</div>
                <div className="text-xs font-bold text-primary">
                  {currency} {totalAllocated.toLocaleString()}
                </div>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                  Account Credit
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {currency} {unallocatedAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {unallocatedAmount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span>
                  {currency} {unallocatedAmount.toLocaleString()} will remain on the account as customer credit.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-10 text-xs font-semibold active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="rounded-xl h-10 text-xs font-bold px-5 bg-primary text-white hover:bg-primary/90 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Posting to Ledger...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Confirm Settlement
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
