import { adminDb } from '@/lib/firebase-admin';
import { extractPlainText, dedupeTags, pruneUndefined } from './quick-notes-domain';
import {
  QUICK_NOTES_COLLECTION,
  QUICK_NOTE_CATEGORIES_COLLECTION,
  NOTE_CONTENT_VERSION,
  type QuickNote,
  type QuickNoteCategory,
  type QuickNoteAiMeta,
  type QuickNoteCreateInput,
  type QuickNoteUpdateInput,
  type NoteDocument,
  type KnowledgeType,
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
      knowledgeType: input.knowledgeType ?? 'note',
      spaceId: input.spaceId,
      collectionId: input.collectionId,
      status: input.status ?? 'active',
      visibility: input.visibility ?? 'workspace',
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
      if (input.knowledgeType !== undefined) patch.knowledgeType = input.knowledgeType;
      if (input.spaceId !== undefined) patch.spaceId = input.spaceId;
      if (input.collectionId !== undefined) patch.collectionId = input.collectionId;
      if (input.status !== undefined) patch.status = input.status;
      if (input.visibility !== undefined) patch.visibility = input.visibility;
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
    options: ListByWorkspaceOptions | number = {}
  ): Promise<QuickNote[]> {
    const opts: ListByWorkspaceOptions = typeof options === 'number' ? { limit: options } : options;
    let query = this.collection.where('workspaceId', '==', workspaceId);
    if (opts.categoryId) {
      query = query.where('categoryId', '==', opts.categoryId);
    }
    query = query.orderBy('isPinned', 'desc').orderBy('updatedAt', 'desc');
    if (opts.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<QuickNote, 'id'>) }));
  }

  /**
   * Convenience alias for listByWorkspace.
   */
  static async getByWorkspace(
    workspaceId: string,
    options: ListByWorkspaceOptions | number = {}
  ): Promise<QuickNote[]> {
    return this.listByWorkspace(workspaceId, options);
  }

  static async createNote(params: {
    workspaceId: string;
    organizationId?: string;
    title: string;
    document?: NoteDocument;
    content?: NoteDocument;
    plainText?: string;
    knowledgeType?: KnowledgeType;
    categoryId?: string;
    tags?: string[];
    color?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    links?: QuickNote['links'];
    createdBy?: string;
    createdByName?: string;
  }): Promise<QuickNote> {
    const doc = params.content || params.document || { type: 'doc', content: [] };
    return this.create({
      workspaceId: params.workspaceId,
      organizationId: params.organizationId || 'default-org',
      createdBy: params.createdBy || 'system',
      createdByName: params.createdByName || 'System',
      input: {
        title: params.title,
        content: doc,
        categoryId: params.categoryId,
        tags: params.tags || [],
        links: params.links || {},
        attachments: [],
        knowledgeType: params.knowledgeType || 'note',
        visibility: 'workspace',
        status: params.isArchived ? 'archived' : 'active',
      },
    });
  }

  static async updateNote(
    noteId: string,
    params: {
      title?: string;
      document?: NoteDocument;
      content?: NoteDocument;
      knowledgeType?: KnowledgeType;
      categoryId?: string;
      tags?: string[];
      color?: string;
      isPinned?: boolean;
      isArchived?: boolean;
      links?: QuickNote['links'];
    }
  ): Promise<QuickNote | null> {
    const doc = params.content || params.document;
    return this.update({
      noteId,
      input: {
        title: params.title,
        content: doc,
        knowledgeType: params.knowledgeType,
        categoryId: params.categoryId,
        tags: params.tags,
        links: params.links,
        status: params.isArchived !== undefined ? (params.isArchived ? 'archived' : 'active') : undefined,
      },
    });
  }

  static async deleteNote(noteId: string): Promise<void> {
    return this.delete(noteId);
  }

  /**
   * Convenience alias for listByWorkspace (used by graph and cross-module actions).
   */
  static async listActive(
    workspaceId: string,
    options: ListByWorkspaceOptions = {}
  ): Promise<QuickNote[]> {
    return this.listByWorkspace(workspaceId, options);
  }

  static async listCategories(workspaceId: string): Promise<QuickNoteCategory[]> {
    const snap = await adminDb
      .collection(QUICK_NOTE_CATEGORIES_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .orderBy('order', 'asc')
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<QuickNoteCategory, 'id'>) }));
  }

  static async batchCreateNotes(notes: QuickNote[]): Promise<number> {
    if (notes.length === 0) return 0;
    const MAX_BATCH_SIZE = 450;
    let savedCount = 0;

    for (let i = 0; i < notes.length; i += MAX_BATCH_SIZE) {
      const chunk = notes.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const note of chunk) {
        const ref = this.collection.doc(note.id);
        batch.set(ref, pruneUndefined(note as unknown as Record<string, unknown>));
        savedCount++;
      }

      await batch.commit();
    }

    return savedCount;
  }
}

/** Re-export with plural spelling for callers using QuickNotesRepository */
export const QuickNotesRepository = QuickNoteRepository;
