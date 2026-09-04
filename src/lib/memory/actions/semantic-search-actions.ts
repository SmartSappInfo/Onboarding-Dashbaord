'use server';

/**
 * @fileOverview CompanyBrain 2.0: Server Actions for Semantic Memory & Qdrant Search
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Scoping:
 *    - All semantic search actions enforce `checkWorkspaceAccess` before querying vector store.
 * 2. Strict Zero-`any` Standard:
 *    - All action params and returns conform to `MemoryActionResult<T>`.
 * 3. Pre-Filtered Vector Queries:
 *    - Tenant boundaries are passed to the query engine and never post-filtered after retrieval.
 *
 * @testability Covered in `src/lib/memory/__tests__/semantic-search.test.ts`.
 */

import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { SemanticSearchService } from '../services/semantic-search-service';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { MemoryRepository } from '../memory-repository';
import type { MemoryObject } from '../types';
import type {
  SemanticSearchResult,
  SemanticSearchFilters,
} from '../semantic-types';
import type { MemoryActionResult } from './memory-actions';

export interface SemanticSearchParams {
  workspaceId: string;
  organizationId: string;
  query: string;
  filters?: SemanticSearchFilters;
  limit?: number;
  userId: string;
}

export interface GetRelatedMemoriesParams {
  memoryId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  limit?: number;
}

export interface ReindexMemoryParams {
  memoryId: string;
  workspaceId: string;
  userId: string;
}

export interface ReindexWorkspaceParams {
  workspaceId: string;
  userId: string;
}

/**
 * Performs pre-filtered semantic vector search across organizational memories.
 */
export async function semanticSearchMemoriesAction(
  params: SemanticSearchParams
): Promise<MemoryActionResult<SemanticSearchResult[]>> {
  const { workspaceId, organizationId, query, filters, limit, userId } = params;

  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!workspaceId || !organizationId) {
    return { success: false, error: 'Missing workspace or organization identifier.' };
  }
  if (!query || !query.trim()) {
    return { success: true, data: [] };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const results = await SemanticSearchService.search({
      workspaceId,
      organizationId,
      query: query.trim(),
      filters,
      limit: limit ?? 15,
      userId,
    });

    return { success: true, data: results };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Semantic search failed.';
    console.error('[semanticSearchMemoriesAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Finds vector nearest neighbors for a target memory.
 */
export async function getRelatedMemoriesAction(
  params: GetRelatedMemoriesParams
): Promise<MemoryActionResult<MemoryObject[]>> {
  const { memoryId, workspaceId, organizationId, userId, limit } = params;

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
    const related = await SemanticSearchService.getRelatedMemories({
      memoryId,
      workspaceId,
      organizationId,
      limit: limit ?? 5,
    });

    return { success: true, data: related };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve related memories.';
    console.error('[getRelatedMemoriesAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Re-indexes a single memory into Qdrant.
 */
export async function reindexMemoryAction(
  params: ReindexMemoryParams
): Promise<MemoryActionResult<{ indexed: boolean }>> {
  const { memoryId, workspaceId, userId } = params;

  if (!userId || !memoryId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const memory = await MemoryRepository.getMemoryById(memoryId);
    if (!memory || memory.workspaceId !== workspaceId) {
      return { success: false, error: 'Memory not found in workspace.' };
    }

    const success = await QdrantIndexer.indexMemory(memory);
    return { success: true, data: { indexed: success } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reindexing failed.';
    console.error('[reindexMemoryAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Re-indexes all memories in a workspace into Qdrant.
 */
export async function reindexWorkspaceMemoriesAction(
  params: ReindexWorkspaceParams
): Promise<MemoryActionResult<{ total: number; indexed: number; failed: number }>> {
  const { workspaceId, userId } = params;

  if (!userId || !workspaceId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return { success: false, error: access.reason || 'Unauthorized workspace access.' };
  }

  try {
    const memories = await MemoryRepository.listMemories(workspaceId, { limit: 500 });
    const stats = await QdrantIndexer.indexMemoriesBatch(memories);

    return {
      success: true,
      data: {
        total: memories.length,
        indexed: stats.indexed,
        failed: stats.failed,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk reindexing failed.';
    console.error('[reindexWorkspaceMemoriesAction] Error:', err);
    return { success: false, error: message };
  }
}
