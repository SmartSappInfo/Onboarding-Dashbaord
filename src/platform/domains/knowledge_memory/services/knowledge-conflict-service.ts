/**
 * @fileOverview Knowledge Conflict & Contradiction Detection Service (Phase 11 M3 · T3)
 *
 * Implements Rule 17 (Non-Delegable Human Conflict Decider),
 * Rule 18 (TOCTOU Version Token Freshness),
 * Rule 40 (Domain Event Publishing),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR).
 */

import { adminDb } from '@/lib/firebase-admin';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  KnowledgeConflictSchema,
  type KnowledgeConflict,
  type ResolveConflictInput,
  type KnowledgeCandidate,
  type KnowledgeConflictType,
} from '../contracts/knowledge-schemas';
import {
  KnowledgeDomainError,
  KNOWLEDGE_ERROR_CODES,
} from '../contracts/knowledge-errors';

export class KnowledgeConflictService {
  private inMemoryConflicts = new Map<string, KnowledgeConflict>();

  /**
   * Creates a new open conflict record in memory_conflicts.
   */
  async createConflictRecord(draft: {
    organizationId: string;
    workspaceId: string;
    candidateId: string;
    existingMemoryId: string;
    conflictType: KnowledgeConflictType;
  }): Promise<KnowledgeConflict> {
    const id = `kn_conf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const conflict: KnowledgeConflict = {
      id,
      organizationId: draft.organizationId,
      workspaceId: draft.workspaceId,
      candidateId: draft.candidateId,
      existingMemoryId: draft.existingMemoryId,
      conflictType: draft.conflictType,
      status: 'open',
      detectedAt: now,
      version: 1,
    };

    const validated = KnowledgeConflictSchema.parse(conflict);
    this.inMemoryConflicts.set(id, validated);

    if (adminDb) {
      try {
        await adminDb.collection('memory_conflicts').doc(id).set(validated);
      } catch {
        // In-memory fallback
      }
    }

    return validated;
  }

  /**
   * Scans candidate against existing memories for entity overlap and contradictory predicates.
   */
  async detectConflicts(
    candidate: KnowledgeCandidate,
    existingMemories: Array<{
      id: string;
      title: string;
      content: string;
      subjectRefs?: string[];
      suggestedRelationships?: Array<{ targetId: string; predicate: string }>;
    }>
  ): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];
    const candSubjectSet = new Set(candidate.subjectRefs);

    // Also include target IDs from relationships in subjects
    for (const rel of candidate.suggestedRelationships) {
      candSubjectSet.add(rel.targetId);
    }

    if (candSubjectSet.size === 0) {
      return conflicts;
    }

    const candNormalized = candidate.content.toLowerCase();

    for (const mem of existingMemories) {
      const memSubjects = new Set(mem.subjectRefs ?? []);
      for (const rel of mem.suggestedRelationships ?? []) {
        memSubjects.add(rel.targetId);
      }

      // Check subject overlap
      let hasSubjectOverlap = false;
      for (const s of candSubjectSet) {
        if (memSubjects.has(s)) {
          hasSubjectOverlap = true;
          break;
        }
      }

      if (!hasSubjectOverlap) {
        continue;
      }

      // Check predicate clash or semantic contradiction
      let isContradiction = false;

      // 1. Shared relationship predicate with different targets or opposing semantics
      if (candidate.suggestedRelationships.length > 0 && mem.suggestedRelationships && mem.suggestedRelationships.length > 0) {
        for (const cRel of candidate.suggestedRelationships) {
          for (const mRel of mem.suggestedRelationships) {
            if (cRel.predicate === mRel.predicate) {
              // Same predicate on same entity, check if text diverges
              if (candNormalized !== mem.content.toLowerCase()) {
                isContradiction = true;
                break;
              }
            }
          }
          if (isContradiction) break;
        }
      }

      // 2. Numerical / Term clashes (e.g. Net-30 vs Net-60)
      if (!isContradiction) {
        const netTermsRegex = /net[- ]?(\d+)/gi;
        const candNetMatch = netTermsRegex.exec(candNormalized);
        netTermsRegex.lastIndex = 0;
        const memNetMatch = netTermsRegex.exec(mem.content.toLowerCase());

        if (candNetMatch && memNetMatch && candNetMatch[1] !== memNetMatch[1]) {
          isContradiction = true;
        }
      }

      // 3. Opposing polarity keywords
      if (!isContradiction) {
        const polarityPairs = [
          ['agreed', 'insists'],
          ['agreed', 'rejected'],
          ['approved', 'rejected'],
          ['open', 'closed'],
          ['valid', 'expired'],
        ];

        const memNormalized = mem.content.toLowerCase();
        for (const [pos, neg] of polarityPairs) {
          if (
            (candNormalized.includes(neg) && memNormalized.includes(pos)) ||
            (candNormalized.includes(pos) && memNormalized.includes(neg))
          ) {
            isContradiction = true;
            break;
          }
        }
      }

      if (isContradiction) {
        const conflictRecord = await this.createConflictRecord({
          organizationId: candidate.organizationId,
          workspaceId: candidate.workspaceId,
          candidateId: candidate.id,
          existingMemoryId: mem.id,
          conflictType: 'contradiction',
        });

        conflicts.push(conflictRecord);

        // Emit domain event (Rule 40)
        try {
          await defaultEventBus.publish(
            createDomainEvent({
              type: 'knowledge.conflict.detected',
              organizationId: candidate.organizationId,
              workspaceId: candidate.workspaceId,
              actor: { id: 'system', type: 'system' },
              entity: { type: 'knowledge_conflict', id: conflictRecord.id },
              payload: {
                conflictId: conflictRecord.id,
                candidateId: candidate.id,
                existingMemoryId: mem.id,
                conflictType: 'contradiction',
              },
              correlationId: `corr_${conflictRecord.id}`,
              source: 'knowledge_conflict_service',
            })
          );
        } catch {
          // Non-blocking
        }
      }
    }

    return conflicts;
  }

  /**
   * Retrieves conflict by ID with workspace anti-IDOR check.
   */
  async getConflict(conflictId: string, workspaceId: string): Promise<KnowledgeConflict> {
    let conflict = this.inMemoryConflicts.get(conflictId);

    if (!conflict && adminDb) {
      try {
        const snap = await adminDb.collection('memory_conflicts').doc(conflictId).get();
        if (snap.exists) {
          conflict = KnowledgeConflictSchema.parse(snap.data());
          this.inMemoryConflicts.set(conflictId, conflict);
        }
      } catch {
        // Fall through
      }
    }

    if (!conflict) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.CONFLICT_NOT_FOUND,
        `Conflict with id '${conflictId}' not found.`
      );
    }

    if (conflict.workspaceId !== workspaceId) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.IDOR_VIOLATION,
        `Access denied: conflict '${conflictId}' does not belong to workspace '${workspaceId}'.`
      );
    }

    return conflict;
  }

  /**
   * Lists conflicts for a workspace.
   */
  async listConflicts(options: {
    workspaceId: string;
    status?: 'open' | 'resolved';
    limit?: number;
  }): Promise<KnowledgeConflict[]> {
    const limit = options.limit ?? 50;
    const memoryMatches = Array.from(this.inMemoryConflicts.values()).filter(
      (c) => c.workspaceId === options.workspaceId && (!options.status || c.status === options.status)
    );

    if (memoryMatches.length > 0 || !adminDb) {
      return memoryMatches.slice(0, limit);
    }

    try {
      let query: FirebaseFirestore.Query = adminDb
        .collection('memory_conflicts')
        .where('workspaceId', '==', options.workspaceId);

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      const snap = await query.limit(limit).get();
      return snap.docs.map((doc) => KnowledgeConflictSchema.parse(doc.data()));
    } catch {
      return memoryMatches.slice(0, limit);
    }
  }

  /**
   * Resolves an open conflict. Strictly non-delegable to AI agents (Rule 17 Non-Negotiable).
   */
  async resolveConflict(
    input: ResolveConflictInput,
    actor: { id: string; type: 'user' | 'agent' }
  ): Promise<KnowledgeConflict> {
    // 1. Rule 17 Gate: Strictly Non-Delegable to AI Agents
    if (actor.type !== 'user') {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.NON_DELEGABLE_ACTION,
        'Conflict resolution is strictly non-delegable to AI agents (Rule 17 Non-Negotiable).'
      );
    }

    // 2. Fetch conflict and verify workspace
    const conflict = await this.getConflict(input.conflictId, input.workspaceId);

    // 3. Concurrency and status check
    if (conflict.status !== 'open') {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.CONFLICT_ALREADY_RESOLVED,
        `Conflict '${input.conflictId}' is already resolved.`
      );
    }

    if (conflict.version !== input.version) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.VERSION_MISMATCH,
        `Version conflict: expected version ${input.version}, but current version is ${conflict.version}.`
      );
    }

    const now = new Date().toISOString();
    const updated: KnowledgeConflict = {
      ...conflict,
      status: 'resolved',
      resolvedAt: now,
      resolution: {
        resolutionType: input.resolution,
        resolvedBy: actor.id,
        resolvedAt: now,
        notes: input.notes,
      },
      version: conflict.version + 1,
    };

    const validated = KnowledgeConflictSchema.parse(updated);
    this.inMemoryConflicts.set(input.conflictId, validated);

    if (adminDb) {
      try {
        await adminDb.collection('memory_conflicts').doc(input.conflictId).set(validated);
      } catch {
        // Fallback
      }
    }

    // 4. Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.conflict.resolved',
          organizationId: conflict.organizationId,
          workspaceId: conflict.workspaceId,
          actor: { id: actor.id, type: 'user' },
          entity: { type: 'knowledge_conflict', id: input.conflictId },
          payload: {
            conflictId: input.conflictId,
            resolutionType: input.resolution,
            resolvedBy: actor.id,
          },
          correlationId: `corr_${input.conflictId}`,
          source: 'knowledge_conflict_service',
        })
      );
    } catch {
      // Non-blocking
    }

    return validated;
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_CONFLICT_SERVICE_KEY = Symbol.for('smartsapp.knowledge_conflict_service');
type GlobalWithConflictService = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_CONFLICT_SERVICE_KEY]?: KnowledgeConflictService;
};

export function getKnowledgeConflictService(): KnowledgeConflictService {
  const g = globalThis as GlobalWithConflictService;
  if (!g[GLOBAL_KNOWLEDGE_CONFLICT_SERVICE_KEY]) {
    g[GLOBAL_KNOWLEDGE_CONFLICT_SERVICE_KEY] = new KnowledgeConflictService();
  }
  return g[GLOBAL_KNOWLEDGE_CONFLICT_SERVICE_KEY];
}
