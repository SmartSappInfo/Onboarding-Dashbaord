'use server';

/**
 * @fileOverview CompanyBrain 2.0: Server Actions for Organization Memory
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Scoping:
 *    - Every server action rigorously checks `checkWorkspaceAccess` before delegating to the repository or pipeline.
 * 2. Strict Zero-`any` Standard:
 *    - All inputs, return objects, and payload data are fully typed with TypeScript interfaces.
 * 3. Atomic Provenance & Explainability:
 *    - Any review status change (`confirmMemoryAction`, `invalidateMemoryAction`) tracks `reviewedBy` and `lastReviewedAt`.
 * 4. Error Transparency:
 *    - Returns uniform `MemoryActionResult<T>` to avoid silent runtime errors and permit actionable client UI feedback.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-repository.test.ts`.
 */

import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { MemoryRepository } from '../memory-repository';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { GraphProjectionService } from '../pipeline/graph-projection-service';
import { GraphRepository } from '../graph-repository';
import { NoteMemoryPipeline, type ProcessNoteMemoryResult } from '../pipeline/note-memory-pipeline';
import type {
  MemoryObject,
  MemoryFilterOptions,
  MemoryHealthStats,
} from '../types';

export type MemoryActionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

export interface ExtractMemoriesFromNoteParams {
  noteId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  title: string;
  plainText: string;
  forceReExtract?: boolean;
}

export interface ConfirmMemoryParams {
  memoryId: string;
  workspaceId: string;
  userId: string;
}

export interface InvalidateMemoryParams {
  memoryId: string;
  workspaceId: string;
  reason: string;
  userId: string;
}

export interface UpdateMemoryParams {
  memoryId: string;
  workspaceId: string;
  updates: Partial<Omit<MemoryObject, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>;
  userId: string;
}

export interface ListWorkspaceMemoriesParams {
  workspaceId: string;
  filters?: MemoryFilterOptions;
  userId: string;
}

export interface GetMemoryHealthStatsParams {
  workspaceId: string;
  userId: string;
}

export interface GetNoteMemoriesParams {
  noteId: string;
  workspaceId: string;
  userId: string;
}

/**
 * Extracts atomic memories from a quick note using Genkit LLM, hashes text for idempotency,
 * resolves entities against active workspace entities, and stores them in Firestore.
 */
