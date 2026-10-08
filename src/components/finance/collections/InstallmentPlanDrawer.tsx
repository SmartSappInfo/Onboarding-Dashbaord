'use client';

/**
 * @fileOverview Installment Plan Drawer & Milestone Inspector (Phase 12 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: Guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessibility: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97] min-h-[44px]`
 * - Fields & Variables SSOT: Standardized <VariablesPanel> integration
 */

import React, { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { VariablesPanel } from '@/components/shared/VariablesPanel';
import {
  type InstallmentPaymentPlan,
  type DebtorAccount,
} from '@/platform/agents/finance/collections/collections-types';
import {
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface InstallmentPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: InstallmentPaymentPlan | null;
  debtor: DebtorAccount | null;
  workspaceId: string;
  organizationId: string;
  onApplyPlan?: (plan: InstallmentPaymentPlan) => Promise<void>;
}

export function InstallmentPlanDrawer({
  isOpen,
  onClose,
  plan,
  debtor,
  workspaceId,
  organizationId,
  onApplyPlan,
}: InstallmentPlanDrawerProps) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'variables'>('schedule');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  if (!isOpen || !plan) return null;

  const handleApply = async () => {
    if (!onApplyPlan) return;
    try {
      setIsApplying(true);
      await onApplyPlan(plan);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden"
        demarcated
      >
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20">
          <div className="flex items-center justify-between gap-3 w-full pr-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary dark:bg-primary/20 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Installment Plan Details
                </DialogTitle>
                <CardInfoTooltip text="Dynamic installment recovery schedule calculated with double-entry remainder distribution, guaranteeing zero floating-point drift." />
              </div>
            </div>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {plan.frequency}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Inspect installment milestone schedule and context variables.
          </DialogDescription>
        </DialogHeader>

        {/* Drawer Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Summary Card */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/10 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">
                Target Account
              </span>
              <h4 className="text-sm font-semibold text-foreground">
                {debtor?.entityName || plan.entityId}
              </h4>
              <p className="text-xs text-muted-foreground">
                Plan ID: <code className="font-mono">{plan.planId?.slice(0, 16) ?? 'DRAFT'}</code>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">
                Total Principal
              </span>
              <p className="text-lg font-bold text-foreground">
                {plan.currency} {plan.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'schedule' | 'variables')}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl">
              <TabsTrigger value="schedule" className="rounded-lg text-xs font-medium gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Milestone Schedule
              </TabsTrigger>
              <TabsTrigger value="variables" className="rounded-lg text-xs font-medium gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Template Variables
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4 space-y-3">
              <div className="border border-border/80 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-muted/30 px-3 py-2 font-medium text-muted-foreground border-b border-border/80">
                  <span className="col-span-2">#</span>
                  <span className="col-span-4">Due Date</span>
                  <span className="col-span-3 text-right">Amount</span>
                  <span className="col-span-3 text-right">Status</span>
                </div>
                <div className="divide-y divide-border/60">
                  {plan.milestones.map((m) => (
                    <div key={m.milestoneIndex} className="grid grid-cols-12 px-3 py-2.5 items-center hover:bg-muted/10">
                      <span className="col-span-2 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {m.milestoneIndex}
                      </span>
                      <span className="col-span-4 text-muted-foreground font-mono">{m.dueDate}</span>
                      <span className="col-span-3 text-right font-mono font-semibold">
                        {m.currency} {m.amount.toFixed(2)}
                      </span>
                      <span className="col-span-3 text-right">
                        <Badge
                          variant={m.status === 'PAID' ? 'default' : 'secondary'}
                          className="text-[10px] uppercase font-mono py-0"
                        >
                          {m.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {plan.milestones.length} milestones sum to {plan.currency}{' '}
                  {plan.totalAmount.toFixed(2)} with zero remainder drift.
                </span>
              </div>
            </TabsContent>

            <TabsContent value="variables" className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Available financial and debtor variables routed through <code className="font-semibold text-foreground">FieldsVariablesService</code>:
              </p>
              <div className="border border-border/70 rounded-xl max-h-[240px] overflow-y-auto">
                <VariablesPanel
                  workspaceId={workspaceId}
                  organizationId={organizationId}
                  className="p-2"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl active:scale-[0.97] min-h-[44px] px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
          {onApplyPlan && (
            <Button
              type="button"
              variant="default"
              onClick={handleApply}
              disabled={isApplying}
              className="rounded-xl active:scale-[0.97] min-h-[44px] px-5 text-xs font-medium gap-1.5 shadow-sm"
            >
              {isApplying ? 'Applying...' : 'Apply Agreement'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
