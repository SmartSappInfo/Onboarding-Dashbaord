import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryObject } from '../types';

// Mock MemoryRepository
const sampleMemoriesMap = new Map<string, MemoryObject>();

vi.mock('../memory-repository', () => ({
  MemoryRepository: {
    getMemoryById: vi.fn(async (id: string) => sampleMemoriesMap.get(id) || null),
    getMemoriesByWorkspace: vi.fn(async () => Array.from(sampleMemoriesMap.values())),
  },
  MEMORY_OBJECTS_COLLECTION: 'memory_objects',
}));

import { SemanticSearchService } from '../services/semantic-search-service';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { QdrantClient } from '../qdrant/qdrant-client';

describe('SemanticSearchService', () => {
  const sampleMemory: MemoryObject = {
    id: 'mem_pricing_objection',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    type: 'problem',
    title: 'School raised concern over $3,000 setup fee',
    content: 'The bursar indicated that the $3,000 upfront setup fee exceeds their immediate discretionary budget. Suggested quarterly split.',
    summary: 'Fee objection',
    source: {
      type: 'user_note',
      sourceId: 'note_456',
      sourceHash: 'hash_456',
    },
    subjectRefs: { entityIds: ['school_st_jude'] },
    topics: ['pricing', 'finance', 'budget'],
    entities: [{ entityName: 'St. Jude School', entityType: 'deal', confidenceScore: 0.95 }],
    importance: 0.9,
    confidence: 0.88,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: {
      createdBy: 'agent',
      userId: 'user_1',
      sourceHash: 'hash_456',
    },
    evidence: 'Bursar indicated setup fee exceeds budget.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sampleMemoriesMap.clear();
    sampleMemoriesMap.set(sampleMemory.id, sampleMemory);

    await QdrantClient.deletePointsByFilter('memoryId', sampleMemory.id);
    await QdrantIndexer.indexMemory(sampleMemory);
  });

  it('retrieves relevant memory with cosine score and verbatim evidence chunk', async () => {
    const results = await SemanticSearchService.search({
      query: 'What was the setup fee budget objection?',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      userId: 'user_1',
      limit: 5,
      filters: {
        minScore: 0.0,
      },
    });

    expect(results.length).toBeGreaterThan(0);
    const topMatch = results[0];
    expect(topMatch.memoryId).toBe('mem_pricing_objection');
    expect(topMatch.memory.title).toBe(sampleMemory.title);
    expect(topMatch.score).toBeGreaterThan(0);
    expect(topMatch.matchedChunk.content).toContain('setup fee');
  });

  it('generates "Why this matched" attribution summary', async () => {
    const results = await SemanticSearchService.search({
      query: 'budget objection',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      userId: 'user_1',
      filters: { minScore: 0.0 },
    });

    expect(results.length).toBeGreaterThan(0);
    const attribution = results[0].whyMatched;
    expect(attribution).toBeDefined();
    expect(attribution?.reason).toBeDefined();
    expect(attribution?.semanticSimilarityPercent).toBeGreaterThan(0);
  });

  it('finds related memories for a given memory ID', async () => {
    const related = await SemanticSearchService.getRelatedMemories({
      memoryId: 'mem_pricing_objection',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      limit: 3,
    });

    // It should exclude itself from results
    expect(related.some((r) => r.id === 'mem_pricing_objection')).toBe(false);
  });
});
