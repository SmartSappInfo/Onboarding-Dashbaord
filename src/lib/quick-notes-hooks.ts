'use client';

import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  type Firestore,
} from 'firebase/firestore';
import { useMemoFirebase, useCollection, useFirestore } from '@/firebase';
import { extractPlainText, dedupeTags, pruneUndefined } from './quick-notes-domain';
import { logQuickNoteActivity } from './quick-notes-actions';
import {
  QUICK_NOTES_COLLECTION,
  QUICK_NOTE_CATEGORIES_COLLECTION,
  NOTE_CONTENT_VERSION,
  quickNoteCreateInputSchema,
  quickNoteUpdateInputSchema,
  type QuickNote,
  type QuickNoteCategory,
  type NoteDocument,
  type QuickNoteAttachment,
  type QuickNoteLinks,
} from './quick-notes-types';

// ─────────────────────────────────────────────────────────────────────────────
// Read hooks (real-time via useCollection — mirrors EntityNotesTab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live subscription to a workspace's Quick Notes. When `categoryId` is set the
 * query is scoped to that category; otherwise notes are returned pinned-first,
 * newest-updated-first. Both query shapes are backed by composite indexes.
 */
/** Upper bound on notes loaded into the board at once (bounds read cost). */
export const BOARD_NOTE_LIMIT = 500;

export function useQuickNotes(
  workspaceId: string | null | undefined,
  categoryId?: string,
  max: number = BOARD_NOTE_LIMIT
) {
  const firestore = useFirestore();
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    const base = collection(firestore, QUICK_NOTES_COLLECTION);
    if (categoryId) {
      return query(
        base,
        where('workspaceId', '==', workspaceId),
        where('categoryId', '==', categoryId),
        orderBy('updatedAt', 'desc'),
        fbLimit(max)
      );
    }
    return query(
      base,
      where('workspaceId', '==', workspaceId),
      orderBy('isPinned', 'desc'),
      orderBy('updatedAt', 'desc'),
      fbLimit(max)
    );
  }, [firestore, workspaceId, categoryId, max]);

  return useCollection<QuickNote>(notesQuery);
}

/**
 * Live subscription to Quick Notes linked to a given record (entity or task).
 * Powers the reverse "Quick Notes" panels on the entity/task detail pages.
 * Backed by the `links.entityId|links.taskId` composite indexes.
 */
export function useLinkedQuickNotes(
  workspaceId: string | null | undefined,
  by: 'entity' | 'task',
  recordId: string | null | undefined
) {
  const firestore = useFirestore();
  const linkedQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    const field = by === 'entity' ? 'links.entityId' : 'links.taskId';
    return query(
      collection(firestore, QUICK_NOTES_COLLECTION),
      where(field, '==', recordId),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc'),
      fbLimit(50)
    );
  }, [firestore, workspaceId, by, recordId]);

  return useCollection<QuickNote>(linkedQuery);
}

/** Live subscription to a workspace's note categories, ordered for the rail. */
export function useNoteCategories(workspaceId: string | null | undefined) {
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, QUICK_NOTE_CATEGORIES_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, workspaceId]);

  return useCollection<QuickNoteCategory>(categoriesQuery);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client write helpers (secured by quick_notes security rules)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateQuickNoteParams {
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  createdByName?: string;
  title: string;
  content: NoteDocument;
  categoryId?: string;
  tags?: string[];
  attachments?: QuickNoteAttachment[];
  links?: QuickNoteLinks;
}