export async function extractMemoriesFromNoteAction(
  params: ExtractMemoriesFromNoteParams
): Promise<MemoryActionResult<ProcessNoteMemoryResult>> {
  const { noteId, workspaceId, organizationId, userId, title, plainText, forceReExtract } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!workspaceId || !organizationId) {
    return { success: false, error: 'Missing workspace or organization identifier.' };
  }
  if (!noteId) {
    return { success: false, error: 'Missing source note identifier.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const result = await NoteMemoryPipeline.processNote({
      noteId,
      workspaceId,
      organizationId,
      userId,
      title,
      plainText,
      forceReExtract,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to extract memories from note.' };
    }

    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error processing note memory.';
    console.error('[extractMemoriesFromNoteAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Confirms an AI-generated memory, upgrading verification to 'user_confirmed'.
 */
export async function confirmMemoryAction(
  params: ConfirmMemoryParams
): Promise<MemoryActionResult<MemoryObject>> {
  const { memoryId, workspaceId, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!memoryId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const existing = await MemoryRepository.getMemoryById(memoryId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return { success: false, error: 'Memory object not found in this workspace.' };
    }

    const updated = await MemoryRepository.confirmMemory(memoryId, userId);
    // Non-blocking asynchronous update to Qdrant vector point
    QdrantIndexer.indexMemory(updated).catch((idxErr) => {
      console.warn('[confirmMemoryAction] Non-blocking index update warning:', idxErr);
    });
    // Non-blocking asynchronous update to Graph Layer
    GraphProjectionService.projectMemory(updated).catch((graphErr) => {
      console.warn('[confirmMemoryAction] Non-blocking graph projection warning:', graphErr);
    });
    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm memory.';
    console.error('[confirmMemoryAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Invalidates a memory candidate or existing memory with a clear reason.
 */
export async function invalidateMemoryAction(
  params: InvalidateMemoryParams
): Promise<MemoryActionResult<MemoryObject>> {
  const { memoryId, workspaceId, reason, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!memoryId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: 'Invalidation reason is required.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const existing = await MemoryRepository.getMemoryById(memoryId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return { success: false, error: 'Memory object not found in this workspace.' };
    }

    const updated = await MemoryRepository.invalidateMemory(memoryId, reason, userId);
    // Non-blocking asynchronous removal of vector points from Qdrant
    QdrantIndexer.deleteMemoryIndex(memoryId).catch((delErr) => {
      console.warn('[invalidateMemoryAction] Non-blocking index prune warning:', delErr);
    });
    // Non-blocking cascading removal of memory node and incident edges from Graph Layer
    GraphRepository.deleteNode(`mem_${memoryId}`, workspaceId).catch((graphErr) => {
      console.warn('[invalidateMemoryAction] Non-blocking graph prune warning:', graphErr);
    });
    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to invalidate memory.';
    console.error('[invalidateMemoryAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Updates a memory object's title, content, type, or tags.
 */
export async function updateMemoryAction(
  params: UpdateMemoryParams
): Promise<MemoryActionResult<MemoryObject>> {
  const { memoryId, workspaceId, updates, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!memoryId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const existing = await MemoryRepository.getMemoryById(memoryId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return { success: false, error: 'Memory object not found in this workspace.' };
    }

    const updated = await MemoryRepository.updateMemory(memoryId, updates);
    // Non-blocking asynchronous re-indexing to Qdrant
    QdrantIndexer.indexMemory(updated).catch((idxErr) => {
      console.warn('[updateMemoryAction] Non-blocking index update warning:', idxErr);
    });
    // Non-blocking asynchronous projection update into Graph Layer
    GraphProjectionService.projectMemory(updated).catch((graphErr) => {
      console.warn('[updateMemoryAction] Non-blocking graph projection warning:', graphErr);
    });
    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update memory.';
    console.error('[updateMemoryAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Lists memories for a workspace filtered by type, verification state, or entity connection.
 */
export async function listWorkspaceMemoriesAction(
  params: ListWorkspaceMemoriesParams
): Promise<MemoryActionResult<MemoryObject[]>> {
  const { workspaceId, filters, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!workspaceId) {
    return { success: false, error: 'Workspace identifier is required.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const memories = await MemoryRepository.listMemories(workspaceId, filters);
    return { success: true, data: memories };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list memories.';
    console.error('[listWorkspaceMemoriesAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Retrieves memories connected directly to a specific source note.
 */
export async function getNoteMemoriesAction(
  params: GetNoteMemoriesParams
): Promise<MemoryActionResult<MemoryObject[]>> {
  const { noteId, workspaceId, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!noteId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const memories = await MemoryRepository.getMemoriesBySourceId(noteId);
    // Filter to current workspace for tenancy isolation
    const workspaceMemories = memories.filter((m) => m.workspaceId === workspaceId);
    return { success: true, data: workspaceMemories };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get note memories.';
    console.error('[getNoteMemoriesAction] Failure:', err);
    return { success: false, error: message };
  }
}

/**
 * Computes memory health statistics for the workspace.
 */
export async function getMemoryHealthStatsAction(
  params: GetMemoryHealthStatsParams
): Promise<MemoryActionResult<MemoryHealthStats>> {
  const { workspaceId, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!workspaceId) {
    return { success: false, error: 'Workspace identifier is required.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const stats = await MemoryRepository.getMemoryStats(workspaceId);
    return { success: true, data: stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve memory health statistics.';
    console.error('[getMemoryHealthStatsAction] Failure:', err);
    return { success: false, error: message };
  }
}
