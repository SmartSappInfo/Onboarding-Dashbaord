'use server';

import { getAggregatedNotes } from './quick-notes-aggregator';
import { LEGACY_SOURCES } from './note-source-adapters';
import { canUser } from './workspace-permissions';
import type { UnifiedNote, UnifiedNoteSource } from './quick-notes-types';

/**
 * Server action: fetch the read-only aggregated legacy notes for a workspace.
 * The board calls this lazily — only when the unified "All sources" view is
 * selected — so the default native-notes view costs a single Firestore
 * subscription (`bundle-conditional`).
 *
 * Runs via the Admin SDK (bypasses security rules), so the caller's workspace
 * access is verified explicitly before any read.
 */
export async function fetchAggregatedNotes(
  workspaceId: string,
  userId: string,
  sources?: ReadonlyArray<Exclude<UnifiedNoteSource, 'quick_note'>>
): Promise<UnifiedNote[]> {
  if (!workspaceId || !userId) return [];
  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return [];
  return getAggregatedNotes(workspaceId, sources ?? LEGACY_SOURCES);
}
