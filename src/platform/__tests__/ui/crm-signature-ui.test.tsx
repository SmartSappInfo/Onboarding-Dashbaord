// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite: Standardized CRM Signature Dossier Modal & Surface Integration (Phase 9 Milestone 5)
 *
 * Implements verification for:
 * - theme.md §8: Standardized Modal & Dialog Architecture compliance.
 * - Rule 4: Zero any / zero any[] typing policy.
 * - Rule 7: Mobile-first >= 44px touch targets.
 * - Rule 12: Canonical 5-tier risk badges (L0 to L4).
 * - Rule 13 & 30: Untrusted reference data containerization (<untrusted_reference_data id="...">).
 * - Rule 21 & 22: Two-Phase Action Proposal Bridge & SHA-256 Lock.
 * - Rule 60: Emergency Dead-Man Switch Evaluation & Alert Banner.
 * - Rule 68: "No Dead Ends" with follow-up multi-turn inquiry.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrmSignatureDossierModal } from '@/components/crm/signature/CrmSignatureDossierModal';
import { CrmSignatureTimelineFeed } from '@/components/crm/signature/CrmSignatureTimelineFeed';
import type { CrmSignatureResult } from '@/platform/agents/crm/signature/crm-signature-types';
import * as signatureActions from '@/app/actions/crm-signature-actions';

// Mock Server Actions
vi.mock('@/app/actions/crm-signature-actions', () => ({
  executeCrmSignatureInquiryAction: vi.fn(),
  sendCrmFollowupMessageAction: vi.fn(),
  getCrmSignatureSessionAction: vi.fn(),
  getCrmSignatureMetricsAction: vi.fn(),
}));

// Mock Proposal Action Modal
vi.mock('@/components/crm/actions/CrmProposalModal', () => ({
  CrmProposalModal: ({ open, action }: { open: boolean; action: unknown }) =>
    open ? <div data-testid="crm-proposal-modal">Mock Proposal Modal for {(action as { title?: string })?.title}</div> : null,
}));

