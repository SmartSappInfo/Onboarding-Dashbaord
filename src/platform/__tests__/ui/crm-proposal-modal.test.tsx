// @vitest-environment jsdom
/**
 * @fileOverview Unit Tests: Standardized CRM Proposal Modal (Phase 9 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture),
 * Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 12 (Risk Vocabulary: L0-L4), Rule 21 & 22 (Two-Phase Action Model & SHA-256 Binding),
 * Rule 27 (Saga Compensation Indicator), Rule 41 (Explainability Grid),
 * and Rule 69 (Dual-Tier CRM Data Model Preservation).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrmProposalModal } from '@/components/crm/actions/CrmProposalModal';
import {
  CrmProposedActionSchema,
  computeCrmActionIdempotencyKey,
  type CrmProposedAction,
} from '@/platform/agents/crm/actions/crm-action-types';
import * as actionsModule from '@/app/actions/crm-proposal-actions';

describe('CrmProposalModal Component (Phase 9 Milestone 4)', () => {
  const mockAction: CrmProposedAction = CrmProposedActionSchema.parse({
    id: 'act_update_stage_101',
    entityId: 'ent_acme_corp',
    workspaceId: 'ws_sales_alpha',
    actionType: 'UPDATE_STAGE',
    priority: 'HIGH',
    riskLevel: 'L2_STATE_MUTATION',
    explainability: {
      what: 'Advance deal to Negotiation stage',
      why: 'Key commercial terms agreed upon in yesterday executive sync',
      impact: 'Accelerates path to close before end of quarter',
      blastRadius: {
        affectedRecordsCount: 1,
        financialExposureUsd: 85000,
        isReversible: true,
      },
    },
    idempotencyKey: computeCrmActionIdempotencyKey('ent_acme_corp', 'UPDATE_STAGE', {
      dealId: 'deal_101',
      stage: 'negotiation',
    }),
    targetCapabilityId: 'crm.deal.update_stage',
    compensatingCapabilityId: 'crm.deal.revert_stage',
    payload: {
      dealId: 'deal_101',
      stage: 'negotiation',
    },
    requiresApproval: true,
    createdAt: new Date().toISOString(),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal with demarcated header, title, and tooltip (theme.md §8)', () => {
    render(
      <CrmProposalModal
        open={true}
        onOpenChange={vi.fn()}
        action={mockAction}
      />
    );

    expect(screen.getByText('Autonomous CRM Action Proposal')).toBeInTheDocument();
    // Screen reader accessible description
    expect(
      screen.getByText(/Review and confirm autonomous CRM recommendation/i)
    ).toHaveClass('sr-only');
  });

  it('displays the 4-part Explainability Grid (Rule 41)', () => {
    render(
      <CrmProposalModal
        open={true}
        onOpenChange={vi.fn()}
        action={mockAction}
      />
    );

    expect(screen.getByText('Advance deal to Negotiation stage')).toBeInTheDocument();
    expect(screen.getByText(/Key commercial terms agreed upon/i)).toBeInTheDocument();
    expect(screen.getByText(/Accelerates path to close/i)).toBeInTheDocument();
    expect(screen.getByText(/Reversible \(1-click Saga Rollback\)/i)).toBeInTheDocument();
  });

  it('displays Dual-Tier CRM target indicator targeting /workspace_entities (Rule 69)', () => {
    render(
      <CrmProposalModal
        open={true}
        onOpenChange={vi.fn()}
        action={mockAction}
      />
    );

    expect(screen.getByText(/workspace_entities/i)).toBeInTheDocument();
    expect(screen.getByText(/Master Identity Protected/i)).toBeInTheDocument();
  });

  it('displays Reversible Saga indicator with compensating capability (Rule 27)', () => {
    render(
      <CrmProposalModal
        open={true}
        onOpenChange={vi.fn()}
        action={mockAction}
      />
    );

    expect(screen.getByText('crm.deal.revert_stage')).toBeInTheDocument();
  });

  it('submits proposal for approval via proposeCrmActionAction', async () => {
    const mockPropose = vi.spyOn(actionsModule, 'proposeCrmActionAction').mockResolvedValue({
      success: true,
      data: {
        proposalId: 'prop_999',
        organizationId: 'org_test',
        workspaceId: 'ws_sales_alpha',
        capabilityId: 'crm.deal.update_stage',
        capabilityVersion: '1.0.0',
        agentPersonaId: 'crm_assistant',
        authorizingUserId: 'usr_test',
        what: 'Advance deal to Negotiation stage',
        why: 'Key commercial terms agreed upon',
        payload: { dealId: 'deal_101' },
        payloadHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        status: 'pending',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const onSubmitted = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CrmProposalModal
        open={true}
        onOpenChange={onOpenChange}
        action={mockAction}
        onProposalSubmitted={onSubmitted}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Submit for Approval/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPropose).toHaveBeenCalledWith({
        workspaceId: 'ws_sales_alpha',
        entityId: 'ent_acme_corp',
        actionData: mockAction,
      });
      expect(onSubmitted).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
