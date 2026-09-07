/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Contradiction & Conflict Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Two-Stage Contradiction Detection:
 *    - Prevents quadratic O(N^2) evaluation overload by utilizing SHA-256 pair caching and
 *      bounded candidate evaluation.
 * 2. Grounded Attribution & Explainability:
 *    - Extracts verbatim opposing aspects and explanations so human reviewers can verify why AI flagged a dispute.
 * 3. Non-Destructive Invariant:
 *    - Identified conflicts are saved into `ConflictRepository` without automatically deleting or altering source data.
 *
 * @testability Covered in `src/lib/memory/__tests__/conflict-engine.test.ts`.
 */

import { createHash } from 'crypto';
import type { MemoryObject } from '../types';
import type { MemoryConflict, ConflictType } from '../orchestrator-types';
import { ConflictRepository } from '../conflict-repository';
import {
  detectMemoryContradictionsFlow,
  detectMemoryContradictionsDeterministic,
} from '@/ai/flows/detect-memory-contradictions-flow';

export interface MemoryPairEvaluation {
  isContradiction: boolean;
  conflictType: ConflictType;
  confidenceScore: number;
  summary: string;
  opposingAspects: string[];
}

// In-memory cache for evaluated pairs: key = hash(min(idA, idB) + max(idA, idB) + hashA + hashB)
const pairEvaluationCache = new Map<string, MemoryPairEvaluation>();

export class ConflictEngine {
  /**
   * Clears the in-memory pair cache (useful for tests and manual invalidation).
   */
  public static clearPairCache(): void {
    pairEvaluationCache.clear();
  }

  /**
   * Returns current cache size.
   */
  public static getCacheSize(): number {
    return pairEvaluationCache.size;
  }