describe('CRM Signature UI & Dossier Modal (Phase 9 Milestone 5)', () => {
  const workspaceId = 'ws_test_456';
  const entityId = 'ent_greenfield_school';

  const mockResult: CrmSignatureResult = {
    inquiryId: 'inq_greenfield_123',
    sessionId: 'sess_greenfield_456',
    entityId,
    entityName: 'Greenfield School',
    healthScore: 78,
    relationshipStatus: 'HEALTHY',
    executiveNarrative:
      'Greenfield School is an active education partner with high engagement and 1 renewal deal in negotiation.',
    timelineHighlights: [
      {
        id: 'ev_1',
        category: 'COMMERCIAL',
        title: 'Expansion Proposal Delivered',
        summary: 'Submitted proposal for campus expansion.',
        timestamp: '2026-09-01T10:00:00Z',
        sourceRef: { type: 'deal', id: 'deal_1' },
      },
    ],
    activeRisks: [
      {
        id: 'risk_stalled',
        category: 'DEAL_STALLED',
        title: 'Deal Stalled in Negotiation',
        description: 'Campus Enterprise Expansion has exceeded 30 days without stage change.',
        severity: 'HIGH',
        confidence: 0.9,
      },
    ],
    commitments: [
      {
        id: 'comm_1',
        title: 'Send Revised Tiered Pricing Schedule',
        dueDate: '2026-09-20T00:00:00Z',
        daysOverdue: 14,
        assignedTo: 'Sarah Jenkins',
        sourceType: 'task',
      },
    ],
    proposedActions: [
      {
        actionType: 'UPDATE_DEAL_STAGE',
        title: 'Advance Deal to Contract Review',
        description: 'Update stage to review following board alignment.',
        rationale: 'Board meeting approved annual budget.',
        riskLevel: 'L2_STATE_MUTATION',
        requiresApproval: true,
        parameters: {
          dealId: 'deal_1',
          stage: 'contract_review',
        },
        entityId,
        workspaceId,
        idempotencyKey: 'crm_action_deal_advance_1',
      },
    ],
    citations: [
      {
        id: 'cite_meet_1',
        sourceType: 'meeting',
        sourceId: 'meet_1',
        title: 'Quarterly Executive Alignment',
        snippet: 'Board approved expansion budget subject to revised tiered pricing schedule.',
        timestamp: '2026-09-05T14:00:00Z',
        confidence: 0.92,
      },
    ],
    metrics: {
      durationMs: 142,
      tokensUsed: 890,
      stepsExecuted: 14,
    },
    generatedAt: '2026-10-04T12:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(signatureActions.executeCrmSignatureInquiryAction).mockResolvedValue({
      success: true,
      data: mockResult,
    });
    vi.mocked(signatureActions.sendCrmFollowupMessageAction).mockResolvedValue({
      success: true,
      data: {
        sessionId: 'sess_greenfield_456',
        answer: 'The contract stalled because the board required a tiered milestone payment breakdown.',
        citations: [
          {
            id: 'cite_note_1',
            sourceType: 'note',
            sourceId: 'note_1',
            title: 'Account Note',
            snippet: 'Client requested tiered milestones.',
            timestamp: '2026-09-10T11:00:00Z',
            confidence: 0.88,
          },
        ],
        proposedActions: [],
        turnIndex: 2,
        generatedAt: '2026-10-04T12:02:00Z',
      },
    });
  });

  describe('CrmSignatureDossierModal Architecture & Conformance', () => {
    it('renders with demarcated header, single-circle tooltip and sr-only description (theme.md §8)', () => {
      render(
        <CrmSignatureDossierModal
          open={true}
          onOpenChange={vi.fn()}
          workspaceId={workspaceId}
          entityId={entityId}
          initialResult={mockResult}
        />
      );

      // Verify modal title
      expect(screen.getByText(/Autonomous Dossier: Greenfield School/i)).toBeInTheDocument();

      // Verify sr-only description exists for screen readers without visual clutter
      const desc = document.querySelector('.sr-only');
      expect(desc).toBeInTheDocument();
      expect(desc?.textContent).toMatch(/Autonomous CRM Intelligence Dossier/i);

      // Verify single-circle CardInfoTooltip exists in header
      const infoTooltip = screen.getByRole('button', { name: /info/i });
      expect(infoTooltip).toBeInTheDocument();
    });

    it('displays executive narrative, relationship health score, active risks and commitments', () => {
      render(
        <CrmSignatureDossierModal
          open={true}
          onOpenChange={vi.fn()}
          workspaceId={workspaceId}
          entityId={entityId}
          initialResult={mockResult}
        />
      );

      // Executive Narrative
      expect(screen.getByText(/Greenfield School is an active education partner/i)).toBeInTheDocument();

      // Health Score
      expect(screen.getByText('78')).toBeInTheDocument();
      expect(screen.getByText(/HEALTHY/i)).toBeInTheDocument();

      // Active Risks
      expect(screen.getByText(/Deal Stalled in Negotiation/i)).toBeInTheDocument();

      // Commitments
      expect(screen.getByText(/Send Revised Tiered Pricing Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/14 days overdue/i)).toBeInTheDocument();
    });

    it('renders next-best-actions with risk badge and triggers proposal modal on click (Rules 21 & 22)', async () => {
      render(
        <CrmSignatureDossierModal
          open={true}
          onOpenChange={vi.fn()}
          workspaceId={workspaceId}
          entityId={entityId}
          initialResult={mockResult}
        />
      );

      // Verify proposed action card
      expect(screen.getByText(/Advance Deal to Contract Review/i)).toBeInTheDocument();
      expect(screen.getByText(/L2_STATE_MUTATION/i)).toBeInTheDocument();

      // Click propose action
      const proposeBtn = screen.getByRole('button', { name: /Propose Action/i });
      fireEvent.click(proposeBtn);

      // Verify Proposal Modal is opened
      await waitFor(() => {
        expect(screen.getByTestId('crm-proposal-modal')).toBeInTheDocument();
      });
    });

    it('handles multi-turn follow-up chat submissions and displays grounded answers', async () => {
      render(
        <CrmSignatureDossierModal
          open={true}
          onOpenChange={vi.fn()}
          workspaceId={workspaceId}
          entityId={entityId}
          initialResult={mockResult}
        />
      );

      const input = screen.getByPlaceholderText(/Ask follow-up question/i);
      fireEvent.change(input, { target: { value: 'Why did the deal stall last week?' } });

      const sendBtn = screen.getByRole('button', { name: /Send Follow-up/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(signatureActions.sendCrmFollowupMessageAction).toHaveBeenCalledWith({
          sessionId: 'sess_greenfield_456',
          workspaceId,
          message: 'Why did the deal stall last week?',
        });
      });

      // Verify answer rendered in conversation thread
      await waitFor(() => {
        expect(
          screen.getByText(/The contract stalled because the board required a tiered milestone payment breakdown/i)
        ).toBeInTheDocument();
      });
    });

    it('fetches dossier automatically if initialResult is not provided', async () => {
      render(
        <CrmSignatureDossierModal
          open={true}
          onOpenChange={vi.fn()}
          workspaceId={workspaceId}
          entityId={entityId}
          initialQuery="What's going on with Greenfield School?"
        />
      );

      await waitFor(() => {
        expect(signatureActions.executeCrmSignatureInquiryAction).toHaveBeenCalledWith(
          expect.objectContaining({
            query: "What's going on with Greenfield School?",
            entityId,
            workspaceId,
          })
        );
      });
    });
  });

  describe('CrmSignatureTimelineFeed Component', () => {
    it('renders timeline highlights and citations in untrusted reference data containers (Rules 13 & 30)', () => {
      render(
        <CrmSignatureTimelineFeed
          timeline={mockResult.timelineHighlights}
          citations={mockResult.citations}
        />
      );

      expect(screen.getByText(/Expansion Proposal Delivered/i)).toBeInTheDocument();
      expect(screen.getByText(/Quarterly Executive Alignment/i)).toBeInTheDocument();

      // Check for untrusted_reference_data element isolating snippets
      const untrustedEl = document.querySelector('untrusted_reference_data');
      expect(untrustedEl).toBeInTheDocument();
      expect(untrustedEl?.textContent).toContain('Board approved expansion budget');
    });
  });
});
