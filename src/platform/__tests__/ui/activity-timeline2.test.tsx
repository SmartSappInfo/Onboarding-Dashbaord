/**
 * @fileOverview Unit & Integration Tests for Activity Timeline 2.0 (Phase 2 Milestone 3 - Task 3 & 4)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Plain English Summaries),
 * Rule 16 (Actor Classes & Badges), Rule 39 (OpenTelemetry Tracing),
 * and theme.md §8 Modal Architecture Invariants.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivityTimeline2 } from '@/components/activity/ActivityTimeline2';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';

// Mock useEventStream hook
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn(() => ({
    status: 'connected',
    lastActivity: null,
    error: null,
    reconnect: vi.fn(),
  })),
}));

// Mock server actions
vi.mock('@/app/actions/activity-actions', () => ({
  listActivitiesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

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

    // Check summaries
    expect(screen.getByText('Sarah Connor created contact John Connor')).toBeDefined();
    expect(screen.getByText('AI SDR Agent moved deal Series A to Proposal Sent')).toBeDefined();
    expect(screen.getByText('Onboarding Drip completed task Send Welcome Packet')).toBeDefined();

    // Check actor badges
    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    expect(screen.getByText('AI (SDR)')).toBeDefined();
    expect(screen.getAllByText('Automation').length).toBeGreaterThan(0);

    // Check live stream status badge
    expect(screen.getByTestId('stream-status-badge')).toBeDefined();
    expect(screen.getByText('Live Stream')).toBeDefined();
  });

  it('filters activities when clicking actor class tabs (Rule 16)', async () => {
    render(<ActivityTimeline2 initialActivities={sampleActivities} />);

    // Click 'AI' tab
    const aiTabButton = screen.getByRole('button', { name: /AI/i });
    fireEvent.click(aiTabButton);

    // AI activity should be visible, user activity should be hidden
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

    // Click inspect on first activity
    fireEvent.click(inspectButtons[0]!);

    // Drawer should open
    await waitFor(() => {
      expect(screen.getByTestId('activity-inspect-drawer')).toBeDefined();
    });

    // Check demarcated header and title
    expect(screen.getByText('Event Audit & Trace Inspector')).toBeDefined();

    // Check correlationId is displayed
    expect(screen.getByText('trace-cor-1')).toBeDefined();
    expect(screen.getByText('trace-cau-1')).toBeDefined();

    // Check DialogDescription is present and accessible (sr-only)
    const srDescription = screen.getByText(/Detailed inspection drawer/i);
    expect(srDescription).toBeDefined();
    expect(srDescription.className).toContain('sr-only');
  });
});
