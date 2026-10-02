import { describe, it, expect, beforeEach } from 'vitest';
import { HybridRetriever } from '@/platform/memory/retrieval/hybrid-retriever';
import { MemoryVectorStore } from '@/platform/memory/adapters/memory-vector-store';
import { SparseBM25Retriever } from '@/platform/memory/retrieval/sparse-bm25-retriever';

describe('Hybrid Retriever: Dense + Sparse RRF with Temporal Decay (Rules 29 & 32)', () => {
  let vectorStore: MemoryVectorStore;
  let sparseRetriever: SparseBM25Retriever;
  let hybridRetriever: HybridRetriever;

  beforeEach(() => {
    vectorStore = new MemoryVectorStore();
    sparseRetriever = new SparseBM25Retriever();
    hybridRetriever = new HybridRetriever({
      vectorStore,
      sparseRetriever,
      rrfK: 60,
    });
  });

  it('fails closed when tenant IDs are missing (Rule 8)', async () => {
    await expect(
      hybridRetriever.search({
        query: 'tuition fee',
        vector: [1, 0, 0],
        organizationId: '',
        workspaceId: 'ws-1',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');

    await expect(
      hybridRetriever.search({
        query: 'tuition fee',
        vector: [1, 0, 0],
        organizationId: 'org-1',
        workspaceId: '',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');
  });

  it('fuses dense and sparse rankings using Reciprocal Rank Fusion (RRF)', async () => {
    // Ingest vector
    await vectorStore.upsert([
      {
        id: 'item-1',
        vector: [1.0, 0.0, 0.0],
        payload: {
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          content: 'Bright Future School tuition schedule.',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'item-2',
        vector: [0.5, 0.5, 0.0],
        payload: {
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          content: 'Tuition fees payment installment plan.',
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    // Ingest sparse BM25
    await sparseRetriever.indexDocuments([
      {
        id: 'item-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'Bright Future School tuition schedule.',
      },
      {
        id: 'item-2',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'Tuition fees payment installment plan.',
      },
    ]);

    const hits = await hybridRetriever.search({
      query: 'tuition schedule',
      vector: [1.0, 0.0, 0.0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(hits).toHaveLength(2);
    expect(hits[0].id).toBe('item-1');
    expect(hits[0].rrfScore).toBeGreaterThan(hits[1].rrfScore);
  });

  it('applies temporal decay to older memories (Rule 29)', async () => {
    const now = Date.now();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date(now).toISOString();

    await vectorStore.upsert([
      {
        id: 'item-old',
        vector: [1.0, 0.0, 0.0],
        payload: {
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          content: 'Old tuition policy from 60 days ago.',
          createdAt: sixtyDaysAgo,
        },
      },
      {
        id: 'item-new',
        vector: [1.0, 0.0, 0.0],
        payload: {
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          content: 'New current tuition policy.',
          createdAt: today,
        },
      },
    ]);

    await sparseRetriever.indexDocuments([
      {
        id: 'item-old',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'Old tuition policy from 60 days ago.',
      },
      {
        id: 'item-new',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'New current tuition policy.',
      },
    ]);

    const hits = await hybridRetriever.search({
      query: 'tuition policy',
      vector: [1.0, 0.0, 0.0],
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      applyDecay: true,
    });

    expect(hits[0].id).toBe('item-new');
    expect(hits[0].finalScore).toBeGreaterThan(hits[1].finalScore);
  });
});
