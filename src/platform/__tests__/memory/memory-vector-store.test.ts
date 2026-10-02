import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryVectorStore } from '@/platform/memory/adapters/memory-vector-store';

describe('MemoryVectorStore: In-Memory Cosine Similarity & Tenant ACL (Rules 8, 24, 47)', () => {
  let store: MemoryVectorStore;

  beforeEach(() => {
    store = new MemoryVectorStore();
  });

  it('fails closed if organizationId or workspaceId is missing (Rule 8)', async () => {
    await expect(
      store.search({
        vector: [1, 0, 0],
        organizationId: '',
        workspaceId: 'ws-1',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');

    await expect(
      store.search({
        vector: [1, 0, 0],
        organizationId: 'org-1',
        workspaceId: '',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');
  });

  it('upserts points and searches with strict tenant filtering', async () => {
    await store.upsert([
      {
        id: 'point-org1-1',
        vector: [1.0, 0.0, 0.0],
        payload: {
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          memoryId: 'mem-1',
          content: 'Alpha customer note',
        },
      },
      {
        id: 'point-org2-1',
        vector: [1.0, 0.0, 0.0], // Identical vector, foreign tenant
        payload: {
          organizationId: 'org-2',
          workspaceId: 'ws-2',
          memoryId: 'mem-2',
          content: 'Beta customer note',
        },
      },
    ]);

    const resultsOrg1 = await store.search({
      vector: [1.0, 0.0, 0.0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(resultsOrg1).toHaveLength(1);
    expect(resultsOrg1[0].id).toBe('point-org1-1');
    expect(resultsOrg1[0].score).toBeCloseTo(1.0);

    const resultsOrg2 = await store.search({
      vector: [1.0, 0.0, 0.0],
      organizationId: 'org-2',
      workspaceId: 'ws-2',
    });

    expect(resultsOrg2).toHaveLength(1);
    expect(resultsOrg2[0].id).toBe('point-org2-1');
  });

  it('ranks results by cosine similarity descending', async () => {
    await store.upsert([
      {
        id: 'p-close',
        vector: [0.9, 0.1, 0.0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1', memoryId: 'm1' },
      },
      {
        id: 'p-exact',
        vector: [1.0, 0.0, 0.0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1', memoryId: 'm2' },
      },
      {
        id: 'p-orthogonal',
        vector: [0.0, 1.0, 0.0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1', memoryId: 'm3' },
      },
    ]);

    const results = await store.search({
      vector: [1.0, 0.0, 0.0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('p-exact');
    expect(results[0].score).toBeCloseTo(1.0);
    expect(results[1].id).toBe('p-close');
    expect(results[1].score).toBeGreaterThan(0.9);
  });

  it('deletes points by ID and by filter', async () => {
    await store.upsert([
      {
        id: 'del-1',
        vector: [1, 0, 0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1', memoryId: 'target-mem' },
      },
    ]);

    expect(await store.size()).toBe(1);

    await store.deleteByIds(['del-1']);
    expect(await store.size()).toBe(0);

    await store.upsert([
      {
        id: 'del-2',
        vector: [1, 0, 0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1', memoryId: 'target-mem-2' },
      },
    ]);

    await store.deleteByFilter({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      key: 'memoryId',
      value: 'target-mem-2',
    });
    expect(await store.size()).toBe(0);
  });

  it('reports healthy cluster status with fallback indication', async () => {
    const health = await store.getHealth();
    expect(health.status).toBe('healthy');
    expect(health.isFallback).toBe(true);
  });
});
