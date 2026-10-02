// @vitest-environment jsdom
/**
 * @fileOverview Exhaustive UI Test Suite for Agent Approval Center & Policy Editor (Phase 3 Milestone 4)
 *
 * Implements Rules 1, 4, 7, 8, 10, 16, 21, 22, 38, 41, 47, 51, 60, 61, 62, 64,
 * and theme.md Section 8 (Standardized Modal Architecture).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalProposalCard } from '@/components/approvals/ApprovalProposalCard';
import { RejectApprovalModal } from '@/components/approvals/RejectApprovalModal';
import { ApprovalMetricsCards } from '@/components/approvals/ApprovalMetricsCards';
import { EmergencyPauseBanner } from '@/components/approvals/EmergencyPauseBanner';
import { AgentPolicyMatrix } from '@/components/approvals/AgentPolicyMatrix';
import { ApprovalsClient } from '@/app/admin/approvals/ApprovalsClient';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

// Mock Workspace Context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_123',
    activeOrganizationId: 'org_test_456',
  }),
}));

// Mock Toast Hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock Server Actions
const mockDecideApprovalAction = vi.fn().mockResolvedValue({ success: true });
const mockSetEmergencyPauseAction = vi.fn().mockResolvedValue({ success: true });
const mockListPendingApprovalsAction = vi.fn().mockResolvedValue({
  success: true,
  data: [],
});

vi.mock('@/app/actions/approval-actions', () => ({
  decideApprovalAction: (...args: unknown[]) => mockDecideApprovalAction(...args),
  setEmergencyPauseAction: (...args: unknown[]) => mockSetEmergencyPauseAction(...args),
  listPendingApprovalsAction: (...args: unknown[]) => mockListPendingApprovalsAction(...args),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    status: 'connected',
    lastActivity: null,
    error: null,
    reconnect: vi.fn(),
  }),
}));

const mockProposal: ActionProposal = {
  proposalId: 'prop_test_001',
  organizationId: 'org_test_456',
  workspaceId: 'ws_test_123',
  capabilityId: 'campaigns.dispatch_outbound',
  capabilityVersion: '1.0.0',
  agentPersonaId: 'lead_sdr',
  authorizingUserId: 'user_admin_1',
  delegationId: 'del_123',
  delegationChain: ['user_admin_1', 'supervisor', 'lead_sdr'],
  what: 'Launch outbound campaign to 1,243 verified contacts',
  why: 'Lead score threshold exceeded 85 for targeted pipeline accounts',
  blastRadius: {
    entityCount: 1243,
    entityType: 'contacts',
    estimatedCostUsd: 12.43,
    riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
  },
  payload: {
    campaignId: 'camp_789',
    recipientCount: 1243,
    channel: 'email',
  },
  payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  status: 'pending',
  expiresAt: new Date(Date.now() + 7200000).toISOString(), // 2 hours
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Phase 3 Milestone 4: Operator UI Surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Action Proposal Card (Rule 41, 22, 64)', () => {
    it('renders structured WHAT, WHY, BLAST RADIUS, and persona badge', () => {
      render(
        <ApprovalProposalCard
          proposal={mockProposal}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      // Rule 41 WHAT statement
      expect(screen.getByText('Launch outbound campaign to 1,243 verified contacts')).toBeDefined();

      // Rule 41 WHY reasoning
      expect(screen.getByText('Lead score threshold exceeded 85 for targeted pipeline accounts')).toBeDefined();

      // Blast radius
      expect(screen.getByText('1243 contacts')).toBeDefined();
      expect(screen.getByText('$12.43')).toBeDefined();

      // Provenance Hop
      expect(screen.getByText('Hop 2')).toBeDefined();

      // Risk badge
      expect(screen.getByText('L3_EXTERNAL_COMMUNICATION_FINANCE')).toBeDefined();
    });

    it('toggles collapsible payload viewer and shows truncated SHA-256 hash', async () => {
      render(
        <ApprovalProposalCard
          proposal={mockProposal}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByText(/Inspect Payload/)).toBeDefined();
      const toggleBtn = screen.getByRole('button', { name: /Inspect Payload/ });
      fireEvent.click(toggleBtn);

      expect(screen.getByText(/Hide Payload/)).toBeDefined();
      expect(screen.getByText(/Full Hash:/)).toBeDefined();
    });

    it('triggers onApprove callback when Approve Action is clicked', () => {
      const onApprove = vi.fn();
      render(
        <ApprovalProposalCard
          proposal={mockProposal}
          onApprove={onApprove}
          onReject={vi.fn()}
        />
      );

      const approveBtn = screen.getByRole('button', { name: /Approve Action/ });
      fireEvent.click(approveBtn);

      expect(onApprove).toHaveBeenCalledWith('prop_test_001');
    });

    it('opens rejection modal when Reject Proposal is clicked', () => {
      render(
        <ApprovalProposalCard
          proposal={mockProposal}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      const rejectBtn = screen.getByRole('button', { name: /Reject Proposal/ });
      fireEvent.click(rejectBtn);

      expect(screen.getByText('Reject Action Proposal')).toBeDefined();
    });
  });

  describe('2. Standardized Rejection Reason Modal (theme.md §8)', () => {
    it('strictly satisfies theme.md Section 8 invariants', () => {
      render(
        <RejectApprovalModal
          open={true}
          onOpenChange={vi.fn()}
          proposalId="prop_test_001"
          proposalTitle="Launch campaign"
          onConfirmReject={vi.fn()}
        />
      );

      // Title & Demarcated Header
      expect(screen.getByText('Reject Action Proposal')).toBeDefined();

      // Screen-reader only description (WCAG AA accessibility)
      const srDescription = screen.getByText(/Select a rejection reason/);
      expect(srDescription.className).toContain('sr-only');

      // Preset reasons present
      expect(screen.getByText('Incorrect audience targeting')).toBeDefined();
      expect(screen.getByText('Budget or cost ceiling exceeded')).toBeDefined();

      // Buttons with touch targets
      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/ });
      expect(confirmBtn.className).toContain('min-h-[44px]');
      expect(confirmBtn.className).toContain('rounded-xl');
    });

    it('submits selected reason and notes upon confirmation', async () => {
      const onConfirmReject = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <RejectApprovalModal
          open={true}
          onOpenChange={onOpenChange}
          proposalId="prop_test_001"
          proposalTitle="Launch campaign"
          onConfirmReject={onConfirmReject}
        />
      );

      // Select a preset reason
      const budgetBtn = screen.getByText('Budget or cost ceiling exceeded');
      fireEvent.click(budgetBtn);

      // Enter notes
      const notesTextarea = screen.getByPlaceholderText(/Provide specific instructions/);
      fireEvent.change(notesTextarea, { target: { value: 'Cap spend at $5' } });

      // Click Confirm Rejection
      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/ });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onConfirmReject).toHaveBeenCalledWith('Budget or cost ceiling exceeded', 'Cap spend at $5');
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('3. Approval Metrics KPI Cards', () => {
    it('renders all 4 metric cards with active pulse indicator', () => {
      const metrics = {
        pendingCount: 5,
        approved24hCount: 22,
        rejectedCount: 3,
        highBlastRadiusCount: 1,
      };

      render(<ApprovalMetricsCards metrics={metrics} />);

      expect(screen.getByText('5')).toBeDefined();
      expect(screen.getByText('22')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('Action Needed')).toBeDefined();
    });
  });

  describe('4. Emergency Dead-Man Switch Banner (Rule 60)', () => {
    it('renders status when monitored and opens confirmation modal', () => {
      render(
        <EmergencyPauseBanner
          isPaused={false}
          onTogglePause={vi.fn()}
          isSystemAdmin={true}
        />
      );

      expect(screen.getByText(/Active & Monitored/)).toBeDefined();
      const killSwitchBtn = screen.getByRole('button', { name: /Emergency Kill-Switch/ });
      fireEvent.click(killSwitchBtn);

      expect(screen.getByText('Engage Emergency Dead-Man Pause')).toBeDefined();
    });

    it('renders active pause banner when dead-man pause is engaged', () => {
      render(
        <EmergencyPauseBanner
          isPaused={true}
          onTogglePause={vi.fn()}
          isSystemAdmin={true}
        />
      );

      expect(screen.getByText(/EMERGENCY DEAD-MAN PAUSE ENGAGED/)).toBeDefined();
      expect(screen.getByRole('button', { name: /Resume Agent Operations/ })).toBeDefined();
    });
  });

  describe('5. Agent Policy Matrix Tab (UI #38)', () => {
    it('renders canonical domain matrix with autonomy badges and Rule 17 non-delegable indicator', () => {
      render(<AgentPolicyMatrix />);

      expect(screen.getByText(/Workspace Agent Policy Matrix/)).toBeDefined();
      expect(screen.getByText('CRM Contacts')).toBeDefined();
      expect(screen.getByText('Messaging & Outreach')).toBeDefined();
      expect(screen.getByText('System Administration')).toBeDefined();
      expect(screen.getByText('Rule 17')).toBeDefined();
    });
  });

  describe('6. ApprovalsClient Integration & Tab Navigation', () => {
    it('renders Three-Zone layout with search filter and empty state', async () => {
      render(<ApprovalsClient />);

      expect(screen.getByText('Agent Approval Center')).toBeDefined();
      expect(screen.getByText('Live Proposals')).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText('All Clear — No Pending Approvals')).toBeDefined();
      });

      // Switch to Policy Matrix tab
      const matrixTab = screen.getByRole('button', { name: /Policy Matrix/ });
      fireEvent.click(matrixTab);

      expect(screen.getByText(/Workspace Agent Policy Matrix/)).toBeDefined();
    });
  });
});
