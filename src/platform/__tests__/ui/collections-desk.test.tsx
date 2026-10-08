// @vitest-environment jsdom
/**
 * @fileOverview Unit & Component Tests: Collections Action Desk UI (Phase 12 Milestone 4)
 *
 * Implements:
 * - theme.md Section 8 (Standardized Modal Architecture & Dialog Systems)
 * - Rule 4 (Strict Zero-any / Zero-any[] typing policy)
 * - Rule 7 (Mobile-first >= 44px Touch Targets & active:scale-[0.97])
 * - Rule 11 (Double-Entry Financial Determinism & Remainder Balancing)
 * - Rule 12 (5-Tier Risk Classification & Badging)
 * - Rule 21 & 22 (Two-Phase Proposal Interception & Cryptographic SHA-256 Payload Binding)
 * - Rule 41 (6-Section Explainability Grid)
 * - Rule 61 (Three-Zone Mission Control Layout: Zone 1 KPI, Zone 2 Filters, Zone 3 Data Grid)
 * - .agents/AGENTS.md (Tag Selection SSOT via TagSelector & VariablesPanel)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  CollectionsKPIHeader,
  DebtorAccountTable,
  FinancialProposalModal,
  InstallmentPlanDrawer,
} from '@/components/finance/collections';
import { CollectionsClient } from '@/app/admin/finance/collections/CollectionsClient';
import {
  type DebtorAccount,
  type CollectionsMetrics,
  type CollectionsNextBestAction,
  type InstallmentPaymentPlan,
} from '@/platform/agents/finance/collections/collections-types';
import * as collectionsActions from '@/app/actions/finance-collections-actions';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock Toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock TenantContext
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org_finance_test',
    activeWorkspaceId: 'ws_finance_test',
    currentOrganization: { id: 'org_finance_test', name: 'Test Org' },
    currentWorkspace: { id: 'ws_finance_test', name: 'Finance Workspace' },
    activeOrganization: { id: 'org_finance_test', name: 'Test Org' },
    activeWorkspace: { id: 'ws_finance_test', name: 'Finance Workspace' },
    setActiveWorkspace: vi.fn(),
    switchOrganizationAndWorkspace: vi.fn(),
    availableOrganizations: [],
    allAccessibleWorkspaces: [],
    isSuperAdmin: false,
  }),
}));

// Mock EventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    isConnected: true,
  }),
}));

// Mock TagSelector to keep test focused on Collections Desk
vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({
    currentTagIds,
    onTagsChange,
  }: {
    currentTagIds?: string[];
    onTagsChange?: (tags: string[]) => void;
  }) => (
    <div data-testid="tag-selector">
      <span data-testid="tag-count">{currentTagIds?.length ?? 0} tags</span>
      <button
        type="button"
        data-testid="add-tag-btn"
        onClick={() => onTagsChange?.([...(currentTagIds ?? []), 'tag_new'])}
      >
        Add Tag
      </button>
    </div>
  ),
}));

// Mock VariablesPanel
vi.mock('@/components/shared/VariablesPanel', () => ({
  VariablesPanel: () => <div data-testid="variables-panel">Variables Panel SSOT</div>,
}));

// Mock Server Actions
vi.mock('@/app/actions/finance-collections-actions', () => ({
  getDebtorAccountsAction: vi.fn(),
  evaluateDebtorNextActionAction: vi.fn(),
  createInstallmentPlanAction: vi.fn(),
  proposeCollectionsActionAction: vi.fn(),
  recordPromiseToPayAction: vi.fn(),
  getCollectionsMetricsAction: vi.fn(),
}));

describe('Collections Action Desk UI (Phase 12 Milestone 4)', () => {
  const mockDebtor: DebtorAccount = {
    entityId: 'ent_debtor_001',
    entityName: 'St. Peter International Academy',
    workspaceId: 'ws_finance_test',
    organizationId: 'org_finance_test',
    studentId: 'STU-9921',
    primaryContactName: 'Dr. Joseph Mensah',
    primaryContactEmail: 'jmensah@stpeters.edu.gh',
    primaryContactPhone: '+233200000001',
    currency: 'GHS',
    totalOutstandingBalance: 12500,
    oldestInvoiceDueDate: '2026-08-15',
    daysOverdue: 45,
    agingBucket: '31_60_DAYS',
    lastContactedAt: '2026-09-20',
    promiseToPayDate: '2026-10-15',
    promiseToPayAmount: 5000,
    brokenPromisesCount: 1,
    relationshipHealth: 'FAIR',
    remarks: 'Requested milestone adjustment due to mid-term fees collection delay.',
    currentTagIds: ['tag_vip_debtor'],
  };

  const mockMetrics: CollectionsMetrics = {
    totalReceivablesOverdue: 125400,
    debtorAccountsCount: 14,
    activePromisesCount: 6,
    promisesVolume: 42000,
    plansActiveCount: 5,
    plansRecoveredThisMonth: 18500,
    currency: 'GHS',
  };

  const mockPlan: InstallmentPaymentPlan = {
    planId: 'plan_test_101',
    entityId: 'ent_debtor_001',
    workspaceId: 'ws_finance_test',
    organizationId: 'org_finance_test',
    totalAmount: 12500,
    currency: 'GHS',
    frequency: 'monthly',
    startDate: '2026-10-15',
    status: 'PROPOSED',
    createdAt: '2026-09-30T10:00:00.000Z',
    milestones: [
      { milestoneIndex: 1, dueDate: '2026-10-15', amount: 4166.66, currency: 'GHS', status: 'PENDING' },
      { milestoneIndex: 2, dueDate: '2026-11-15', amount: 4166.66, currency: 'GHS', status: 'PENDING' },
      { milestoneIndex: 3, dueDate: '2026-12-15', amount: 4166.68, currency: 'GHS', status: 'PENDING' },
    ],
  };

  const mockNextAction: CollectionsNextBestAction = {
    actionId: 'act_test_001',
    entityId: 'ent_debtor_001',
    actionType: 'PROPOSE_INSTALLMENT_PLAN',
    priority: 'HIGH',
    riskLevel: 'L2_STATE_MUTATION',
    explainability: {
      what: 'Propose structured 3-month installment payment plan',
      why: 'Account has 1 broken promise but maintains FAIR relationship health and large overdue balance.',
      recoveryProbability: 82,
      riskLevel: 'L2_STATE_MUTATION',
      financialExposure: 12500,
    },
    dunningDraft: {
      draftId: 'draft_test_001',
      entityId: 'ent_debtor_001',
      channel: 'whatsapp',
      tier: 'INSTALLMENT_PROPOSAL',
      recipientName: 'Dr. Joseph Mensah',
      recipientAddress: '+233200000001',
      subject: 'Installment Recovery Option for St. Peter International Academy',
      body: 'Dear Dr. Joseph Mensah, we have formulated an installment schedule of 3 payments...',
      paymentLink: 'https://portal.smartsapp.com/pay/ent_debtor_001',
      currency: 'GHS',
      amountDue: 12500,
      daysOverdue: 45,
      generatedAt: '2026-09-30T10:00:00.000Z',
    },
    proposedPlan: mockPlan,
    idempotencyKey: 'col_act_ent_debtor_001_45_PROPOSE_INSTALLMENT_PLAN',
    requiresHumanApproval: true,
    nonDelegable: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = 'auto';
  });

  describe('1. CollectionsKPIHeader (Zone 1 Executive Cards)', () => {
    it('renders all 4 executive metrics with formatted currency and double-entry precision', () => {
      render(<CollectionsKPIHeader metrics={mockMetrics} isLoading={false} />);

      expect(screen.getByText('Overdue Receivables')).toBeInTheDocument();
      expect(screen.getByText('125,400.00 GHS')).toBeInTheDocument();

      expect(screen.getByText('Debtor Accounts')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();

      expect(screen.getByText('Active Promises to Pay')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('42,000.00 GHS committed')).toBeInTheDocument();

      expect(screen.getByText('Active Payment Plans')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('18,500.00 GHS recovered this month')).toBeInTheDocument();
    });

    it('renders placeholder loaders when isLoading is true', () => {
      render(<CollectionsKPIHeader metrics={null} isLoading={true} />);

      const placeholders = screen.getAllByText('...');
      expect(placeholders.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. DebtorAccountTable (Zone 3 Interactive Grid)', () => {
    it('renders debtor rows with health badge, aging badge, and contact information', () => {
      render(
        <DebtorAccountTable
          debtors={[mockDebtor]}
          isLoading={false}
          onEvaluateDebtor={vi.fn()}
          onProposePlan={vi.fn()}
          onRecordPromise={vi.fn()}
        />
      );

      expect(screen.getByText('St. Peter International Academy')).toBeInTheDocument();
      expect(screen.getByText('Dr. Joseph Mensah')).toBeInTheDocument();
      expect(screen.getByText('STU-9921')).toBeInTheDocument();
      expect(screen.getByText('jmensah@stpeters.edu.gh')).toBeInTheDocument();
      expect(screen.getByText('+233200000001')).toBeInTheDocument();

      // Aging badge
      expect(screen.getByText('45d · 31–60 Days')).toBeInTheDocument();

      // Outstanding balance
      expect(screen.getByText('GHS 12,500.00')).toBeInTheDocument();

      // Relationship health & broken promises
      expect(screen.getByText('FAIR')).toBeInTheDocument();
      expect(screen.getByText('1 Broken')).toBeInTheDocument();

      // Promise info
      expect(screen.getByText('Promised GHS 5000 by 2026-10-15')).toBeInTheDocument();
    });

    it('renders empty zero state when debtor list is empty', () => {
      render(
        <DebtorAccountTable
          debtors={[]}
          isLoading={false}
          onEvaluateDebtor={vi.fn()}
          onProposePlan={vi.fn()}
          onRecordPromise={vi.fn()}
        />
      );

      expect(screen.getByText('Zero Overdue Accounts Found')).toBeInTheDocument();
    });

    it('triggers action callbacks when action buttons are clicked', () => {
      const handleEvaluate = vi.fn();
      const handlePlan = vi.fn();
      const handlePromise = vi.fn();

      render(
        <DebtorAccountTable
          debtors={[mockDebtor]}
          isLoading={false}
          onEvaluateDebtor={handleEvaluate}
          onProposePlan={handlePlan}
          onRecordPromise={handlePromise}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Evaluate Action/i }));
      expect(handleEvaluate).toHaveBeenCalledWith(mockDebtor);

      fireEvent.click(screen.getByRole('button', { name: /Plan/i }));
      expect(handlePlan).toHaveBeenCalledWith(mockDebtor);

      fireEvent.click(screen.getByRole('button', { name: /Promise/i }));
      expect(handlePromise).toHaveBeenCalledWith(mockDebtor);
    });

    it('integrates TagSelector SSOT and propagates tag updates', () => {
      const handleTagsChange = vi.fn();

      render(
        <DebtorAccountTable
          debtors={[mockDebtor]}
          isLoading={false}
          onEvaluateDebtor={vi.fn()}
          onProposePlan={vi.fn()}
          onRecordPromise={vi.fn()}
          onTagsChange={handleTagsChange}
        />
      );

      expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
      expect(screen.getByText('1 tags')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('add-tag-btn'));
      expect(handleTagsChange).toHaveBeenCalledWith('ent_debtor_001', ['tag_vip_debtor', 'tag_new']);
    });
  });

  describe('3. FinancialProposalModal (theme.md §8 & Two-Phase Approval)', () => {
    it('renders with demarcated header, single-circle info tooltip, sr-only description and explainability grid', async () => {
      render(
        <FinancialProposalModal
          isOpen={true}
          onClose={vi.fn()}
          debtor={mockDebtor}
          nextAction={mockNextAction}
          onConfirmProposal={vi.fn()}
        />
      );

      // Title & SR description
      expect(screen.getByText('Financial Proposal Review')).toBeInTheDocument();
      expect(
        screen.getByText('Review intercepted collections proposal, installment schedule, and recovery probability.')
      ).toHaveClass('sr-only');

      // 4-Part Explainability Grid
      expect(screen.getByText('Propose structured 3-month installment payment plan')).toBeInTheDocument();
      expect(screen.getByText(/Account has 1 broken promise but maintains FAIR relationship health/i)).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
      expect(screen.getByText('L2_STATE_MUTATION')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();

      // Installment Schedule Breakdown Preview
      expect(screen.getByText(/Proposed Installment Schedule/i)).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
      expect(screen.getByText('GHS 4166.68')).toBeInTheDocument(); // remainder cent

      // SHA-256 Payload Hash badge check
      await waitFor(() => {
        expect(screen.getByText(/SHA-256 Digest:/i)).toBeInTheDocument();
      });
    });

    it('handles copy hash button and confirms proposal on submit', async () => {
      const handleConfirm = vi.fn().mockResolvedValue(undefined);

      render(
        <FinancialProposalModal
          isOpen={true}
          onClose={vi.fn()}
          debtor={mockDebtor}
          nextAction={mockNextAction}
          onConfirmProposal={handleConfirm}
        />
      );

      // Wait for async hash computation
      await waitFor(() => {
        expect(screen.getByText(/SHA-256 Digest: [a-f0-9]{16}\.\.\./i)).toBeInTheDocument();
      });

      // Click copy hash button
      const copyBtn = screen.getByRole('button', { name: /Copy/i });
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();

      // Submit proposal
      const confirmBtn = screen.getByRole('button', { name: /Stage Action Proposal/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(handleConfirm).toHaveBeenCalled();
        const callArg = handleConfirm.mock.calls[0][0];
        expect(callArg.entityId).toBe('ent_debtor_001');
        expect(callArg.actionType).toBe('PROPOSE_INSTALLMENT_PLAN');
      });
    });
  });

  describe('4. InstallmentPlanDrawer (theme.md §8 & Remainder Balancing)', () => {
    it('renders installment milestone schedule with remainder balancing notice and VariablesPanel SSOT', async () => {
      render(
        <InstallmentPlanDrawer
          isOpen={true}
          onClose={vi.fn()}
          plan={mockPlan}
          debtor={mockDebtor}
          workspaceId="ws_finance_test"
          organizationId="org_finance_test"
          onApplyPlan={vi.fn()}
        />
      );

      expect(screen.getByText('Installment Plan Details')).toBeInTheDocument();
      expect(screen.getByText('St. Peter International Academy')).toBeInTheDocument();
      expect(screen.getByText('GHS 12,500.00')).toBeInTheDocument();

      // Remainder Balancing Notice
      expect(
        screen.getByText(/3 milestones sum to GHS 12500\.00 with zero remainder drift/i)
      ).toBeInTheDocument();

      // Switch to Template Variables tab
      const tabBtn = screen.getByRole('tab', { name: /Template Variables/i });
      fireEvent.pointerDown(tabBtn);
      fireEvent.click(tabBtn);
      fireEvent.keyDown(tabBtn, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByTestId('variables-panel')).toBeInTheDocument();
      });
    });
  });

  describe('5. CollectionsClient (Three-Zone Mission Control & Workflows)', () => {
    beforeEach(() => {
      vi.mocked(collectionsActions.getDebtorAccountsAction).mockResolvedValue({
        success: true,
        data: [mockDebtor],
      });

      vi.mocked(collectionsActions.getCollectionsMetricsAction).mockResolvedValue({
        success: true,
        data: mockMetrics,
      });

      vi.mocked(collectionsActions.evaluateDebtorNextActionAction).mockResolvedValue({
        success: true,
        data: mockNextAction,
      });

      vi.mocked(collectionsActions.recordPromiseToPayAction).mockResolvedValue({
        success: true,
        data: {
          ...mockDebtor,
          promiseToPayAmount: 6000,
          promiseToPayDate: '2026-10-30',
        },
      });

      vi.mocked(collectionsActions.proposeCollectionsActionAction).mockResolvedValue({
        success: true,
        data: {
          proposalId: 'prop_fin_coll_101',
          payloadHash: 'hash_test_101',
        },
      });
    });

    it('renders Three-Zone layout with search, aging tabs, KPI cards, and debtors table', async () => {
      render(<CollectionsClient />);

      // Zone 1
      expect(screen.getByText('Overdue Receivables')).toBeInTheDocument();

      // Zone 2: Title & Search
      expect(screen.getByText('Collections Action Desk')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search student, debtor, contact...')).toBeInTheDocument();

      // Zone 2: Aging Bucket Tabs
      expect(screen.getByRole('button', { name: /All Debtors/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /31–60 Days/i })).toBeInTheDocument();

      // Zone 3: Debtor Account
      await waitFor(() => {
        expect(screen.getByText('St. Peter International Academy')).toBeInTheDocument();
      });
    });

    it('opens and submits Record Promise modal adhering to theme.md §8', async () => {
      render(<CollectionsClient />);

      await waitFor(() => {
        expect(screen.getByText('St. Peter International Academy')).toBeInTheDocument();
      });

      // Click Promise button
      fireEvent.click(screen.getByRole('button', { name: /Promise/i }));

      // Record Promise dialog opens
      expect(screen.getByText('Record Promise to Pay')).toBeInTheDocument();
      expect(
        screen.getByText(/Record commitment date and promised amount for this debtor/i)
      ).toHaveClass('sr-only');

      // Change amount and date
      const amountInput = screen.getByDisplayValue('6250');
      fireEvent.change(amountInput, { target: { value: '6000' } });

      const dateInput = screen.getByDisplayValue(/2026-/i);
      fireEvent.change(dateInput, { target: { value: '2026-10-30' } });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Record Commitment/i }));

      await waitFor(() => {
        expect(collectionsActions.recordPromiseToPayAction).toHaveBeenCalledWith({
          organizationId: 'org_finance_test',
          workspaceId: 'ws_finance_test',
          entityId: 'ent_debtor_001',
          amount: 6000,
          promiseDate: '2026-10-30',
          notes: undefined,
        });
      });
    });

    it('triggers evaluation and opens FinancialProposalModal', async () => {
      render(<CollectionsClient />);

      await waitFor(() => {
        expect(screen.getByText('St. Peter International Academy')).toBeInTheDocument();
      });

      // Click Evaluate Action
      const evaluateBtn = screen.getByRole('button', { name: /Evaluate Action/i });
      fireEvent.click(evaluateBtn);

      await waitFor(() => {
        expect(collectionsActions.evaluateDebtorNextActionAction).toHaveBeenCalledWith(
          'ent_debtor_001',
          'ws_finance_test',
          'org_finance_test'
        );
        expect(screen.getByText('Financial Proposal Review')).toBeInTheDocument();
      });
    });
  });
});
