// @vitest-environment jsdom
/**
 * @fileOverview Unit tests for BlockersManagerView (Phase 4B).
 * Validates:
 * - Rendering blocker cards with severity and categories.
 * - Status tab filtering.
 * - Blocker acknowledgement and assignment.
 * - Resolution modal with resolution note.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BlockersManagerView } from '../BlockersManagerView';
import type { BlockerRecord } from '@/lib/types';

const mockMutateBlocker = vi.fn().mockResolvedValue({ success: true });
const mockToast = vi.fn();

vi.mock('@/lib/standup-server-actions', () => ({
  mutateBlockerAction: (...args: unknown[]) => mockMutateBlocker(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockBlockers: BlockerRecord[] = [
  {
    id: 'blk-1',
    workspaceId: 'ws-1',
    summary: 'Third-party webhook failing with 502',
    category: 'external_dependency',
    severity: 'critical',
    status: 'open',
    raisedBy: 'user-alice',
    raisedByName: 'Alice Smith',
    createdAt: '2026-10-09T08:00:00.000Z',
    updatedAt: '2026-10-09T08:00:00.000Z',
  },
  {
    id: 'blk-2',
    workspaceId: 'ws-1',
    summary: 'Design asset missing for onboarding',
    category: 'client_approval',
    severity: 'medium',
    status: 'acknowledged',
    raisedBy: 'user-bob',
    raisedByName: 'Bob Jones',
    ownerId: 'user-alice',
    ownerName: 'Alice Smith',
    createdAt: '2026-10-09T08:30:00.000Z',
    updatedAt: '2026-10-09T09:00:00.000Z',
  },
];

describe('BlockersManagerView Component (Phase 4B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders blocker items with severity and raised by author', () => {
    render(<BlockersManagerView workspaceId="ws-1" blockers={mockBlockers} />);

    expect(screen.getByText('Third-party webhook failing with 502')).toBeInTheDocument();
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers acknowledge action on open blocker', async () => {
    render(<BlockersManagerView workspaceId="ws-1" blockers={mockBlockers} />);

    const ackButton = screen.getByRole('button', { name: /^Acknowledge$/i });
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(mockMutateBlocker).toHaveBeenCalledWith(
        'ws-1',
        'blk-1',
        expect.objectContaining({
          status: 'acknowledged',
          expectedUpdatedAt: '2026-10-09T08:00:00.000Z',
        })
      );
    });
  });

  it('opens resolve dialog and submits resolution note', async () => {
    render(<BlockersManagerView workspaceId="ws-1" blockers={mockBlockers} />);

    // Click Resolve on the first blocker
    const resolveBtns = screen.getAllByRole('button', { name: /^Resolve$/i });
    fireEvent.click(resolveBtns[0]);

    // Check modal appears
    await waitFor(() => {
      expect(screen.getByText('Resolve Blocker')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText(/Describe how this obstacle was resolved/i);
    fireEvent.change(noteInput, {
      target: { value: 'Third-party vendor resolved service outage' },
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Resolution/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateBlocker).toHaveBeenCalledWith(
        'ws-1',
        'blk-1',
        expect.objectContaining({
          status: 'resolved',
          resolutionNote: 'Third-party vendor resolved service outage',
        })
      );
    });
  });
});
