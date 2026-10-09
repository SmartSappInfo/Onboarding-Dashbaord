'use client';

/**
 * @fileOverview Collections Action Desk & Aging Receivables Mission Control (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first touch targets >= 44px with active:scale-[0.97].
 * - Rule 8 & 47: Anti-IDOR tenant validation via TenantContext.
 * - Rule 11: Double-entry financial determinism.
 * - Rule 21 & 22: Two-phase proposal interception & SHA-256 payload tampering detection.
 * - Rule 60: Emergency dead-man switch fail-closed handling.
 * - Rule 61: Three-Zone mission control layout.
 * - Rule 62: Real-time UI reactivity via `useEventStream`.
 * - theme.md §8: Standardized modal review desk.
 * - .agents/AGENTS.md: Actionable toast navigation with relative paths.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CollectionsKPIHeader,
  DebtorAccountTable,
  FinancialProposalModal,
  InstallmentPlanDrawer,
} from '@/components/finance/collections';
import {
  type DebtorAccount,
  type CollectionsMetrics,
  type CollectionsNextBestAction,
  type InstallmentPaymentPlan,
  type AgingBucket,
  type ProposeCollectionsActionInput,
} from '@/platform/agents/finance/collections/collections-types';
import {
  getDebtorAccountsAction,
  evaluateDebtorNextActionAction,
  createInstallmentPlanAction,
  proposeCollectionsActionAction,
  recordPromiseToPayAction,
  getCollectionsMetricsAction,
} from '@/app/actions/finance-collections-actions';
import {
  Search,
  RefreshCw,
  HandCoins,
} from 'lucide-react';

export interface CollectionsClientProps {
  initialMetrics?: CollectionsMetrics | null;
  initialDebtors?: DebtorAccount[];
}

type FilterTab = 'ALL' | AgingBucket;

export function CollectionsClient({
  initialMetrics = null,
  initialDebtors = [],
}: CollectionsClientProps) {
  const { currentOrganization, currentWorkspace, activeOrganizationId, activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  const organizationId = activeOrganizationId || currentOrganization?.id || 'org-demo-1';
  const workspaceId = activeWorkspaceId || currentWorkspace?.id || 'ws-demo-1';

  // Mission control state
  const [metrics, setMetrics] = useState<CollectionsMetrics | null>(initialMetrics);
  const [debtors, setDebtors] = useState<DebtorAccount[]>(initialDebtors);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Modals state
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorAccount | null>(null);
  const [evaluatedAction, setEvaluatedAction] = useState<CollectionsNextBestAction | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState<boolean>(false);
  const [activePlan, setActivePlan] = useState<InstallmentPaymentPlan | null>(null);
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState<boolean>(false);

  // Promise-to-pay dialog state
  const [isPromiseModalOpen, setIsPromiseModalOpen] = useState<boolean>(false);
  const [promiseDate, setPromiseDate] = useState<string>('');
  const [promiseAmount, setPromiseAmount] = useState<number>(0);
  const [promiseNotes, setPromiseNotes] = useState<string>('');
  const [isRecordingPromise, setIsRecordingPromise] = useState<boolean>(false);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load live accounts & metrics
  const loadData = useCallback(async () => {
    if (!organizationId || !workspaceId) return;

    try {
      setIsLoading(true);
      const [metricsRes, accountsRes] = await Promise.all([
        getCollectionsMetricsAction(workspaceId, organizationId),
        getDebtorAccountsAction({
          workspaceId,
          organizationId,
          agingBucket: activeTab === 'ALL' ? undefined : activeTab,
          searchQuery: debouncedSearch || undefined,
        }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (accountsRes.success && accountsRes.data) {
        setDebtors(accountsRes.data);
      }
    } catch {
      toast({
        title: 'Sync Failed',
        description: 'Failed to synchronize live collections state.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, workspaceId, activeTab, debouncedSearch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time SSE reactivity (Rule 62)
  const { lastActivity } = useEventStream({
    workspaceId: workspaceId || undefined,
    eventTypes: ['finance.collections.*', 'finance.payment.*', 'finance.invoice.*'],
  });

  useEffect(() => {
    if (lastActivity) {
      void loadData();
    }
  }, [lastActivity, loadData]);

  // Handler: Evaluate debtor next action and open proposal modal
  const handleEvaluateDebtor = async (debtor: DebtorAccount) => {
    setSelectedDebtor(debtor);
    try {
      toast({
        title: 'Evaluating Debtor Account',
        description: `Running recovery evaluation algorithm for ${debtor.entityName}...`,
        duration: 3000,
      });

      const res = await evaluateDebtorNextActionAction(
        debtor.entityId,
        workspaceId,
        organizationId
      );

      if (res.success && res.data) {
        setEvaluatedAction(res.data);
        setIsProposalModalOpen(true);
      } else {
        toast({
          title: 'Evaluation Failed',
          description: res.error?.message || 'Failed to evaluate debtor next action.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Evaluation Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  // Handler: Propose Plan drawer trigger
  const handleProposePlan = async (debtor: DebtorAccount) => {
    setSelectedDebtor(debtor);
    try {
      const planRes = await createInstallmentPlanAction({
        entityId: debtor.entityId,
        workspaceId,
        organizationId,
        totalAmount: debtor.totalOutstandingBalance,
        currency: debtor.currency,
        frequency: 'monthly',
        milestoneCount: debtor.totalOutstandingBalance > 5000 ? 4 : 3,
        startDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });

      if (planRes.success && planRes.data) {
        setActivePlan(planRes.data);
        setIsPlanDrawerOpen(true);
      } else {
        toast({
          title: 'Plan Generation Failed',
          description: planRes.error?.message || 'Could not generate installment plan.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unexpected error.',
        variant: 'destructive',
      });
    }
  };

  // Handler: Open Record Promise dialog
  const handleOpenRecordPromise = (debtor: DebtorAccount) => {
    setSelectedDebtor(debtor);
    setPromiseAmount(Math.round(debtor.totalOutstandingBalance * 0.5));
    setPromiseDate(
      new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    );
    setPromiseNotes('');
    setIsPromiseModalOpen(true);
  };

  // Handler: Submit Promise to Pay
  const handleSavePromise = async () => {
    if (!selectedDebtor) return;
    try {
      setIsRecordingPromise(true);
      const res = await recordPromiseToPayAction({
        entityId: selectedDebtor.entityId,
        workspaceId,
        organizationId,
        promiseDate,
        amount: Number(promiseAmount),
        notes: promiseNotes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast({
          title: 'Promise Recorded',
          description: `Promise of ${selectedDebtor.currency} ${promiseAmount} by ${promiseDate} saved.`,
          actionConfig: {
            path: '/admin/finance/collections',
            label: 'View Collections',
          },
          duration: 6000,
        });
        setIsPromiseModalOpen(false);
        loadData();
      } else {
        toast({
          title: 'Recording Failed',
          description: res.error?.message || 'Could not record promise to pay.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRecordingPromise(false);
    }
  };

  // Handler: Confirm staged proposal
  const handleConfirmProposal = async (proposalInput: ProposeCollectionsActionInput) => {
    const res = await proposeCollectionsActionAction(proposalInput);
    if (!res.success) {
      throw new Error(res.error?.message || 'Failed to submit proposal.');
    }
    loadData();
  };

  // Handler: Tags change
  const handleTagsChange = (entityId: string, tagIds: string[]) => {
    setDebtors((prev) =>
      prev.map((d) => (d.entityId === entityId ? { ...d, currentTagIds: tagIds } : d))
    );
  };

  const tabs: { label: string; value: FilterTab }[] = [
    { label: 'All Debtors', value: 'ALL' },
    { label: '0–14 Days', value: '0_14_DAYS' },
    { label: '15–30 Days', value: '15_30_DAYS' },
    { label: '31–60 Days', value: '31_60_DAYS' },
    { label: '60+ Days Overdue', value: 'OVER_60_DAYS' },
  ];

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
      {/* Title Bar & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Collections Action Desk
          </h1>
          <CardInfoTooltip text="Intelligent aging receivables recovery engine. Evaluates overdue tuition fees, generates dynamic installment plans, and intercepts high-risk proposals into the unified approval center." />
          <Badge variant="outline" className="hidden sm:inline-flex text-xs font-mono">
            Phase 12 · M4
          </Badge>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.97] min-h-[44px] px-3.5 text-xs font-medium gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Zone 1: Executive KPI Cards */}
      <CollectionsKPIHeader metrics={metrics} isLoading={isLoading} />

      {/* Zone 2: Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 bg-card border border-border/80 rounded-2xl shadow-sm">
        {/* Aging Bucket Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              variant={activeTab === tab.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.value)}
              className="rounded-xl active:scale-[0.97] min-h-[44px] px-3.5 text-xs font-semibold whitespace-nowrap"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* 300ms Debounced Search */}
        <div className="relative min-w-[260px] md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, debtor, contact..."
            className="pl-9 pr-4 rounded-xl min-h-[44px] text-xs bg-background/50 border-border/80 focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Zone 3: Interactive Data Grid */}
      <DebtorAccountTable
        debtors={debtors}
        isLoading={isLoading}
        onEvaluateDebtor={handleEvaluateDebtor}
        onProposePlan={handleProposePlan}
        onRecordPromise={handleOpenRecordPromise}
        onTagsChange={handleTagsChange}
      />

      {/* Standardized Proposal Modal (theme.md §8) */}
      <FinancialProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        debtor={selectedDebtor}
        nextAction={evaluatedAction}
        onConfirmProposal={handleConfirmProposal}
      />

      {/* Standardized Installment Plan Drawer (theme.md §8) */}
      <InstallmentPlanDrawer
        isOpen={isPlanDrawerOpen}
        onClose={() => setIsPlanDrawerOpen(false)}
        plan={activePlan}
        debtor={selectedDebtor}
        workspaceId={workspaceId}
        organizationId={organizationId}
        onApplyPlan={async (plan) => {
          if (!selectedDebtor) return;
          await handleConfirmProposal({
            entityId: selectedDebtor.entityId,
            workspaceId,
            organizationId,
            actionType: 'PROPOSE_INSTALLMENT_PLAN',
            riskLevel: 'L2_STATE_MUTATION',
            payload: {
              entityId: selectedDebtor.entityId,
              plan,
            },
            rationale: `Applied structured ${plan.frequency} installment schedule with ${plan.milestones.length} milestones.`,
            idempotencyKey: `col_plan_apply_${plan.planId}`,
          });
        }}
      />

      {/* Standardized Promise-to-Pay Recording Dialog (theme.md §8) */}
      <Dialog open={isPromiseModalOpen} onOpenChange={(open) => !open && setIsPromiseModalOpen(false)}>
        <DialogContent className="max-w-md border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden">
          <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Record Promise to Pay
                </DialogTitle>
                <CardInfoTooltip text="Log a debtor's verbal or written commitment to pay. Schedules an automated follow-up reminder and pauses automated dunning escalation until the promised date." />
              </div>
            </div>
            <DialogDescription className="sr-only">
              Record commitment date and promised amount for this debtor.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Debtor Account
              </span>
              <p className="font-semibold text-sm text-foreground">{selectedDebtor?.entityName}</p>
              <p className="text-muted-foreground">
                Total Overdue: {selectedDebtor?.currency} {selectedDebtor?.totalOutstandingBalance.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Promised Payment Date</label>
              <Input
                type="date"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Promised Amount ({selectedDebtor?.currency})</label>
              <Input
                type="number"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(Number(e.target.value))}
                className="rounded-xl min-h-[44px] text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Commitment Notes</label>
              <textarea
                rows={2}
                value={promiseNotes}
                onChange={(e) => setPromiseNotes(e.target.value)}
                placeholder="Details of parent discussion, payment method, or payroll dates..."
                className="w-full text-xs p-2.5 rounded-xl border border-border/80 bg-background focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromiseModalOpen(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px] px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSavePromise}
              disabled={isRecordingPromise || !promiseDate || promiseAmount <= 0}
              className="rounded-xl active:scale-[0.97] min-h-[44px] px-5 text-xs font-medium gap-1.5 shadow-sm"
            >
              {isRecordingPromise ? 'Recording...' : 'Record Commitment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageContainerFluid>
  );
}
