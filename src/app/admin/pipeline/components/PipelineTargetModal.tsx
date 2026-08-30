'use client';

/**
 * @fileoverview Pipeline Revenue Target / Quota Configuration Modal
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 124 & Section 48):
 * - Allows workspace administrators to configure monthly and quarterly revenue targets (quotas).
 * - Drives the dynamic Pipeline Coverage calculation (Pipeline / Target).
 * - Enforces multi-tenant authorization via `savePipelineTargetAction()`.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Strict zero 'any' / zero 'any[]'.
 * - Minimum 44x44px touch targets on all interactive controls.
 * - Actionable toasts with relative paths.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { savePipelineTargetAction } from '@/app/actions/deal-analytics-actions';
import type { PipelineTarget } from '@/lib/types';

interface PipelineTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId?: string | null;
  pipelineName?: string;
  currentTarget?: PipelineTarget | null;
  onTargetSaved?: (target: PipelineTarget) => void;
}

export default function PipelineTargetModal({
  isOpen,
  onClose,
  pipelineId = null,
  pipelineName,
  currentTarget,
  onTargetSaved,
}: PipelineTargetModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [periodType, setPeriodType] = React.useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [targetAmount, setTargetAmount] = React.useState<string>(() => {
    return currentTarget ? String(currentTarget.targetAmount) : '100000';
  });
  const [currency, setCurrency] = React.useState<string>(() => currentTarget?.currency || 'GHS');
  const [isSaving, setIsSaving] = React.useState(false);

  // Period Options Generator
  const periodOptions = React.useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();

    if (periodType === 'monthly') {
      return [
        { label: `Jan ${year}`, value: `${year}-01` },
        { label: `Feb ${year}`, value: `${year}-02` },
        { label: `Mar ${year}`, value: `${year}-03` },
        { label: `Apr ${year}`, value: `${year}-04` },
        { label: `May ${year}`, value: `${year}-05` },
        { label: `Jun ${year}`, value: `${year}-06` },
        { label: `Jul ${year}`, value: `${year}-07` },
        { label: `Aug ${year}`, value: `${year}-08` },
        { label: `Sep ${year}`, value: `${year}-09` },
        { label: `Oct ${year}`, value: `${year}-10` },
        { label: `Nov ${year}`, value: `${year}-11` },
        { label: `Dec ${year}`, value: `${year}-12` },
      ];
    } else if (periodType === 'quarterly') {
      return [
        { label: `Q1 ${year}`, value: `${year}-Q1` },
        { label: `Q2 ${year}`, value: `${year}-Q2` },
        { label: `Q3 ${year}`, value: `${year}-Q3` },
        { label: `Q4 ${year}`, value: `${year}-Q4` },
      ];
    } else {
      return [
        { label: `${year} Full Year`, value: `${year}` },
        { label: `${year + 1} Full Year`, value: `${year + 1}` },
      ];
    }
  }, [periodType]);

  // Sync selected period when periodType changes
  React.useEffect(() => {
    if (periodOptions.length > 0 && !periodOptions.some(p => p.value === selectedPeriod)) {
      setSelectedPeriod(periodOptions[0].value);
    }
  }, [periodType, periodOptions, selectedPeriod]);

  // Update target amount if currentTarget changes
  React.useEffect(() => {
    if (currentTarget) {
      setTargetAmount(String(currentTarget.targetAmount));
      setSelectedPeriod(currentTarget.period);
      setCurrency(currentTarget.currency || 'GHS');
    }
  }, [currentTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user?.uid) return;

    const amountNum = parseFloat(targetAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Target',
        description: 'Please enter a valid non-negative revenue quota.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await savePipelineTargetAction(
        {
          workspaceId: activeWorkspaceId,
          pipelineId,
          period: selectedPeriod,
          targetAmount: amountNum,
          currency,
        },
        user.uid
      );

      if (res.success && res.target) {
        toast({
          title: 'Target Quota Saved',
          description: `Revenue quota for ${selectedPeriod} set to ${currency} ${amountNum.toLocaleString()}.`,
          actionConfig: {
            path: '/admin/pipeline',
            label: 'View Pipeline',
          },
        });
        if (onTargetSaved) {
          onTargetSaved(res.target);
        }
        onClose();
      } else {
        throw new Error(res.error || 'Failed to save pipeline revenue target.');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error updating revenue target.';
      toast({ variant: 'destructive', title: 'Save Failed', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 border-border/80 shadow-2xl bg-card">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Revenue Target Quota
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {pipelineName ? `Set revenue targets for ${pipelineName}` : 'Set workspace revenue quota'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Type Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Timeframe Cadence
            </Label>
            <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-2xl border border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPeriodType('monthly')}
                className={`h-9 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  periodType === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPeriodType('quarterly')}
                className={`h-9 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  periodType === 'quarterly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Quarterly
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPeriodType('annual')}
                className={`h-9 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  periodType === 'annual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
              </Button>
            </div>
          </div>

          {/* Period Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Period
            </Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-11 min-h-[44px] rounded-xl text-xs font-bold bg-background border-border/80">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover z-[250]">
                {periodOptions.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs font-semibold">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Amount & Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Quota Amount
            </Label>
            <div className="flex items-center gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24 h-11 min-h-[44px] rounded-xl text-xs font-bold bg-background border-border/80 shrink-0">
                  <SelectValue placeholder="GHS" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-popover z-[250]">
                  <SelectItem value="GHS" className="text-xs font-semibold">GHS</SelectItem>
                  <SelectItem value="USD" className="text-xs font-semibold">USD</SelectItem>
                  <SelectItem value="EUR" className="text-xs font-semibold">EUR</SelectItem>
                  <SelectItem value="GBP" className="text-xs font-semibold">GBP</SelectItem>
                  <SelectItem value="NGN" className="text-xs font-semibold">NGN</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                step="1000"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="100000"
                className="h-11 min-h-[44px] rounded-xl font-bold text-sm bg-background border-border/80 focus:ring-primary/20"
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used to calculate pipeline coverage ratio and rep quota attainment.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 min-h-[44px] px-4 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-11 min-h-[44px] px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Saving Target...</span>
                </>
              ) : (
                <span>Save Revenue Target</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
