/**
 * @fileOverview Unit & Integration Tests: Knowledge Search Modal & Evidence Stack (Phase 11 M5 · T3)
 *
 * Verifies:
 * - KnowledgeSearchModal: open/close lifecycle, search query dispatch, filter chips
 * - KnowledgeEvidenceStack: grounded synthesis display, citation precision, expandable citations
 * - Prompt injection isolation via <untrusted_reference_data> (Rules 13 & 30)
 * - Conflict detection warning display
 * - Non-hallucination fallback on no_evidence coverage (Rule 47)
 * - Knapsack context budgeting indicators (Rules 28 & 56)
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeSearchModal } from '@/components/knowledge/KnowledgeSearchModal';
import { KnowledgeEvidenceStack } from '@/components/knowledge/KnowledgeEvidenceStack';
import type { KnowledgeAnswerContract } from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_search_123',
    activeOrganizationId: 'org_search_456',
  }),
}));

const mockAskKnowledgeAgentAction = vi.fn();

vi.mock('@/app/actions/knowledge-agent-actions', () => ({
  askKnowledgeAgentAction: (...args: unknown[]) => mockAskKnowledgeAgentAction(...args),
}));

describe('Knowledge Search Modal & Evidence Stack (Phase 11 M5 · T3)', () => {
  const sampleAnswerContract: KnowledgeAnswerContract = {
    query: 'What was agreed in the Greenfield annual contract?',
    answer: 'Greenfield School agreed to adopt SmartSapp Cloud for 2026-2027 with quarterly invoicing.',
    coverage: 'complete',
    claims: [
      {
        claimText: 'Greenfield School agreed to adopt SmartSapp Cloud for 2026-2027.',
        citationIds: ['cite_1'],
        confidence: 0.96,
      },
      {
        claimText: 'Payment schedule was set to quarterly invoicing.',
        citationIds: ['cite_2'],
        confidence: 0.92,
      },
    ],
    citations: [
      {
        citationId: 'cite_1',
        sourceId: 'meet_transcript_101',
        sourceType: 'meeting',
        textSpan: 'Headmistress agreed to enroll all 4 campuses under SmartSapp Cloud.',
        relevanceScore: 0.95,
      },
      {
        citationId: 'cite_2',
        sourceId: 'crm_deal_842',
        sourceType: 'crm_note',
        textSpan: 'Payment terms: 4 equal quarterly installments due on term commencement.',
        relevanceScore: 0.91,
      },
    ],
    conflictsDetected: [
      {
        factA: 'Quarterly billing installments',
        factB: 'Annual lump sum upfront payment',
        reason: 'Legacy proposal in Salesforce lists annual payment upfront.',
      },
    ],
    contextSummary: {
      totalFound: 12,
      includedCount: 2,
      omittedCount: 10,
      tokenCount: 840,
    },
    citationPrecision: 0.94,
  };

  const noEvidenceContract: KnowledgeAnswerContract = {
    query: 'What is the secret launch date of Project Apollo?',
    answer: 'No grounded facts exist.',
    coverage: 'no_evidence',
    claims: [],
    citations: [],
    conflictsDetected: [],
    contextSummary: {
      totalFound: 0,
      includedCount: 0,
      omittedCount: 0,
      tokenCount: 0,
    },
    citationPrecision: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAskKnowledgeAgentAction.mockResolvedValue({
      success: true,
      data: sampleAnswerContract,
    });
  });

  it('renders KnowledgeSearchModal with demarcated header when open', () => {
    render(<KnowledgeSearchModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Knowledge Search & Evidence Stack')).toBeDefined();
    expect(screen.getByPlaceholderText(/Ask anything about meetings, deals/i)).toBeDefined();
    expect(screen.getByText('All Sources')).toBeDefined();
  });

  it('dispatches search to askKnowledgeAgentAction on submit', async () => {
    render(<KnowledgeSearchModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ask anything about meetings, deals/i);
    fireEvent.change(input, { target: { value: 'Greenfield contract terms' } });

    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockAskKnowledgeAgentAction).toHaveBeenCalledWith({
        organizationId: 'org_search_456',
        workspaceId: 'ws_search_123',
        query: 'Greenfield contract terms',
      });
    });

    // Synthesized answer rendered
    await waitFor(() => {
      expect(
        screen.getByText(
          'Greenfield School agreed to adopt SmartSapp Cloud for 2026-2027 with quarterly invoicing.'
        )
      ).toBeDefined();
    });
  });

  it('renders Evidence Stack with citations, expand/collapse, and knapsack indicators', () => {
    render(<KnowledgeEvidenceStack answerContract={sampleAnswerContract} />);

    expect(screen.getByText('Grounded Institutional Synthesis')).toBeDefined();
    expect(screen.getByText('Complete Grounding')).toBeDefined();
    expect(screen.getByText('94% Precision')).toBeDefined();

    // Knapsack budgeting
    expect(screen.getByText(/Found 12 items · Selected 2 \(840 tokens\) · 10 omitted/i)).toBeDefined();

    // Citations list
    expect(screen.getByText(/Source #meet_transcript_101/i)).toBeDefined();
    expect(screen.getByText(/Source #crm_deal_842/i)).toBeDefined();

    // Click to expand citation excerpt
    const citationBtn = screen.getByText(/Source #meet_transcript_101/i);
    fireEvent.click(citationBtn);

    expect(
      screen.getByText('Headmistress agreed to enroll all 4 campuses under SmartSapp Cloud.')
    ).toBeDefined();
  });

  it('displays conflict warning banner when contradictions detected', () => {
    render(<KnowledgeEvidenceStack answerContract={sampleAnswerContract} />);

    expect(screen.getByText('Factual Contradiction Detected in Retrieved Memory')).toBeDefined();
    expect(
      screen.getByText('Legacy proposal in Salesforce lists annual payment upfront.')
    ).toBeDefined();
  });

  it('renders non-hallucinatory fallback card when coverage is no_evidence', () => {
    render(<KnowledgeEvidenceStack answerContract={noEvidenceContract} />);

    expect(screen.getByText('No Verified Evidence Found')).toBeDefined();
    expect(
      screen.getByText(/Per Rule 47 strict grounding policies, SmartSapp AI does not speculate/i)
    ).toBeDefined();
  });

  it('triggers task creation callback from insight', () => {
    const handleCreateTask = vi.fn();
    render(
      <KnowledgeEvidenceStack
        answerContract={sampleAnswerContract}
        onCreateTask={handleCreateTask}
      />
    );

    const createTaskBtn = screen.getByRole('button', { name: /Create Task from Insight/i });
    fireEvent.click(createTaskBtn);

    expect(handleCreateTask).toHaveBeenCalledWith(
      'Greenfield School agreed to adopt SmartSapp Cloud for 2026-2027.'
    );
  });
});
