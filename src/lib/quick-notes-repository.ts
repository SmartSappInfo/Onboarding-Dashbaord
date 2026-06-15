import { adminDb } from '@/lib/firebase-admin';
import { extractPlainText, dedupeTags, pruneUndefined } from './quick-notes-domain';
import {
  QUICK_NOTES_COLLECTION,
  NOTE_CONTENT_VERSION,
  type QuickNote,
  type QuickNoteAiMeta,
  type QuickNoteCreateInput,
  type QuickNoteUpdateInput,
} from './quick-notes-types';

/**
 * Quick Notes — data access layer.
 *
 * Server-only. All Firestore reads/writes for `quick_notes` flow through here so
 * that orchestration (server actions: auth, activity logging, index projection)
 * stays separate from persistence, and the domain layer stays pure. Inputs are
 * assumed already validated by the calling action via the Zod schemas.
 */

/** @deprecated Use NOTE_CONTENT_VERSION from quick-notes-types. Kept as a re-export. */
export const CONTENT_SCHEMA_VERSION = NOTE_CONTENT_VERSION;

/** Thrown when an update loses an optimistic-concurrency race (design spec R12). */
export class QuickNoteConcurrencyError extends Error {
  constructor(message = 'This note was modified by someone else. Reload and try again.') {
    super(message);
    this.name = 'QuickNoteConcurrencyError';
  }
}

/** Thrown when a note cannot be found. */
export class QuickNoteNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Quick note not found: ${noteId}`);
    this.name = 'QuickNoteNotFoundError';
  }
}

export interface CreateQuickNoteParams {
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  createdByName?: string;
  input: QuickNoteCreateInput;
}

export interface UpdateQuickNoteParams {
  noteId: string;
  input: QuickNoteUpdateInput;
}

export interface ListByWorkspaceOptions {
  categoryId?: string;
  limit?: number;
}

export class QuickNoteRepository {
  private static get collection() {
    return adminDb.collection(QUICK_NOTES_COLLECTION);
  }

  static async create(params: CreateQuickNoteParams): Promise<QuickNote> {
    const { organizationId, workspaceId, createdBy, createdByName, input } = params;
    const ref = this.collection.doc();
    const now = new Date().toISOString();
    const plainText = extractPlainText(input.content);

    const note: QuickNote = {
      id: ref.id,
      organizationId,
      workspaceId,
      title: input.title.trim(),
      content: input.content,
      plainText,
      contentVersion: CONTENT_SCHEMA_VERSION,
      categoryId: input.categoryId,
      tags: dedupeTags(input.tags),
      attachments: input.attachments ?? [],
      links: input.links ?? {},
      isPinned: false,
      embeddingVersion: 1,
      createdBy,
      createdByName,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(pruneUndefined(note as unknown as Record<string, unknown>));
    return note;
  }

  static async getById(noteId: string): Promise<QuickNote | null> {
    const snap = await this.collection.doc(noteId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<QuickNote, 'id'>) };
  }

  /**
   * Partial update with an optimistic-concurrency guard. When `plainText`
   * changes, `embeddingVersion` is bumped so Phase 7 can re-embed lazily.
   */
  static async update(params: UpdateQuickNoteParams): Promise<QuickNote> {
    const { noteId, input } = params;
    const ref = this.collection.doc(noteId);

    return adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new QuickNoteNotFoundError(noteId);

      const current = { id: snap.id, ...(snap.data() as Omit<QuickNote, 'id'>) };

      if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
        throw new QuickNoteConcurrencyError();
      }

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { updatedAt: now };

      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
      if (input.tags !== undefined) patch.tags = dedupeTags(input.tags);
      if (input.attachments !== undefined) patch.attachments = input.attachments;
      if (input.links !== undefined) patch.links = input.links;

      if (input.content !== undefined) {
        patch.content = input.content;
        const nextPlainText = extractPlainText(input.content);
        patch.plainText = nextPlainText;
        if (nextPlainText !== current.plainText) {
          patch.embeddingVersion = (current.embeddingVersion ?? 0) + 1;
        }
      }

      tx.update(ref, pruneUndefined(patch));
      return { ...current, ...patch } as QuickNote;
    });
  }

  static async togglePin(noteId: string, isPinned: boolean, pinnedBy?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.collection.doc(noteId).update(
      pruneUndefined({
        isPinned,
        pinnedAt: isPinned ? now : undefined,
        pinnedBy: isPinned ? pinnedBy : undefined,
        updatedAt: now,
      })
    );
  }

  static async delete(noteId: string): Promise<void> {
    await this.collection.doc(noteId).delete();
  }

  /** Caches the AI insight on the note (server-side; does not bump updatedAt). */
  static async setAiMeta(noteId: string, ai: QuickNoteAiMeta): Promise<void> {
    await this.collection.doc(noteId).update({ ai });
  }

  static async listByWorkspace(
    workspaceId: string,
    options: ListByWorkspaceOptions = {}
  ): Promise<QuickNote[]> {
    let query = this.collection.where('workspaceId', '==', workspaceId);
    if (options.categoryId) {
      query = query.where('categoryId', '==', options.categoryId);
    }
    query = query.orderBy('isPinned', 'desc').orderBy('updatedAt', 'desc');
    if (options.limit) query = query.limit(options.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<QuickNote, 'id'>) }));
  }
}
