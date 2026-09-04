/**
 * Backfill Knowledge Relations & Bi-directional Links (Company Brain Phase 5).
 *
 * Scans notes in a workspace, discovers pre-existing CRM linkages (entities,
 * contacts, deals, tasks, campaigns), and materializes them into first-class
 * `knowledge_relations` in Firestore.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-knowledge-relations.ts --workspace=<workspaceId>
 */

import { QuickNoteRepository } from '../src/lib/quick-notes-repository';
import { KnowledgeRelationRepository } from '../src/lib/knowledge-relation-repository';
import type {
  KnowledgeRelation,
  KnowledgeRelationType,
} from '../src/lib/quick-notes-types';

interface LinkCandidate {
  targetId: string | undefined;
  relType: KnowledgeRelationType;
  targetType: KnowledgeRelation['toObjectType'];
}

async function main() {
  const args = process.argv.slice(2);
  const workspaceArg = args.find((a) => a.startsWith('--workspace='));
  const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : undefined;

  if (!workspaceId) {
    console.error('Missing required argument: --workspace=<workspaceId>');
    process.exit(1);
  }

  console.log(`Starting Knowledge Relations backfill for workspace ${workspaceId}…`);

  const notes = await QuickNoteRepository.listActive(workspaceId);
  console.log(`Found ${notes.length} active notes in workspace.`);

  const existingRelations = await KnowledgeRelationRepository.fetchRelationsForWorkspace(workspaceId);
  const existingSet = new Set(existingRelations.map((r) => `${r.fromObjectId}->${r.toObjectId}:${r.relationType}`));
  console.log(`Found ${existingRelations.length} existing relations.`);

  const toCreate: Array<Omit<KnowledgeRelation, 'id' | 'createdAt'>> = [];

  for (const note of notes) {
    if (!note.links) continue;

    const candidates: LinkCandidate[] = [
      { targetId: note.links.entityId, relType: 'about_school', targetType: 'school' },
      { targetId: note.links.contactId, relType: 'about_contact', targetType: 'contact' },
      { targetId: note.links.dealId, relType: 'about_deal', targetType: 'deal' },
      { targetId: note.links.taskId, relType: 'depends_on', targetType: 'task' },
      { targetId: note.links.campaignId, relType: 'about_campaign', targetType: 'campaign' },
    ];

    for (const cand of candidates) {
      if (cand.targetId) {
        const key = `${note.id}->${cand.targetId}:${cand.relType}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          toCreate.push({
            workspaceId,
            fromObjectId: note.id,
            fromObjectType: note.knowledgeType || 'note',
            toObjectId: cand.targetId,
            toObjectType: cand.targetType,
            relationType: cand.relType,
            confidence: 1.0,
            source: 'system',
            createdByName: 'Migration Script',
            metadata: { backfilled: true, originalNoteTitle: note.title },
          });
        }
      }
    }
  }

  console.log(`Discovered ${toCreate.length} candidate relationship(s) to materialize.`);

  if (toCreate.length > 0) {
    await KnowledgeRelationRepository.batchCreateRelations(workspaceId, toCreate);
    console.log(`Successfully backfilled ${toCreate.length} relations into knowledge_relations.`);
  } else {
    console.log('Knowledge relations are already up to date.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during relations backfill:', err);
  process.exit(1);
});
