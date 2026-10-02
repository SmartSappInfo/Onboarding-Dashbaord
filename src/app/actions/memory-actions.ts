'use server';

/**
 * @fileOverview Secure Institutional Memory Server Actions (Phase 4 Milestone 4)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Multi-Tenancy),
 * Rule 10 (Inline Architectural Docs), Rule 13 & 30 (Untrusted Data Isolation),
 * Rule 47 (Multi-Tenant Isolation), Rule 51 (Server Action Auth via Session Cookie),
 * Rule 60 (Emergency Dead-Man Pause Check), Rule 61 (Operator Console Surface),
 * and Rule 69 (Strangler Pattern via CanonicalMemoryService).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth } from '@/lib/auth/require-auth';
import {
  getCanonicalMemoryService,
  type CanonicalMemoryObject,
  type MemoryStats,
  type MemoryTier,
  type MemoryType,
  type SensitivityLevel,
} from '@/platform/memory';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { z } from 'zod';

export interface MemoryActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

const InboxTabSchema = z.enum([
  'new',
  'insights',
  'potential',
  'conflicts',
  'unconfirmed',
  'stale',
]);
export type InboxTab = z.infer<typeof InboxTabSchema>;

const SearchMemorySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  tiers: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  maxSensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
});

/**
 * Search institutional knowledge across dense vectors and sparse BM25 indices.
 */
export async function searchMemoryAction(
  rawInput: z.input<typeof SearchMemorySchema>
): Promise<MemoryActionResult<CanonicalMemoryObject[]>> {
  try {
    const auth = await requireAuth();
    const parsed = SearchMemorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: 'Invalid search parameters', code: 'INVALID_ARGUMENT' };
    }

    const { query, limit, maxSensitivity, tiers, types } = parsed.data;

    const orgId = auth.isSystemAdmin && parsed.data.organizationId
      ? parsed.data.organizationId
      : auth.profile.organizationId;
    const wsId = parsed.data.workspaceId || auth.profile.defaultWorkspaceId || 'default';

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const memoryService = getCanonicalMemoryService();
    const results = await memoryService.queryMemory({
      organizationId: orgId,
      workspaceId: wsId,
      query,
      limit,
      tiers: tiers as MemoryTier[] | undefined,
      types: types as MemoryType[] | undefined,
      maxSensitivity: maxSensitivity as SensitivityLevel | undefined,
      includeExpired: false,
    });

    return { success: true, data: results };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return { success: false, error: message };
  }
}

/**
 * List unverified and candidate knowledge items for Knowledge Inbox triage (PRD §93).
 */
export async function listKnowledgeInboxAction(options?: {
  tab?: InboxTab;
  limit?: number;
  workspaceId?: string;
  organizationId?: string;
}): Promise<MemoryActionResult<CanonicalMemoryObject[]>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;
    const wsId = options?.workspaceId || auth.profile.defaultWorkspaceId || 'default';

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const memoryService = getCanonicalMemoryService();
    // Query all items for this workspace
    const items = await memoryService.queryMemory({
      organizationId: orgId,
      workspaceId: wsId,
      query: '*',
      limit: options?.limit ?? 50,
      includeExpired: true,
    });

    const tab = options?.tab ?? 'new';
    const now = new Date().toISOString();

    const filtered = items.filter((item) => {
      switch (tab) {
        case 'new':
          return item.verification === 'unverified' || item.verification === 'ai_generated';
        case 'insights':
          return item.type === 'insight' || item.type === 'ai_recommendation';
        case 'potential':
          return (
            (item.source.type === 'meeting' || item.source.type === 'user_note') &&
            item.verification === 'unverified'
          );
        case 'conflicts':
          return item.lifecycle.status === 'disputed' || item.verification === 'disputed';
        case 'unconfirmed':
          return item.verification === 'unverified';
        case 'stale':
          return Boolean(
            (item.temporal.validUntil && item.temporal.validUntil < now) ||
            item.temporal.supersededBy ||
            item.lifecycle.status === 'stale'
          );
        default:
          return true;
      }
    });

    return { success: true, data: filtered };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list knowledge inbox';
    return { success: false, error: message };
  }
}

/**
 * Inspect canonical memory object details and provenance (PRD §94).
 */
