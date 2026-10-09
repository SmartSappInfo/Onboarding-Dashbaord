/**
 * @fileOverview Consolidated UI Tests for Global Activity, Activity Timeline 2.0,
 * and Dead-Letter Queue Operator Drawer (Phase 2 Milestone 3).
 *
 * Implements Rule 1 (Zero Regressions), Rule 4 (Strict Typing), Rule 7 (Plain English Summaries),
 * Rule 10 (Inline Docs), Rule 16 (Actor Classes & Badges), Rule 25 (DLQ Ops),
 * Rule 39 (OpenTelemetry Tracing), Rule 47 (Multi-Tenant Isolation), Rule 61 (Operator Console),
 * Rule 69 (Backward Compatibility), and theme.md §8 Modal Architecture Invariants.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GlobalActivityClient } from '@/app/admin/activity/GlobalActivityClient';
import GlobalActivityPage, { metadata as activityMetadata } from '@/app/admin/activity/page';
import ActivitiesPage, { metadata as legacyMetadata } from '@/app/admin/activities/page';
import { ActivityTimeline2 } from '@/components/activity/ActivityTimeline2';
import { DeadLetterQueueDrawer } from '@/components/activity/DeadLetterQueueDrawer';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';
import type { DeadLetterRecord } from '@/platform/events/storage/dead-letter-storage';

// Mock workspace context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws-test-123',
    activeOrganizationId: 'org-test-456',
  }),
}));

// Mock server actions
const mockListActivitiesAction = vi.fn().mockResolvedValue({ success: true, data: [] });
const mockListDeadLetterEventsAction = vi.fn();
const mockReplayDeadLetterEventAction = vi.fn();
const mockDiscardDeadLetterEventAction = vi.fn();

vi.mock('@/app/actions/activity-actions', () => ({
  listActivitiesAction: (...args: unknown[]) => mockListActivitiesAction(...args),
  listDeadLetterEventsAction: (...args: unknown[]) => mockListDeadLetterEventsAction(...args),
  replayDeadLetterEventAction: (...args: unknown[]) => mockReplayDeadLetterEventAction(...args),
  discardDeadLetterEventAction: (...args: unknown[]) => mockDiscardDeadLetterEventAction(...args),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    events: [],
    status: 'connected',
    isConnected: true,
    lastActivity: null,
    error: null,
    reconnect: vi.fn(),
  }),
}));

/* ==============================================================================
 * 1. Global Activity Dashboard & Legacy Route
 * ============================================================================== */
describe('Global Activity Dashboard & Legacy Route (Rules 1, 4, 61, 69)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDeadLetterEventsAction.mockResolvedValue({
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
    });
  });

  it('renders Three-Zone layout with live status indicator and DLQ console trigger', async () => {
    render(<GlobalActivityClient />);

    expect(screen.getByText('Global Activity & Audit Console')).toBeDefined();
    expect(screen.getByText('Live Feed')).toBeDefined();

    const dlqButton = screen.getByRole('button', {
      name: /Open Dead-Letter Queue Operator Console/i,
    });
    expect(dlqButton).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined();
    });

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

/* ==============================================================================
 * 2. ActivityTimeline2 & ActivityInspectDrawer
 * ============================================================================== */
