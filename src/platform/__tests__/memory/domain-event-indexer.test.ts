/**
 * @fileOverview Unit Tests for DomainEventIndexer (Phase 4 Milestone 3)
 *
 * Verifies Rules 4, 8, 25, 26, 40, and 47.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DomainEventIndexer,
  MEMORY_INDEXER_QUEUE,
  MEMORY_INDEXER_ENDPOINT,
} from '../../memory/subscribers/domain-event-indexer';
import { createDomainEvent } from '../../capabilities/events/domain-event';

describe('DomainEventIndexer', () => {
  it('maps crm.note.created events and enqueues Cloud Tasks correctly', async () => {
    const mockSchedule = vi.fn().mockResolvedValue('task-id-123');
    const indexer = new DomainEventIndexer({
      scheduleTask: mockSchedule,
    });

    const event = createDomainEvent({
      type: 'crm.note.created',
      organizationId: 'org-test-1',
      workspaceId: 'ws-test-1',
      source: 'crm_note_action',
      correlationId: 'corr-101',
      actor: { id: 'user-77', type: 'user' },
      entity: { id: 'note-555', type: 'contact' },
      payload: {
        note: 'Customer requested a follow-up call regarding enterprise plan pricing.',
        authorName: 'Sarah Connor',
        topics: ['pricing', 'enterprise'],
      },
    });

    const result = await indexer.handleEvent(event);
    expect(result).toBe(true);
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    const [taskKey, queue, endpoint, payload] = mockSchedule.mock.calls[0];
    expect(taskKey).toContain('mem-');
    expect(queue).toBe(MEMORY_INDEXER_QUEUE);
    expect(endpoint).toBe(MEMORY_INDEXER_ENDPOINT);
    expect(payload.organizationId).toBe('org-test-1');
    expect(payload.workspaceId).toBe('ws-test-1');
    expect(payload.targets[0].sourceType).toBe('user_note');
    expect(payload.targets[0].content).toContain('Customer requested a follow-up');
    expect(payload.targets[0].topics).toContain('enterprise');
    expect(payload.correlationId).toBe('corr-101');
  });

  it('maps meeting.completed transcripts into meeting ingestion targets', async () => {
    const mockSchedule = vi.fn().mockResolvedValue('task-id-124');
    const indexer = new DomainEventIndexer({
      scheduleTask: mockSchedule,
    });

    const event = createDomainEvent({
      type: 'meeting.completed',
      organizationId: 'org-test-1',
      workspaceId: 'ws-test-1',
      source: 'zoom_sync',
      correlationId: 'corr-102',
      actor: { id: 'system', type: 'system' },
      entity: { id: 'meet-999', type: 'meeting' },
      payload: {
        title: 'Quarterly Planning Session',
        transcript: 'Speaker 1: Welcome everyone. Let us review the roadmap milestones.',
        topics: ['quarterly', 'planning'],
      },
    });

    const result = await indexer.handleEvent(event);
    expect(result).toBe(true);

    const [, , , payload] = mockSchedule.mock.calls[0];
    expect(payload.targets[0].sourceType).toBe('meeting');
    expect(payload.targets[0].title).toBe('Quarterly Planning Session');
    expect(payload.targets[0].content).toContain('Speaker 1: Welcome everyone');
  });

  it('dispatches to onDispatchInline handler when configured', async () => {
    const inlineSpy = vi.fn().mockResolvedValue(undefined);
    const indexer = new DomainEventIndexer({
      onDispatchInline: inlineSpy,
    });

    const event = createDomainEvent({
      type: 'crm.note.created',
      organizationId: 'org-test-1',
      workspaceId: 'ws-test-1',
      source: 'test',
      correlationId: 'corr-103',
      actor: { id: 'user-1', type: 'user' },
      entity: { id: 'note-1', type: 'contact' },
      payload: { note: 'Quick note' },
    });

    const result = await indexer.handleEvent(event);
    expect(result).toBe(true);
    expect(inlineSpy).toHaveBeenCalledTimes(1);
    expect(inlineSpy.mock.calls[0][0].targets[0].content).toBe('Quick note');
  });

  it('ignores unrelated domain events cleanly without error', async () => {
    const mockSchedule = vi.fn();
    const indexer = new DomainEventIndexer({
      scheduleTask: mockSchedule,
    });

    const event = createDomainEvent({
      type: 'billing.invoice.paid',
      organizationId: 'org-test-1',
      workspaceId: 'ws-test-1',
      source: 'stripe',
      correlationId: 'corr-104',
      actor: { id: 'system', type: 'system' },
      entity: { id: 'inv-123', type: 'invoice' },
      payload: { amount: 5000 },
    });

    const result = await indexer.handleEvent(event);
    expect(result).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
