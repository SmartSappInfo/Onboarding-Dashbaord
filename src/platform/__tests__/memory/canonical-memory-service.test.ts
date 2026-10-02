import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalMemoryService } from '@/platform/memory/services/canonical-memory-service';
import { MemoryVectorStore } from '@/platform/memory/adapters/memory-vector-store';
import { defaultEventBus } from '@/platform/events/event-bus';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('CanonicalMemoryService: Strangler Layer, Temporal Decay & Dead-Man Switch (Rules 21, 29, 40, 60, 69)', () => {
  let vectorStore: MemoryVectorStore;
  let service: CanonicalMemoryService;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    defaultEventBus.clear();
    vectorStore = new MemoryVectorStore();
    service = new CanonicalMemoryService({ vectorStore });
  });

  it('creates canonical memory item, indexes vector, and emits domain event (Rule 40)', async () => {
    let capturedEvent: unknown = null;
    defaultEventBus.subscribe('memory.item.created', (event) => {
      capturedEvent = event;
    });

    const memory = await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'insight',
      title: 'Tuition Payment Schedule',
      content: 'Parents requested split payments in three tranches.',
      source: { type: 'meeting', sourceId: 'meet-101' },
      provenance: { createdBy: 'agent', agentId: 'agent-sdr' },
      topics: ['tuition', 'finance'],
    });

    expect(memory.id).toBeDefined();
    expect(memory.lifecycle.status).toBe('active');
    expect(capturedEvent).toBeDefined();
    expect((capturedEvent as { type: string }).type).toBe('memory.item.created');
  });

  it('fails closed when emergency dead-man pause switch is active (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    await expect(
      service.createMemoryItem({
        organizationId: 'org-test',
        workspaceId: 'ws-test',
        tier: 'semantic',
        type: 'insight',
        content: 'New memory while emergency pause is active.',
        source: { type: 'meeting', sourceId: 'm-1' },
        provenance: { createdBy: 'agent' },
      })
    ).rejects.toThrow('MEMORY_DEAD_MAN_PAUSED');
  });

  it('calculates temporal decay and filters expired memories (Rule 29)', async () => {
    // 1. Expired memory
    await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'fact',
      content: 'Temporary promotion expires today.',
      source: { type: 'user_note', sourceId: 'note-1' },
      provenance: { createdBy: 'user', userId: 'user-1' },
      validUntil: '2020-01-01T00:00:00.000Z', // In the past
    });

    // 2. Active memory
    await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'fact',
      content: 'Permanent school curriculum policy.',
      source: { type: 'document', sourceId: 'doc-1' },
      provenance: { createdBy: 'user', userId: 'user-1' },
    });

    const activeItems = await service.queryMemory({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      query: 'policy',
      includeExpired: false,
    });

    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].content).toContain('Permanent school curriculum policy');
  });

  it('supersedes older memory item and emits memory.item.superseded event', async () => {
    let supersededEvent: unknown = null;
    defaultEventBus.subscribe('memory.item.superseded', (event) => {
      supersededEvent = event;
    });

    const original = await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'preference',
      content: 'Client prefers Monday morning syncs.',
      source: { type: 'user_note', sourceId: 'n1' },
      provenance: { createdBy: 'user' },
    });

    const replacement = await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'preference',
      content: 'Client changed preference: now prefers Friday afternoons.',
      source: { type: 'user_note', sourceId: 'n2' },
      provenance: { createdBy: 'user' },
    });

    await service.supersedeMemoryItem(original.id, replacement.id);

    const updatedOriginal = await service.getMemoryItem(original.id);
    expect(updatedOriginal?.temporal.supersededBy).toBe(replacement.id);
    expect(supersededEvent).toBeDefined();
    expect((supersededEvent as { type: string }).type).toBe('memory.item.superseded');
  });

  it('updates verification state and emits memory.item.verified / memory.item.rejected (PRD §94)', async () => {
    let verifiedEvent: unknown = null;
    defaultEventBus.subscribe('memory.item.verified', (event) => {
      verifiedEvent = event;
    });

    const item = await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'insight',
      content: 'Prospect intends to purchase 500 licenses next quarter.',
      source: { type: 'meeting', sourceId: 'meet-202' },
      provenance: { createdBy: 'agent' },
      verification: 'unverified',
    });

    expect(item.verification).toBe('unverified');

    const confirmed = await service.updateVerificationState(item.id, 'user_confirmed', 'Verified via call');
    expect(confirmed?.verification).toBe('user_confirmed');
    expect(confirmed?.lifecycle.status).toBe('active');
    expect(verifiedEvent).toBeDefined();

    let rejectedEvent: unknown = null;
    defaultEventBus.subscribe('memory.item.rejected', (event) => {
      rejectedEvent = event;
    });

    const rejected = await service.updateVerificationState(item.id, 'invalidated', 'Client canceled project');
    expect(rejected?.verification).toBe('invalidated');
    expect(rejected?.lifecycle.status).toBe('disputed');
    expect(rejectedEvent).toBeDefined();
  });

  it('deletes memory item from store and vector index and emits memory.item.deleted', async () => {
    let deletedEvent: unknown = null;
    defaultEventBus.subscribe('memory.item.deleted', (event) => {
      deletedEvent = event;
    });

    const item = await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'note',
      content: 'Transient scratchpad note.',
      source: { type: 'user_note', sourceId: 'note-99' },
      provenance: { createdBy: 'user' },
    });

    expect(await service.getMemoryItem(item.id)).not.toBeNull();

    const deleted = await service.deleteMemoryItem(item.id);
    expect(deleted).toBe(true);
    expect(await service.getMemoryItem(item.id)).toBeNull();
    expect(deletedEvent).toBeDefined();
  });

  it('computes accurate aggregated memory stats for tenant workspace', async () => {
    await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'semantic',
      type: 'insight',
      content: 'Knowledge 1',
      source: { type: 'meeting', sourceId: 'src-1' },
      provenance: { createdBy: 'agent' },
      verification: 'unverified',
      sensitivity: 'internal',
    });

    await service.createMemoryItem({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      tier: 'episodic',
      type: 'event',
      content: 'Knowledge 2',
      source: { type: 'call', sourceId: 'src-2' },
      provenance: { createdBy: 'user' },
      verification: 'user_confirmed',
      sensitivity: 'confidential',
    });

    const stats = await service.getMemoryStats('org-test', 'ws-test');
    expect(stats.totalIndexed).toBe(2);
    expect(stats.activeSources).toBe(2);
    expect(stats.tierCounts.semantic).toBe(1);
    expect(stats.tierCounts.episodic).toBe(1);
    expect(stats.verificationCounts.unverified).toBe(1);
    expect(stats.verificationCounts.user_confirmed).toBe(1);
    expect(stats.sensitivityCounts.internal).toBe(1);
    expect(stats.sensitivityCounts.confidential).toBe(1);
    expect(stats.inboxPending).toBe(1);
    expect(stats.healthStatus).toBe('healthy');
  });
});
