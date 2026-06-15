import { adminDb } from '../firebase-admin';
import { unifiedNoteId } from '../quick-notes-domain';
import type { UnifiedNote } from '../quick-notes-types';
import type { NoteSourceAdapter } from './types';

/** Minimal shape this adapter reads from a `call_queue_items` document. */
export interface RawCallQueueItem {
  id: string;
  workspaceId: string;
  entityId?: string;
  entityName?: string;
  notesDraft?: string;
  outcome?: string;
  lastAttemptAt?: string | null;
  updatedAt?: string;
}

/** Returns null when the call has no note content (nothing to surface). */
export function callNoteToUnified(item: RawCallQueueItem): UnifiedNote | null {
  const note = (item.notesDraft ?? '').trim();
  if (!note) return null;

  const who = item.entityName || 'a contact';
  return {
    id: unifiedNoteId('call_note', item.id),
    source: 'call_note',
    sourceId: item.id,
    workspaceId: item.workspaceId,
    title: `Call with ${who}`,
    plainText: item.outcome ? `[${item.outcome}] ${note}` : note,
    tags: [],
    attachments: [],
    links: { entityId: item.entityId, entityName: item.entityName },
    isPinned: false,
    createdAt: item.updatedAt || item.lastAttemptAt || '',
    originHref: '/admin/messaging/call-centre',
    editable: false,
  };
}

export const CallNoteAdapter: NoteSourceAdapter = {
  source: 'call_note',
  async readForWorkspace(workspaceId, limit) {
    const snap = await adminDb
      .collection('call_queue_items')
      .where('workspaceId', '==', workspaceId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs
      .map((d) => callNoteToUnified({ id: d.id, ...(d.data() as Omit<RawCallQueueItem, 'id'>) }))
      .filter((n): n is UnifiedNote => n !== null);
  },
};