  /**
   * Computes a deterministic cache key for a pair of memories.
   */
  public static computePairKey(a: MemoryObject, b: MemoryObject): string {
    const [first, second] = a.id < b.id ? [a, b] : [b, a];
    const raw = `${first.id}:${first.updatedAt || first.createdAt}|${second.id}:${second.updatedAt || second.createdAt}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Evaluates a single pair of memories to detect contradictions.
   */
  public static async evaluateMemoryPair(
    memoryA: MemoryObject,
    memoryB: MemoryObject
  ): Promise<MemoryPairEvaluation> {
    if (memoryA.id === memoryB.id) {
      return {
        isContradiction: false,
        conflictType: 'duplicate_divergence',
        confidenceScore: 1.0,
        summary: 'Same memory',
        opposingAspects: [],
      };
    }

    const cacheKey = this.computePairKey(memoryA, memoryB);
    const cached = pairEvaluationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: MemoryPairEvaluation;

    try {
      const output = await detectMemoryContradictionsFlow({
        memoryA: {
          id: memoryA.id,
          title: memoryA.title || '',
          content: memoryA.content,
          type: memoryA.type,
          createdAt: memoryA.createdAt,
        },
        memoryB: {
          id: memoryB.id,
          title: memoryB.title || '',
          content: memoryB.content,
          type: memoryB.type,
          createdAt: memoryB.createdAt,
        },
      });

      result = {
        isContradiction: output.isContradiction,
        conflictType: output.conflictType,
        confidenceScore: output.confidenceScore,
        summary: output.summary,
        opposingAspects: output.opposingAspects,
      };
    } catch {
      // Fallback deterministic inspection
      const fallback = detectMemoryContradictionsDeterministic({
        memoryA: {
          id: memoryA.id,
          title: memoryA.title || '',
          content: memoryA.content,
          type: memoryA.type,
          createdAt: memoryA.createdAt,
        },
        memoryB: {
          id: memoryB.id,
          title: memoryB.title || '',
          content: memoryB.content,
          type: memoryB.type,
          createdAt: memoryB.createdAt,
        },
      });

      result = {
        isContradiction: fallback.isContradiction,
        conflictType: fallback.conflictType,
        confidenceScore: fallback.confidenceScore,
        summary: fallback.summary,
        opposingAspects: fallback.opposingAspects,
      };
    }

    pairEvaluationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Generates candidate pairs of memories for conflict inspection based on entity or topic overlap.
   */
  public static findCandidatePairs(
    memories: MemoryObject[],
    maxPairs: number = 50
  ): { memoryA: MemoryObject; memoryB: MemoryObject }[] {
    const activeMemories = memories.filter((m) => m.lifecycle.status !== 'archived');
    const pairs: { memoryA: MemoryObject; memoryB: MemoryObject }[] = [];

    for (let i = 0; i < activeMemories.length; i++) {
      for (let j = i + 1; j < activeMemories.length; j++) {
        if (pairs.length >= maxPairs) return pairs;

        const memA = activeMemories[i];
        const memB = activeMemories[j];

        const sharedEntities =
          memA.subjectRefs?.entityIds?.some((id) =>
            memB.subjectRefs?.entityIds?.includes(id)
          ) || false;

        const sharedTopics =
          memA.topics?.some((t) =>
            memB.topics?.some((bt) => bt.toLowerCase() === t.toLowerCase())
          ) || false;

        if (sharedEntities || sharedTopics || memA.type === memB.type) {
          pairs.push({ memoryA: memA, memoryB: memB });
        }
      }
    }

    return pairs;
  }

  /**
   * Evaluates an array of candidate memory pairs and formats conflict detection records.
   */
  public static async evaluatePairs(
    pairs: { memoryA: MemoryObject; memoryB: MemoryObject }[]
  ): Promise<
    {
      hasConflict: boolean;
      conflict?: {
        workspaceId: string;
        organizationId: string;
        memoryIdA: string;
        memoryIdB: string;
        summary: string;
        conflictType: ConflictType;
        confidenceScore: number;
        evidenceA: {
          memoryId: string;
          title: string;
          quote: string;
          sourceType: MemoryObject['source']['type'];
          sourceId: string;
          createdAt: string;
        };
        evidenceB: {
          memoryId: string;
          title: string;
          quote: string;
          sourceType: MemoryObject['source']['type'];
          sourceId: string;
          createdAt: string;
        };
        opposingAspects: string[];
      };
    }[]
  > {
    const results: {
      hasConflict: boolean;
      conflict?: {
        workspaceId: string;
        organizationId: string;
        memoryIdA: string;
        memoryIdB: string;
        summary: string;
        conflictType: ConflictType;
        confidenceScore: number;
        evidenceA: {
          memoryId: string;
          title: string;
          quote: string;
          sourceType: MemoryObject['source']['type'];
          sourceId: string;
          createdAt: string;
        };
        evidenceB: {
          memoryId: string;
          title: string;
          quote: string;
          sourceType: MemoryObject['source']['type'];
          sourceId: string;
          createdAt: string;
        };
        opposingAspects: string[];
      };
    }[] = [];

    for (const pair of pairs) {
      const evaluation = await this.evaluateMemoryPair(pair.memoryA, pair.memoryB);

      if (evaluation.isContradiction && evaluation.confidenceScore >= 0.75) {
        results.push({
          hasConflict: true,
          conflict: {
            workspaceId: pair.memoryA.workspaceId,
            organizationId: pair.memoryA.organizationId,
            memoryIdA: pair.memoryA.id,
            memoryIdB: pair.memoryB.id,
            summary: evaluation.summary,
            conflictType: evaluation.conflictType,
            confidenceScore: evaluation.confidenceScore,
            evidenceA: {
              memoryId: pair.memoryA.id,
              title: pair.memoryA.title || `${pair.memoryA.type} Knowledge`,
              quote: pair.memoryA.evidence || pair.memoryA.content,
              sourceType: pair.memoryA.source.type,
              sourceId: pair.memoryA.source.sourceId,
              createdAt: pair.memoryA.createdAt,
            },
            evidenceB: {
              memoryId: pair.memoryB.id,
              title: pair.memoryB.title || `${pair.memoryB.type} Knowledge`,
              quote: pair.memoryB.evidence || pair.memoryB.content,
              sourceType: pair.memoryB.source.type,
              sourceId: pair.memoryB.source.sourceId,
              createdAt: pair.memoryB.createdAt,
            },
            opposingAspects: evaluation.opposingAspects,
          },
        });
      } else {
        results.push({ hasConflict: false });
      }
    }

    return results;
  }

  /**
   * Scans a set of memories within a workspace and records any newly detected conflicts.
   */
  public static async detectAndRecordConflicts(params: {
    workspaceId: string;
    organizationId: string;
    memories: MemoryObject[];
    maxPairsToEvaluate?: number;
  }): Promise<MemoryConflict[]> {
    const { workspaceId, organizationId, memories, maxPairsToEvaluate = 50 } = params;
    const pairs = this.findCandidatePairs(memories, maxPairsToEvaluate);
    const recordedConflicts: MemoryConflict[] = [];

    for (const pair of pairs) {
      const existingConflict = await ConflictRepository.findConflictByPair(
        workspaceId,
        pair.memoryA.id,
        pair.memoryB.id
      );

      if (existingConflict) continue;

      const evaluation = await this.evaluateMemoryPair(pair.memoryA, pair.memoryB);

      if (evaluation.isContradiction && evaluation.confidenceScore >= 0.75) {
        const conflict = await ConflictRepository.createConflict({
          workspaceId,
          organizationId,
          memoryIdA: pair.memoryA.id,
          memoryIdB: pair.memoryB.id,
          summary: evaluation.summary,
          status: 'unresolved',
          conflictType: evaluation.conflictType,
          confidenceScore: evaluation.confidenceScore,
          detectedBy: 'ai',
          evidenceA: {
            memoryId: pair.memoryA.id,
            title: pair.memoryA.title || `${pair.memoryA.type} Knowledge`,
            quote: pair.memoryA.evidence || pair.memoryA.content,
            sourceType: pair.memoryA.source.type,
            sourceId: pair.memoryA.source.sourceId,
            createdAt: pair.memoryA.createdAt,
          },
          evidenceB: {
            memoryId: pair.memoryB.id,
            title: pair.memoryB.title || `${pair.memoryB.type} Knowledge`,
            quote: pair.memoryB.evidence || pair.memoryB.content,
            sourceType: pair.memoryB.source.type,
            sourceId: pair.memoryB.source.sourceId,
            createdAt: pair.memoryB.createdAt,
          },
          opposingAspects: evaluation.opposingAspects,
        });

        recordedConflicts.push(conflict);
      }
    }

    return recordedConflicts;
  }
}
