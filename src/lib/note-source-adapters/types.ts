import type { UnifiedNote, UnifiedNoteSource } from '../quick-notes-types';

/**
 * Strategy interface for surfacing a legacy note source in the unified feed.
 *
 * Each adapter owns: (1) how to read its source for a workspace, and (2) the
 * pure mapping from a raw source document to a `UnifiedNote`. Adding a new
 * source (e.g. meeting notes) means implementing this once and registering it —
 * the aggregator and UI need no changes (open/closed).
 */
export interface NoteSourceAdapter {
  readonly source: UnifiedNoteSource;
  /** Reads up to `limit` notes for the workspace, normalised to UnifiedNote. */
  readForWorkspace(workspaceId: string, limit: number): Promise<UnifiedNote[]>;
}

/** Default per-source read cap (keeps aggregation bounded — design spec R1). */
export const DEFAULT_PER_SOURCE_LIMIT = 100;
