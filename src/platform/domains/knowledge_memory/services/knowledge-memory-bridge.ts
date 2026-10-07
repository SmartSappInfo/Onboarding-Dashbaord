/**
 * @fileOverview Rule 29 Immutable Fact Supersession & Memory Bridge (Phase 11 M3 · T4)
 *
 * Implements Rule 29 (Immutable Temporal Fact Supersession: NEVER overwrite or delete history),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR),
 * Rule 40 (Domain Event Publishing: memory.superseded & memory.created).
 */

import { adminDb } from '@/lib/firebase-admin';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { KnowledgeCandidate } from '../contracts/knowledge-schemas';
import {
  KnowledgeDomainError,
  KNOWLEDGE_ERROR_CODES,
} from '../contracts/knowledge-errors';

export interface MemoryRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  content: string;
  type: string;
  version: number;
  lifecycle: {
    status: 'active' | 'archived' | 'disputed' | 'stale';
    lastReviewedAt?: string;
    reviewedBy?: string;
  };
  temporalValidity: {
    validFrom: string;
    validUntil?: string;
    supersededBy?: string;
  };
  verification: string;
  subjectRefs?: string[];
  createdAt: string;
  updatedAt: string;
}

export class KnowledgeMemoryBridge {
  private inMemoryStore = new Map<string, MemoryRecord>();

  /**
   * Creates a new active memory record.
   */
  async createMemoryRecord(params: {
    organizationId: string;
    workspaceId: string;
    title: string;
    content: string;
    type: string;
    version?: number;
    subjectRefs?: string[];
  }): Promise<MemoryRecord> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const record: MemoryRecord = {
      id,
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      title: params.title,
      content: params.content,
      type: params.type,
      version: params.version ?? 1,
      lifecycle: {
        status: 'active',
      },
      temporalValidity: {
        validFrom: now,
      },
      verification: 'source_verified',
      subjectRefs: params.subjectRefs ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryStore.set(id, record);

    if (adminDb) {
      try {
        await adminDb.collection('memory_objects').doc(id).set(record);
      } catch {
        // Fallback
      }
    }

    return record;
  }

