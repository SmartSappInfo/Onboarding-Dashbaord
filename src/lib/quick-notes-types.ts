import { z } from 'zod';

/**
 * Quick Notes — Unified Notes Workspace
 *
 * Type + schema source of truth for the Quick Notes feature.
 *
 * Design note: the rich note body is a TipTap document, but this module
 * deliberately models it with a *structural* `NoteDocument` type instead of
 * importing `@tiptap/*`. That keeps the domain + repository layers free of any
 * client/editor runtime dependency, so pure functions (e.g. `extractPlainText`)
 * stay trivially unit-testable on the server. The client editor casts its
 * TipTap JSON to `NoteDocument` — the two are structurally compatible.
 */

/** Structural mirror of TipTap's `JSONContent`. */
export interface NoteDocument {
  type?: string;
  text?: string;
  content?: NoteDocument[];
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type QuickNoteAttachmentType = 'link' | 'image' | 'video' | 'file';

export interface QuickNoteAttachment {
  id: string;
  type: QuickNoteAttachmentType;
  /** Same-origin Firebase Storage URL (media) or external URL (links). */
  url: string;
  /** Set for anything we host in Storage, so it can be cleaned up on delete. */
  storagePath?: string;
  title?: string;
  description?: string;
  /** Re-hosted to Storage for `next/image` (see design spec R3). */
  thumbnailUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/** Denormalised cross-object links (mirrors EntityNote.dealName convention). */
export interface QuickNoteLinks {
  entityId?: string;
  entityName?: string;
  taskId?: string;
  taskName?: string;
  dealId?: string;
  dealName?: string;
}

export type NoteSentiment = 'positive' | 'neutral' | 'negative' | 'urgent';

export interface QuickNoteAiMeta {
  summary?: string;
  suggestedTags?: string[];
  sentiment?: NoteSentiment;
  actionItems?: string[];
  generatedAt?: string;
  model?: string;
}

export interface QuickNote {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  content: NoteDocument;
  /** Derived from `content` at write-time — powers search, AI, and embeddings. */
  plainText: string;
  /** Schema/version guard for future editor migrations. */
  contentVersion: number;
  categoryId?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  pinnedAt?: string;
  ai?: QuickNoteAiMeta;
  /** Bumped when `plainText` changes; drives re-embedding (Phase 7). */
  embeddingVersion?: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteCategory {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  /** Design token key, never a raw hex value. */
  color: string;
  icon?: string;
  order: number;
  createdBy: string;
  createdAt: string;
}

export type UnifiedNoteSource = 'quick_note' | 'entity_note' | 'task_note' | 'call_note';

/** The board's render model. Native + legacy notes normalise to this shape. */
export interface UnifiedNote {
  /** Globally unique: `${source}:${sourceId}`. */
  id: string;
  source: UnifiedNoteSource;
  sourceId: string;
  workspaceId: string;
  title?: string;
  plainText: string;
  noteType?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  createdByName?: string;
  createdAt: string;
  /** Deep-link to the source record's native UI. Null for native quick notes. */
  originHref: string | null;
  editable: boolean;
}

/** Projection row stored in `note_index` (server-only writes). */
export interface NoteIndexRow extends Omit<UnifiedNote, 'attachments'> {
  attachmentCount: number;
  embedding?: number[];
  embeddingVersion?: number;
  indexedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod input schemas (validated at the server-action boundary)
// ─────────────────────────────────────────────────────────────────────────────

/** Lenient structural validation for a TipTap document. */
export const noteDocumentSchema: z.ZodType<NoteDocument> = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      text: z.string().optional(),
      content: z.array(noteDocumentSchema).optional(),
      attrs: z.record(z.unknown()).optional(),
      marks: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough()
);

export const quickNoteAttachmentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['link', 'image', 'video', 'file']),
  url: z.string().url(),
  storagePath: z.string().optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const quickNoteLinksSchema = z.object({
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  taskId: z.string().optional(),
  taskName: z.string().optional(),
  dealId: z.string().optional(),
  dealName: z.string().optional(),
});

export const quickNoteCreateInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: noteDocumentSchema,
  categoryId: z.string().optional(),
  tags: z.array(z.string()).max(30).default([]),
  attachments: z.array(quickNoteAttachmentSchema).max(50).default([]),
  links: quickNoteLinksSchema.default({}),
});

export const quickNoteUpdateInputSchema = quickNoteCreateInputSchema
  .partial()
  .extend({
    /** Optimistic-concurrency guard (design spec R12). */
    expectedUpdatedAt: z.string().optional(),
  });

export type QuickNoteCreateInput = z.infer<typeof quickNoteCreateInputSchema>;
export type QuickNoteUpdateInput = z.infer<typeof quickNoteUpdateInputSchema>;

export const QUICK_NOTES_COLLECTION = 'quick_notes';
export const QUICK_NOTE_CATEGORIES_COLLECTION = 'quick_note_categories';
export const NOTE_INDEX_COLLECTION = 'note_index';

/** Stored TipTap content schema version; bump on a breaking content-shape change. */
export const NOTE_CONTENT_VERSION = 1;
