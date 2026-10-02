import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QdrantVectorStore } from '@/platform/memory/adapters/qdrant-vector-store';
import { MemoryVectorStore } from '@/platform/memory/adapters/memory-vector-store';

describe('QdrantVectorStore: Mandatory Tenant ACL & Circuit Breaker (Rules 4, 8, 24, 32, 47)', () => {
  let fallback: MemoryVectorStore;
  let qdrant: QdrantVectorStore;

  beforeEach(() => {
    fallback = new MemoryVectorStore();
    qdrant = new QdrantVectorStore({
      baseUrl: 'https://test-qdrant.cluster.io',
      apiKey: 'test-api-key',
      fallbackStore: fallback,
      failureThreshold: 2,
      resetTimeoutMs: 100, // Fast reset for testing
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails closed immediately when organizationId or workspaceId is missing (Rule 8)', async () => {
    await expect(
      qdrant.search({
        vector: [1, 0, 0],
        organizationId: '',
        workspaceId: 'ws-1',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');

    await expect(
      qdrant.search({
        vector: [1, 0, 0],
        organizationId: 'org-1',
        workspaceId: '',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');
  });

  it('falls back to in-memory store when Qdrant is unconfigured without crashing (Rule 24)', async () => {
    const unconfigured = new QdrantVectorStore({
      baseUrl: '',
      apiKey: '',
      fallbackStore: fallback,
    });

    await unconfigured.upsert([
      {
        id: 'p-1',
        vector: [1, 0, 0],
        payload: { organizationId: 'org-1', workspaceId: 'ws-1' },
      },
    ]);

    const results = await unconfigured.search({
      vector: [1, 0, 0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('p-1');
  });

  it('trips circuit breaker after consecutive failures and transitions to OPEN (Rule 24)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    expect(qdrant.getCircuitState()).toBe('CLOSED');

    // First failure
    await qdrant.upsert([
      { id: 'p-fail-1', vector: [1, 0], payload: { organizationId: 'org-1', workspaceId: 'ws-1' } },
    ]);
    expect(qdrant.getCircuitState()).toBe('CLOSED');

    // Second failure - trips threshold
    await qdrant.upsert([
      { id: 'p-fail-2', vector: [1, 0], payload: { organizationId: 'org-1', workspaceId: 'ws-1' } },
    ]);
    expect(qdrant.getCircuitState()).toBe('OPEN');

    // In OPEN state, requests route directly to fallback without fetch invocation
    const fetchSpy = vi.spyOn(global, 'fetch');
    const searchRes = await qdrant.search({
      vector: [1, 0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(searchRes).toBeDefined();
  });

  it('recovers from OPEN to HALF_OPEN to CLOSED after cooldown (Rule 24)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Down'));

    // Trip the breaker
    await qdrant.upsert([{ id: 'p1', vector: [1], payload: { organizationId: 'o1', workspaceId: 'w1' } }]);
    await qdrant.upsert([{ id: 'p2', vector: [1], payload: { organizationId: 'o1', workspaceId: 'w1' } }]);
    expect(qdrant.getCircuitState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 120));

    // Next request triggers probe (HALF_OPEN)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [] }),
    } as Response);

    await qdrant.search({
      vector: [1],
      organizationId: 'o1',
      workspaceId: 'w1',
    });

    expect(qdrant.getCircuitState()).toBe('CLOSED');
  });
});