export async function inspectMemoryItemAction(
  id: string,
  options?: { workspaceId?: string; organizationId?: string }
): Promise<MemoryActionResult<CanonicalMemoryObject>> {
  try {
    const auth = await requireAuth();
    if (!id) {
      return { success: false, error: 'Memory ID required', code: 'INVALID_ARGUMENT' };
    }

    const memoryService = getCanonicalMemoryService();
    const item = await memoryService.getMemoryItem(id);
    if (!item) {
      return { success: false, error: 'Memory item not found', code: 'MEMORY_NOT_FOUND' };
    }

    // Anti-IDOR enforcement (Rule 47)
    if (!auth.isSystemAdmin && item.organizationId !== auth.profile.organizationId) {
      return { success: false, error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' };
    }

    if (options?.workspaceId && item.workspaceId !== options.workspaceId) {
      return { success: false, error: 'Access denied: Workspace mismatch', code: 'WORKSPACE_MISMATCH' };
    }

    return { success: true, data: item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to inspect memory item';
    return { success: false, error: message };
  }
}

/**
 * Verify and confirm candidate knowledge into institutional memory (PRD §62, §94).
 */
export async function verifyMemoryItemAction(
  id: string,
  notes?: string,
  options?: { workspaceId?: string; organizationId?: string }
): Promise<MemoryActionResult<CanonicalMemoryObject>> {
  try {
    const auth = await requireAuth();
    if (!id) {
      return { success: false, error: 'Memory ID required', code: 'INVALID_ARGUMENT' };
    }

    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    // Rule 60 emergency dead-man pause check
    await checkGovernanceDeadManSwitch(orgId);

    const memoryService = getCanonicalMemoryService();
    const existing = await memoryService.getMemoryItem(id);
    if (!existing) {
      return { success: false, error: 'Memory item not found', code: 'MEMORY_NOT_FOUND' };
    }

    if (!auth.isSystemAdmin && existing.organizationId !== orgId) {
      return { success: false, error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' };
    }

    const reviewerNote = notes || `Verified by user ${auth.uid}`;
    const updated = await memoryService.updateVerificationState(id, 'user_confirmed', reviewerNote);
    if (!updated) {
      return { success: false, error: 'Failed to update memory verification', code: 'UPDATE_FAILED' };
    }

    return { success: true, data: updated };
  } catch (err: unknown) {
    if (err instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: 'System is paused under Emergency Dead-Man Switch',
        code: 'MEMORY_DEAD_MAN_PAUSED',
      };
    }
    const message = err instanceof Error ? err.message : 'Failed to verify memory item';
    return { success: false, error: message };
  }
}

/**
 * Invalidate or reject unverified / inaccurate knowledge candidate.
 */
export async function rejectMemoryItemAction(
  id: string,
  reason: string,
  options?: { workspaceId?: string; organizationId?: string }
): Promise<MemoryActionResult<CanonicalMemoryObject>> {
  try {
    const auth = await requireAuth();
    if (!id || !reason) {
      return { success: false, error: 'Memory ID and rejection reason required', code: 'INVALID_ARGUMENT' };
    }

    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    // Rule 60 emergency dead-man pause check
    await checkGovernanceDeadManSwitch(orgId);

    const memoryService = getCanonicalMemoryService();
    const existing = await memoryService.getMemoryItem(id);
    if (!existing) {
      return { success: false, error: 'Memory item not found', code: 'MEMORY_NOT_FOUND' };
    }

    if (!auth.isSystemAdmin && existing.organizationId !== orgId) {
      return { success: false, error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' };
    }

    const updated = await memoryService.updateVerificationState(id, 'invalidated', reason);
    if (!updated) {
      return { success: false, error: 'Failed to invalidate memory item', code: 'UPDATE_FAILED' };
    }

    return { success: true, data: updated };
  } catch (err: unknown) {
    if (err instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: 'System is paused under Emergency Dead-Man Switch',
        code: 'MEMORY_DEAD_MAN_PAUSED',
      };
    }
    const message = err instanceof Error ? err.message : 'Failed to reject memory item';
    return { success: false, error: message };
  }
}

/**
 * Delete memory item permanently.
 */
export async function deleteMemoryItemAction(
  id: string,
  options?: { workspaceId?: string; organizationId?: string }
): Promise<MemoryActionResult<void>> {
  try {
    const auth = await requireAuth();
    if (!id) {
      return { success: false, error: 'Memory ID required', code: 'INVALID_ARGUMENT' };
    }

    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    // Rule 60 emergency dead-man pause check
    await checkGovernanceDeadManSwitch(orgId);

    const memoryService = getCanonicalMemoryService();
    const existing = await memoryService.getMemoryItem(id);
    if (!existing) {
      return { success: false, error: 'Memory item not found', code: 'MEMORY_NOT_FOUND' };
    }

    if (!auth.isSystemAdmin && existing.organizationId !== orgId) {
      return { success: false, error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' };
    }

    const deleted = await memoryService.deleteMemoryItem(id);
    if (!deleted) {
      return { success: false, error: 'Failed to delete memory item', code: 'DELETE_FAILED' };
    }

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: 'System is paused under Emergency Dead-Man Switch',
        code: 'MEMORY_DEAD_MAN_PAUSED',
      };
    }
    const message = err instanceof Error ? err.message : 'Failed to delete memory item';
    return { success: false, error: message };
  }
}

/**
 * Retrieve aggregated memory metrics for Company Brain UI (Roadmap §19).
 */
export async function getMemoryBrainMetricsAction(options?: {
  workspaceId?: string;
  organizationId?: string;
}): Promise<MemoryActionResult<MemoryStats>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;
    const wsId = options?.workspaceId || auth.profile.defaultWorkspaceId || 'default';

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const memoryService = getCanonicalMemoryService();
    const stats = await memoryService.getMemoryStats(orgId, wsId);
    return { success: true, data: stats };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch memory brain metrics';
    return { success: false, error: message };
  }
}

