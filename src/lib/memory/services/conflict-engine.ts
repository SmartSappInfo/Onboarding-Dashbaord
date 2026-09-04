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
          title: memoryA.title,
          content: memoryA.content,
          type: memoryA.type,
          createdAt: memoryA.createdAt,
        },
        memoryB: {
          id: memoryB.id,
          title: memoryB.title,
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
          title: memoryA.title,
          content: memoryA.content,
          type: memoryA.type,
          createdAt: memoryA.createdAt,
        },
        memoryB: {
          id: memoryB.id,
          title: memoryB.title,
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
   * Scans a set of memories within a workspace and records any newly detected conflicts.
   */
  public static async detectAndRecordConflicts(params: {
    workspaceId: string;
    organizationId: string;
    memories: MemoryObject[];
    maxPairsToEvaluate?: number;
  }): Promise<MemoryConflict[]> {
    const { workspaceId, organizationId, memories, maxPairsToEvaluate = 50 } = params;
    const activeMemories = memories.filter((m) => m.lifecycle.status !== 'archived');
    const recordedConflicts: MemoryConflict[] = [];

    let pairsEvaluated = 0;

    for (let i = 0; i < activeMemories.length; i++) {
      for (let j = i + 1; j < activeMemories.length; j++) {
        if (pairsEvaluated >= maxPairsToEvaluate) break;

        const memA = activeMemories[i];
        const memB = activeMemories[j];

        // Skip evaluation if both have no shared entity or topical overlap unless general
        const sharedEntities =
          memA.subjectRefs?.entityIds?.some((id) =>
            memB.subjectRefs?.entityIds?.includes(id)
          ) || false;
        const sharedTopics =
          memA.topics?.some((t) => memB.topics?.includes(t)) || false;

        // If they share no entities and no topics, skip unless they share the same memory type
        if (!sharedEntities && !sharedTopics && memA.type !== memB.type) {
          continue;
        }

        pairsEvaluated++;

        // Check if conflict is already recorded in the database
        const existingConflict = await ConflictRepository.findConflictByPair(
          workspaceId,
          memA.id,
          memB.id
        );

        if (existingConflict) {
          continue;
        }

        const evaluation = await this.evaluateMemoryPair(memA, memB);

        if (evaluation.isContradiction && evaluation.confidenceScore >= 0.75) {
          const conflict = await ConflictRepository.createConflict({
            workspaceId,
            organizationId,
            memoryIdA: memA.id,
            memoryIdB: memB.id,
            summary: evaluation.summary,
            status: 'unresolved',
            conflictType: evaluation.conflictType,
            confidenceScore: evaluation.confidenceScore,
            detectedBy: 'ai',
            evidenceA: {
              memoryId: memA.id,
              title: memA.title,
              quote: memA.evidence || memA.content,
              sourceType: memA.source.type,
              sourceId: memA.source.sourceId,
              createdAt: memA.createdAt,
            },
            evidenceB: {
              memoryId: memB.id,
              title: memB.title,
              quote: memB.evidence || memB.content,
              sourceType: memB.source.type,
              sourceId: memB.source.sourceId,
              createdAt: memB.createdAt,
            },
            opposingAspects: evaluation.opposingAspects,
          });

          recordedConflicts.push(conflict);
        }
      }
    }

    return recordedConflicts;
  }
}
