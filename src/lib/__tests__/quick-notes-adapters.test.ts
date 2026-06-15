import { describe, it, expect } from 'vitest';
import { entityNoteToUnified } from '../note-source-adapters/entity-note-adapter';
import { taskNotesToUnified } from '../note-source-adapters/task-note-adapter';
import { callNoteToUnified } from '../note-source-adapters/call-note-adapter';
import { getAdapters, LEGACY_SOURCES, NOTE_SOURCE_ADAPTERS } from '../note-source-adapters';

describe('entityNoteToUnified', () => {
  it('maps an entity note to a read-only unified note with a deep-link', () => {
    const u = entityNoteToUnified({
      id: 'en1',
      entityId: 'e1',
      workspaceId: 'ws1',
      content: '  Spoke with client  ',
      noteType: 'call',
      isPinned: true,
      createdByName: 'Joe',
      createdAt: '2026-06-01T10:00:00.000Z',
      dealId: 'd1',
      dealName: 'Renewal',
    });
    expect(u).toMatchObject({
      id: 'entity_note:en1',
      source: 'entity_note',
      sourceId: 'en1',
      workspaceId: 'ws1',
      plainText: 'Spoke with client',
      noteType: 'call',
      isPinned: true,
      createdByName: 'Joe',
      originHref: '/admin/entities/e1',
      editable: false,
    });
    expect(u.links).toEqual({ entityId: 'e1', dealId: 'd1', dealName: 'Renewal' });
  });

  it('has a null originHref when there is no entityId', () => {
    const u = entityNoteToUnified({ id: 'en2', workspaceId: 'ws1', content: 'orphan' });
    expect(u.originHref).toBeNull();
    expect(u.createdAt).toBe('');
  });
});

describe('taskNotesToUnified', () => {
  it('explodes embedded task notes into individual unified notes', () => {
    const result = taskNotesToUnified({
      id: 't1',
      workspaceId: 'ws1',
      title: 'Follow up',
      entityId: 'e9',
      entityName: 'Acme',
      notes: [
        { id: 'n1', content: 'called', createdAt: '2026-06-02T00:00:00.000Z', authorName: 'Ada' },
        { id: 'n2', content: 'emailed', createdAt: '2026-06-03T00:00:00.000Z' },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'task_note:t1:n1',
      source: 'task_note',
      sourceId: 't1:n1',
      title: 'Follow up',
      plainText: 'called',
      originHref: '/admin/tasks?task=t1',
      editable: false,
    });
    expect(result[0].links).toEqual({ taskId: 't1', taskName: 'Follow up', entityId: 'e9', entityName: 'Acme' });
  });

  it('returns [] when a task has no notes', () => {
    expect(taskNotesToUnified({ id: 't2', workspaceId: 'ws1', title: 'x' })).toEqual([]);
    expect(taskNotesToUnified({ id: 't3', workspaceId: 'ws1', title: 'x', notes: [] })).toEqual([]);
  });
});

describe('callNoteToUnified', () => {
  it('maps a call with notes, prefixing the outcome', () => {
    const u = callNoteToUnified({
      id: 'c1',
      workspaceId: 'ws1',
      entityId: 'e1',
      entityName: 'Acme',
      notesDraft: 'Left a voicemail',
      outcome: 'no_answer',
      updatedAt: '2026-06-04T00:00:00.000Z',
    });
    expect(u).not.toBeNull();
    expect(u).toMatchObject({
      id: 'call_note:c1',
      source: 'call_note',
      title: 'Call with Acme',
      plainText: '[no_answer] Left a voicemail',
      originHref: '/admin/messaging/call-centre',
      editable: false,
    });
    expect(u!.links).toEqual({ entityId: 'e1', entityName: 'Acme' });
  });

  it('returns null when the call has no note content', () => {
    expect(callNoteToUnified({ id: 'c2', workspaceId: 'ws1', notesDraft: '   ' })).toBeNull();
    expect(callNoteToUnified({ id: 'c3', workspaceId: 'ws1' })).toBeNull();
  });

  it('falls back to a generic contact label and lastAttemptAt date', () => {
    const u = callNoteToUnified({ id: 'c4', workspaceId: 'ws1', notesDraft: 'note', lastAttemptAt: '2026-06-05T00:00:00.000Z' });
    expect(u!.title).toBe('Call with a contact');
    expect(u!.createdAt).toBe('2026-06-05T00:00:00.000Z');
  });
});

describe('adapter registry', () => {
  it('exposes all legacy sources and returns them by default', () => {
    expect(LEGACY_SOURCES).toEqual(['entity_note', 'task_note', 'call_note']);
    expect(getAdapters().map((a) => a.source)).toEqual(['entity_note', 'task_note', 'call_note']);
  });

  it('returns only requested adapters', () => {
    expect(getAdapters(['call_note']).map((a) => a.source)).toEqual(['call_note']);
    expect(NOTE_SOURCE_ADAPTERS.entity_note.source).toBe('entity_note');
  });
});
