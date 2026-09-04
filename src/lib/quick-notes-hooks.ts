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
  KNOWLEDGE_SPACES_COLLECTION,
  KNOWLEDGE_COLLECTIONS_COLLECTION,
  KNOWLEDGE_TEMPLATES_COLLECTION,
  NOTE_CONTENT_VERSION,
  quickNoteCreateInputSchema,
  quickNoteUpdateInputSchema,
  knowledgeTemplateCreateInputSchema,
  knowledgeTemplateUpdateInputSchema,
  type QuickNote,
  type QuickNoteCategory,
  type KnowledgeSpace,
  type KnowledgeCollection,
  type KnowledgeTemplate,
  type KnowledgeTemplateCreateInput,
  type KnowledgeTemplateUpdateInput,
  type KnowledgeType,
  type KnowledgeStatus,
  type KnowledgeVisibility,
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
  by: 'entity' | 'contact' | 'lead' | 'deal' | 'task',
  recordId: string | null | undefined
) {
  const firestore = useFirestore();
  const linkedQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    let field = 'links.entityId';
    if (by === 'contact') field = 'links.contactId';
    else if (by === 'lead') field = 'links.leadId';
    else if (by === 'deal') field = 'links.dealId';
    else if (by === 'task') field = 'links.taskId';

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

export { useUnifiedEntityTimeline } from './hooks/use-unified-entity-timeline';

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

/**
 * Live subscription to workspace knowledge spaces (Company Brain 2.0).
 */
export function useKnowledgeSpaces(workspaceId: string | null | undefined) {
  const firestore = useFirestore();
  const spacesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, KNOWLEDGE_SPACES_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, workspaceId]);

  return useCollection<KnowledgeSpace>(spacesQuery);
}

/**
 * Live subscription to knowledge collections inside a workspace (Company Brain 2.0).
 */
export function useKnowledgeCollections(
  workspaceId: string | null | undefined,
  spaceId?: string | null
) {
  const firestore = useFirestore();
  const collectionsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    if (spaceId) {
      return query(
        collection(firestore, KNOWLEDGE_COLLECTIONS_COLLECTION),
        where('workspaceId', '==', workspaceId),
        where('spaceId', '==', spaceId),
        orderBy('order', 'asc')
      );
    }
    return query(
      collection(firestore, KNOWLEDGE_COLLECTIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, workspaceId, spaceId]);

  return useCollection<KnowledgeCollection>(collectionsQuery);
}

/**
 * Live subscription to workspace knowledge templates (Phase 2).
 */
export function useKnowledgeTemplates(workspaceId: string | null | undefined) {
  const firestore = useFirestore();
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, KNOWLEDGE_TEMPLATES_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, workspaceId]);

  return useCollection<KnowledgeTemplate>(templatesQuery);
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
  knowledgeType?: KnowledgeType;
  spaceId?: string;
  collectionId?: string;
  status?: KnowledgeStatus;
  visibility?: KnowledgeVisibility;
  categoryId?: string;
  tags?: string[];
  attachments?: QuickNoteAttachment[];
  links?: QuickNoteLinks;
}

