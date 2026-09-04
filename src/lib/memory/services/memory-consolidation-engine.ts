/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Memory Consolidation Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Clustering & Synthesis:
 *    - Detects redundant, fragmented, or closely related memory units and proposes
 *      unified canonical records.
 * 2. Non-Destructive Source Invalidation:
 *    - When consolidation is accepted by a human operator, source memories are archived
 *      with clear provenance pointers, never deleted.
 * 3. Bounded High-Load Guard:
 *    - Memory clusters are capped at <= 5 memories per candidate to prevent token overload.
 * 4. Zero-`any` Standard:
 *    - Completely typed with domain interfaces.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-consolidation.test.ts`.
 */

import { createHash } from 'crypto';
import { MemoryRepository } from '../memory-repository';
import { OrganizationMemoryService } from './organization-memory-service';
import {
  consolidateMemoriesFlow,
  consolidateMemoriesDeterministic,
} from '@/ai/flows/consolidate-memories-flow';
import type { MemoryObject, MemoryType } from '../types';
import type { ConsolidationCandidate } from '../orchestrator-types';

export class MemoryConsolidationEngine {
  /**
   * Generates a deterministic candidate ID from a sorted array of source memory IDs.
   */
  private static generateCandidateId(sourceIds: string[]): string {
    const sorted = [...sourceIds].sort().join(':');
    return 'cand_' + createHash('sha256').update(sorted).digest('hex').slice(0, 16);
  }

  /**
   * Discovers clusters of related memories and synthesizes proposed consolidation candidates.
   */
  public static async findConsolidationCandidates(
    workspaceId: string,
    organizationId: string,
    minClusterSize: number = 2
  ): Promise<ConsolidationCandidate[]> {
    const memories = await MemoryRepository.listMemories(workspaceId, {
      status: 'active',
      limit: 100,
    });

    if (memories.length < minClusterSize) {
      return [];
    }

    // 1. Group memories by shared Entity ID or shared topic clusters
    const entityBuckets = new Map<string, MemoryObject[]>();
    const topicBuckets = new Map<string, MemoryObject[]>();

    for (const mem of memories) {
      // Group by entityIds
      const entityIds = mem.subjectRefs?.entityIds || [];
      for (const eId of entityIds) {
        const bucket = entityBuckets.get(eId) || [];
        bucket.push(mem);
        entityBuckets.set(eId, bucket);
      }

      // Group by prominent topics
      for (const topic of mem.topics || []) {
        const cleanTopic = topic.toLowerCase().trim();
        if (cleanTopic.length > 2) {
          const bucket = topicBuckets.get(cleanTopic) || [];
          bucket.push(mem);
          topicBuckets.set(cleanTopic, bucket);
        }
      }
    }

    // 2. Extract unique candidate clusters (bounded to 2..5 memories)
    const rawClusters: MemoryObject[][] = [];
    const seenClusterKeys = new Set<string>();

    const evaluateBucket = (bucket: MemoryObject[]) => {
      if (bucket.length >= minClusterSize) {
        const sliced = bucket.slice(0, 5);
        const clusterKey = sliced.map((m) => m.id).sort().join(':');
        if (!seenClusterKeys.has(clusterKey)) {
          seenClusterKeys.add(clusterKey);
          rawClusters.push(sliced);
        }
      }
    };

    entityBuckets.forEach(evaluateBucket);
    topicBuckets.forEach(evaluateBucket);

    // Limit candidate evaluation to top 10 clusters to protect concurrency & tokens
    const clustersToProcess = rawClusters.slice(0, 10);
    const candidates: ConsolidationCandidate[] = [];

    for (const cluster of clustersToProcess) {
      try {
        const inputPayload = {
          memories: cluster.map((m) => ({
            id: m.id,
            title: m.title || `${m.type}: ${m.content.slice(0, 30)}`,
            content: m.content,
            type: m.type,
            topics: m.topics,
            entityNames: m.entities?.map((e) => e.entityName) || [],
          })),
        };

        let synthesis: ConsolidateMemoriesOutput | undefined;
        try {
          synthesis = await consolidateMemoriesFlow(inputPayload);
        } catch (flowErr) {
          console.warn('[MemoryConsolidationEngine] flow error:', flowErr);
        }

        if (!synthesis || !synthesis.proposedTitle) {
          synthesis = consolidateMemoriesDeterministic(inputPayload);
        }

        const sourceMemoryIds = cluster.map((m) => m.id);
        const candidateId = this.generateCandidateId(sourceMemoryIds);

        // Collect all entity IDs
        const entityIdsSet = new Set<string>();
        for (const m of cluster) {
          for (const eId of m.subjectRefs?.entityIds || []) {
            entityIdsSet.add(eId);
          }
        }

        candidates.push({
          id: candidateId,
          workspaceId,
          organizationId,
          sourceMemoryIds,
          proposedTitle: synthesis.proposedTitle,
          proposedContent: synthesis.proposedContent,
          proposedType: (synthesis.proposedType as MemoryType) || 'fact',
          confidenceScore: synthesis.confidenceScore,
          reasoning: synthesis.reasoning,
          topics: synthesis.synthesizedTopics,
          entityIds: Array.from(entityIdsSet),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[MemoryConsolidationEngine] Cluster synthesis error:', err);
      }
    }

    return candidates;
  }

  /**
   * Applies an approved consolidation candidate: persists the canonical synthesized memory
   * and non-destructively archives the source memories with attribution.
   */
  public static async applyConsolidation(
    candidate: ConsolidationCandidate,
    userId: string
  ): Promise<MemoryObject> {
    const { workspaceId, organizationId } = candidate;

    // 1. Create the new consolidated MemoryObject
    const { memory: consolidatedMemory } = await OrganizationMemoryService.remember({
      workspaceId,
      organizationId,
      type: candidate.proposedType,
      title: candidate.proposedTitle,
      content: candidate.proposedContent,
      source: {
        type: 'ai_flow',
        sourceId: candidate.id,
      },
      topics: candidate.topics,
      subjectRefs: {
        entityIds: candidate.entityIds,
      },
      evidence: `Consolidated from source memories: ${candidate.sourceMemoryIds.join(', ')}`,
      userId,
      verification: 'user_confirmed',
      skipConflictCheck: true,
    });

    // 2. Non-destructively archive the source memories
    for (const srcId of candidate.sourceMemoryIds) {
      try {
        await MemoryRepository.invalidateMemory(
          srcId,
          `Consolidated into canonical memory ${consolidatedMemory.id}`,
          userId
        );
      } catch (err) {
        console.warn(`[MemoryConsolidationEngine] Could not archive source memory ${srcId}:`, err);
      }
    }

    return consolidatedMemory;
  }
}
