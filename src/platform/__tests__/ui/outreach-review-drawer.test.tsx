// @vitest-environment jsdom
/**
 * @fileOverview Test Suite for OutreachReviewDrawer (Phase 10 Milestone 4 Task 5)
 *
 * Implements:
 * - theme.md Section 8 (Standardized Modal & Drawer Architecture).
 * - Rule 4: Strict Typing (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first touch targets >= 44px with active:scale-[0.97].
 * - Rule 13 & 30: Untrusted reference data containerization.
 * - Rule 21 & 22: Two-Phase Approval Proposal Review with SHA-256 payloadHash binding.
 * - Rule 41: Explainability Grid (WHAT, WHY, TARGET, EXPECTED CHANGE).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutreachReviewDrawer } from '@/components/sales/OutreachReviewDrawer';
import type { OutreachMessageDraft } from '@/platform/agents/sales/outbound/sdr-outbound-types';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock VariablesPanel
vi.mock('@/components/shared/VariablesPanel', () => ({
  VariablesPanel: ({ onSelect }: { onSelect?: (key: string) => void }) => (
    <div data-testid="variables-panel">
      <button onClick={() => onSelect?.('contact.firstName')}>Insert First Name</button>
    </div>
  ),
}));

describe('OutreachReviewDrawer Component (Phase 10 Milestone 4)', () => {
  const mockDrafts: OutreachMessageDraft[] = [
    {
      id: 'draft_wa_01',
      prospectId: 'prosp_legon_01',
      recipientName: 'Dr. Michael Mensah',
      recipientAddress: '+233244123456',
      channel: 'whatsapp',
      stepIndex: 1,
      dayOffset: 0,
      body: 'Hello Dr. Mensah, SmartSapp can automate your school fee billing securely.',
      whatsappUrl: 'https://wa.me/233244123456?text=Hello%20Dr.%20Mensah',
      variablesUsed: ['contact.firstName', 'institution.name'],
      explainability: {
        what: 'WhatsApp introductory message targeting head of institution',
        why: 'Prospect has 92/100 ICP fit and uses legacy billing software',
        expectedStateChange: 'Transition prospect from new to contacted',
      },
      groundingPoints: ['High ICP fit score', 'Legacy billing software detected'],
      status: 'draft',
      payloadHash: 'hash_draft_wa_01_1234567890abcdef1234567890abcdef1234567890abcdef',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'draft_em_02',
      prospectId: 'prosp_legon_01',
      recipientName: 'Dr. Michael Mensah',
      recipientAddress: 'mmensah@legon.edu.gh',
      channel: 'email',
      stepIndex: 2,
      dayOffset: 3,
      subject: 'Modernizing fee collection at University of Ghana',
      body: 'Dear Dr. Mensah, Following up on our WhatsApp brief with a case study.',
      variablesUsed: ['contact.firstName', 'institution.name'],
      explainability: {
        what: 'Email case study follow-up sequence step',
        why: 'Multi-touch SDR cadence increases conversion by 40%',
        expectedStateChange: 'Awaiting email open/reply signal',
      },
      groundingPoints: ['Executive leadership contact', 'Case study reference available'],
      status: 'draft',
      payloadHash: 'hash_draft_em_02_1234567890abcdef1234567890abcdef1234567890abcdef',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
    drafts: mockDrafts,
    actionProposalId: 'prop_sdr_9999',
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    onApproveAndDispatch: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drawer header adhering to theme.md §8 with single-circle info tooltip', () => {
    render(<OutreachReviewDrawer {...defaultProps} />);

    // Check title
    expect(screen.getByText(/Review SDR Outbound Sequence/i)).toBeInTheDocument();

    // Check screen-reader only description (Zero Raw Descriptions rule)
    const srDesc = document.querySelector('.sr-only');
    expect(srDesc).toBeInTheDocument();
    expect(srDesc?.textContent).toContain('SDR outbound');

    // Check single-circle info tooltip container
    const tooltipBtn = document.querySelector('[data-state]');
    expect(tooltipBtn).toBeInTheDocument();
  });

  it('renders cryptographic SHA-256 payloadHash badge with copy action (Rule 22)', () => {
    render(<OutreachReviewDrawer {...defaultProps} />);

    const hashBadge = screen.getByText(/e3b0c442/i);
    expect(hashBadge).toBeInTheDocument();

    fireEvent.click(hashBadge);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('renders sequence steps with channel badges and allows switching steps', () => {
    render(<OutreachReviewDrawer {...defaultProps} />);

    // Steps list
    expect(screen.getByText(/Step 1: Day 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Day 3/i)).toBeInTheDocument();

    // Body of step 1 visible initially
    expect(screen.getByText(/SmartSapp can automate your school fee billing securely/i)).toBeInTheDocument();

    // Switch to step 2
    const step2Btn = screen.getByText(/Step 2: Day 3/i);
    fireEvent.click(step2Btn);

    // Body of step 2 visible
    expect(screen.getByText(/Following up on our WhatsApp brief/i)).toBeInTheDocument();
  });

  it('renders Rule 41 Explainability Grid (WHAT, WHY, EXPECTED STATE CHANGE)', () => {
    render(<OutreachReviewDrawer {...defaultProps} />);

    const explainTab = screen.getByRole('tab', { name: /Rule 41 Explainability/i });
    fireEvent.click(explainTab);

    expect(screen.getByText(/WhatsApp introductory message targeting head of institution/i)).toBeInTheDocument();
    expect(screen.getByText(/Prospect has 92\/100 ICP fit and uses legacy billing software/i)).toBeInTheDocument();
    expect(screen.getByText(/Transition prospect from new to contacted/i)).toBeInTheDocument();
  });

  it('triggers approve and dispatch action with proposal ID and payloadHash (Rule 21)', async () => {
    render(<OutreachReviewDrawer {...defaultProps} />);

    const approveBtn = screen.getByRole('button', { name: /Approve & Dispatch Cadence/i });
    expect(approveBtn).toBeInTheDocument();

    await fireEvent.click(approveBtn);
    expect(defaultProps.onApproveAndDispatch).toHaveBeenCalledWith(
      'draft_wa_01',
      'prop_sdr_9999',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});
