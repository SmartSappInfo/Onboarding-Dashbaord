/**
 * @fileOverview Unit & UI Tests for Global Activity Page & Legacy Alias (Phase 2 Milestone 3 - Task 6)
 *
 * Implements Rule 1 (Zero Regressions), Rule 4 (Strict Typing), Rule 10 (Inline Docs),
 * Rule 47 (Multi-Tenant Isolation), Rule 61 (Operator Console), and Rule 69 (Backward Compatibility).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GlobalActivityClient } from '@/app/admin/activity/GlobalActivityClient';
import GlobalActivityPage, { metadata as activityMetadata } from '@/app/admin/activity/page';
import ActivitiesPage, { metadata as legacyMetadata } from '@/app/admin/activities/page';

// Mock workspace context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws-test-123',
    activeOrganizationId: 'org-test-456',
  }),
}));

// Mock server actions
vi.mock('@/app/actions/activity-actions', () => ({
  listActivitiesAction: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  listDeadLetterEventsAction: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        eventId: 'evt-dlq-test-1',
        event: {
          id: 'evt-dlq-test-1',
          type: 'deal.stage_changed',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          organizationId: 'org-test-456',
          actor: { type: 'user', id: 'usr-1' },
          entity: { type: 'deal', id: 'deal-1' },
          payload: {},
          correlationId: 'trace-dlq-1',
          source: 'crm',
        },
        attempts: 3,
        lastError: 'HTTP 504 Gateway Timeout',
        quarantinedAt: new Date().toISOString(),
        organizationId: 'org-test-456',
        status: 'quarantined',
      },
    ],
  }),
  replayDeadLetterEventAction: vi.fn(),
  discardDeadLetterEventAction: vi.fn(),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    events: [],
    isConnected: true,
    error: null,
  }),
}));

describe('Global Activity Dashboard & Legacy Route (Rules 1, 4, 61, 69)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Three-Zone layout with live status indicator and DLQ console trigger', async () => {
    render(<GlobalActivityClient />);

    // Zone 1: Header & Live indicator
    expect(screen.getByText('Global Activity & Audit Console')).toBeDefined();
    expect(screen.getByText('Live Feed')).toBeDefined();

    // Zone 1: DLQ trigger button
    const dlqButton = screen.getByRole('button', {
      name: /Open Dead-Letter Queue Operator Console/i,
    });
    expect(dlqButton).toBeDefined();

    // Await DLQ count badge
    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined(); // 1 quarantined record
    });

    // Zone 2: Actor filter buttons (All, Human, AI, Automation, System)
    expect(screen.getByRole('button', { name: /^All$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Human/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /AI/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Automation/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /System/i })).toBeDefined();
  });

  it('opens DeadLetterQueueDrawer when operator clicks DLQ Console button', async () => {
    render(<GlobalActivityClient />);

    const dlqButton = screen.getByRole('button', {
      name: /Open Dead-Letter Queue Operator Console/i,
    });
    fireEvent.click(dlqButton);

    await waitFor(() => {
      expect(screen.getByText('Dead-Letter Queue Operator Console')).toBeDefined();
      expect(screen.getByText('HTTP 504 Gateway Timeout')).toBeDefined();
    });
  });

  it('verifies /admin/activity page export and metadata', async () => {
    expect(activityMetadata.title).toBe('Global Activity & Audit Console');
    await act(async () => {
      render(<GlobalActivityPage />);
    });
    expect(screen.getByText('Global Activity & Audit Console')).toBeDefined();
  });

  it('verifies /admin/activities legacy route forwards to GlobalActivityClient (Rule 1, Rule 69)', async () => {
    expect(legacyMetadata.title).toBe('Platform Audit Trail');
    await act(async () => {
      render(<ActivitiesPage />);
    });
    expect(screen.getByText('Global Activity & Audit Console')).toBeDefined();
  });
});
