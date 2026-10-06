// @vitest-environment jsdom
/**
 * @fileOverview Test Suite for ApprovalReviewCard Component (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px with active:scale-[0.97].
 * - Rule 12: Canonical Risk Taxonomy badges (L0 to L4).
 * - Rule 13 & 30: Untrusted Reference Data containerization.
 * - Rule 20 & 39: Distributed tracing badges with one-click copy.
 * - Rule 22: Cryptographic SHA-256 payload hash display with copy affordance.
 * - Rule 41: Explainability Grid (WHAT, WHY, AFFECTED, BLAST RADIUS, EVIDENCE, EXPECTED CHANGE).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalReviewCard } from '@/components/approvals/ApprovalReviewCard';
import type { ApprovalView } from '@/platform/policy/approval-view';

describe('ApprovalReviewCard Component (Phase 8 Milestone 3)', () => {
  const mockProposal: ApprovalView = {
    // Unified approval view (Phase 11 M0 · T2): an approver looking at a pending, decidable request.
    needsReproposal: false,
    executable: true,
    requiredApprovals: 1,
    approvalsCount: 0,
    version: 0,
    canDecide: true,
    proposalId: 'prop_test_200',
    organizationId: 'org_acme_corp',
    workspaceId: 'ws_sales_01',
    capabilityId: 'crm.bulk_update_deals',
    capabilityVersion: '1.2.0',
    agentPersonaId: 'deal_coach',
    authorizingUserId: 'user_sales_lead',
    delegationId: 'del_deal_456',
    delegationChain: ['user_admin', 'supervisor', 'deal_coach'],
    toolInvocationId: 'tool_inv_789',
    what: 'Apply 15% discount across 14 high-intent enterprise pipeline deals',
    why: 'End-of-quarter acceleration requested by account executives; margin remains >= 65%',
    blastRadius: {
      entityCount: 14,
      entityType: 'deals',
      estimatedCostUsd: 14250.0,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      targetSummary: 'Tier 1 Enterprise Accounts in Stage 4 (Negotiation)',
    },
    evidence: {
      averageMargin: '68.4%',
      targetCloseDate: '2026-10-31',
      scorecardReference: 'doc_q4_pricing_policy',
    },
    payload: {
      dealIds: ['deal_1', 'deal_2', 'deal_3'],
      discountRate: 0.15,
      requiresManagerSignoff: false,
    },
    payloadHash: '4a6b2c8d1e0f3a5b7c9d2e4f6a8b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
    status: 'pending',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders the 6-section explainability grid (Rule 41)', () => {
    render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    // 1. WHAT
    expect(screen.getByText(/Apply 15% discount across 14 high-intent enterprise pipeline deals/)).toBeDefined();

    // 2. WHY
    expect(screen.getByText(/End-of-quarter acceleration requested by account executives/)).toBeDefined();

    // 3. AFFECTED ENTITIES
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('deals')).toBeDefined();

    // 4. BLAST RADIUS
    expect(screen.getByText(/\$14,250/)).toBeDefined();
    expect(screen.getAllByText(/Tier 1 Enterprise Accounts in Stage 4/).length).toBeGreaterThan(0);

    // 5. EVIDENCE
    expect(screen.getByText(/doc_q4_pricing_policy/)).toBeDefined();

    // 6. EXPECTED CHANGE
    expect(screen.getByText(/crm\.bulk_update_deals/)).toBeDefined();
  });

  it('renders truncated SHA-256 payload hash (16 chars) with copy affordance (Rule 22)', async () => {
    render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    const truncatedHash = mockProposal.payloadHash.slice(0, 16);
    expect(screen.getByText(new RegExp(truncatedHash))).toBeDefined();

    // Click copy hash button
    const copyBtn = screen.getByRole('button', { name: /Copy Hash/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockProposal.payloadHash);
  });

  it('renders distributed tracing and delegation badges (Rules 20 & 39)', () => {
    render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    expect(screen.getByText(/deal_coach/)).toBeDefined();
    expect(screen.getByText(/Hop 2/i)).toBeDefined();
    expect(screen.getByText(/tool_inv_789/)).toBeDefined();
  });

  it('renders canonical risk badge with appropriate styling (Rule 12)', () => {
    render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    expect(screen.getByText(/L3_EXTERNAL_COMMUNICATION_FINANCE/)).toBeDefined();
  });

  it('encloses untrusted reference data inside <untrusted_reference_data> container (Rules 13 & 30)', () => {
    const { container } = render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    const untrustedElements = container.querySelectorAll('untrusted_reference_data');
    expect(untrustedElements.length).toBeGreaterThan(0);
  });

  it('triggers action callbacks with tactile feedback and mobile touch targets >= 44px (Rule 7)', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onInspect = vi.fn();

    render(
      <ApprovalReviewCard
        proposal={mockProposal}
        onApprove={onApprove}
        onReject={onReject}
        onInspect={onInspect}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
    const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
    const inspectBtn = screen.getByRole('button', { name: /Review Details/i });

    expect(approveBtn.className).toContain('min-h-[44px]');
    expect(rejectBtn.className).toContain('min-h-[44px]');
    expect(inspectBtn.className).toContain('min-h-[44px]');

    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith(mockProposal);

    fireEvent.click(rejectBtn);
    expect(onReject).toHaveBeenCalledWith(mockProposal);

    fireEvent.click(inspectBtn);
    expect(onInspect).toHaveBeenCalledWith(mockProposal);
  });
});
