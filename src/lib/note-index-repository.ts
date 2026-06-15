import { adminDb, FieldValue } from '@/lib/firebase-admin';
import {
  NOTE_INDEX_COLLECTION,
  type NoteIndexRow,
  type UnifiedNote,
} from './quick-notes-types';

/**
 * Quick Notes — denormalised read-model (`note_index`) projection layer.
 *
 * The unified feed's scale target (design spec §3.2): every note (native +
 * legacy) projects into one collection queried with composite indexes + cursor
 * pagination, instead of scanning the tasks collection at read time.
 *
 * Server-only (Admin SDK; the `note_index` rules forbid client writes). The
 * read-time aggregator remains the live mechanism + cold-start fallback; this
 * collection is populated by `scripts/backfill-note-index.ts` and can be kept
 * fresh by Firestore triggers / a scheduled re-sync (ops follow-up).
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
   * Bulk projection in chunked batches (used by the backfill). Optional
   * `embeddings` map (keyed by UnifiedNote id) stores a search vector per note.
   */
  static async projectMany(notes: UnifiedNote[], embeddings?: Map<string, number[]>): Promise<number> {
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

  /**
   * Semantic nearest-neighbour search within a workspace. Requires the Firestore
   * vector index (see scripts/NOTE_INDEX_VECTOR_README.md) and a backfilled
   * `note_index` with embeddings.
   */
  static async searchByVector(
    workspaceId: string,
    queryVector: number[],
    limit = 10
  ): Promise<NoteIndexRow[]> {
    if (queryVector.length === 0) return [];
    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .findNearest({
        vectorField: 'embedding',
        queryVector: FieldValue.vector(queryVector),
        limit,
        distanceMeasure: 'COSINE',
      })
      .get();
    return snap.docs.map((d) => {
      const { embedding, ...rest } = d.data() as NoteIndexRow & { embedding?: unknown };
      void embedding; // strip the heavy vector from the returned payload
      return rest as NoteIndexRow;
    });
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