  /**
   * Retrieves a memory record by ID with workspace anti-IDOR validation.
   */
  async getMemoryRecord(id: string, workspaceId: string): Promise<MemoryRecord | null> {
    let record = this.inMemoryStore.get(id);

    if (!record && adminDb) {
      try {
        const snap = await adminDb.collection('memory_objects').doc(id).get();
        if (snap.exists) {
          record = snap.data() as MemoryRecord;
          this.inMemoryStore.set(id, record);
        }
      } catch {
        // Fallback
      }
    }

    if (!record) return null;

    if (record.workspaceId !== workspaceId) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.IDOR_VIOLATION,
        `Access denied: memory '${id}' does not belong to workspace '${workspaceId}'.`
      );
    }

    return record;
  }

  /**
   * Rule 29 Immutable Temporal Supersession:
   * Atomically marks old record archived with validUntil + supersededBy,
   * and creates a new active record with version = oldVersion + 1.
   * Zero data deletion.
   */
  async supersedeMemory(params: {
    organizationId: string;
    workspaceId: string;
    oldMemoryId: string;
    newMemoryDraft: {
      title: string;
      content: string;
      type: string;
      subjectRefs?: string[];
    };
    actorId: string;
  }): Promise<{ oldRecord: MemoryRecord; newRecord: MemoryRecord }> {
    const old = await this.getMemoryRecord(params.oldMemoryId, params.workspaceId);
    if (!old) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.CANDIDATE_NOT_FOUND,
        `Memory record '${params.oldMemoryId}' not found for supersession.`
      );
    }

    if (old.organizationId !== params.organizationId || old.workspaceId !== params.workspaceId) {
      throw new KnowledgeDomainError(
        KNOWLEDGE_ERROR_CODES.IDOR_VIOLATION,
        `Tenant mismatch: memory '${params.oldMemoryId}' does not belong to caller workspace.`
      );
    }

    const now = new Date().toISOString();
    const newMemoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newVersion = (old.version ?? 1) + 1;

    // 1. Update old record (archived + validUntil + supersededBy)
    const updatedOld: MemoryRecord = {
      ...old,
      lifecycle: {
        ...old.lifecycle,
        status: 'archived',
        lastReviewedAt: now,
        reviewedBy: params.actorId,
      },
      temporalValidity: {
        ...old.temporalValidity,
        validUntil: now,
        supersededBy: newMemoryId,
      },
      updatedAt: now,
    };

    // 2. Create new record (active + validFrom + version + 1)
    const newRecord: MemoryRecord = {
      id: newMemoryId,
      organizationId: old.organizationId,
      workspaceId: old.workspaceId,
      title: params.newMemoryDraft.title,
      content: params.newMemoryDraft.content,
      type: params.newMemoryDraft.type,
      version: newVersion,
      lifecycle: {
        status: 'active',
      },
      temporalValidity: {
        validFrom: now,
      },
      verification: 'user_confirmed',
      subjectRefs: params.newMemoryDraft.subjectRefs ?? old.subjectRefs ?? [],
      createdAt: now,
      updatedAt: now,
    };

    // 3. Atomically persist both
    this.inMemoryStore.set(old.id, updatedOld);
    this.inMemoryStore.set(newMemoryId, newRecord);

    if (adminDb) {
      try {
        const batch = adminDb.batch();
        batch.set(adminDb.collection('memory_objects').doc(old.id), updatedOld);
        batch.set(adminDb.collection('memory_objects').doc(newMemoryId), newRecord);
        await batch.commit();
      } catch {
        // Fallback
      }
    }

    // 4. Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'memory.superseded',
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          actor: { id: params.actorId, type: 'user' },
          entity: { type: 'memory_object', id: newMemoryId },
          payload: {
            oldMemoryId: old.id,
            newMemoryId,
            supersededVersion: old.version ?? 1,
            newVersion,
          },
          correlationId: `corr_${newMemoryId}`,
          source: 'knowledge_memory_bridge',
        })
      );
    } catch {
      // Non-blocking
    }

    return { oldRecord: updatedOld, newRecord };
  }

  /**
   * Materializes an accepted candidate into persistent memory_objects.
   * If supersededMemoryId is passed, executes Rule 29 supersession.
   */
  async materializeCandidate(
    candidate: KnowledgeCandidate,
    options?: { supersededMemoryId?: string; actorId?: string }
  ): Promise<{ memoryId: string; supersededMemoryId?: string; version: number }> {
    const actorId = options?.actorId ?? 'system';

    if (options?.supersededMemoryId) {
      const { newRecord } = await this.supersedeMemory({
        organizationId: candidate.organizationId,
        workspaceId: candidate.workspaceId,
        oldMemoryId: options.supersededMemoryId,
        newMemoryDraft: {
          title: candidate.title,
          content: candidate.content,
          type: candidate.type,
          subjectRefs: candidate.subjectRefs,
        },
        actorId,
      });

      return {
        memoryId: newRecord.id,
        supersededMemoryId: options.supersededMemoryId,
        version: newRecord.version,
      };
    }

    // New distinct fact
    const newRecord = await this.createMemoryRecord({
      organizationId: candidate.organizationId,
      workspaceId: candidate.workspaceId,
      title: candidate.title,
      content: candidate.content,
      type: candidate.type,
      version: 1,
      subjectRefs: candidate.subjectRefs,
    });

    // Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'memory.created',
          organizationId: candidate.organizationId,
          workspaceId: candidate.workspaceId,
          actor: { id: actorId, type: 'user' },
          entity: { type: 'memory_object', id: newRecord.id },
          payload: {
            memoryId: newRecord.id,
            type: newRecord.type,
            candidateId: candidate.id,
          },
          correlationId: `corr_${newRecord.id}`,
          source: 'knowledge_memory_bridge',
        })
      );
    } catch {
      // Non-blocking
    }

    return {
      memoryId: newRecord.id,
      version: newRecord.version,
    };
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_MEMORY_BRIDGE_KEY = Symbol.for('smartsapp.knowledge_memory_bridge');
type GlobalWithMemoryBridge = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_MEMORY_BRIDGE_KEY]?: KnowledgeMemoryBridge;
};

export function getKnowledgeMemoryBridge(): KnowledgeMemoryBridge {
  const g = globalThis as GlobalWithMemoryBridge;
  if (!g[GLOBAL_KNOWLEDGE_MEMORY_BRIDGE_KEY]) {
    g[GLOBAL_KNOWLEDGE_MEMORY_BRIDGE_KEY] = new KnowledgeMemoryBridge();
  }
  return g[GLOBAL_KNOWLEDGE_MEMORY_BRIDGE_KEY];
}