describe('ActivityTimeline2 & ActivityInspectDrawer (Rules 4, 7, 16, theme.md §8)', () => {
  const sampleActivities: ActivityRecordV2[] = [
    {
      id: 'act-1',
      eventId: 'evt-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      timestamp: new Date().toISOString(),
      eventType: 'crm.contact.created',
      actor: { type: 'user', id: 'usr-1', displayName: 'Sarah Connor' },
      entity: { type: 'contact', id: 'cnt-1', name: 'John Connor' },
      summary: 'Sarah Connor created contact John Connor',
      details: { role: 'Leader' },
      metadata: {},
      correlationId: 'trace-cor-1',
      causationId: 'trace-cau-1',
    },
    {
      id: 'act-2',
      eventId: 'evt-2',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      timestamp: new Date().toISOString(),
      eventType: 'deal.stage_changed',
      actor: { type: 'agent', id: 'agt-1', displayName: 'AI SDR Agent', agentRole: 'SDR' },
      entity: { type: 'deal', id: 'deal-1', name: 'Series A' },
      summary: 'AI SDR Agent moved deal Series A to Proposal Sent',
      details: { stage: 'Proposal Sent' },
      metadata: {},
      correlationId: 'trace-cor-2',
    },
    {
      id: 'act-3',
      eventId: 'evt-3',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      timestamp: new Date().toISOString(),
      eventType: 'task.completed',
      actor: { type: 'automation', id: 'auto-1', displayName: 'Onboarding Drip' },
      entity: { type: 'task', id: 'task-1', name: 'Send Welcome Packet' },
      summary: 'Onboarding Drip completed task Send Welcome Packet',
      details: {},
      metadata: {},
      correlationId: 'trace-cor-3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders activity feed items with actor class badges and plain English summaries (Rule 7, 16)', () => {
    render(<ActivityTimeline2 initialActivities={sampleActivities} />);

    expect(screen.getByText('Sarah Connor created contact John Connor')).toBeDefined();
    expect(screen.getByText('AI SDR Agent moved deal Series A to Proposal Sent')).toBeDefined();
    expect(screen.getByText('Onboarding Drip completed task Send Welcome Packet')).toBeDefined();

    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    expect(screen.getByText('AI (SDR)')).toBeDefined();
    expect(screen.getAllByText('Automation').length).toBeGreaterThan(0);

    expect(screen.getByTestId('stream-status-badge')).toBeDefined();
    expect(screen.getByText('Live Stream')).toBeDefined();
  });

  it('filters activities when clicking actor class tabs (Rule 16)', async () => {
    render(<ActivityTimeline2 initialActivities={sampleActivities} />);

    const aiTabButton = screen.getByRole('button', { name: /AI/i });
    fireEvent.click(aiTabButton);

    expect(screen.getByText('AI SDR Agent moved deal Series A to Proposal Sent')).toBeDefined();
    expect(screen.queryByText('Sarah Connor created contact John Connor')).toBeNull();
    expect(screen.queryByText('Onboarding Drip completed task Send Welcome Packet')).toBeNull();
  });

  it('filters activities based on search input', async () => {
    render(<ActivityTimeline2 initialActivities={sampleActivities} />);

    const searchInput = screen.getByPlaceholderText(/Search activity/i);
    fireEvent.change(searchInput, { target: { value: 'Welcome Packet' } });

    expect(screen.getByText('Onboarding Drip completed task Send Welcome Packet')).toBeDefined();
    expect(screen.queryByText('Sarah Connor created contact John Connor')).toBeNull();
  });

  it('opens Inspect Drawer adhering to theme.md §8 Modal Architecture when Inspect is clicked', async () => {
    render(<ActivityTimeline2 initialActivities={sampleActivities} />);

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);

    fireEvent.click(inspectButtons[0]!);

    await waitFor(() => {
      expect(screen.getByTestId('activity-inspect-drawer')).toBeDefined();
    });

    expect(screen.getByText('Event Audit & Trace Inspector')).toBeDefined();
    expect(screen.getByText('trace-cor-1')).toBeDefined();
    expect(screen.getByText('trace-cau-1')).toBeDefined();

    const srDescription = screen.getByText(/Detailed inspection drawer/i);
    expect(srDescription).toBeDefined();
    expect(srDescription.className).toContain('sr-only');
  });
});

/* ==============================================================================
 * 3. DeadLetterQueueDrawer
 * ============================================================================== */
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
    mockListDeadLetterEventsAction.mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });

    render(
      <DeadLetterQueueDrawer
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Dead-Letter Queue Operator Console')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('deal.stage_changed')).toBeDefined();
      expect(screen.getByText(/External HTTP gateway timed out/i)).toBeDefined();
      expect(screen.getByText(/Attempts: 3/i)).toBeDefined();
    });

    expect(screen.getByRole('button', { name: /Retry Dispatch/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeDefined();

    const srDescription = screen.getByText(/Dead-letter queue inspection and event replay operator console/i);
    expect(srDescription).toBeDefined();
    expect(srDescription.className).toContain('sr-only');
  });

  it('calls replayDeadLetterEventAction when Retry Dispatch is clicked', async () => {
    mockListDeadLetterEventsAction.mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });
    mockReplayDeadLetterEventAction.mockResolvedValueOnce({
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
      expect(mockReplayDeadLetterEventAction).toHaveBeenCalledWith({ eventId: 'evt-dlq-1' });
    });
  });

  it('calls discardDeadLetterEventAction when Discard is clicked', async () => {
    mockListDeadLetterEventsAction.mockResolvedValueOnce({
      success: true,
      data: sampleRecords,
    });
    mockDiscardDeadLetterEventAction.mockResolvedValueOnce({
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
      expect(mockDiscardDeadLetterEventAction).toHaveBeenCalledWith({
        eventId: 'evt-dlq-1',
        reason: 'Operator manual discard',
      });
    });
  });
});
