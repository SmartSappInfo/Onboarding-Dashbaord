'use client';

/**
 * SmartSapp Finance 2.0 - Create Payment Plan Modal
 * Restructures debt into periodic installments with live schedule preview.
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
import { useWorkspace } from '@/context/WorkspaceContext';
import { Loader2, Calendar, Split, CheckCircle2 } from 'lucide-react';
import { createPaymentPlanAction } from '@/lib/collection-actions';

export interface CreatePaymentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  totalDebt: number;
  currency?: string;
  onSuccess?: () => void;
}

export function CreatePaymentPlanModal({
  isOpen,
  onClose,
  caseId,
  accountId,
  entityId,
  entityName,
  totalDebt = 0,
  currency = 'GHS',
  onSuccess,
}: CreatePaymentPlanModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [downPayment, setDownPayment] = React.useState<string>('');
  const [installmentsCount, setInstallmentsCount] = React.useState<string>('3');
  const [frequency, setFrequency] = React.useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const numDebt = Math.max(0, Math.round(totalDebt * 100) / 100);
  const numDown = Math.max(0, Math.round((Number(downPayment) || 0) * 100) / 100);
  const remaining = Math.max(0, Math.round((numDebt - numDown) * 100) / 100);
  const count = Math.max(1, parseInt(installmentsCount, 10) || 1);
  const approxPerInstallment = Math.round((remaining / count) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please sign in.' });
      return;
    }

    if (numDown > numDebt) {
      toast({ variant: 'destructive', title: 'Invalid Down Payment', description: 'Down payment cannot exceed total debt.' });
      return;
    }

    setIsSubmitting(true);
    const res = await createPaymentPlanAction(
      {
        caseId,
        accountId,
        entityId,
        entityName,
        totalDebt: numDebt,
        downPayment: numDown,
        installmentsCount: count,
        frequency,
        startDate,
        currency,
      },
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );

    setIsSubmitting(false);

    if (res.success && res.plan) {
      toast({
        title: 'Payment Plan Activated',
        description: `Plan ${res.plan.planNumber} created for ${count} installments.`,
      });
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create plan',
        description: res.error || 'Please verify parameters and try again.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Split className="h-4 w-4" />
            Debt Restructuring
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Create Payment Plan</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Arranging installment schedule for <span className="font-semibold text-foreground">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
            <div>
              <span className="text-muted-foreground">Total Debt:</span>
              <p className="font-bold text-sm text-foreground">{currency} {numDebt.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining after Down:</span>
              <p className="font-bold text-sm text-primary">{currency} {remaining.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Down Payment ({currency})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={numDebt}
                placeholder="0.00"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                className="rounded-xl h-11 min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Number of Installments *</Label>
              <Select value={installmentsCount} onValueChange={setInstallmentsCount}>
                <SelectTrigger className="rounded-xl h-11 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Installments</SelectItem>
                  <SelectItem value="3">3 Installments</SelectItem>
                  <SelectItem value="4">4 Installments</SelectItem>
                  <SelectItem value="6">6 Installments</SelectItem>
                  <SelectItem value="12">12 Installments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Frequency *</Label>
              <Select value={frequency} onValueChange={(val) => setFrequency(val as 'weekly' | 'biweekly' | 'monthly')}>
                <SelectTrigger className="rounded-xl h-11 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly (every 7d)</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly (every 14d)</SelectItem>
                  <SelectItem value="monthly">Monthly (every 30d)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 rounded-xl h-11 min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Schedule Preview */}
          <div className="p-3 border rounded-xl bg-card space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Schedule Summary
            </div>
            <p className="text-muted-foreground text-[11px]">
              {numDown > 0 && <span>Immediate Down Payment of <strong>{currency} {numDown.toLocaleString()}</strong> + </span>}
              <strong>{count}</strong> {frequency} installments of approximately <strong>{currency} {approxPerInstallment.toLocaleString()}</strong> each.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
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
              disabled={isSubmitting || numDebt <= 0}
              className="rounded-xl h-11 min-h-[44px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                'Activate Payment Plan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
