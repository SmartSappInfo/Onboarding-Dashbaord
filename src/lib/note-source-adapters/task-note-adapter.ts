import { adminDb } from '../firebase-admin';
import { unifiedNoteId } from '../quick-notes-domain';
import type { UnifiedNote } from '../quick-notes-types';
import type { NoteSourceAdapter } from './types';

/** Minimal shape this adapter reads from a `tasks` document. */
export interface RawTaskWithNotes {
  id: string;
  workspaceId: string;
  title?: string;
  entityId?: string | null;
  entityName?: string | null;
  notes?: Array<{ id: string; content?: string; createdAt?: string; authorName?: string }>;
}

/**
 * Pure mapping — a task may carry many embedded notes, each becoming its own
 * UnifiedNote. The composite sourceId keeps them globally unique.
 */
export function taskNotesToUnified(task: RawTaskWithNotes): UnifiedNote[] {
  if (!Array.isArray(task.notes) || task.notes.length === 0) return [];
  return task.notes.map((note) => ({
    id: unifiedNoteId('task_note', `${task.id}:${note.id}`),
    source: 'task_note' as const,
    sourceId: `${task.id}:${note.id}`,
    workspaceId: task.workspaceId,
    title: task.title,
    plainText: (note.content ?? '').trim(),
    tags: [],
    attachments: [],
    links: {
      taskId: task.id,
      taskName: task.title,
      entityId: task.entityId ?? undefined,
      entityName: task.entityName ?? undefined,
    },
    isPinned: false,
    createdByName: note.authorName,
    createdAt: note.createdAt ?? '',
    originHref: `/admin/tasks?task=${task.id}`,
    editable: false,
  }));
}

export const TaskNoteAdapter: NoteSourceAdapter = {
  source: 'task_note',
  async readForWorkspace(workspaceId, limit) {
    // Task notes are embedded, so we read recent tasks and flatten their notes.
    const snap = await adminDb
      .collection('tasks')
      .where('workspaceId', '==', workspaceId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.flatMap((d) =>
      taskNotesToUnified({ id: d.id, ...(d.data() as Omit<RawTaskWithNotes, 'id'>) })
    );
  },
};