export interface EntityContextResult {
  entityId: string;
  entityType?: string;
  compiledContext: string;
  evidence: Array<{
    id: string;
    citationTag: string;
    verbatimSnippet: string;
    score: number;
    confidence: number;
    sourceType: string;
    sourceId: string;
    author: string;
    sensitivity: string;
  }>;
  tokenCount: number;
  truncated: boolean;
}

export interface EntityGraphNode {
  id: string;
  label: string;
  nodeType: string;
  connectionsCount?: number;
  originHref?: string | null;
}

export interface EntityGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  confidence?: number;
}

export interface EntityGraphResult {
  centerNodeId: string;
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
}

/**
 * Retrieve grounded institutional memory context for a specific CRM entity (PRD §98).
 */
export async function getEntityContextAction(
  entityId: string,
  entityType?: string,
  options?: {
    query?: string;
    maxTokens?: number;
    workspaceId?: string;
    organizationId?: string;
  }
): Promise<MemoryActionResult<EntityContextResult>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;
    const wsId = options?.workspaceId || auth.profile.defaultWorkspaceId || 'default';

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const memoryService = getCanonicalMemoryService();
    const retrieved = await memoryService.retrieveContext({
      organizationId: orgId,
      workspaceId: wsId,
      query: options?.query || `${entityType ?? 'entity'}: ${entityId}`,
      maxTokens: options?.maxTokens ?? 2000,
    });

    return {
      success: true,
      data: {
        entityId,
        entityType,
        compiledContext: retrieved.evidencePack.promptContext,
        evidence: retrieved.evidencePack.items.map((item) => ({
          id: item.id,
          citationTag: `[${item.sourceType}:${item.sourceId}]`,
          verbatimSnippet: item.content,
          score: item.confidence ?? 0.85,
          confidence: item.confidence ?? 0.85,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          author: item.authorName ?? 'System',
          sensitivity: item.sensitivity ?? 'internal',
        })),
        tokenCount: retrieved.budgetResult.totalTokens,
        truncated: retrieved.budgetResult.truncatedCount > 0,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve entity context';
    return { success: false, error: message };
  }
}

/**
 * Retrieve multi-hop knowledge graph nodes and edges for an entity (PRD §96).
 */
export async function getEntityGraphAction(
  entityId: string,
  options?: {
    depth?: number;
    timeWindowDays?: number;
    nodeTypes?: string[];
    workspaceId?: string;
    organizationId?: string;
  }
): Promise<MemoryActionResult<EntityGraphResult>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;
    const wsId = options?.workspaceId || auth.profile.defaultWorkspaceId || 'default';

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const memoryService = getCanonicalMemoryService();
    const items = await memoryService.queryMemory({
      organizationId: orgId,
      workspaceId: wsId,
      query: entityId,
      limit: 100, // Rule 9 bounded ceiling
    });

    const centerNode = {
      id: entityId,
      label: entityId.replace(/^[^_]+_/, '').replace(/[_-]/g, ' '),
      nodeType: 'entity',
      connectionsCount: 0,
      originHref: `/admin/entities/${entityId}`,
    };

    const nodes: Array<{
      id: string;
      label: string;
      nodeType: string;
      connectionsCount?: number;
      originHref?: string | null;
    }> = [centerNode];

    const edges: Array<{
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
      relationshipType: string;
      confidence?: number;
    }> = [];

    for (const item of items) {
      if (nodes.length >= 100) break; // Rule 9 bounded ceiling
      if (!nodes.some((n) => n.id === item.id)) {
        nodes.push({
          id: item.id,
          label: item.title ?? (item.content.slice(0, 30) + (item.content.length > 30 ? '...' : '')),
          nodeType: item.tier,
          connectionsCount: 1,
          originHref: `/admin/brain?item=${item.id}`,
        });

        edges.push({
          id: `edge_${entityId}_${item.id}`,
          sourceNodeId: entityId,
          targetNodeId: item.id,
          relationshipType: 'RELATED_TO',
          confidence: item.confidence,
        });
      }
    }

    centerNode.connectionsCount = edges.length;

    return {
      success: true,
      data: {
        centerNodeId: entityId,
        nodes,
        edges,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve entity graph';
    return { success: false, error: message };
  }
}

