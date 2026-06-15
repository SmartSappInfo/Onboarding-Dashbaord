import type { UnifiedNoteSource } from '../quick-notes-types';
import type { NoteSourceAdapter } from './types';
import { EntityNoteAdapter } from './entity-note-adapter';
import { TaskNoteAdapter } from './task-note-adapter';
import { CallNoteAdapter } from './call-note-adapter';

export * from './types';
export { entityNoteToUnified } from './entity-note-adapter';
export { taskNotesToUnified } from './task-note-adapter';
export { callNoteToUnified } from './call-note-adapter';

/** All legacy note-source adapters, keyed by source. */
export const NOTE_SOURCE_ADAPTERS: Record<Exclude<UnifiedNoteSource, 'quick_note'>, NoteSourceAdapter> = {
  entity_note: EntityNoteAdapter,
  task_note: TaskNoteAdapter,
  call_note: CallNoteAdapter,
};

/** The legacy sources surfaced read-only in the unified feed. */
export const LEGACY_SOURCES: Array<Exclude<UnifiedNoteSource, 'quick_note'>> = [
  'entity_note',
  'task_note',
  'call_note',
];

export function getAdapters(
  sources: ReadonlyArray<Exclude<UnifiedNoteSource, 'quick_note'>> = LEGACY_SOURCES
): NoteSourceAdapter[] {
  return sources.map((s) => NOTE_SOURCE_ADAPTERS[s]);
}
