/**
 * @fileOverview Unit & UI Tests for Dead-Letter Queue Operator Drawer (Phase 2 Milestone 3 - Task 5)
 *
 * Implements Rule 4 (Strict Typing), Rule 25 (DLQ Ops), Rule 61 (Operator Console),
 * and theme.md §8 Modal Architecture Invariants.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeadLetterQueueDrawer } from '@/components/activity/DeadLetterQueueDrawer';
import type { DeadLetterRecord } from '@/platform/events/storage/dead-letter-storage';

// Mock server actions
vi.mock('@/app/actions/activity-actions', () => ({
  listDeadLetterEventsAction: vi.fn(),
  replayDeadLetterEventAction: vi.fn(),
  discardDeadLetterEventAction: vi.fn(),
}));

import {
  listDeadLetterEventsAction,
  replayDeadLetterEventAction,
  discardDeadLetterEventAction,
} from '@/app/actions/activity-actions';

describe('DeadLetterQueueDrawer (Rules 4, 25, 61, theme.md §8)', () => {
  const sampleRecords: DeadLetterRecord[] = [
    {
      eventId: 'evt-dlq-1',
      event: {
        id: 'evt-dlq-1',
        type: 'deal.stage_changed',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        organizationId: 'org-test-1',
        actor: { type: 'user', id: 'usr-1' },
        entity: { type: 'deal', id: 'deal-1' },
        payload: { stage: 'Won' },
        correlationId: 'trace-1',
        source: 'crm',
      },
      attempts: 3,
      lastError: 'External HTTP gateway timed out after 30000ms',
      errorStack: 'Error: Gateway timeout\n  at fetch...',
      quarantinedAt: new Date().toISOString(),
      organizationId: 'org-test-1',
      status: 'quarantined',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quarantined records with error reason and retry/discard buttons', async () => {
    vi.mocked(listDeadLetterEventsAction).mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });

    render(
      <DeadLetterQueueDrawer
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Verify title and info tooltip
    expect(screen.getByText('Dead-Letter Queue Operator Console')).toBeDefined();

    // Verify record content
    await waitFor(() => {
      expect(screen.getByText('deal.stage_changed')).toBeDefined();
      expect(screen.getByText(/External HTTP gateway timed out/i)).toBeDefined();
      expect(screen.getByText(/Attempts: 3/i)).toBeDefined();
    });

    // Check actions exist
    expect(screen.getByRole('button', { name: /Retry Dispatch/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeDefined();

    // Verify modal architecture compliance (sr-only description)
    const srDescription = screen.getByText(/Dead-letter queue inspection and event replay operator console/i);
    expect(srDescription).toBeDefined();
    expect(srDescription.className).toContain('sr-only');
  });

  it('calls replayDeadLetterEventAction when Retry Dispatch is clicked', async () => {
    vi.mocked(listDeadLetterEventsAction).mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });
    vi.mocked(replayDeadLetterEventAction).mockResolvedValueOnce({
      success: true,
      data: { eventId: 'evt-dlq-1' },
    });

    render(
      <DeadLetterQueueDrawer
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry Dispatch/i })).toBeDefined();
    });

    const retryButton = screen.getByRole('button', { name: /Retry Dispatch/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(replayDeadLetterEventAction).toHaveBeenCalledWith({ eventId: 'evt-dlq-1' });
    });
  });

  it('calls discardDeadLetterEventAction when Discard is clicked', async () => {
    vi.mocked(listDeadLetterEventsAction).mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });
    vi.mocked(discardDeadLetterEventAction).mockResolvedValueOnce({
      success: true,
      data: { eventId: 'evt-dlq-1' },
    });

    render(
      <DeadLetterQueueDrawer
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Discard/i })).toBeDefined();
    });

    const discardButton = screen.getByRole('button', { name: /Discard/i });
    fireEvent.click(discardButton);

    await waitFor(() => {
      expect(discardDeadLetterEventAction).toHaveBeenCalledWith({
        eventId: 'evt-dlq-1',
        reason: 'Operator manual discard',
      });
    });
  });
});
