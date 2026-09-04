import { adminDb, FieldValue } from '@/lib/firebase-admin';
import {
  NOTE_INDEX_COLLECTION,
  type NoteIndexRow,
  type UnifiedNote,
  type KnowledgeType,
  type UnifiedNoteSource,
} from './quick-notes-types';

/**
 * Quick Notes — denormalised read-model (`note_index`) projection layer (Phase 4).
 *
 * The unified feed's scale target: every note (native + legacy) projects into one
 * collection queried with composite indexes, vector nearest-neighbours, and
 * token matching, instead of scanning multiple collections at read time.
 *
 * Server-only (Admin SDK; the `note_index` rules forbid client writes).
 */

const MAX_BATCH = 450;

export class NoteIndexRepository {
  private static get collection() {
    return adminDb.collection(NOTE_INDEX_COLLECTION);
  }

  /** Firestore doc ids cannot contain '/'. UnifiedNote ids never do, but guard anyway. */
  static docId(unifiedId: string): string {
    return unifiedId.replace(/\//g, '_');
  }

  /** Pure projection of a UnifiedNote into a stored index row. */
  static toRow(note: UnifiedNote, extra?: Partial<NoteIndexRow>): NoteIndexRow {
    const { attachments, ...rest } = note;
    return {
      ...rest,
      attachmentCount: attachments?.length ?? 0,
      indexedAt: new Date().toISOString(),
      ...extra,
    };
  }

  /**
   * Converts a row to its Firestore write payload: drops `undefined` and wraps
   * the embedding as a native Vector value (required for `findNearest`).
   */
  private static toWritePayload(row: NoteIndexRow): Record<string, unknown> {
    const { embedding, ...rest } = row;
    const payload: Record<string, unknown> = stripUndefined(rest);
    if (embedding && embedding.length > 0) {
      payload.embedding = FieldValue.vector(embedding);
    }
    return payload;
  }

  static async projectNote(note: UnifiedNote, extra?: Partial<NoteIndexRow>): Promise<void> {
    const row = this.toRow(note, extra);
    await this.collection.doc(this.docId(note.id)).set(this.toWritePayload(row), { merge: true });
  }

  /**
   * Bulk projection in chunked batches (used by re-indexing & backfill). Optional
   * `embeddings` map (keyed by UnifiedNote id) stores a search vector per note.
   */
  static async projectMany(
    notes: UnifiedNote[],
    embeddings?: Map<string, number[]>,
    onBatchComplete?: (written: number) => void
  ): Promise<number> {
    let written = 0;
    for (let i = 0; i < notes.length; i += MAX_BATCH) {
      const chunk = notes.slice(i, i + MAX_BATCH);
      const batch = adminDb.batch();
      for (const note of chunk) {
        const row = this.toRow(note, { embedding: embeddings?.get(note.id) });
        batch.set(this.collection.doc(this.docId(note.id)), this.toWritePayload(row), { merge: true });
      }
      await batch.commit();
      written += chunk.length;
      if (onBatchComplete) onBatchComplete(written);
    }
    return written;
  }

  static async deleteByUnifiedId(unifiedId: string): Promise<void> {
    await this.collection.doc(this.docId(unifiedId)).delete();
  }

  static async listByWorkspace(workspaceId: string, limit = 100): Promise<NoteIndexRow[]> {
    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .orderBy('isPinned', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as NoteIndexRow);
  }

  static async countByWorkspace(workspaceId: string): Promise<number> {
    const snap = await this.collection.where('workspaceId', '==', workspaceId).count().get();
    return snap.data().count;
  }

  /**
   * Semantic nearest-neighbour search within a workspace. Requires the Firestore
   * vector index and a backfilled `note_index` with embeddings.
   */
  static async searchByVector(
    workspaceId: string,
    queryVector: number[],
    limit = 10,
    options?: {
      knowledgeTypes?: KnowledgeType[];
      sources?: UnifiedNoteSource[];
    }
  ): Promise<NoteIndexRow[]> {
    if (queryVector.length === 0) return [];

    let query = this.collection.where('workspaceId', '==', workspaceId);

    const snap = await query
      .findNearest({
        vectorField: 'embedding',
        queryVector: FieldValue.vector(queryVector),
        limit: Math.min(limit * 2, 50), // Fetch buffer for client/in-memory filtering
        distanceMeasure: 'COSINE',
      })
      .get();

    let rows = snap.docs.map((d) => {
      const { embedding, ...rest } = d.data() as NoteIndexRow & { embedding?: unknown };
      void embedding; // strip the heavy vector from the returned payload
      return rest as NoteIndexRow;
    });

    if (options?.knowledgeTypes && options.knowledgeTypes.length > 0) {
      const typesSet = new Set(options.knowledgeTypes);
      rows = rows.filter((r) => r.knowledgeType && typesSet.has(r.knowledgeType));
    }

    if (options?.sources && options.sources.length > 0) {
      const sourcesSet = new Set(options.sources);
      rows = rows.filter((r) => sourcesSet.has(r.source));
    }

    return rows.slice(0, limit);
  }

  /**
   * Lexical token search over indexed rows in a workspace (Phase 4).
   * Queries workspace rows and ranks by token match frequency in title, plainText, and tags.
   */
  static async searchByKeywords(
    workspaceId: string,
    terms: string[],
    limit = 20,
    options?: {
      knowledgeTypes?: KnowledgeType[];
      sources?: UnifiedNoteSource[];
      entityId?: string;
    }
  ): Promise<NoteIndexRow[]> {
    if (!workspaceId || terms.length === 0) return [];

    // Query most recent indexed records for the workspace (bounded at 250 for low latency)
    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get();

    const normalizedTerms = terms.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 1);
    if (normalizedTerms.length === 0) return [];

    const scoredRows: Array<{ row: NoteIndexRow; matchScore: number }> = [];

    for (const doc of snap.docs) {
      const row = doc.data() as NoteIndexRow;

      // Filter by knowledge type if specified
      if (options?.knowledgeTypes && options.knowledgeTypes.length > 0) {
        if (!row.knowledgeType || !options.knowledgeTypes.includes(row.knowledgeType)) continue;
      }

      // Filter by source if specified
      if (options?.sources && options.sources.length > 0) {
        if (!options.sources.includes(row.source)) continue;
      }

      // Filter by entity if specified
      if (options?.entityId) {
        const matchesEntity =
          row.links?.entityId === options.entityId ||
          row.links?.contactId === options.entityId ||
          row.links?.leadId === options.entityId ||
          row.links?.dealId === options.entityId ||
          row.links?.taskId === options.entityId;
        if (!matchesEntity) continue;
      }

      const titleLower = (row.title || '').toLowerCase();
      const textLower = (row.plainText || '').toLowerCase();
      const tagsLower = (row.tags || []).map((t) => t.toLowerCase());

      let matchScore = 0;

      for (const term of normalizedTerms) {
        if (titleLower.includes(term)) matchScore += 10;
        if (textLower.includes(term)) matchScore += 3;
        if (tagsLower.some((t) => t.includes(term))) matchScore += 5;
        if (row.links?.entityName?.toLowerCase().includes(term)) matchScore += 6;
        if (row.links?.contactName?.toLowerCase().includes(term)) matchScore += 6;
        if (row.links?.dealName?.toLowerCase().includes(term)) matchScore += 6;
      }

      if (matchScore > 0) {
        scoredRows.push({ row, matchScore });
      }
    }

    // Sort descending by keyword score
    return scoredRows
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map((s) => s.row);
  }

  /**
   * Scoped search by CRM entity linkage (Phase 4).
   */
  static async searchByEntity(
    workspaceId: string,
    entityId: string,
    limit = 25
  ): Promise<NoteIndexRow[]> {
    if (!workspaceId || !entityId) return [];

    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const matched: NoteIndexRow[] = [];
    for (const doc of snap.docs) {
      const row = doc.data() as NoteIndexRow;
      if (
        row.links?.entityId === entityId ||
        row.links?.contactId === entityId ||
        row.links?.leadId === entityId ||
        row.links?.dealId === entityId ||
        row.links?.taskId === entityId
      ) {
        matched.push(row);
      }
      if (matched.length >= limit) break;
    }

    return matched;
  }
}

/** Firestore rejects `undefined`; drop those keys before writing. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
