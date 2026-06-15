'use server';

import { embedText } from '@/ai/flows/embed-note-flow';
import { NoteIndexRepository } from './note-index-repository';
import { canUser } from './workspace-permissions';
import { buildAiInput } from './quick-notes-domain';
import type { NoteIndexRow } from './quick-notes-types';

/**
 * Quick Notes — semantic "ask your notes" search (Phase 7).
 *
 * Embeds the query and runs a Firestore vector `findNearest` over the workspace's
 * `note_index`. Requires (ops): the vector index created via
 * scripts/NOTE_INDEX_VECTOR_README.md and a backfilled index
 * (`npm run backfill:note-index --workspace=<id>`).
 */

type SearchResult =
  | { success: true; data: NoteIndexRow[] }
  | { success: false; error: string; code?: 'no_index' | 'rate_limited' | 'unauthenticated' };

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const callLog = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (callLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    callLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  callLog.set(userId, recent);
  return false;
}

export interface SemanticSearchParams {
  workspaceId: string;
  query: string;
  userId: string;
  limit?: number;
}

export async function semanticSearchNotes(params: SemanticSearchParams): Promise<SearchResult> {
  const { workspaceId, userId } = params;
  if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
  if (!workspaceId) return { success: false, error: 'No workspace selected.' };

  // Admin-SDK read: verify the caller may view this workspace's notes.
  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

  const query = buildAiInput(params.query, 1000);
  if (!query) return { success: false, error: 'Enter a question or phrase to search.' };
  if (rateLimited(userId)) {
    return { success: false, error: 'Too many searches. Please wait a moment.', code: 'rate_limited' };
  }

  try {
    const queryVector = await embedText(query);
    if (queryVector.length === 0) return { success: true, data: [] };

    const rows = await NoteIndexRepository.searchByVector(workspaceId, queryVector, params.limit ?? 10);
    return { success: true, data: rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    // A missing vector index surfaces as a FAILED_PRECONDITION from Firestore.
    if (/index|FAILED_PRECONDITION|vector/i.test(message)) {
      return {
        success: false,
        code: 'no_index',
        error: 'Semantic search is not set up yet. Backfill the note index and create the vector index.',
      };
    }
    return { success: false, error: message };
  }
}
