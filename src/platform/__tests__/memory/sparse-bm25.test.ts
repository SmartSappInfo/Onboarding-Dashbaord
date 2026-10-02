import { describe, it, expect, beforeEach } from 'vitest';
import { SparseBM25Retriever } from '@/platform/memory/retrieval/sparse-bm25-retriever';

describe('Sparse BM25 Keyword Search Engine (Rule 32 & PRD §18)', () => {
  let retriever: SparseBM25Retriever;

  beforeEach(() => {
    retriever = new SparseBM25Retriever();
  });

  it('fails closed when organizationId or workspaceId is missing (Rule 8)', async () => {
    await expect(
      retriever.search({
        query: 'tuition fee',
        organizationId: '',
        workspaceId: 'ws-1',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');

    await expect(
      retriever.search({
        query: 'tuition fee',
        organizationId: 'org-1',
        workspaceId: '',
      })
    ).rejects.toThrow('MEMORY_TENANT_REQUIRED');
  });

  it('indexes documents and ranks hits by BM25 score with tenant isolation', async () => {
    await retriever.indexDocuments([
      {
        id: 'doc-org1-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'Bright Future School tuition payment policy and schedule for primary students.',
      },
      {
        id: 'doc-org1-2',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'Kumasi High School sports calendar and extracurricular activities.',
      },
      {
        id: 'doc-org2-1',
        organizationId: 'org-2',
        workspaceId: 'ws-2',
        content: 'Bright Future School foreign tenant document regarding tuition payment.',
      },
    ]);

    const results = await retriever.search({
      query: 'tuition payment',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-org1-1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('correctly handles empty query or unknown terms without crashing', async () => {
    await retriever.indexDocuments([
      {
        id: 'doc-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        content: 'General school guidelines.',
      },
    ]);

    const results = await retriever.search({
      query: 'xylophone quantum computing',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    expect(results).toHaveLength(0);
  });
});