/** Creates a note / knowledge object and fires (non-blocking) the activity-feed log. Returns the new id. */
export async function createQuickNote(
  firestore: Firestore,
  params: CreateQuickNoteParams
): Promise<string> {
  // Validate the user-supplied fields against the shared contract before writing.
  const parsed = quickNoteCreateInputSchema.safeParse({
    title: params.title,
    content: params.content,
    knowledgeType: params.knowledgeType ?? 'note',
    spaceId: params.spaceId,
    collectionId: params.collectionId,
    status: params.status ?? 'active',
    visibility: params.visibility ?? 'workspace',
    categoryId: params.categoryId,
    tags: params.tags ?? [],
    attachments: params.attachments ?? [],
    links: params.links ?? {},
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid knowledge object.');
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
    knowledgeType: parsed.data.knowledgeType ?? 'note',
    spaceId: parsed.data.spaceId,
    collectionId: parsed.data.collectionId,
    status: parsed.data.status ?? 'active',
    visibility: parsed.data.visibility ?? 'workspace',
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
  knowledgeType?: KnowledgeType;
  spaceId?: string | null;
  collectionId?: string | null;
  status?: KnowledgeStatus;
  visibility?: KnowledgeVisibility;
  categoryId?: string | null;
  tags?: string[];
  attachments?: QuickNoteAttachment[];
  links?: QuickNoteLinks;
}

/**
 * Updates a note or knowledge object. Recomputes `plainText` when content changes.
 */
export async function updateQuickNote(
  firestore: Firestore,
  note: QuickNote,
  patch: UpdateQuickNotePatch
): Promise<void> {
  const toValidate: Record<string, unknown> = {};
  if (patch.title !== undefined) toValidate.title = patch.title;
  if (patch.content !== undefined) toValidate.content = patch.content;
  if (patch.knowledgeType !== undefined) toValidate.knowledgeType = patch.knowledgeType;
  if (patch.spaceId) toValidate.spaceId = patch.spaceId;
  if (patch.collectionId) toValidate.collectionId = patch.collectionId;
  if (patch.status !== undefined) toValidate.status = patch.status;
  if (patch.visibility !== undefined) toValidate.visibility = patch.visibility;
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
  if (patch.knowledgeType !== undefined) next.knowledgeType = patch.knowledgeType;
  if (patch.spaceId !== undefined) next.spaceId = patch.spaceId ?? null;
  if (patch.collectionId !== undefined) next.collectionId = patch.collectionId ?? null;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.visibility !== undefined) next.visibility = patch.visibility;
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

export interface CreateSpaceParams {
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  order?: number;
}

export async function createKnowledgeSpace(
  firestore: Firestore,
  params: CreateSpaceParams
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(
    collection(firestore, KNOWLEDGE_SPACES_COLLECTION),
    pruneUndefined({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      name: params.name.trim(),
      description: params.description?.trim(),
      color: params.color,
      icon: params.icon,
      order: params.order ?? 0,
      isArchived: false,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  );
  return ref.id;
}

export async function deleteKnowledgeSpace(firestore: Firestore, spaceId: string): Promise<void> {
  await deleteDoc(doc(firestore, KNOWLEDGE_SPACES_COLLECTION, spaceId));
}

export interface CreateCollectionParams {
  organizationId: string;
  workspaceId: string;
  spaceId?: string;
  createdBy: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  order?: number;
}

export async function createKnowledgeCollection(
  firestore: Firestore,
  params: CreateCollectionParams
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(
    collection(firestore, KNOWLEDGE_COLLECTIONS_COLLECTION),
    pruneUndefined({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      spaceId: params.spaceId,
      name: params.name.trim(),
      description: params.description?.trim(),
      color: params.color,
      icon: params.icon,
      order: params.order ?? 0,
      isArchived: false,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  );
  return ref.id;
}

export async function deleteKnowledgeCollection(firestore: Firestore, collectionId: string): Promise<void> {
  await deleteDoc(doc(firestore, KNOWLEDGE_COLLECTIONS_COLLECTION, collectionId));
}

export interface CreateTemplateParams {
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  name: string;
  description?: string;
  knowledgeType?: KnowledgeType;
  icon?: string;
  color?: string;
  content: NoteDocument;
  order?: number;
  isSystem?: boolean;
}

export async function createKnowledgeTemplate(
  firestore: Firestore,
  params: CreateTemplateParams
): Promise<string> {
  const parsed = knowledgeTemplateCreateInputSchema.safeParse({
    name: params.name,
    description: params.description ?? '',
    knowledgeType: params.knowledgeType ?? 'note',
    icon: params.icon ?? 'Notebook',
    color: params.color ?? 'blue',
    content: params.content,
    order: params.order ?? 0,
    isSystem: params.isSystem ?? false,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid template definition.');
  }

  const now = new Date().toISOString();
  const ref = await addDoc(
    collection(firestore, KNOWLEDGE_TEMPLATES_COLLECTION),
    pruneUndefined({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description,
      knowledgeType: parsed.data.knowledgeType,
      icon: parsed.data.icon,
      color: parsed.data.color,
      content: parsed.data.content,
      order: parsed.data.order,
      isSystem: parsed.data.isSystem,
      isArchived: false,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  );
  return ref.id;
}

export interface UpdateTemplatePatch {
  name?: string;
  description?: string;
  knowledgeType?: KnowledgeType;
  icon?: string;
  color?: string;
  content?: NoteDocument;
  order?: number;
  isArchived?: boolean;
}

export async function updateKnowledgeTemplate(
  firestore: Firestore,
  templateId: string,
  patch: UpdateTemplatePatch
): Promise<void> {
  const parsed = knowledgeTemplateUpdateInputSchema.safeParse(patch);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid template update.');
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (patch.name !== undefined) updateData.name = patch.name.trim();
  if (patch.description !== undefined) updateData.description = patch.description.trim();
  if (patch.knowledgeType !== undefined) updateData.knowledgeType = patch.knowledgeType;
  if (patch.icon !== undefined) updateData.icon = patch.icon;
  if (patch.color !== undefined) updateData.color = patch.color;
  if (patch.content !== undefined) updateData.content = patch.content;
  if (patch.order !== undefined) updateData.order = patch.order;
  if (patch.isArchived !== undefined) updateData.isArchived = patch.isArchived;

  await updateDoc(doc(firestore, KNOWLEDGE_TEMPLATES_COLLECTION, templateId), updateData);
}

export async function deleteKnowledgeTemplate(
  firestore: Firestore,
  templateId: string
): Promise<void> {
  await deleteDoc(doc(firestore, KNOWLEDGE_TEMPLATES_COLLECTION, templateId));
}
