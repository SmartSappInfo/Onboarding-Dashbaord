/**
 * @fileOverview CompanyBrain 2.0: Semantic Search & Explainability Service
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Hybrid Semantic Retrieval (PRD Sections 18–20):
 *    - Embeds search queries into 768-dim vectors via EmbeddingService.
 *    - Enforces tenant isolation payload filters at query time before computing distance.
 * 2. Deep Explainability ("Why this matched"):
 *    - Analyzes query terms, extracted entities, and vector score to provide clear,
 *      natural-language reasons for every retrieved result.
 * 3. Nearest Neighbor Exploration:
 *    - Allows users and agents to discover related memories in vector space.
 * 4. Strict Zero-`any` Standard:
 *    - All search parameters and return models are strongly typed.
 *
 * @testability Covered in `src/lib/memory/__tests__/semantic-search.test.ts`.
 */

import { EmbeddingService } from './embedding-service';
import { QdrantClient, type QdrantSearchHit } from '../qdrant/qdrant-client';
import { MemoryRepository } from '../memory-repository';
import type { MemoryObject } from '../types';
import type {
  SemanticSearchRequest,
  SemanticSearchResult,
  WhyMatchedAttribution,
} from '../semantic-types';

export class SemanticSearchService {
  /**
   * Generates a natural-language attribution explaining why a memory matched the query.
   */
  public static generateWhyMatchedAttribution(
    query: string,
    hit: QdrantSearchHit
  ): WhyMatchedAttribution {
    const cleanQuery = query.toLowerCase().trim();
    const queryTokens = cleanQuery
      .split(/\W+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'our', 'with', 'show', 'tell'].includes(w));

    const chunkContent = (hit.payload.content || '').toLowerCase();
    const topics = (hit.payload.topics || []).map((t) => t.toLowerCase());

    const matchedTerms: string[] = [];

    // Check query tokens in chunk text
    for (const token of queryTokens) {
      if (chunkContent.includes(token)) {
        matchedTerms.push(token);
      }
    }

    // Check matching topics
    for (const topic of topics) {
      if (queryTokens.some((q) => topic.includes(q) || q.includes(topic))) {
        if (!matchedTerms.includes(topic)) {
          matchedTerms.push(topic);
        }
      }
    }

    const similarityPercent = Math.round(Math.min(hit.score * 100, 100));

    let reason = '';
    if (matchedTerms.length > 0) {
      reason = `Matches concepts: "${matchedTerms.slice(0, 3).join('", "')}". High semantic alignment with ${hit.payload.memoryType}.`;
    } else {
      reason = `Conceptually aligned with query intent in ${hit.payload.memoryType} context.`;
    }

    return {
      reason,
      matchedTerms,
      confidenceScore: hit.payload.confidence ?? 0.85,
      semanticSimilarityPercent: similarityPercent,
    };
  }

  /**
   * Executes semantic vector search across organizational memories.
   */
  public static async search(request: SemanticSearchRequest): Promise<SemanticSearchResult[]> {
    const {
      workspaceId,
      organizationId,
      query,
      filters = {},
      limit = 15,
    } = request;

    const trimmedQuery = (query || '').trim();
    if (!trimmedQuery || !workspaceId || !organizationId) {
      return [];
    }

    // 1. Generate embedding for query text
    const queryVector = await EmbeddingService.embedText(trimmedQuery);

    // 2. Query Qdrant with pre-filtering
    const hits = await QdrantClient.searchPoints({
      vector: queryVector,
      workspaceId,
      organizationId,
      filters,
      limit: Math.min(limit, 50),
      scoreThreshold: filters.minScore ?? 0.5,
    });

    if (hits.length === 0) return [];

    // 3. Hydrate authoritative MemoryObjects from Firestore (or fallback to payload)
    const memoryIds = Array.from(new Set(hits.map((h) => h.payload.memoryId)));
    const memoryMap = new Map<string, MemoryObject>();

    await Promise.all(
      memoryIds.map(async (id) => {
        const mem = await MemoryRepository.getMemoryById(id);
        if (mem) {
          memoryMap.set(id, mem);
        }
      })
    );

    // 4. Construct explainable results
    const results: SemanticSearchResult[] = [];
    const seenMemoryIds = new Set<string>();

    for (const hit of hits) {
      if (seenMemoryIds.has(hit.payload.memoryId)) {
        continue;
      }
      seenMemoryIds.add(hit.payload.memoryId);

      let memory = memoryMap.get(hit.payload.memoryId);

      // Fallback object reconstruction if Firestore doc was deleted or unavailable
      if (!memory) {
        memory = {
          id: hit.payload.memoryId,
          organizationId: hit.payload.organizationId,
          workspaceId: hit.payload.workspaceId,
          type: hit.payload.memoryType,
          title: hit.payload.heading,
          content: hit.payload.content,
          source: {
            type: hit.payload.sourceType,
            sourceId: hit.payload.sourceId,
          },
          subjectRefs: {
            entityIds: hit.payload.entityIds,
            dealIds: hit.payload.dealIds,
          },
          topics: hit.payload.topics,
          entities: hit.payload.entityIds.map((id) => ({
            entityId: id,
            entityName: id,
            entityType: 'deal',
            confidenceScore: 0.9,
          })),
          importance: hit.payload.importance,
          confidence: hit.payload.confidence,
          verification: hit.payload.verification,
          visibility: { scope: hit.payload.visibilityScope },
          lifecycle: { status: 'active' },
          provenance: { createdBy: 'agent' },
          createdAt: hit.payload.createdAt,
          updatedAt: hit.payload.createdAt,
        };
      }

      const whyMatched = this.generateWhyMatchedAttribution(trimmedQuery, hit);

      results.push({
        memoryId: hit.payload.memoryId,
        score: hit.score,
        memory,
        matchedChunk: {
          chunkId: hit.payload.chunkId,
          heading: hit.payload.heading,
          content: hit.payload.content,
          position: 0,
        },
        whyMatched,
      });
    }

    return results;
  }

  /**
   * Retrieves vector nearest-neighbors for a given memory object.
   */
  public static async getRelatedMemories(params: {
    memoryId: string;
    workspaceId: string;
    organizationId: string;
    limit?: number;
  }): Promise<MemoryObject[]> {
    const { memoryId, workspaceId, organizationId, limit = 5 } = params;
    if (!memoryId || !workspaceId) return [];

    const sourceMemory = await MemoryRepository.getMemoryById(memoryId);
    if (!sourceMemory) return [];

    // Embed memory content to search nearest neighbors
    const vector = await EmbeddingService.embedText(sourceMemory.content);

    const hits = await QdrantClient.searchPoints({
      vector,
      workspaceId,
      organizationId,
      limit: limit + 1, // include extra to exclude self
      scoreThreshold: 0.55,
    });

    const relatedIds = hits
      .map((h) => h.payload.memoryId)
      .filter((id) => id !== memoryId)
      .slice(0, limit);

    if (relatedIds.length === 0) return [];

    const relatedMemories: MemoryObject[] = [];
    for (const id of relatedIds) {
      const mem = await MemoryRepository.getMemoryById(id);
      if (mem) relatedMemories.push(mem);
    }

    return relatedMemories;
  }
}
