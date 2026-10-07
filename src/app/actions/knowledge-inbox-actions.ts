'use server';

/**
 * @fileOverview Secure Server Actions: Knowledge Inbox, Candidates, Conflicts & Graph (Phase 11 M3 · T7)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 17 (Non-Delegable Human Decider), Rule 51 (Next.js 15 Server Actions Conventions),
 * Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges),
 * Rule 60 (Emergency Dead-Man Switch Evaluation).
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  getKnowledgeCandidateService,
} from '@/platform/domains/knowledge_memory/services/knowledge-candidate-service';
import {
  getKnowledgeConflictService,
} from '@/platform/domains/knowledge_memory/services/knowledge-conflict-service';
import {
  getKnowledgeGraphProjectionService,
  type GraphNodeRecord,
  type GraphEdgeRecord,
} from '@/platform/domains/knowledge_memory/services/knowledge-graph-projection-service';
import {
  KnowledgeCandidateSchema,
  ReviewQueueDecideInputSchema,
  ResolveConflictInputSchema,
  type KnowledgeCandidate,
  type ReviewQueueDecideInput,
  type KnowledgeConflict,
  type ResolveConflictInput,
  type KnowledgeCandidateStatus,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';
import {
  KnowledgeDomainError,
  KNOWLEDGE_ERROR_CODES,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-errors';

export interface KnowledgeActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Validates tenant boundaries and enforces Anti-IDOR security (Rule 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, requestedWorkspaceId: string): string {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new KnowledgeDomainError(
      KNOWLEDGE_ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Missing authenticated organization context.'
    );
  }

  const sessionWsId = auth.profile?.lastActiveWorkspaceId;
  if (!auth.isSystemAdmin && sessionWsId && sessionWsId !== requestedWorkspaceId) {
    throw new KnowledgeDomainError(
      KNOWLEDGE_ERROR_CODES.IDOR_VIOLATION,
      `Cross-workspace access denied: caller workspace '${sessionWsId}' does not match requested '${requestedWorkspaceId}'.`
    );
  }

  return sessionOrgId;
}

/**
 * Lists candidates for a workspace with optional status filter.
 */
export async function listKnowledgeCandidatesAction(
  workspaceId: string,
  status?: KnowledgeCandidateStatus
): Promise<KnowledgeActionResult<KnowledgeCandidate[]>> {
  try {
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, workspaceId);

    try {
      checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        message: 'Knowledge candidate service is paused under emergency governance (Rule 60).',
      };
    }

    const service = getKnowledgeCandidateService();
    const candidates = await service.listCandidates({ workspaceId, status });

    return {
      success: true,
      data: candidates,
    };
  } catch (err: unknown) {
    const code = err instanceof KnowledgeDomainError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: code,
      message,
    };
  }
}

/**
 * Decides a candidate in the review queue. Strictly non-delegable human operator action (Rule 17).
 */
export async function decideKnowledgeCandidateAction(
  rawInput: ReviewQueueDecideInput
): Promise<KnowledgeActionResult<KnowledgeCandidate>> {
  try {
    const auth = await requireAuth();
    const input = ReviewQueueDecideInputSchema.parse(rawInput);
    const orgId = assertTenantAccess(auth, input.workspaceId);

    try {
      checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        message: 'Knowledge decision service is paused under emergency governance (Rule 60).',
      };
    }

    const service = getKnowledgeCandidateService();
    const decided = await service.decideCandidate(input, {
      id: auth.uid,
      type: 'user', // Authenticated human session
    });

    return {
      success: true,
      data: decided,
    };
  } catch (err: unknown) {
    const code = err instanceof KnowledgeDomainError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: code,
      message,
    };
  }
}

/**
 * Lists memory conflicts for a workspace.
 */
export async function listKnowledgeConflictsAction(
  workspaceId: string,
  status?: 'open' | 'resolved'
): Promise<KnowledgeActionResult<KnowledgeConflict[]>> {
  try {
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, workspaceId);

    try {
      checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        message: 'Knowledge conflict service is paused under emergency governance (Rule 60).',
      };
    }

    const service = getKnowledgeConflictService();
    const conflicts = await service.listConflicts({ workspaceId, status });

    return {
      success: true,
      data: conflicts,
    };
  } catch (err: unknown) {
    const code = err instanceof KnowledgeDomainError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: code,
      message,
    };
  }
}

/**
 * Resolves an open memory conflict. Strictly non-delegable human operator action (Rule 17).
 */
export async function resolveKnowledgeConflictAction(
  rawInput: ResolveConflictInput
): Promise<KnowledgeActionResult<KnowledgeConflict>> {
  try {
    const auth = await requireAuth();
    const input = ResolveConflictInputSchema.parse(rawInput);
    const orgId = assertTenantAccess(auth, input.workspaceId);

    try {
      checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        message: 'Knowledge conflict resolution is paused under emergency governance (Rule 60).',
      };
    }

    const service = getKnowledgeConflictService();
    const resolved = await service.resolveConflict(input, {
      id: auth.uid,
      type: 'user', // Authenticated human session
    });

    return {
      success: true,
      data: resolved,
    };
  } catch (err: unknown) {
    const code = err instanceof KnowledgeDomainError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: code,
      message,
    };
  }
}

/**
 * Retrieves graph neighbors within Rule 55 ceilings (maxNodes <= 80, maxDepth <= 2).
 */
export async function getKnowledgeGraphNeighborsAction(
  workspaceId: string,
  nodeId: string,
  maxNodes?: number,
  maxDepth?: number
): Promise<KnowledgeActionResult<{ nodes: GraphNodeRecord[]; edges: GraphEdgeRecord[] }>> {
  try {
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, workspaceId);

    try {
      checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: KNOWLEDGE_ERROR_CODES.KNOWLEDGE_DEAD_MAN_PAUSED,
        message: 'Knowledge graph queries are paused under emergency governance (Rule 60).',
      };
    }

    const service = getKnowledgeGraphProjectionService();
    const result = await service.getNeighbors({
      workspaceId,
      nodeId,
      maxNodes,
      maxDepth,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const code = err instanceof KnowledgeDomainError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: code,
      message,
    };
  }
}
