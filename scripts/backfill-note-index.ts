// @ts-nocheck
/**
 * Backfill the `note_index` projection (Quick Notes scale path).
 *
 * Populates the denormalised `note_index` collection from every note source —
 * native Quick Notes plus the legacy entity / task / call notes — for a given
 * workspace. Run once per workspace to bootstrap; ongoing freshness is handled
 * by the read-time aggregator today and Firestore triggers / scheduled re-sync
 * later (design spec §3.2 / ops follow-up).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-note-index.ts --workspace=<workspaceId> [--embed]
 *
 *   --embed   Also generate semantic-search embeddings (requires a Google AI
 *             key and the vector index — see NOTE_INDEX_VECTOR_README.md).
 */

import { QuickNoteRepository } from '../src/lib/quick-notes-repository';
import { quickNoteToUnified } from '../src/lib/quick-notes-domain';
import { getAggregatedNotes } from '../src/lib/quick-notes-aggregator';
import { NoteIndexRepository } from '../src/lib/note-index-repository';
import { embedText } from '../src/ai/flows/embed-note-flow';

async function main() {
  const args = process.argv.slice(2);
  const workspaceArg = args.find((a) => a.startsWith('--workspace='));
  const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : undefined;
  const withEmbeddings = args.includes('--embed');

  if (!workspaceId) {
    console.error('Missing --workspace=<workspaceId>');
    process.exit(1);
  }

  console.log(`Backfilling note_index for workspace ${workspaceId}${withEmbeddings ? ' (with embeddings)' : ''}…`);

  // Native Quick Notes → UnifiedNote
  const native = await QuickNoteRepository.listByWorkspace(workspaceId, 1000);
  const nativeUnified = native.map(quickNoteToUnified);

  // Legacy sources (entity / task / call) → UnifiedNote
  const legacyUnified = await getAggregatedNotes(workspaceId);

  const all = [...nativeUnified, ...legacyUnified];

  // Optionally compute embeddings (best-effort; a single failure won't abort).
  const embeddings = new Map<string, number[]>();
  if (withEmbeddings) {
    let embedded = 0;
    for (const note of all) {
      try {
        const vec = await embedText(note.plainText);
        if (vec.length > 0) {
          embeddings.set(note.id, vec);
          embedded += 1;
        }
      } catch (err) {
        console.warn(`  ! embedding failed for ${note.id}:`, (err as Error).message);
      }
    }
    console.log(`  embedded ${embedded}/${all.length} notes`);
  }

  const written = await NoteIndexRepository.projectMany(all, withEmbeddings ? embeddings : undefined);

  console.log(
    `✓ Projected ${written} rows (native: ${nativeUnified.length}, legacy: ${legacyUnified.length}).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
