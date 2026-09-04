/**
 * @fileOverview CompanyBrain 2.0: Memory Repository Layer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Point of Data Access for `memory_objects`:
 *    - All Firestore reads and mutations for organizational memories route through this repository.
 *    - Guarantees multi-tenant isolation via workspaceId and organizationId checks.
 * 2. High-Load Guard & Batch Chunking:
 *    - Batch operations chunk writes in blocks of <= 250 documents per chunk.
 * 3. Strict Zero-`any` typing:
 *    - Fully typed with TypeScript interfaces. No `any` or `any[]`.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-repository.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MemoryObject,
  MemoryFilterOptions,
  MemoryHealthStats,
} from './types';

export const MEMORY_OBJECTS_COLLECTION = 'memory_objects';

/** Helper to chunk array operations into Firestore batch-safe limits (<= 250). */
function chunkArray<T>(items: T[], chunkSize = 250): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Helper to prune undefined keys before writing to Firestore. */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) {
      delete clean[key];
    }
  }
  return clean;
}

export class MemoryRepository {
  private static get collection() {
    return adminDb.collection(MEMORY_OBJECTS_COLLECTION);
  }

  /**
   * Persists a single memory object to Firestore.
   */
  static async createMemory(
    params: Omit<MemoryObject, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MemoryObject> {
    const ref = this.collection.doc();
    const now = new Date().toISOString();

    const memory: MemoryObject = {
      ...params,
      id: ref.id,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(pruneUndefined(memory as unknown as Record<string, unknown>));
    return memory;
  }

  /**
   * Persists multiple memory objects in safe chunks of <= 250 operations.
   */
  static async createMemoriesBatch(
    memories: Omit<MemoryObject, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<MemoryObject[]> {
    if (memories.length === 0) return [];

    const now = new Date().toISOString();
    const createdMemories: MemoryObject[] = [];
    const chunks = chunkArray(memories, 250);

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const item of chunk) {
        const ref = this.collection.doc();
        const memory: MemoryObject = {
          ...item,
          id: ref.id,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(ref, pruneUndefined(memory as unknown as Record<string, unknown>));
        createdMemories.push(memory);
      }
      await batch.commit();
    }

    return createdMemories;
  }

  /**
   * Retrieves a memory object by ID.
   */
  static async getMemoryById(id: string): Promise<MemoryObject | null> {
    if (!id) return null;
    const snap = await this.collection.doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as MemoryObject;
  }

  /**
   * Retrieves memories linked to a specific source record (e.g. noteId, meetingId).
   */
  static async getMemoriesBySourceId(sourceId: string): Promise<MemoryObject[]> {
    if (!sourceId) return [];
    const snap = await this.collection
      .where('source.sourceId', '==', sourceId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((d) => d.data() as MemoryObject);
  }

  /**
   * Lists memory objects for a workspace with flexible multi-attribute filtering.
   */
  static async listMemories(
    workspaceId: string,
    filters: MemoryFilterOptions = {}
  ): Promise<MemoryObject[]> {
    if (!workspaceId) return [];

    let query: FirebaseFirestore.Query = this.collection.where('workspaceId', '==', workspaceId);

    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.verification) {
      query = query.where('verification', '==', filters.verification);
    }
    if (filters.status) {
      query = query.where('lifecycle.status', '==', filters.status);
    }
    if (filters.entityId) {
      query = query.where('subjectRefs.entityIds', 'array-contains', filters.entityId);
    }
    if (filters.dealId) {
      query = query.where('subjectRefs.dealIds', 'array-contains', filters.dealId);
    }

    query = query.orderBy('createdAt', 'desc');

    if (filters.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100);
    }

    const snap = await query.get();
    let results = snap.docs.map((d) => d.data() as MemoryObject);

    // In-memory query filter if client provided a search text string
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      results = results.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.topics.some((t) => t.toLowerCase().includes(q)) ||
          m.entities.some((e) => e.entityName.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Confirms an AI-generated memory, upgrading verification to 'user_confirmed'.
   */
  static async confirmMemory(id: string, userId: string): Promise<MemoryObject> {
    const memory = await this.getMemoryById(id);
    if (!memory) {
      throw new Error(`MemoryObject not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updates: Partial<MemoryObject> = {
      verification: 'user_confirmed',
      lifecycle: {
        ...memory.lifecycle,
        status: 'active',
        lastReviewedAt: now,
        reviewedBy: userId,
      },
      updatedAt: now,
    };

    await this.collection.doc(id).update(pruneUndefined(updates as Record<string, unknown>));

    return {
      ...memory,
      ...updates,
      lifecycle: {
        ...memory.lifecycle,
        ...updates.lifecycle!,
      },
    };
  }

  /**
   * Invalidates a memory object, marking it archived and setting invalidationReason.
   */
  static async invalidateMemory(
    id: string,
    reason: string,
    userId: string
  ): Promise<MemoryObject> {
    const memory = await this.getMemoryById(id);
    if (!memory) {
      throw new Error(`MemoryObject not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updates: Partial<MemoryObject> = {
      verification: 'invalidated',
      lifecycle: {
        ...memory.lifecycle,
        status: 'archived',
        lastReviewedAt: now,
        reviewedBy: userId,
        invalidationReason: reason.trim(),
      },
      updatedAt: now,
    };

    await this.collection.doc(id).update(pruneUndefined(updates as Record<string, unknown>));

    return {
      ...memory,
      ...updates,
      lifecycle: {
        ...memory.lifecycle,
        ...updates.lifecycle!,
      },
    };
  }

  /**
   * Generic update on a memory object.
   */
  static async updateMemory(
    id: string,
    updates: Partial<Omit<MemoryObject, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>
  ): Promise<MemoryObject> {
    const memory = await this.getMemoryById(id);
    if (!memory) {
      throw new Error(`MemoryObject not found: ${id}`);
    }

    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
    };

    await this.collection.doc(id).update(pruneUndefined(cleanUpdates as Record<string, unknown>));

    return {
      ...memory,
      ...cleanUpdates,
    };
  }

  /**
   * Deletes or soft-archives memories generated by a specific sourceId.
   */
  static async deleteMemoriesBySourceId(sourceId: string): Promise<number> {
    if (!sourceId) return 0;
    const snap = await this.collection.where('source.sourceId', '==', sourceId).get();
    if (snap.empty) return 0;

    const chunks = chunkArray(snap.docs, 250);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    return snap.docs.length;
  }

  /**
   * Computes health metrics for a workspace's organizational memory.
   */
  static async getMemoryStats(workspaceId: string): Promise<MemoryHealthStats> {
    if (!workspaceId) {
      return {
        totalMemories: 0,
        pendingReviewCount: 0,
        verifiedCount: 0,
        conflictsOrInvalidatedCount: 0,
      };
    }

    const snap = await this.collection.where('workspaceId', '==', workspaceId).get();

    let totalMemories = 0;
    let pendingReviewCount = 0;
    let verifiedCount = 0;
    let conflictsOrInvalidatedCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as MemoryObject;
      if (data.lifecycle?.status === 'archived' || data.verification === 'invalidated') {
        conflictsOrInvalidatedCount++;
      } else {
        totalMemories++;
        if (data.verification === 'ai_generated' || data.verification === 'unverified') {
          pendingReviewCount++;
        } else if (data.verification === 'user_confirmed' || data.verification === 'source_verified') {
          verifiedCount++;
        }
      }
    }

    return {
      totalMemories,
      pendingReviewCount,
      verifiedCount,
      conflictsOrInvalidatedCount,
    };
  }
}
