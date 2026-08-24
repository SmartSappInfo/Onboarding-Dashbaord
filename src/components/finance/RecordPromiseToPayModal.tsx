'use client';

/**
 * SmartSapp Finance 2.0 - Record Promise-to-Pay (PTP) Modal
 * Records debtor payment commitments with automated fulfillment tracking.
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Loader2, Calendar, DollarSign, Handshake } from 'lucide-react';
import { PaymentMethod } from '@/lib/types';
import { recordPromiseToPayAction } from '@/lib/collection-actions';

export interface RecordPromiseToPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  defaultAmount?: number;
  currency?: string;
  onSuccess?: () => void;
}

export function RecordPromiseToPayModal({
  isOpen,
  onClose,
  caseId,
  accountId,
  entityId,
  entityName,
  defaultAmount = 0,
  currency = 'GHS',
  onSuccess,
}: RecordPromiseToPayModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const tomorrowStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [amount, setAmount] = React.useState<string>(defaultAmount > 0 ? String(defaultAmount) : '');
  const [promisedDate, setPromisedDate] = React.useState<string>(tomorrowStr);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [notes, setNotes] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount > 0 ? String(defaultAmount) : '');
      setPromisedDate(tomorrowStr);
      setNotes('');
    }
  }, [isOpen, defaultAmount, tomorrowStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please sign in.' });
      return;
    }

    const numAmount = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
    if (numAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a positive promised amount.' });
      return;
    }

    if (!promisedDate) {
      toast({ variant: 'destructive', title: 'Missing Date', description: 'Please select a promise due date.' });
      return;
    }

    setIsSubmitting(true);
    const res = await recordPromiseToPayAction(
      {
        caseId,
        accountId,
        entityId,
        entityName,
        promisedAmount: numAmount,
        currency,
        promisedDate,
        paymentMethod,
        notes,
      },
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );

    setIsSubmitting(false);

    if (res.success) {
      toast({
        title: 'Promise Recorded',
        description: `Commitment of ${currency} ${numAmount.toLocaleString()} due on ${promisedDate} logged.`,
      });
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to record promise',
        description: res.error || 'Please verify inputs and try again.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Handshake className="h-4 w-4" />
            Promise-to-Pay (PTP)
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Record Payment Commitment</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Logging formal remittance agreement for <span className="font-semibold text-foreground">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Promised Amount ({currency}) *</Label>
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
                className="pl-9 rounded-xl h-11 min-h-[44px] font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Promised Payment Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="pl-9 rounded-xl h-11 min-h-[44px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Expected Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}>
              <SelectTrigger className="rounded-xl h-11 min-h-[44px]">
                <SelectValue placeholder="Select Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer / EFT</SelectItem>
                <SelectItem value="mobile_money">Mobile Money (MOM)</SelectItem>
                <SelectItem value="cheque">Company Cheque</SelectItem>
                <SelectItem value="cash">Cash Remittance</SelectItem>
                <SelectItem value="card">Credit/Debit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Agreement Notes & Commitment Context</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Finance director agreed to disburse pending board approval..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl resize-none text-xs"
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-11 min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-11 min-h-[44px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                'Save Commitment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
