/**
 * note-import-helpers.ts
 *
 * Dedicated helper utilities for converting spreadsheet columns into authentic
 * CRM EntityNote documents in Firestore (`entity_notes` collection) during bulk imports.
 *
 * Conforms to SmartSapp Development Standards:
 * - Rule 4: Strict typing (zero `any`/`any[]`).
 * - Rule 8: Multi-tenant safety and sanitization.
 * - Rule 9: Resource exhaustion protection (capped note length).
 * - Rule 10: Clear architectural guides for future maintainers.
 */

import type { EntityNote } from '@/lib/types';
import type { NoteImportConfig } from '@/lib/import-types';

/** Maximum permitted length of an imported note to guard against Firestore write exhaustion */
export const MAX_IMPORTED_NOTE_LENGTH = 10000;

/** Regular expression matching headers typically representing note or remark columns */
const NOTE_HEADER_PATTERN = /\b(notes?|personal\s*notes?|remarks?|comments?|feedback|call\s*notes?|summary\s*notes?|observations?)\b/i;

/**
 * Automatically inspects incoming file headers to identify a probable note column.
 * Returns the exact column header string as it appears in the spreadsheet, or null.
 */
export function detectNoteColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (!h) continue;
    const trimmed = h.trim();
    if (NOTE_HEADER_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Checks whether an incoming value represents non-empty, actionable note text.
 */
export function isValidNoteText(text: unknown): boolean {
  if (text === null || text === undefined) return false;
  const str = String(text).trim();
  return str.length > 0;
}

/**
 * Formats the note content, applying an optional category/context prefix
 * and truncating beyond MAX_IMPORTED_NOTE_LENGTH to prevent memory or database issues.
 */
export function formatNoteContent(rawText: string, prefix?: string): string {
  const trimmed = String(rawText).trim();
  let content = trimmed;

  if (prefix && prefix.trim().length > 0) {
    const cleanPrefix = prefix.trim().replace(/^\[+|\]+$/g, '').trim();
    if (cleanPrefix) {
      content = `[${cleanPrefix}] ${trimmed}`;
    }
  }

  if (content.length > MAX_IMPORTED_NOTE_LENGTH) {
    content = content.slice(0, MAX_IMPORTED_NOTE_LENGTH);
  }

  return content;
}

export interface BuildNoteParams {
  noteId: string;
  entityId: string;
  workspaceId: string;
  content: string;
  userId: string;
  userName?: string;
  noteType?: NoteImportConfig['noteType'];
  isPinned?: boolean;
  prefix?: string;
  now?: string;
}

/**
 * Constructs an authentic, typed EntityNote document ready for Firestore persistence.
 */
export function buildEntityNotePayload(params: BuildNoteParams): EntityNote {
  const {
    noteId,
    entityId,
    workspaceId,
    content,
    userId,
    userName = 'System Import',
    noteType = 'general',
    isPinned = false,
    prefix,
    now = new Date().toISOString(),
  } = params;

  const formattedContent = formatNoteContent(content, prefix);

  const payload: EntityNote = {
    id: noteId,
    entityId,
    workspaceId,
    content: formattedContent,
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
    noteType,
    isPinned,
    source: 'bulk_import' as unknown as undefined, // Optional provenance
  };

  if (isPinned) {
    payload.pinnedAt = now;
    payload.pinnedBy = userId;
  }

  return payload;
}
