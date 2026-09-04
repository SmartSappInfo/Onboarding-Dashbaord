'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Organization Memory Orchestrator & Conflict Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Gate:
 *    - All mutations and reads verify user membership via `checkWorkspaceAccess`.
 * 2. Actionable Error Navigation (Rule 1):
 *    - All errors return relative `actionConfig` paths beginning with `/`.
 * 3. Strict Zero-`any` Standard:
 *    - Strict TypeScript models for all params and `ActionResult<T>` responses.
 * 4. Non-Destructive Integrity:
 *    - Conflict resolutions and stale confirmations preserve audit trails.
 *
 * @testability Tested via unit tests and UI integration.
 */

import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { OrganizationMemoryService, type MemoryRecallResult } from '../services/organization-memory-service';
import { ConflictRepository } from '../conflict-repository';
import { ConflictEngine } from '../services/conflict-engine';
import { MemoryRepository } from '../memory-repository';
import {
  calculateFreshnessScore,
  reconfirmFreshness,
} from '../services/freshness-engine';
import { ContextBuilderService } from '../services/context-builder-service';
import { MemoryConsolidationEngine } from '../services/memory-consolidation-engine';
import type { MemoryObject } from '../types';
import type {
  MemoryConflict,
  ConflictStatus,
  ConflictResolutionChoice,
  MemoryFreshnessInfo,
  ConsolidationCandidate,
  MemoryHealthMetrics,
} from '../orchestrator-types';

export type ActionResult<T> =
  | { success: true; data: T; error?: never; code?: never; actionConfig?: never }
  | {
      success: false;
      data?: never;
      error: string;
      code?: 'unauthenticated' | 'unauthorized' | 'validation_error' | 'not_found' | 'server_error';
      actionConfig?: { path: string; label: string };
    };

// ============================================================================
// 1. HEALTH & METRICS ACTIONS
// ============================================================================

/**
 * Retrieves holistic memory health metrics across Firestore, Qdrant, and Graph.
 */
export async function getMemoryHealthAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<MemoryHealthMetrics>> {
  const { workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }

  try {
    const metrics = await OrganizationMemoryService.getHealth(workspaceId, organizationId);
    return { success: true, data: metrics };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve memory health metrics.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Refresh Dashboard' },
    };
  }
}

// ============================================================================
// 2. CONFLICT GOVERNANCE ACTIONS
// ============================================================================

/**
 * Lists detected memory conflicts for a workspace, optionally filtered by status.
 */
export async function listMemoryConflictsAction(params: {
  workspaceId: string;
  userId: string;
  status?: ConflictStatus;
}): Promise<ActionResult<MemoryConflict[]>> {
  const { workspaceId, userId, status } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Notes Overview' },
    };
  }

  try {
    const conflicts = await ConflictRepository.listConflictsByWorkspace({ workspaceId, status });
    return { success: true, data: conflicts };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list memory conflicts.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Retry Conflicts' },
    };
  }
}

/**
 * Resolves a memory conflict with human adjudication (Confirm A, Confirm B, Keep Both, Synthesize, Dismiss).
 */
export async function resolveMemoryConflictAction(params: {
  conflictId: string;
  workspaceId: string;
  userId: string;
  resolution: ConflictResolutionChoice;
  resolutionNotes?: string;
}): Promise<ActionResult<MemoryConflict>> {
  const { conflictId, workspaceId, userId, resolution, resolutionNotes } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required to resolve conflicts.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes/conflicts', label: 'View Conflicts' },
    };
  }

  try {
    const conflict = await ConflictRepository.getConflictById(conflictId);
    if (!conflict) {
      return {
        success: false,
        error: 'Conflict record not found.',
        code: 'not_found',
        actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Back to Conflicts' },
      };
    }

    // Apply specific resolution behavior to source memories
    if (resolution === 'confirm_a') {
      // Memory B is superseded / invalidated
      await MemoryRepository.invalidateMemory(
        conflict.memoryIdB,
        `Superseded by memory ${conflict.memoryIdA} in conflict resolution.`,
        userId
      );
      await MemoryRepository.confirmMemory(conflict.memoryIdA, userId);
    } else if (resolution === 'confirm_b') {
      // Memory A is superseded / invalidated
      await MemoryRepository.invalidateMemory(
        conflict.memoryIdA,
        `Superseded by memory ${conflict.memoryIdB} in conflict resolution.`,
        userId
      );
      await MemoryRepository.confirmMemory(conflict.memoryIdB, userId);
    }

    await ConflictRepository.resolveConflict({
      conflictId,
      resolution,
      resolvedByUserId: userId,
      resolutionNotes,
    });

    // Invalidate cached context packages so subsequent context assemblies reflect the resolution
    ContextBuilderService.clearCache();

    const updated = await ConflictRepository.getConflictById(conflictId);
    if (!updated) {
      throw new Error('Failed to retrieve updated conflict.');
    }

    return { success: true, data: updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to resolve memory conflict.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Retry Resolution' },
    };
  }
}

/**
 * Triggers a live batch contradiction scan across active memories in a workspace.
 */
export async function scanMemoryConflictsBatchAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<{ scannedPairs: number; conflictsDetected: number }>> {
  const { workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const memories = await MemoryRepository.listMemories(workspaceId, { limit: 50 });
    const activeMemories = memories.filter((m) => m.lifecycle.status !== 'archived');

    const pairs = ConflictEngine.findCandidatePairs(activeMemories, 50);
    const results = await ConflictEngine.evaluatePairs(pairs);

    let conflictsDetected = 0;
    for (const r of results) {
      if (r.hasConflict && r.conflict) {
        await ConflictRepository.createConflict({
          workspaceId,
          organizationId,
          memoryIdA: r.conflict.memoryIdA,
          memoryIdB: r.conflict.memoryIdB,
          summary: r.conflict.summary,
          status: 'unresolved',
          conflictType: r.conflict.conflictType,
          confidenceScore: r.conflict.confidenceScore,
          detectedBy: 'ai',
          evidenceA: r.conflict.evidenceA,
          evidenceB: r.conflict.evidenceB,
          opposingAspects: r.conflict.opposingAspects,
        });
        conflictsDetected += 1;
      }
    }

    return {
      success: true,
      data: {
        scannedPairs: pairs.length,
        conflictsDetected,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Conflict scan encountered an error.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Conflict Center' },
    };
  }
}

// ============================================================================
// 3. FRESHNESS & STALENESS ACTIONS
// ============================================================================

/**
 * Lists stale memories or memories nearing decay in a workspace.
 */
export async function listStaleMemoriesAction(params: {
  workspaceId: string;
  userId: string;
  minFreshnessScore?: number;
}): Promise<ActionResult<{ memory: MemoryObject; freshness: MemoryFreshnessInfo }[]>> {
  const { workspaceId, userId, minFreshnessScore = 0.5 } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const memories = await MemoryRepository.listMemories(workspaceId, { limit: 100 });
    const activeMemories = memories.filter((m) => m.lifecycle.status !== 'archived');

    const staleItems: { memory: MemoryObject; freshness: MemoryFreshnessInfo }[] = [];
    for (const mem of activeMemories) {
      const freshness = calculateFreshnessScore(mem);
      if (freshness.isStale || freshness.freshnessScore < minFreshnessScore) {
        staleItems.push({ memory: mem, freshness });
      }
    }

    staleItems.sort((a, b) => a.freshness.freshnessScore - b.freshness.freshnessScore);
    return { success: true, data: staleItems };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve stale memories.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Notes Overview' },
    };
  }
}

/**
 * Reconfirms a memory as fresh truth with 1 click.
 */
export async function reconfirmMemoryFreshnessAction(params: {
  memoryId: string;
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<MemoryObject>> {
  const { memoryId, workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const memory = await MemoryRepository.getMemoryById(memoryId);
    if (!memory) {
      return {
        success: false,
        error: 'Memory not found.',
        code: 'not_found',
        actionConfig: { path: '/admin/quick-notes', label: 'Notes Overview' },
      };
    }

    const patch = reconfirmFreshness(memory, userId);
    await MemoryRepository.confirmMemory(memoryId, userId);

    return {
      success: true,
      data: {
        ...memory,
        ...patch,
        verification: 'user_confirmed',
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reconfirm memory freshness.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
    };
  }
}

// ============================================================================
// 4. CONSOLIDATION ACTIONS
// ============================================================================

/**
 * Discovers clusters of related memories and returns proposed consolidation candidates.
 */
export async function findConsolidationCandidatesAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<ConsolidationCandidate[]>> {
  const { workspaceId, organizationId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const candidates = await MemoryConsolidationEngine.findConsolidationCandidates(
      workspaceId,
      organizationId
    );
    return { success: true, data: candidates };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to discover consolidation candidates.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
    };
  }
}

/**
 * Applies an approved consolidation candidate.
 */
export async function applyConsolidationAction(params: {
  candidate: ConsolidationCandidate;
  userId: string;
}): Promise<ActionResult<MemoryObject>> {
  const { candidate, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(candidate.workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const consolidated = await MemoryConsolidationEngine.applyConsolidation(candidate, userId);
    return { success: true, data: consolidated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to apply memory consolidation.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
    };
  }
}

// ============================================================================
// 5. UNIFIED RECALL ACTION
// ============================================================================

/**
 * Intelligently routes and executes multi-store recall queries.
 */
export async function unifiedRecallAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  query: string;
  strategy?: 'auto' | 'semantic' | 'relational' | 'exact' | 'hybrid';
  limit?: number;
}): Promise<ActionResult<MemoryRecallResult>> {
  const { workspaceId, organizationId, userId, query, strategy = 'auto', limit = 15 } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Overview' },
    };
  }

  try {
    const result = await OrganizationMemoryService.recall({
      workspaceId,
      organizationId,
      query,
      strategy,
      limit,
    });
    return { success: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recall operation encountered an error.';
    return {
      success: false,
      error: msg,
      code: 'server_error',
      actionConfig: { path: '/admin/quick-notes/search', label: 'Search Console' },
    };
  }
}
