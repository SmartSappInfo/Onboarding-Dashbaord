import { cache } from 'react';
import { sortUnifiedNotes } from './quick-notes-domain';
import type { UnifiedNote, UnifiedNoteSource } from './quick-notes-types';
import { getAdapters, LEGACY_SOURCES, DEFAULT_PER_SOURCE_LIMIT } from './note-source-adapters';

/**
 * Quick Notes — read-time aggregation of legacy note sources.
 *
 * Server-only (uses the Admin SDK via the adapters). Fans out to each requested
 * source in parallel (no waterfall — `async-parallel`), tolerates a single
 * source failing, and returns a unified, sorted list. Wrapped in `React.cache`
 * for per-request de-duplication (`server-cache-react`). Per-source caps keep
 * the work bounded (design spec R1); the `note_index` projection is the
 * eventual scale path, with this aggregator as the cold-start fallback.
 */
export const getAggregatedNotes = cache(
  async (
    workspaceId: string,
    sources: ReadonlyArray<Exclude<UnifiedNoteSource, 'quick_note'>> = LEGACY_SOURCES,
    perSourceLimit: number = DEFAULT_PER_SOURCE_LIMIT
  ): Promise<UnifiedNote[]> => {
    if (!workspaceId) return [];
    const adapters = getAdapters(sources);
    const results = await Promise.all(
      adapters.map((adapter) =>
        adapter.readForWorkspace(workspaceId, perSourceLimit).catch((error) => {
          console.error(`[QuickNotes] aggregation failed for source "${adapter.source}":`, error);
          return [] as UnifiedNote[];
        })
      )
    );
    return sortUnifiedNotes(results.flat());
  }
);
