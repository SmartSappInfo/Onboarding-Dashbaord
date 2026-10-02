import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  searchMemoryAction,
  listKnowledgeInboxAction,
  inspectMemoryItemAction,
  verifyMemoryItemAction,
  rejectMemoryItemAction,
  deleteMemoryItemAction,
  getMemoryBrainMetricsAction,
  getEntityContextAction,
  getEntityGraphAction,
} from '@/app/actions/memory-actions';
import {
  CanonicalMemoryService,
  setCanonicalMemoryServiceForTests,
} from '@/platform/memory/services/canonical-memory-service';
import { MemoryVectorStore } from '@/platform/memory/adapters/memory-vector-store';
import { defaultEventBus } from '@/platform/events/event-bus';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

// Mock requireAuth
let mockAuthUser = {
  uid: 'usr_mock_123',
  isSystemAdmin: false,
  profile: {
    organizationId: 'org_test_1',
    defaultWorkspaceId: 'ws_test_1',
  },
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => mockAuthUser),
}));

describe('Institutional Memory Server Actions (Rules 4, 8, 47, 51, 60, 69)', () => {
  let memoryService: CanonicalMemoryService;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    defaultEventBus.clear();
    const vectorStore = new MemoryVectorStore();
    memoryService = new CanonicalMemoryService({ vectorStore });
    setCanonicalMemoryServiceForTests(memoryService);

    mockAuthUser = {
      uid: 'usr_mock_123',
      isSystemAdmin: false,
      profile: {
        organizationId: 'org_test_1',
        defaultWorkspaceId: 'ws_test_1',
      },
    };
  });

  it('searches memory with tenant boundaries enforced (Rules 8 & 47)', async () => {
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'insight',
      title: 'Discount Policy',
      content: 'Early bird registration offers 15% tuition discount.',
      source: { type: 'document', sourceId: 'doc-1' },
      provenance: { createdBy: 'user' },
    });

    // Cross-tenant item (should not be returned)
    await memoryService.createMemoryItem({
      organizationId: 'org_other_99',
      workspaceId: 'ws_other_99',
      tier: 'semantic',
      type: 'insight',
      title: 'Other Org Secret',
      content: 'Secret tuition policy of competitor.',
      source: { type: 'document', sourceId: 'doc-99' },
      provenance: { createdBy: 'user' },
    });

    const res = await searchMemoryAction({ query: 'discount' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].title).toBe('Discount Policy');
  });

  it('lists knowledge inbox items filtered by triage tab (PRD §93)', async () => {
    // 1. Unverified insight
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'insight',
      content: 'Unverified meeting deduction.',
      source: { type: 'meeting', sourceId: 'meet-1' },
      provenance: { createdBy: 'agent' },
      verification: 'unverified',
    });

    // 2. Verified fact
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'fact',
      content: 'Verified policy document.',
      source: { type: 'document', sourceId: 'doc-1' },
      provenance: { createdBy: 'user' },
      verification: 'user_confirmed',
    });

    const newRes = await listKnowledgeInboxAction({ tab: 'new' });
    expect(newRes.success).toBe(true);
    expect(newRes.data).toHaveLength(1);
    expect(newRes.data?.[0].content).toContain('Unverified meeting deduction');

    const insightsRes = await listKnowledgeInboxAction({ tab: 'insights' });
    expect(insightsRes.success).toBe(true);
    expect(insightsRes.data).toHaveLength(1);
  });

  it('inspects memory item with anti-IDOR guard (Rule 47)', async () => {
    const item = await memoryService.createMemoryItem({
      organizationId: 'org_other_foreign',
      workspaceId: 'ws_foreign',
      tier: 'semantic',
      type: 'fact',
      content: 'Confidential foreign data.',
      source: { type: 'crm_entity', sourceId: 'crm-1' },
      provenance: { createdBy: 'user' },
    });

    // Non-admin attempting to inspect foreign org item
    const res = await inspectMemoryItemAction(item.id);
    expect(res.success).toBe(false);
    expect(res.code).toBe('TENANT_MISMATCH');
  });

  it('verifies candidate knowledge item and checks dead-man switch (Rules 60 & 69)', async () => {
    const item = await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'insight',
      content: 'Candidate recommendation.',
      source: { type: 'meeting', sourceId: 'm-1' },
      provenance: { createdBy: 'agent' },
      verification: 'unverified',
    });

    const verifyRes = await verifyMemoryItemAction(item.id, 'Confirmed by Joseph');
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.data?.verification).toBe('user_confirmed');

    // Dead-man pause check
    setGovernanceDeadManStateForTests(true);
    const pausedRes = await verifyMemoryItemAction(item.id, 'Should fail');
    expect(pausedRes.success).toBe(false);
    expect(pausedRes.code).toBe('MEMORY_DEAD_MAN_PAUSED');
  });

  it('rejects candidate and deletes memory item safely', async () => {
    const item = await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'observation',
      content: 'Invalid observation.',
      source: { type: 'user_note', sourceId: 'n-1' },
      provenance: { createdBy: 'user' },
      verification: 'unverified',
    });

    const rejectRes = await rejectMemoryItemAction(item.id, 'False premise');
    expect(rejectRes.success).toBe(true);
    expect(rejectRes.data?.verification).toBe('invalidated');

    const deleteRes = await deleteMemoryItemAction(item.id);
    expect(deleteRes.success).toBe(true);

    const check = await inspectMemoryItemAction(item.id);
    expect(check.success).toBe(false);
    expect(check.code).toBe('MEMORY_NOT_FOUND');
  });

  it('computes aggregated brain metrics for Company Brain KPI display', async () => {
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'insight',
      content: 'Knowledge A',
      source: { type: 'meeting', sourceId: 'm-1' },
      provenance: { createdBy: 'agent' },
      verification: 'unverified',
    });

    const metricsRes = await getMemoryBrainMetricsAction();
    expect(metricsRes.success).toBe(true);
    expect(metricsRes.data?.totalIndexed).toBe(1);
    expect(metricsRes.data?.inboxPending).toBe(1);
    expect(metricsRes.data?.healthStatus).toBe('healthy');
  });

  it('retrieves grounded entity context with prompt injection isolation (Rules 13, 30, 47)', async () => {
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'observation',
      content: 'Account executive reported strong interest in enterprise plan.',
      source: { type: 'crm_entity', sourceId: 'ent_contact_777' },
      provenance: { createdBy: 'user' },
      confidence: 0.95,
      subjectRefs: { entityIds: ['ent_contact_777'] },
    });

    const contextRes = await getEntityContextAction('ent_contact_777', 'contact');
    expect(contextRes.success).toBe(true);
    if (contextRes.success && contextRes.data) {
      expect(contextRes.data.compiledContext).toContain('<untrusted_reference_data');
      expect(contextRes.data.evidence.length).toBeGreaterThan(0);
      expect(contextRes.data.entityId).toBe('ent_contact_777');
    }
  });

  it('retrieves multi-hop entity graph nodes and edges (PRD §96, Rules 8 & 9)', async () => {
    await memoryService.createMemoryItem({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      tier: 'semantic',
      type: 'decision',
      content: 'Decision reached regarding contract terms for ent_contact_777.',
      source: { type: 'crm_entity', sourceId: 'ent_contact_777' },
      provenance: { createdBy: 'agent' },
      confidence: 0.92,
      subjectRefs: { entityIds: ['ent_contact_777'] },
    });

    const graphRes = await getEntityGraphAction('ent_contact_777', { depth: 1 });
    expect(graphRes.success).toBe(true);
    if (graphRes.success && graphRes.data) {
      expect(graphRes.data.centerNodeId).toBe('ent_contact_777');
      expect(graphRes.data.nodes.length).toBeGreaterThan(1);
      expect(graphRes.data.edges.length).toBeGreaterThan(0);
    }
  });
});
