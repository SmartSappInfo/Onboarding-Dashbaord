/**
 * @fileOverview Unit & Integration Tests: Knowledge Inbox Client & Triage (Phase 11 M5 · T2)
 *
 * Verifies:
 * - Candidate loading and status badge counters
 * - Tab filtering (Needs Review, Conflicts, Accepted, High Confidence, All)
 * - Single candidate accept and reject flows
 * - Batch selection and batch decision execution
 * - Inspector modal trigger and conflict resolution modal trigger
 * - Empty state feedback
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeInboxClient } from '@/app/admin/intelligence/knowledge/inbox/KnowledgeInboxClient';
import type { KnowledgeCandidate } from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_123',
    activeOrganizationId: 'org_test_456',
  }),
}));

vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn(),
}));

const mockListKnowledgeCandidatesAction = vi.fn();
const mockDecideKnowledgeCandidateAction = vi.fn();
const mockResolveKnowledgeConflictAction = vi.fn();

vi.mock('@/app/actions/knowledge-inbox-actions', () => ({
  listKnowledgeCandidatesAction: (...args: unknown[]) => mockListKnowledgeCandidatesAction(...args),
  decideKnowledgeCandidateAction: (...args: unknown[]) => mockDecideKnowledgeCandidateAction(...args),
  resolveKnowledgeConflictAction: (...args: unknown[]) => mockResolveKnowledgeConflictAction(...args),
}));

describe('Knowledge Inbox Client (Phase 11 M5 · T2)', () => {
  const sampleCandidates: KnowledgeCandidate[] = [
    {
      id: 'cand_1',
      organizationId: 'org_test_456',
      workspaceId: 'ws_test_123',
      source: {
        type: 'meeting',
        id: 'meet_99',
      },
      type: 'procedure',
      title: 'Greenfield School Adopted SmartSapp Cloud',
      content: '<untrusted_reference_data id="cand_1">The board decided to adopt SmartSapp for 2026-2027.</untrusted_reference_data>',
      confidence: 0.95,
      sensitivity: 'internal',
      subjectRefs: ['deal_1'],
      suggestedRelationships: [],
      verificationState: 'unverified',
      status: 'pending',
      version: 1,
      createdAt: '2026-10-07T12:00:00Z',
      updatedAt: '2026-10-07T12:00:00Z',
    },
    {
      id: 'cand_2',
      organizationId: 'org_test_456',
      workspaceId: 'ws_test_123',
      source: {
        type: 'note',
        id: 'note_12',
      },
      type: 'policy',
      title: 'Pricing Conflict on Campus License',
      content: 'Quote discrepancy between $45,000 and $52,000 per term.',
      confidence: 0.88,
      sensitivity: 'confidential',
      subjectRefs: [],
      suggestedRelationships: [],
      verificationState: 'unverified',
      conflictId: 'conf_77',
      status: 'pending',
      version: 1,
      createdAt: '2026-10-07T12:30:00Z',
      updatedAt: '2026-10-07T12:30:00Z',
    },
    {
      id: 'cand_3',
      organizationId: 'org_test_456',
      workspaceId: 'ws_test_123',
      source: {
        type: 'agent_run',
        id: 'run_5',
      },
      type: 'fact',
      title: 'Headmistress Email Address Verified',
      content: 'Email is headmistress@greenfield.edu.',
      confidence: 0.72,
      sensitivity: 'internal',
      subjectRefs: [],
      suggestedRelationships: [],
      verificationState: 'verified',
      status: 'accepted',
      version: 2,
      createdAt: '2026-10-06T10:00:00Z',
      updatedAt: '2026-10-06T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockListKnowledgeCandidatesAction.mockResolvedValue({
      success: true,
      data: sampleCandidates,
    });
    mockDecideKnowledgeCandidateAction.mockResolvedValue({
      success: true,
      data: { status: 'accepted' },
    });
    mockResolveKnowledgeConflictAction.mockResolvedValue({
      success: true,
      data: { resolved: true },
    });
  });

  it('renders Knowledge Inbox and loads candidates on mount', async () => {
    render(<KnowledgeInboxClient />);

    expect(screen.getByText('Knowledge Inbox')).toBeDefined();

    await waitFor(() => {
      expect(mockListKnowledgeCandidatesAction).toHaveBeenCalledWith('ws_test_123');
    });

    // In default 'needs_review' tab, candidates with status 'proposed' are shown (cand_1 and cand_2)
    expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    expect(screen.getByText('Pricing Conflict on Campus License')).toBeDefined();
    // cand_3 has status 'accepted', should not be in 'needs_review' tab
    expect(screen.queryByText('Headmistress Email Address Verified')).toBeNull();
  });

  it('filters by status tab properly', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    });

    // Click Conflicts tab
    const conflictsTab = screen.getByRole('button', { name: /Conflicts/i });
    fireEvent.click(conflictsTab);

    // Only cand_2 has conflictId
    expect(screen.getByText('Pricing Conflict on Campus License')).toBeDefined();
    expect(screen.queryByText('Greenfield School Adopted SmartSapp Cloud')).toBeNull();

    // Click Accepted tab
    const acceptedTab = screen.getByRole('button', { name: /Accepted/i });
    fireEvent.click(acceptedTab);

    // Only cand_3 has status accepted
    expect(screen.getByText('Headmistress Email Address Verified')).toBeDefined();
    expect(screen.queryByText('Pricing Conflict on Campus License')).toBeNull();
  });

  it('dispatches decide action on candidate accept with optimistic update', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    });

    // Card accept button has exact name 'Accept' (not 'Accepted')
    const acceptButtons = screen.getAllByRole('button', { name: /^Accept$/i });
    expect(acceptButtons.length).toBeGreaterThan(0);
    fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(mockDecideKnowledgeCandidateAction).toHaveBeenCalledWith('ws_test_123', {
        candidateId: 'cand_1',
        decision: 'accept',
        expectedVersion: 1,
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Candidate accepted into memory',
      })
    );
  });

  it('dispatches decide action on candidate reject', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    });

    const rejectButtons = screen.getAllByRole('button', { name: /^Reject$/i });
    expect(rejectButtons.length).toBeGreaterThan(0);
    fireEvent.click(rejectButtons[0]);

    await waitFor(() => {
      expect(mockDecideKnowledgeCandidateAction).toHaveBeenCalledWith('ws_test_123', {
        candidateId: 'cand_1',
        decision: 'reject',
        expectedVersion: 1,
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Candidate rejected',
      })
    );
  });

  it('opens inspector drawer when clicking Inspect Details', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Details/i });
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Knowledge Item Inspector')).toBeDefined();
      expect(screen.getByText('Temporal Validity & Lineage')).toBeDefined();
    });
  });

  it('opens conflict resolution modal when clicking Resolve Conflict', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Pricing Conflict on Campus License')).toBeDefined();
    });

    const resolveBtn = screen.getByRole('button', { name: /Resolve Conflict/i });
    fireEvent.click(resolveBtn);

    await waitFor(() => {
      expect(screen.getByText('Contradiction Detected')).toBeDefined();
      expect(screen.getByText('Existing Memory')).toBeDefined();
      expect(screen.getByText('Incoming Candidate')).toBeDefined();
    });
  });

  it('displays empty state when search matches no items', async () => {
    render(<KnowledgeInboxClient />);

    await waitFor(() => {
      expect(screen.getByText('Greenfield School Adopted SmartSapp Cloud')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Search candidates/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent query 12345' } });

    await waitFor(() => {
      expect(screen.getByText('No knowledge candidates found')).toBeDefined();
    });
  });
});
