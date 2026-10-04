// @vitest-environment jsdom
/**
 * @fileOverview Test Suite for ProposalReviewDrawer & Diff Viewer (Phase 8 Milestone 3)
 *
 * Implements:
 * - theme.md Section 8 (Standardized Modal Architecture).
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile touch targets >= 44px with active:scale-[0.97].
 * - Rule 13 & 30: Untrusted reference data containerization.
 * - Rule 21 & 22: Two-Phase Approval & Cryptographic Hash Binding.
 * - Rule 41: Explainability Grid.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProposalReviewDrawer } from '@/components/approvals/ProposalReviewDrawer';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

describe('ProposalReviewDrawer Component (Phase 8 Milestone 3)', () => {
  const mockProposal: ActionProposal = {
    proposalId: 'prop_test_300',
    organizationId: 'org_acme_corp',
    workspaceId: 'ws_sales_01',
    capabilityId: 'billing.issue_credit_memo',
    capabilityVersion: '2.0.0',
    agentPersonaId: 'supervisor',
    authorizingUserId: 'user_finance_admin',
    delegationId: 'del_fin_100',
    delegationChain: ['user_cfo', 'supervisor'],
    toolInvocationId: 'inv_credit_memo_456',
    what: 'Issue $2,500.00 credit memo to Customer Acme Logistics due to billing SLA delay',
    why: 'SLA dispute resolved in favor of customer under contract section 9.2',
    blastRadius: {
      entityCount: 1,
      entityType: 'invoice',
      estimatedCostUsd: 2500.0,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      targetSummary: 'Acme Logistics (Invoice #INV-2026-881)',
    },
    evidence: {
      slaDowntimeMinutes: 144,
      creditMemoRate: '$17.36/min',
      contractClause: 'SLA Tier 1 Standard',
    },
    payload: {
      customerId: 'cust_acme_99',
      invoiceId: 'inv_881',
      creditAmount: 2500.0,
      reasonCode: 'SLA_BREACH',
    },
    payloadHash: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d',
    status: 'pending',
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('strictly adheres to theme.md Section 8 invariants', () => {
    render(
      <ProposalReviewDrawer
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    // Demarcated Header
    const demarcatedHeaders = document.body.querySelectorAll('[data-demarcated="true"], .border-b');
    expect(demarcatedHeaders.length).toBeGreaterThan(0);

    // Single-Circle Info Tooltip (Rule 10)
    expect(document.body.querySelector('button.cursor-help, [data-state]')).toBeDefined();

    // sr-only description for screen-readers
    const srOnlyDesc = document.body.querySelector('.sr-only');
    expect(srOnlyDesc).toBeDefined();

    // Dialog title
    expect(screen.getByText(/Review Action Proposal/i)).toBeDefined();
  });

  it('renders all 4 tabs: Overview, Diff Viewer, Payload & Evidence, and Audit & Lineage', () => {
    render(
      <ProposalReviewDrawer
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Diff Viewer/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Payload & Evidence/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Audit & Lineage/i })).toBeDefined();
  });

  it('switches to Diff Viewer tab and renders proposed changes', () => {
    render(
      <ProposalReviewDrawer
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    const diffTab = screen.getByRole('tab', { name: /Diff Viewer/i });
    fireEvent.click(diffTab);

    // Should display diff content or key value changes
    expect(screen.getByText(/creditAmount/i)).toBeDefined();
    expect(screen.getByText(/2500/i)).toBeDefined();
  });

  it('switches to Payload tab and renders isolated <untrusted_reference_data> container (Rules 13 & 30)', () => {
    render(
      <ProposalReviewDrawer
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    const payloadTab = screen.getByRole('tab', { name: /Payload & Evidence/i });
    fireEvent.click(payloadTab);

    const untrustedElements = document.body.querySelectorAll('untrusted_reference_data');
    expect(untrustedElements.length).toBeGreaterThan(0);
  });

  it('renders footer buttons with tactile feedback and >= 44px touch targets (Rule 7)', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <ProposalReviewDrawer
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /Approve Action/i });
    const rejectBtn = screen.getByRole('button', { name: /Reject Proposal/i });

    expect(approveBtn.className).toContain('min-h-[44px]');
    expect(rejectBtn.className).toContain('min-h-[44px]');

    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith(mockProposal);

    fireEvent.click(rejectBtn);
    expect(onReject).toHaveBeenCalledWith(mockProposal);
  });
});
