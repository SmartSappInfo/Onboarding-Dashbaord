import { adminDb } from '../firebase-admin';
import { unifiedNoteId } from '../quick-notes-domain';
import type { UnifiedNote } from '../quick-notes-types';
import type { NoteSourceAdapter } from './types';

/** Minimal shape this adapter reads from an `entity_notes` document. */
export interface RawEntityNote {
  id: string;
  entityId?: string;
  workspaceId: string;
  content?: string;
  noteType?: string;
  isPinned?: boolean;
  createdByName?: string;
  createdAt?: string;
  dealId?: string;
  dealName?: string;
}

/** Pure mapping — unit-testable without Firestore. */
export function entityNoteToUnified(doc: RawEntityNote): UnifiedNote {
  return {
    id: unifiedNoteId('entity_note', doc.id),
    source: 'entity_note',
    sourceId: doc.id,
    workspaceId: doc.workspaceId,
    plainText: (doc.content ?? '').trim(),
    noteType: doc.noteType,
    tags: [],
    attachments: [],
    links: {
      entityId: doc.entityId,
      dealId: doc.dealId,
      dealName: doc.dealName,
    },
    isPinned: !!doc.isPinned,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt ?? '',
    originHref: doc.entityId ? `/admin/entities/${doc.entityId}` : null,
    editable: false,
  };
}

export const EntityNoteAdapter: NoteSourceAdapter = {
  source: 'entity_note',
  async readForWorkspace(workspaceId, limit) {
    const snap = await adminDb
      .collection('entity_notes')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => entityNoteToUnified({ id: d.id, ...(d.data() as Omit<RawEntityNote, 'id'>) }));
  },
};
