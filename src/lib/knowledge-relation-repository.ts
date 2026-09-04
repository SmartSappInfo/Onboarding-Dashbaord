import { adminDb } from '@/lib/firebase-admin';
import {
  KNOWLEDGE_RELATIONS_COLLECTION,
  type KnowledgeRelation,
  type KnowledgeRelationType,
} from './quick-notes-types';

/**
 * Knowledge Relation Repository (Company Brain Phase 5).
 *
 * Server-only data access layer for typed knowledge relationships and bi-directional
 * backlinks across notes, ideas, decisions, and CRM records.
 *
 * All operations enforce strict multi-tenant boundary isolation by workspaceId.
 */

const MAX_BATCH_SIZE = 450;

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

export class KnowledgeRelationRepository {
  private static get collection() {
    return adminDb.collection(KNOWLEDGE_RELATIONS_COLLECTION);
  }

  /**
   * Creates and persists a single typed relationship.
   */
  static async createRelation(
    relation: Omit<KnowledgeRelation, 'id' | 'createdAt'>
  ): Promise<KnowledgeRelation> {
    const docRef = this.collection.doc();
    const now = new Date().toISOString();

    const record: KnowledgeRelation = {
      ...relation,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(stripUndefined(record as unknown as Record<string, unknown>));
    return record;
  }

  /**
   * Deletes a relationship safely, verifying workspace tenant boundaries.
   */
  static async deleteRelation(workspaceId: string, relationId: string): Promise<void> {
    const docRef = this.collection.doc(relationId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return;
    }

    const data = snap.data() as KnowledgeRelation;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Forbidden: Attempted cross-tenant relationship deletion.');
    }

    await docRef.delete();
  }

  /**
   * Fetches all relations for a workspace, optionally filtered by source, target, or types.
   */
  static async fetchRelationsForWorkspace(
    workspaceId: string,
    options: {
      fromObjectId?: string;
      toObjectId?: string;
      relationTypes?: KnowledgeRelationType[];
      limit?: number;
    } = {}
  ): Promise<KnowledgeRelation[]> {
    let query: FirebaseFirestore.Query = this.collection.where('workspaceId', '==', workspaceId);

    if (options.fromObjectId) {
      query = query.where('fromObjectId', '==', options.fromObjectId);
    }

    if (options.toObjectId) {
      query = query.where('toObjectId', '==', options.toObjectId);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(500);
    }

    const snap = await query.get();
    let relations = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as KnowledgeRelation));

    if (options.relationTypes && options.relationTypes.length > 0) {
      const allowed = new Set(options.relationTypes);
      relations = relations.filter((r) => allowed.has(r.relationType));
    }

    return relations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Fetches all incoming backlinks for a given target object.
   */
  static async fetchBacklinks(
    workspaceId: string,
    targetObjectId: string
  ): Promise<KnowledgeRelation[]> {
    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .where('toObjectId', '==', targetObjectId)
      .limit(200)
      .get();

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as KnowledgeRelation))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Batch creates relationships safely (batched in chunks <= 450).
   */
  static async batchCreateRelations(
    workspaceId: string,
    relations: Array<Omit<KnowledgeRelation, 'id' | 'createdAt'>>
  ): Promise<KnowledgeRelation[]> {
    if (relations.length === 0) return [];

    const now = new Date().toISOString();
    const createdRecords: KnowledgeRelation[] = [];

    for (let i = 0; i < relations.length; i += MAX_BATCH_SIZE) {
      const chunk = relations.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const rel of chunk) {
        const docRef = this.collection.doc();
        const record: KnowledgeRelation = {
          ...rel,
          id: docRef.id,
          workspaceId,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(docRef, stripUndefined(record as unknown as Record<string, unknown>));
        createdRecords.push(record);
      }

      await batch.commit();
    }

    return createdRecords;
  }

  /**
   * Cascading cleanup: deletes all relations where objectId is either source or target.
   */
  static async deleteRelationsForObject(workspaceId: string, objectId: string): Promise<number> {
    const [fromSnap, toSnap] = await Promise.all([
      this.collection
        .where('workspaceId', '==', workspaceId)
        .where('fromObjectId', '==', objectId)
        .get(),
      this.collection
        .where('workspaceId', '==', workspaceId)
        .where('toObjectId', '==', objectId)
        .get(),
    ]);

    const docIds = new Set<string>();
    fromSnap.docs.forEach((d) => docIds.add(d.id));
    toSnap.docs.forEach((d) => docIds.add(d.id));

    if (docIds.size === 0) return 0;

    const idList = Array.from(docIds);
    for (let i = 0; i < idList.length; i += MAX_BATCH_SIZE) {
      const chunk = idList.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((id) => batch.delete(this.collection.doc(id)));
      await batch.commit();
    }

    return docIds.size;
  }
}
