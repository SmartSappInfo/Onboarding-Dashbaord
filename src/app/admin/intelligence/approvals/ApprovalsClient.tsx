'use client';

/**
 * @fileOverview Unified Agent Approval Center Client Console (Phase 8 Milestone 3)
 *
 * Three-Zone operator mission control layout:
 * - Zone 1: Executive KPI Header & Emergency Dead-Man Switch Banner (`ApprovalMetricsCards` & `EmergencyPauseBanner`).
 * - Zone 2: Category Filter Toolbar (6 Category Pills, Status Tabs & 300ms Debounced Search).
 * - Zone 3: Live Proposals Stream (`ApprovalReviewCard`, `ProposalReviewDrawer`, `RejectApprovalModal`).
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px, plain English UX.
 * - Rule 8 & 47: Anti-IDOR tenant validation.
 * - Rule 10: Comprehensive architectural documentation.
 * - Rule 13: Anti-self-approval enforcement.
 * - Rule 18: Live TOCTOU authority verification.
 * - Rule 21 & 22: Two-Phase action model & cryptographic SHA-256 payload tampering detection.
 * - Rule 27: Saga rollback trigger on rejection.
 * - Rule 60: Emergency dead-man switch evaluation.
 * - Rule 61: Backoffice agent control plane.
 * - Rule 62: Real-time UI reactivity via `useEventStream`.
 * - Rule 68: "No Dead Ends" with clear actions on every proposal.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { ApprovalMetricsCards } from '@/components/approvals/ApprovalMetricsCards';
import { EmergencyPauseBanner } from '@/components/approvals/EmergencyPauseBanner';
import { ApprovalReviewCard } from '@/components/approvals/ApprovalReviewCard';
import { ProposalReviewDrawer } from '@/components/approvals/ProposalReviewDrawer';
import { RejectApprovalModal } from '@/components/approvals/RejectApprovalModal';
import { useEventStream } from '@/hooks/useEventStream';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import {
  listActionProposalsAction,
  approveActionProposalAction,
  rejectActionProposalAction,
  getApprovalGovernanceMetricsAction,
  setEmergencyPauseAction,
  type ProposalCategory,
  type ApprovalGovernanceMetrics,
} from '@/app/actions/approval-governance-actions';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Inbox,
  Filter,
  Clock,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CATEGORY_TABS: { id: ProposalCategory; label: string }[] = [
  { id: 'all', label: 'All Proposals' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'financial', label: 'Financial' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'bulk_updates', label: 'Bulk Updates' },
  { id: 'privileged', label: 'Privileged' },
];

export function ApprovalsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const organizationId = activeOrganizationId || 'org_default';

  // Data state
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [metrics, setMetrics] = useState<ApprovalGovernanceMetrics>({
    pendingCount: 0,
    approvedCount24h: 0,
    rejectedCount24h: 0,
    criticalPendingCount: 0,
    isEmergencyPaused: false,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<ProposalCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals & Drawer State
  const [selectedProposal, setSelectedProposal] = useState<ActionProposal | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [rejectingProposal, setRejectingProposal] = useState<ActionProposal | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 300ms Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [proposalsRes, metricsRes] = await Promise.all([
        listActionProposalsAction({
          organizationId,
          workspaceId: activeWorkspaceId || undefined,
          status: statusFilter,
          category: categoryFilter,
          search: debouncedSearch || undefined,
          limit: 50,
        }),
        getApprovalGovernanceMetricsAction({
          organizationId,
          workspaceId: activeWorkspaceId || undefined,
        }),
      ]);

      if (proposalsRes.success && proposalsRes.data) {
        setProposals(proposalsRes.data);
      }
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err) {
      console.error('[ApprovalsClient] Failed to load data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [organizationId, activeWorkspaceId, statusFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Real-time SSE Reactivity (Rule 62)
  const { lastActivity } = useEventStream({
    workspaceId: activeWorkspaceId || undefined,
  });

  useEffect(() => {
    if (lastActivity) {
      void loadData();
    }
  }, [lastActivity, loadData]);

  // Handlers
  const handleApprove = async (proposal: ActionProposal) => {
    setIsProcessing(true);
    try {
      const res = await approveActionProposalAction({
        organizationId: proposal.organizationId,
        proposalId: proposal.proposalId,
      });

      if (!res.success) {
        toast({
          title: 'Approval Failed',
          description: res.error?.message || 'Failed to approve action proposal.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Action Proposal Approved',
        description: `Successfully authorized ${proposal.capabilityId}. Execution will proceed.`,
      });

      setIsDrawerOpen(false);
      void loadData();
    } catch (err) {
      toast({
        title: 'Approval Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRejectModal = (proposal: ActionProposal) => {
    setRejectingProposal(proposal);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (reason: string, notes?: string) => {
    if (!rejectingProposal) return;
    setIsProcessing(true);
    try {
      const combinedNotes = notes ? `${reason}: ${notes}` : reason;
      const res = await rejectActionProposalAction({
        organizationId: rejectingProposal.organizationId,
        proposalId: rejectingProposal.proposalId,
        decisionNotes: combinedNotes,
      });

      if (!res.success) {
        toast({
          title: 'Rejection Failed',
          description: res.error?.message || 'Failed to reject action proposal.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Proposal Rejected',
        description: 'Proposal rejected and reverse saga compensation triggered.',
      });

      setIsRejectModalOpen(false);
      setRejectingProposal(null);
      setIsDrawerOpen(false);
      void loadData();
    } catch (err) {
      toast({
        title: 'Rejection Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInspect = (proposal: ActionProposal) => {
    setSelectedProposal(proposal);
    setIsDrawerOpen(true);
  };

  const handleToggleEmergencyPause = async (pause: boolean, reason?: string) => {
    try {
      const res = await setEmergencyPauseAction({
        paused: pause,
        reason,
      });

      if (!res.success) {
        toast({
          title: 'Kill-Switch Error',
          description: res.error?.message || 'Failed to update emergency pause status.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: pause ? 'Emergency Pause Engaged' : 'Emergency Pause Lifted',
        description: pause
          ? 'All autonomous agent operations and approval processing have been halted.'
          : 'Agent operations and approval processing have resumed.',
      });

      void loadData();
    } catch (err) {
      toast({
        title: 'Emergency Control Error',
        description: err instanceof Error ? err.message : 'Failed to toggle kill switch.',
        variant: 'destructive',
      });
    }
  };

  const filteredProposals = useMemo(() => {
    return proposals;
  }, [proposals]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Surface Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Agent Approval Center
              <CardInfoTooltip text="Central operator console for adjudicating high-risk agent proposals, managing dual-control compliance, and inspecting two-phase execution payloads." />
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review, verify, and authorize two-phase human-in-the-loop proposals from autonomous swarms and workflows.
          </p>
        </div>

        {/* Global Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={isRefreshing}
          className="rounded-xl min-h-[44px] px-4 self-start sm:self-auto active:scale-[0.97]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Zone 1: Executive KPI Cards & Emergency Kill-Switch Banner */}
      <div className="space-y-4">
        <EmergencyPauseBanner
          isPaused={metrics.isEmergencyPaused}
          onTogglePause={handleToggleEmergencyPause}
          isSystemAdmin={true}
        />

        <ApprovalMetricsCards
          metrics={{
            pendingCount: metrics.pendingCount,
            approved24hCount: metrics.approvedCount24h,
            rejectedCount: metrics.rejectedCount24h,
            highBlastRadiusCount: metrics.criticalPendingCount,
          }}
        />
      </div>

      {/* Zone 2: Category Filter Toolbar & Search */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4 shadow-sm">
        {/* Status Mode Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/60 self-start">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending Review</span>
              {metrics.pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  {metrics.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>All History</span>
            </button>
          </div>

          {/* 300ms Debounced Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, why, persona..."
              className="pl-9 rounded-xl min-h-[44px] bg-background text-sm border-border/80"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1 shrink-0 mr-1">
            <Filter className="h-3.5 w-3.5" />
            Category:
          </span>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 min-h-[36px] active:scale-[0.97] border ${
                categoryFilter === tab.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone 3: Live Proposals Feed */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border/80 bg-card">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading action proposals...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border/80 bg-card">
          <div className="p-3 rounded-2xl bg-muted/40 text-muted-foreground mb-3">
            <Inbox className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No proposals pending approval</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {searchQuery || categoryFilter !== 'all'
              ? 'No proposals matched your active filters. Try adjusting search or category criteria.'
              : 'All autonomous agent operations are currently authorized or executed cleanly.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <ApprovalReviewCard
              key={proposal.proposalId}
              proposal={proposal}
              onApprove={handleApprove}
              onReject={handleOpenRejectModal}
              onInspect={handleInspect}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      )}

      {/* Standardized Review Drawer (theme.md §8) */}
      <ProposalReviewDrawer
        proposal={selectedProposal}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onApprove={handleApprove}
        onReject={handleOpenRejectModal}
        isProcessing={isProcessing}
      />

      {/* Standardized Rejection Reason Modal (theme.md §8) */}
      {rejectingProposal && (
        <RejectApprovalModal
          open={isRejectModalOpen}
          onOpenChange={setIsRejectModalOpen}
          proposalId={rejectingProposal.proposalId}
          proposalTitle={rejectingProposal.what}
          onConfirmReject={handleConfirmReject}
          isSubmitting={isProcessing}
        />
      )}
    </div>
  );
}