/** Creates a note and fires (non-blocking) the activity-feed log. Returns the new id. */
export async function createQuickNote(
  firestore: Firestore,
  params: CreateQuickNoteParams
): Promise<string> {
  // Validate the user-supplied fields against the shared contract before writing.
  const parsed = quickNoteCreateInputSchema.safeParse({
    title: params.title,
    content: params.content,
    categoryId: params.categoryId,
    tags: params.tags ?? [],
    attachments: params.attachments ?? [],
    links: params.links ?? {},
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid note.');
  }

  const now = new Date().toISOString();
  const plainText = extractPlainText(parsed.data.content);
  const data = pruneUndefined({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    title: parsed.data.title,
    content: parsed.data.content,
    plainText,
    contentVersion: NOTE_CONTENT_VERSION,
    categoryId: parsed.data.categoryId,
    tags: dedupeTags(parsed.data.tags),
    attachments: parsed.data.attachments,
    links: parsed.data.links,
    isPinned: false,
    embeddingVersion: 1,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    createdAt: now,
    updatedAt: now,
  });

  const ref = await addDoc(collection(firestore, QUICK_NOTES_COLLECTION), data);

  // Non-blocking: log to the global Activity Feed (server action).
  void logQuickNoteActivity({
    noteId: ref.id,
    title: params.title.trim(),
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    contentPreview: plainText,
    links: params.links,
  }).catch(() => {
    /* activity logging is best-effort and must never block note creation */
  });

  return ref.id;
}

export interface UpdateQuickNotePatch {
  title?: string;
  content?: NoteDocument;
  categoryId?: string | null;
  tags?: string[];
  attachments?: QuickNoteAttachment[];
  links?: QuickNoteLinks;
}

/**
 * Updates a note. Recomputes `plainText` when content changes and bumps
 * `embeddingVersion` so Phase 7 can re-embed lazily. The optimistic-concurrency
 * guard lives in the server repository; client edits are last-write-wins by
 * design (v1, single-editor assumption — design spec R12).
 */
export async function updateQuickNote(
  firestore: Firestore,
  note: QuickNote,
  patch: UpdateQuickNotePatch
): Promise<void> {
  // Validate the fields being changed (null categoryId = "clear", which the
  // create schema doesn't model, so it's checked separately below).
  const toValidate: Record<string, unknown> = {};
  if (patch.title !== undefined) toValidate.title = patch.title;
  if (patch.content !== undefined) toValidate.content = patch.content;
  if (patch.categoryId) toValidate.categoryId = patch.categoryId;
  if (patch.tags !== undefined) toValidate.tags = patch.tags;
  if (patch.attachments !== undefined) toValidate.attachments = patch.attachments;
  if (patch.links !== undefined) toValidate.links = patch.links;
  const parsed = quickNoteUpdateInputSchema.safeParse(toValidate);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid note.');
  }

  const now = new Date().toISOString();
  const next: Record<string, unknown> = { updatedAt: now };

  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.categoryId !== undefined) next.categoryId = patch.categoryId ?? null;
  if (patch.tags !== undefined) next.tags = dedupeTags(patch.tags);
  if (patch.attachments !== undefined) next.attachments = patch.attachments;
  if (patch.links !== undefined) next.links = patch.links;

  if (patch.content !== undefined) {
    next.content = patch.content;
    const nextPlainText = extractPlainText(patch.content);
    next.plainText = nextPlainText;
    if (nextPlainText !== note.plainText) {
      next.embeddingVersion = (note.embeddingVersion ?? 0) + 1;
    }
  }

  await updateDoc(doc(firestore, QUICK_NOTES_COLLECTION, note.id), next);
}

export async function toggleQuickNotePin(
  firestore: Firestore,
  note: QuickNote,
  pinnedBy?: string
): Promise<void> {
  const willPin = !note.isPinned;
  const now = new Date().toISOString();
  await updateDoc(doc(firestore, QUICK_NOTES_COLLECTION, note.id), {
    isPinned: willPin,
    pinnedAt: willPin ? now : null,
    pinnedBy: willPin ? pinnedBy ?? null : null,
    updatedAt: now,
  });
}

export async function deleteQuickNote(firestore: Firestore, noteId: string): Promise<void> {
  await deleteDoc(doc(firestore, QUICK_NOTES_COLLECTION, noteId));
}

export interface CreateCategoryParams {
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  name: string;
  color: string;
  icon?: string;
  order?: number;
}

export async function createQuickNoteCategory(
  firestore: Firestore,
  params: CreateCategoryParams
): Promise<string> {
  const ref = await addDoc(
    collection(firestore, QUICK_NOTE_CATEGORIES_COLLECTION),
    pruneUndefined({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      name: params.name.trim(),
      color: params.color,
      icon: params.icon,
      order: params.order ?? 0,
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
    })
  );
  return ref.id;
}

export async function deleteQuickNoteCategory(firestore: Firestore, categoryId: string): Promise<void> {
  await deleteDoc(doc(firestore, QUICK_NOTE_CATEGORIES_COLLECTION, categoryId));
}
