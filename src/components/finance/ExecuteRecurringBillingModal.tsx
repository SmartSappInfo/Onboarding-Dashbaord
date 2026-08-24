'use client';

/**
 * SmartSapp Finance 2.0 - Execute Recurring Billing Modal
 * One-click batch cycle invoicing dialog for active institutional agreements.
 * 
 * Invariants:
 * 1. Mobile & Accessibility: min-h-[44px] touch targets, keyboard navigation.
 * 2. Emil Kowalski animations: active:scale-[0.97] micro-interactions.
 * 3. Strict typing: zero 'any' usage.
 * 4. Actionable toast: Relative path navigation link to /admin/finance/invoices.
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
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { BillingPeriod, BillingAgreement, RecurringBillingBatchResult } from '@/lib/types';
import { executeRecurringBillingAction } from '@/lib/agreement-actions';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Zap, 
  Building2, 
  ArrowRight 
} from 'lucide-react';
import Link from 'next/link';

export interface ExecuteRecurringBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPeriodId?: string;
}

export function ExecuteRecurringBillingModal({
  isOpen,
  onClose,
  initialPeriodId,
}: ExecuteRecurringBillingModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>(initialPeriodId || '');
  const [autoIssue, setAutoIssue] = React.useState<boolean>(false);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [batchResult, setBatchResult] = React.useState<RecurringBillingBatchResult | null>(null);

  // Sync initialPeriodId
  React.useEffect(() => {
    if (initialPeriodId) {
      setSelectedPeriodId(initialPeriodId);
    }
  }, [initialPeriodId]);

  // Query Billing Periods
  const periodsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'billing_periods'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('startDate', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: periods } = useCollection<BillingPeriod>(periodsQuery);

  // Set default period
  React.useEffect(() => {
    if (periods && periods.length > 0 && !selectedPeriodId) {
      const openPeriod = periods.find((p: BillingPeriod) => p.status === 'open') || periods[0];
      setSelectedPeriodId(openPeriod.id);
    }
  }, [periods, selectedPeriodId]);

  // Query Active Agreements
  const agreementsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'billing_agreements'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: agreements } = useCollection<BillingAgreement>(agreementsQuery);

  // Calculate eligible agreements
  const eligibleStats = React.useMemo(() => {
    if (!agreements || !selectedPeriodId) {
      return { total: 0, eligible: 0, alreadyBilled: 0, estimatedRevenue: 0 };
    }
    let eligible = 0;
    let alreadyBilled = 0;
    let revenue = 0;

    agreements.forEach((agr: BillingAgreement) => {
      if (agr.lastBilledPeriodId === selectedPeriodId) {
        alreadyBilled++;
      } else {
        eligible++;
        revenue += Number(agr.totalAmountPerCycle) || 0;
      }
    });

    return {
      total: agreements.length,
      eligible,
      alreadyBilled,
      estimatedRevenue: Math.round(revenue * 100) / 100,
    };
  }, [agreements, selectedPeriodId]);

  const selectedPeriod = React.useMemo(() => {
    return periods?.find((p: BillingPeriod) => p.id === selectedPeriodId);
  }, [periods, selectedPeriodId]);

  const handleExecute = async () => {
    if (!selectedPeriodId || !user?.uid || !activeWorkspaceId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an active billing cycle period.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setBatchResult(null);

    try {
      const res = await executeRecurringBillingAction(
        selectedPeriodId,
        activeWorkspaceId,
        user.uid,
        autoIssue
      );

      if (res.success && res.batchResult) {
        setBatchResult(res.batchResult);
        toast({
          title: 'Recurring Invoicing Completed',
          description: `Successfully generated ${res.batchResult.invoicesCreated} invoices for ${selectedPeriod?.name || 'Cycle'}.`,
          actionConfig: {
            path: '/admin/finance/invoices',
            label: 'View Invoices',
          },
          duration: 10000,
        });
      } else {
        toast({
          title: 'Batch Billing Failed',
          description: res.error || 'Failed to complete recurring billing execution.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setBatchResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[540px] rounded-3xl p-6 border-border shadow-2xl bg-card">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Zap className="h-5 w-5 fill-primary/20" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Run Recurring Cycle Billing
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Generate batch invoices for all active institutional agreements
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!batchResult ? (
          <div className="space-y-5 py-3">
            {/* Cycle Selection */}
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Target Billing Cycle / Period *</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs text-foreground">
                  <SelectValue placeholder="Select Billing Period" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {periods?.map((p: BillingPeriod) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} {p.status === 'open' ? '(Current Open)' : `(${p.status})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cycle Impact Preview Box */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Active Agreements
                </span>
                <Badge variant="outline" className="text-xs font-bold px-2.5 py-0.5">
                  {eligibleStats.total} Total
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-background border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Eligible to Bill</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {eligibleStats.eligible}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Already Billed</p>
                  <p className="text-base font-black text-amber-600 dark:text-amber-400">
                    {eligibleStats.alreadyBilled}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Est. Revenue</p>
                  <p className="text-sm font-black text-foreground truncate">
                    GHS {eligibleStats.estimatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Issuance Mode Selection */}
            <div className="p-3.5 rounded-2xl bg-background border border-border/60 flex items-center justify-between gap-3">
              <div className="space-y-0.5 text-left">
                <p className="text-xs font-bold text-foreground">Auto-Issue to Sub-Ledger</p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  If enabled, invoices will immediately finalize, allocate sequential numbers, and debit the customer ledger.
                </p>
              </div>
              <Button
                type="button"
                variant={autoIssue ? 'default' : 'outline'}
                size="sm"
                className="h-8 min-h-[36px] text-xs font-bold rounded-xl active:scale-[0.97]"
                onClick={() => setAutoIssue(!autoIssue)}
              >
                {autoIssue ? 'Immediate Issuance' : 'Create Drafts'}
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Deterministic idempotency protects this batch run. Agreements already billed for{' '}
                <strong>{selectedPeriod?.name || 'this cycle'}</strong> will automatically be skipped.
              </span>
            </div>
          </div>
        ) : (
          /* Execution Results View */
          <div className="space-y-4 py-3">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-black text-foreground">Batch Run Finished Successfully</h4>
              <p className="text-xs font-medium text-muted-foreground">
                Invoices generated for {batchResult.periodName}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-background border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Invoices Created</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {batchResult.invoicesCreated}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Skipped (Billed)</p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {batchResult.skippedAlreadyBilled}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Gross Invoiced</p>
                <p className="text-sm font-black text-foreground truncate">
                  GHS {batchResult.totalGrossInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {batchResult.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                <p className="font-bold">Failed Agreements ({batchResult.errors.length}):</p>
                {batchResult.errors.map((e, idx) => (
                  <p key={idx} className="text-[11px]">
                    • {e.agreementNumber}: {e.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          {!batchResult ? (
            <>
              <Button
                variant="outline"
                className="h-11 min-h-[44px] rounded-xl px-5 text-xs font-bold active:scale-[0.97]"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-h-[44px] rounded-xl px-6 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
                onClick={handleExecute}
                disabled={isProcessing || eligibleStats.eligible === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Invoices...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current mr-2" />
                    Run Billing ({eligibleStats.eligible} Eligible)
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-11 min-h-[44px] rounded-xl px-5 text-xs font-bold active:scale-[0.97]"
                onClick={handleClose}
              >
                Done
              </Button>
              <Button
                asChild
                className="h-11 min-h-[44px] rounded-xl px-6 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
              >
                <Link href="/admin/finance/invoices">
                  View Invoices <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
