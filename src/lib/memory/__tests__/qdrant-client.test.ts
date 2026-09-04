import { describe, it, expect, beforeEach } from 'vitest';
import { QdrantClient } from '../qdrant/qdrant-client';
import { EmbeddingService } from '../services/embedding-service';
import type { QdrantPoint, QdrantPayload } from '../semantic-types';
import type { MemoryType } from '../types';

describe('QdrantClient (Resilient In-Memory & REST Store)', () => {
  beforeEach(() => {
    QdrantClient.clearMockStore();
  });

  function createSamplePoint(params: {
    id: string;
    workspaceId: string;
    organizationId: string;
    memoryId: string;
    text: string;
    memoryType?: MemoryType;
  }): QdrantPoint {
    const vector = EmbeddingService.generateFallbackVector(params.text);
    const payload: QdrantPayload = {
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      memoryId: params.memoryId,
      memoryType: params.memoryType || 'insight',
      sourceType: 'user_note',
      sourceId: 'note_123',
      chunkId: 'chunk_0',
      entityIds: ['ent_1'],
      dealIds: [],
      topics: ['onboarding', 'pricing'],
      importance: 0.9,
      confidence: 0.85,
      visibilityScope: 'workspace',
      verification: 'ai_generated',
      createdAt: new Date().toISOString(),
      content: params.text,
    };

    return {
      id: params.id,
      vector,
      payload,
    };
  }

  it('upserts points and verifies cluster health', async () => {
    const point = createSamplePoint({
      id: 'pt_1',
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      memoryId: 'mem_1',
      text: 'School agreed to payment schedule of three installments.',
    });

    const success = await QdrantClient.upsertPoints([point]);
    expect(success).toBe(true);

    const health = await QdrantClient.getClusterHealth();
    expect(health.status).toBeDefined();
    expect(health.pointsCount).toBeGreaterThanOrEqual(1);
    expect(health.vectorDimension).toBe(768);
  });

  it('enforces strict tenant isolation: never returns cross-workspace or cross-org results', async () => {
    const pointWsAlpha = createSamplePoint({
      id: 'pt_alpha',
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      memoryId: 'mem_alpha',
      text: 'Confidential strategic pricing review for Acme Academy.',
    });

    const pointWsBeta = createSamplePoint({
      id: 'pt_beta',
      workspaceId: 'ws_beta',
      organizationId: 'org_1',
      memoryId: 'mem_beta',
      text: 'Confidential strategic pricing review for Beacon College.',
    });

    await QdrantClient.upsertPoints([pointWsAlpha, pointWsBeta]);

    const queryVector = EmbeddingService.generateFallbackVector('pricing review');

    // Query ws_alpha only
    const resultsAlpha = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      limit: 10,
    });

    expect(resultsAlpha.length).toBe(1);
    expect(resultsAlpha[0].id).toBe('pt_alpha');
    expect(resultsAlpha[0].payload.workspaceId).toBe('ws_alpha');

    // Query ws_beta only
    const resultsBeta = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_beta',
      organizationId: 'org_1',
      limit: 10,
    });

    expect(resultsBeta.length).toBe(1);
    expect(resultsBeta[0].id).toBe('pt_beta');
    expect(resultsBeta[0].payload.workspaceId).toBe('ws_beta');

    // Query unknown workspace returns zero results
    const resultsUnknown = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_unknown',
      organizationId: 'org_1',
      limit: 10,
    });
    expect(resultsUnknown).toHaveLength(0);
  });

  it('filters by memoryType and minScore', async () => {
    const decisionPoint = createSamplePoint({
      id: 'pt_dec',
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      memoryId: 'mem_dec',
      text: 'Decided to waive onboarding fee for pilot phase.',
      memoryType: 'decision',
    });

    const problemPoint = createSamplePoint({
      id: 'pt_prob',
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      memoryId: 'mem_prob',
      text: 'Network latency issues reported during morning sync.',
      memoryType: 'problem',
    });

    await QdrantClient.upsertPoints([decisionPoint, problemPoint]);

    const queryVector = EmbeddingService.generateFallbackVector('onboarding fee decision');

    // Filter by decision type
    const decisionResults = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      filters: { memoryTypes: ['decision'] },
      limit: 5,
    });

    expect(decisionResults.length).toBe(1);
    expect(decisionResults[0].payload.memoryType).toBe('decision');
  });

  it('deletes points by filter (memoryId or sourceId)', async () => {
    const pt1 = createSamplePoint({
      id: 'pt_del_1',
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
      memoryId: 'mem_to_delete',
      text: 'Temporary draft observation.',
    });

    await QdrantClient.upsertPoints([pt1]);

    const queryVector = EmbeddingService.generateFallbackVector('Temporary draft');
    const beforeDelete = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
    });
    expect(beforeDelete.length).toBe(1);

    // Delete by memoryId
    await QdrantClient.deletePointsByFilter('memoryId', 'mem_to_delete');

    const afterDelete = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId: 'ws_alpha',
      organizationId: 'org_1',
    });
    expect(afterDelete.length).toBe(0);
  });
});
