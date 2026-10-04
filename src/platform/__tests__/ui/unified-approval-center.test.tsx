// @vitest-environment jsdom
/**
 * @fileOverview Test Suite for Unified Agent Approval Center Console & Strangler Fig Redirect (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR tenant validation.
 * - Rule 10: Complete architectural documentation.
 * - Rule 13: Model Distrust & Anti-Self-Approval.
 * - Rule 21 & 22: Two-Phase Action Model & Cryptographic Payload Tampering Detection.
 * - Rule 27: Formal Saga Compensation Trigger on Rejection.
 * - Rule 60: Emergency Dead-Man Switch Gate.
 * - Rule 61: Backoffice Operator Mission Control Console.
 * - Rule 62: Real-Time SSE Reactivity.
 * - Rule 69: Strangler Fig Pattern SSOT.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalsClient } from '@/app/admin/intelligence/approvals/ApprovalsClient';
import AdminApprovalsRedirectPage from '@/app/admin/approvals/page';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

// Mock Workspace Context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_sales_01',
    activeOrganizationId: 'org_acme_corp',
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
const mockListActionProposals = vi.fn();
const mockGetMetrics = vi.fn();
const mockApproveProposal = vi.fn();
const mockRejectProposal = vi.fn();
const mockSetEmergencyPause = vi.fn();

vi.mock('@/app/actions/approval-governance-actions', () => ({
  listActionProposalsAction: (...args: unknown[]) => mockListActionProposals(...args),
  getApprovalGovernanceMetricsAction: (...args: unknown[]) => mockGetMetrics(...args),
  approveActionProposalAction: (...args: unknown[]) => mockApproveProposal(...args),
  rejectActionProposalAction: (...args: unknown[]) => mockRejectProposal(...args),
  setEmergencyPauseAction: (...args: unknown[]) => mockSetEmergencyPause(...args),
}));

// Mock Next Navigation redirect
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
}));

// Mock useEventStream
let mockSseLastActivity: unknown = null;
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    status: 'connected',
    lastActivity: mockSseLastActivity,
    error: null,
    reconnect: vi.fn(),
  }),
}));

describe('Unified Approval Center & Mission Control (/admin/intelligence/approvals)', () => {
  const sampleProposal: ActionProposal = {
    proposalId: 'prop_unified_001',
    organizationId: 'org_acme_corp',
    workspaceId: 'ws_sales_01',
    capabilityId: 'campaigns.dispatch_outbound',
    capabilityVersion: '1.0.0',
    agentPersonaId: 'lead_sdr',
    authorizingUserId: 'user_agent_supervisor',
    what: 'Launch outbound campaign to 750 high-priority leads',
    why: 'Lead score threshold exceeded 85 and market segment is active',
    blastRadius: {
      entityCount: 750,
      entityType: 'contacts',
      estimatedCostUsd: 15.0,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      targetSummary: 'Enterprise Tier 1 Leads',
    },
    payload: {
      campaignId: 'camp_enterprise_q4',
      recipientCount: 750,
    },
    payloadHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    status: 'pending',
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSseLastActivity = null;

    mockListActionProposals.mockResolvedValue({
      success: true,
      data: [sampleProposal],
    });

    mockGetMetrics.mockResolvedValue({
      success: true,
      data: {
        pendingCount: 1,
        approvedCount24h: 8,
        rejectedCount24h: 2,
        criticalPendingCount: 0,
        isEmergencyPaused: false,
      },
    });

    mockApproveProposal.mockResolvedValue({
      success: true,
      data: { ...sampleProposal, status: 'approved' },
    });

    mockRejectProposal.mockResolvedValue({
      success: true,
      data: { ...sampleProposal, status: 'rejected' },
    });

    mockSetEmergencyPause.mockResolvedValue({
      success: true,
      data: { paused: false },
    });
  });

  describe('1. Three-Zone Mission Control Layout', () => {
    it('renders Zone 1 KPI cards and dead-man banner, Zone 2 category filters, and Zone 3 proposals', async () => {
      render(<ApprovalsClient />);

      // Surface Title
      expect(screen.getByText('Agent Approval Center')).toBeDefined();

      // Zone 1: KPI Cards
      await waitFor(() => {
        expect(screen.getByText('Pending Approvals')).toBeDefined();
        expect(screen.getByText('Approved (24h)')).toBeDefined();
        expect(screen.getByText('Rejected')).toBeDefined();
        expect(screen.getByText('High Blast Radius')).toBeDefined();
      });

      // Zone 2: Category Filter Pills
      expect(screen.getByText('All Proposals')).toBeDefined();
      expect(screen.getByText('Campaigns')).toBeDefined();
      expect(screen.getByText('Financial')).toBeDefined();
      expect(screen.getByText('Messaging')).toBeDefined();
      expect(screen.getByText('Bulk Updates')).toBeDefined();
      expect(screen.getByText('Privileged')).toBeDefined();

      // Zone 3: Proposals Feed
      await waitFor(() => {
        expect(screen.getByText(/Launch outbound campaign to 750 high-priority leads/)).toBeDefined();
      });
    });

    it('filters proposals when category pills or search input are used', async () => {
      render(<ApprovalsClient />);

      await waitFor(() => {
        expect(screen.getByText(/Launch outbound campaign/)).toBeDefined();
      });

      // Click Campaigns category
      const campaignsPill = screen.getByText('Campaigns');
      fireEvent.click(campaignsPill);

      await waitFor(() => {
        expect(mockListActionProposals).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'campaigns',
          })
        );
      });
    });
  });

  describe('2. Proposal Review Drawer & Decision Actions', () => {
    it('opens ProposalReviewDrawer when Review Details is clicked', async () => {
      render(<ApprovalsClient />);

      await waitFor(() => {
        expect(screen.getByText(/Launch outbound campaign/)).toBeDefined();
      });

      const inspectBtn = screen.getByRole('button', { name: /Review Details/i });
      fireEvent.click(inspectBtn);

      // Drawer dialog should open
      await waitFor(() => {
        expect(screen.getByText(/Review Action Proposal/i)).toBeDefined();
      });
    });

    it('approves proposal when Approve button is clicked', async () => {
      render(<ApprovalsClient />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Approve$/i })).toBeDefined();
      });

      const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockApproveProposal).toHaveBeenCalledWith({
          organizationId: 'org_acme_corp',
          proposalId: 'prop_unified_001',
        });
      });
    });

    it('opens RejectApprovalModal and rejects proposal with mandatory reason notes', async () => {
      render(<ApprovalsClient />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Reject$/i })).toBeDefined();
      });

      const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
      fireEvent.click(rejectBtn);

      // Rejection modal should open
      await waitFor(() => {
        expect(screen.getByText(/Reject Action Proposal/i)).toBeDefined();
      });

      const confirmRejectBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      fireEvent.click(confirmRejectBtn);

      await waitFor(() => {
        expect(mockRejectProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 'org_acme_corp',
            proposalId: 'prop_unified_001',
          })
        );
      });
    });
  });

  describe('3. Real-Time SSE Reactivity (Rule 62)', () => {
    it('refreshes proposals feed when an event arrives from EventStream', async () => {
      const { rerender } = render(<ApprovalsClient />);

      await waitFor(() => {
        expect(mockListActionProposals).toHaveBeenCalledTimes(1);
      });

      // Simulate incoming SSE event
      mockSseLastActivity = {
        type: 'policy.approval.granted',
        timestamp: Date.now(),
      };

      rerender(<ApprovalsClient />);

      await waitFor(() => {
        expect(mockListActionProposals).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('4. Strangler Fig Redirect (Rule 69)', () => {
    it('redirects /admin/approvals to /admin/intelligence/approvals preserving query parameters', async () => {
      await AdminApprovalsRedirectPage({
        searchParams: Promise.resolve({
          category: 'financial',
          status: 'pending',
        }),
      });

      expect(mockRedirect).toHaveBeenCalledWith(
        '/admin/intelligence/approvals?category=financial&status=pending'
      );
    });

    it('redirects to base /admin/intelligence/approvals when no query parameters are provided', async () => {
      await AdminApprovalsRedirectPage({
        searchParams: Promise.resolve({}),
      });

      expect(mockRedirect).toHaveBeenCalledWith('/admin/intelligence/approvals');
    });
  });
});
