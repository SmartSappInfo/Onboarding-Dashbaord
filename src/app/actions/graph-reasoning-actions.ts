'use server';

/**
 * @fileOverview Next.js 15 Server Actions for Graph Reasoning & Relationship Intelligence (Phase 13 Milestone 2)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Assertion)
 * - Rule 10 (Zod v4 Schema Validation)
 * - Rule 12 (Canonical Risk Vocabulary: L0_READ)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 50 (Tenant-Partitioned Cache Invalidation)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth via requireAuth())
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z, ZodError } from 'zod';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  AnalyzeInfluenceInputSchema,
  AnalyzeInfluenceInputRaw,
  AnalyzeInfluenceResult,
  DetectContagionInputSchema,
  DetectContagionInputRaw,
  AccountContagionCluster,
  FindCausalPathInputSchema,
  FindCausalPathInputRaw,
  MultiHopPathReasoning,
  GraphReasoningError,
} from '@/platform/domains/graph_reasoning/graph-reasoning-types';
import { getGraphReasoningService } from '@/platform/domains/graph_reasoning/graph-reasoning-service';

export interface GraphActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Enforces Anti-IDOR tenant boundary validation (Rules 8 & 47).
 */
function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new GraphReasoningError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}' (Rules 8 & 47).`,
      403
    );
  }
}

/**
 * 1. Analyze Decision-Maker Influence Map Action
 */
export async function getDecisionMakerInfluenceMapAction(
  rawInput: AnalyzeInfluenceInputRaw
): Promise<GraphActionResult<AnalyzeInfluenceResult>> {
  try {
    const validated = AnalyzeInfluenceInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, validated.organizationId);

    try {
      await checkGovernanceDeadManSwitch(validated.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return {
          success: false,
          error: `Graph reasoning operations are emergency paused for tenant '${validated.organizationId}' (Rule 60).`,
          code: 'GRAPH_DEAD_MAN_PAUSED',
        };
      }
      throw err;
    }

    const service = getGraphReasoningService();
    const result = await service.analyzeDecisionMakerInfluence(validated);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof GraphReasoningError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    if (error instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: error.message,
        code: 'GRAPH_DEAD_MAN_PAUSED',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown graph reasoning error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * 2. Detect Account Risk Contagion Action
 */
export async function detectAccountRiskContagionAction(
  rawInput: DetectContagionInputRaw
): Promise<GraphActionResult<AccountContagionCluster>> {
  try {
    const validated = DetectContagionInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, validated.organizationId);

    try {
      await checkGovernanceDeadManSwitch(validated.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return {
          success: false,
          error: `Graph reasoning operations are emergency paused for tenant '${validated.organizationId}' (Rule 60).`,
          code: 'GRAPH_DEAD_MAN_PAUSED',
        };
      }
      throw err;
    }

    const service = getGraphReasoningService();
    const result = await service.detectAccountRiskContagion(validated);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof GraphReasoningError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    if (error instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: error.message,
        code: 'GRAPH_DEAD_MAN_PAUSED',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown contagion detection error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * 3. Find Causal Relationship Path Action
 */
export async function findCausalRelationshipPathAction(
  rawInput: FindCausalPathInputRaw
): Promise<GraphActionResult<MultiHopPathReasoning>> {
  try {
    const validated = FindCausalPathInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, validated.organizationId);

    try {
      await checkGovernanceDeadManSwitch(validated.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return {
          success: false,
          error: `Graph reasoning operations are emergency paused for tenant '${validated.organizationId}' (Rule 60).`,
          code: 'GRAPH_DEAD_MAN_PAUSED',
        };
      }
      throw err;
    }

    const service = getGraphReasoningService();
    const result = await service.findCausalRelationshipPath(validated);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof GraphReasoningError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    if (error instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: error.message,
        code: 'GRAPH_DEAD_MAN_PAUSED',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown pathfinding error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

const InvalidateCacheInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  entityId: z.string().optional(),
});

/**
 * 4. Invalidate Graph Reasoning Cache Action (Rule 50)
 */
export async function invalidateGraphReasoningCacheAction(
  params: z.input<typeof InvalidateCacheInputSchema>
): Promise<GraphActionResult<{ invalidated: boolean }>> {
  try {
    const validated = InvalidateCacheInputSchema.parse(params);
    const auth = await requireAuth();
    assertTenantContext(auth, validated.organizationId);

    const service = getGraphReasoningService();
    service.invalidateCache(validated.organizationId, validated.workspaceId, validated.entityId);

    return {
      success: true,
      data: { invalidated: true },
    };
  } catch (error) {
    if (error instanceof GraphReasoningError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown cache invalidation error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}
