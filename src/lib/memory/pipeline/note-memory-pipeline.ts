/**
 * @fileOverview CompanyBrain 2.0: Note -> Memory Transformation Pipeline
 *
 * ARCHITECTURAL GUIDELINES & DESIGN POINTERS (Rule 10 Maintainer Note):
 * 1. End-to-End Orchestrator for Organization Memory:
 *    - Transforms unstructured notes into typed, linked, verified MemoryObjects.
 * 2. Idempotency & Hash Guard:
 *    - Computes sha256 hash of plain text. Skips redundant LLM calls if text hasn't changed.
 *    - Replaces/archives obsolete memories when notes are materially updated.
 * 3. Entity Resolution:
 *    - Cross-references LLM extracted entity names against active `workspace_entities` in Firestore.
 * 4. High-Load Batch Chunking:
 *    - Guarantees batch write limits (<= 250 documents) via MemoryRepository.
 * 5. Strict Zero-`any` typing:
 *    - Fully typed with TypeScript interfaces.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-pipeline.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { createHash } from 'crypto';
import { extractMemories, type ExtractMemoriesOutput } from '@/ai/flows/extract-memories-flow';
import { MemoryRepository } from '../memory-repository';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { GraphProjectionService } from './graph-projection-service';
import type {
  MemoryObject,
  ExtractedEntity,
  SubjectReferences,
} from '../types';
import { QUICK_NOTES_COLLECTION, type QuickNote } from '@/lib/quick-notes-types';

export interface ProcessNoteMemoryParams {
  noteId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  title: string;
  plainText: string;
  forceReExtract?: boolean;
}

export interface ProcessNoteMemoryResult {
  success: boolean;
  memories: MemoryObject[];
  aiOutput?: ExtractMemoriesOutput;
  isCached?: boolean;
  error?: string;
}

interface WorkspaceEntityCandidate {
  entityId: string;
  displayName: string;
}

export class NoteMemoryPipeline {
  /**
   * Generates a SHA-256 hash of normalized text for change detection.
   */
  public static computeTextHash(text: string): string {
    return createHash('sha256').update((text || '').trim().toLowerCase()).digest('hex');
  }

  /**
   * Resolves entity names against active workspace entities in Firestore.
   */
  private static async resolveWorkspaceEntities(
    workspaceId: string,
    extractedNames: string[]
  ): Promise<WorkspaceEntityCandidate[]> {
    if (!workspaceId || extractedNames.length === 0) return [];

    try {
      const snap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(100)
        .get();

      const existingEntities: WorkspaceEntityCandidate[] = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          entityId: (data.entityId as string) || doc.id,
          displayName: (data.displayName as string) || (data.name as string) || '',
        };
      });

      const matched: WorkspaceEntityCandidate[] = [];
      for (const extracted of extractedNames) {
        const cleanExtracted = extracted.toLowerCase().trim();
        if (cleanExtracted.length < 2) continue;

        const found = existingEntities.find(
          (e) =>
            e.displayName.toLowerCase() === cleanExtracted ||
            e.displayName.toLowerCase().includes(cleanExtracted) ||
            cleanExtracted.includes(e.displayName.toLowerCase())
        );

        if (found && !matched.some((m) => m.entityId === found.entityId)) {
          matched.push(found);
        }
      }

      return matched;
    } catch (err) {
      console.error('[NoteMemoryPipeline] Error resolving workspace entities:', err);
      return [];
    }
  }

  /**
   * Ingests a note, executes memory extraction, and commits atomic MemoryObjects.
   */
  public static async processNote(
    params: ProcessNoteMemoryParams
  ): Promise<ProcessNoteMemoryResult> {
    const {
      noteId,
      workspaceId,
      organizationId,
      userId,
      title,
      plainText,
      forceReExtract = false,
    } = params;

    const trimmedText = (plainText || '').trim();
    if (!trimmedText) {
      return {
        success: false,
        memories: [],
        error: 'Note contains no text to process.',
      };
    }

    const currentHash = this.computeTextHash(trimmedText);

    // 1. Check idempotency: If note already has memories for this exact hash, return them
    if (!forceReExtract) {
      const existingMemories = await MemoryRepository.getMemoriesBySourceId(noteId);
      if (
        existingMemories.length > 0 &&
        existingMemories[0].source?.sourceHash === currentHash
      ) {
        return {
          success: true,
          memories: existingMemories,
          isCached: true,
        };
      }
    }

    // 2. Fetch active workspace entity names to provide a hint to the LLM
    let contextHint = '';
    try {
      const activeEntitiesSnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(25)
        .get();

      const sampleNames = activeEntitiesSnap.docs
        .map((d) => (d.data().displayName as string) || (d.data().name as string))
        .filter(Boolean);

      if (sampleNames.length > 0) {
        contextHint = `Active entities in this workspace: ${sampleNames.join(', ')}`;
      }
    } catch {
      // Non-blocking fallback
    }

    // 3. Execute AI extraction flow
    let aiOutput: ExtractMemoriesOutput;
    try {
      aiOutput = await extractMemories({
        noteTitle: title,
        plainText: trimmedText,
        workspaceId,
        organizationId,
        contextHint,
      });
    } catch (err) {
      console.error('[NoteMemoryPipeline] Extraction flow failure:', err);
      return {
        success: false,
        memories: [],
        error: err instanceof Error ? err.message : 'AI memory extraction failed.',
      };
    }

    // 4. Resolve detected entity names to real entity IDs
    const extractedNames = aiOutput.extractedEntities.map((e) => e.entityName);
    const resolvedEntities = await this.resolveWorkspaceEntities(workspaceId, extractedNames);
    const resolvedEntityIds = resolvedEntities.map((r) => r.entityId);

    const typedEntities: ExtractedEntity[] = aiOutput.extractedEntities.map((e) => {
      const match = resolvedEntities.find(
        (r) => r.displayName.toLowerCase() === e.entityName.toLowerCase()
      );
      return {
        entityId: match?.entityId,
        entityName: e.entityName,
        entityType: e.entityType,
        confidenceScore: e.confidenceScore,
      };
    });

    // 5. Clean up old memories for this note to prevent duplication
    await MemoryRepository.deleteMemoriesBySourceId(noteId);
    // Asynchronously prune obsolete vector points for this note source
    QdrantIndexer.deleteSourceIndex(noteId).catch((delErr) => {
      console.warn('[NoteMemoryPipeline] Warning pruning obsolete source vector points:', delErr);
    });

    // 6. Build atomic MemoryObject drafts
    const memoryDrafts: Omit<MemoryObject, 'id' | 'createdAt' | 'updatedAt'>[] =
      aiOutput.memoryCandidates.map((c) => {
        const subjectRefs: SubjectReferences = {};
        if (resolvedEntityIds.length > 0) {
          subjectRefs.entityIds = resolvedEntityIds;
        }

        return {
          organizationId,
          workspaceId,
          type: c.type,
          title: c.title,
          content: c.content,
          summary: c.title,
          source: {
            type: 'user_note',
            sourceId: noteId,
            sourceHash: currentHash,
          },
          subjectRefs,
          topics: aiOutput.topics,
          entities: typedEntities,
          importance: c.importance,
          confidence: c.confidence,
          verification: 'ai_generated',
          visibility: { scope: 'workspace' },
          lifecycle: { status: 'active' },
          provenance: {
            createdBy: 'agent',
            userId,
            sourceHash: currentHash,
          },
          evidence: c.evidence,
        };
      });

    // 7. Persist memories in safe chunked batch (<= 250)
    const createdMemories = await MemoryRepository.createMemoriesBatch(memoryDrafts);
    const createdMemoryIds = createdMemories.map((m) => m.id);

    // 7b. Asynchronously index newly created memories into Qdrant (non-blocking for UI)
    if (createdMemories.length > 0) {
      QdrantIndexer.indexMemoriesBatch(createdMemories).catch((indexingErr) => {
        console.warn('[NoteMemoryPipeline] Asynchronous vector indexing background warning:', indexingErr);
      });

      // 7c. Asynchronously project newly created memories into the Graph Layer (non-blocking for UI)
      Promise.all(createdMemories.map((m) => GraphProjectionService.projectMemory(m))).catch((graphErr) => {
        console.warn('[NoteMemoryPipeline] Asynchronous graph projection background warning:', graphErr);
      });
    }

    // 8. Update source QuickNote document with memory linkage and cached AI meta
    try {
      const noteRef = adminDb.collection(QUICK_NOTES_COLLECTION).doc(noteId);
      const noteSnap = await noteRef.get();

      if (noteSnap.exists) {
        const actionItems = aiOutput.memoryCandidates
          .filter((c) => c.type === 'action_item')
          .map((c) => c.title);

        const updatePayload: Partial<QuickNote> = {
          memoryObjectIds: createdMemoryIds,
          sourceHash: currentHash,
          ai: {
            summary: aiOutput.executiveSummary,
            suggestedTags: aiOutput.topics,
            sentiment: aiOutput.overallSentiment,
            actionItems,
            generatedAt: new Date().toISOString(),
            model: 'googleai/gemini-2.5-flash',
          },
          updatedAt: new Date().toISOString(),
        };

        await noteRef.update(updatePayload as Record<string, unknown>);
      }
    } catch (err) {
      console.warn('[NoteMemoryPipeline] Non-critical warning updating note linkage:', err);
    }

    return {
      success: true,
      memories: createdMemories,
      aiOutput,
    };
  }
}
