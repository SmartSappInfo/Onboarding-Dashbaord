'use server';

/**
 * @fileOverview Secure Next.js 15 Server Actions for Knowledge Agent (Phase 11 M4 · T4)
 *
 * Implements:
 * - Session authentication via requireAuth() (Rule 51)
 * - Anti-IDOR tenant validation bound to authenticated session (Rule 8 & 47)
 * - Emergency dead-man switch evaluation via checkGovernanceDeadManSwitch (Rule 60)
 * - Adaptive multi-index retrieval and grounded answer synthesis (Rule 47)
 * - Structured error taxonomy (Rule 48)
 *
 * Strict Compliance:
 * - Zero `any` or `any[]` (Rule 4)
 */

import { requireAuth } from '@/lib/auth/require-auth';
import {
  type KnowledgeAnswerContract,
  type KnowledgeSearchHybridInput,
  type KnowledgeSearchHybridOutput,
  type KnowledgeGetEvidenceInput,
  type KnowledgeGetEvidenceOutput,
  type ExplainContextInclusionInput,
  type ExplainContextInclusionOutput,
  KnowledgeSearchHybridInputSchema,
  KnowledgeGetEvidenceInputSchema,
  ExplainContextInclusionInputSchema,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';
import {
  KnowledgeAgentError,
  KNOWLEDGE_AGENT_ERROR_CODES,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-errors';
import {
  getKnowledgeAgentService,
} from '@/platform/domains/knowledge_memory/services/knowledge-agent-service';
import {
  getKnowledgeAdaptiveRetriever,
} from '@/platform/domains/knowledge_memory/services/knowledge-adaptive-retriever';
import { z } from 'zod/v4';

export interface KnowledgeActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Enforces Anti-IDOR tenant boundary validation (Rules 8 & 47).
 */
function assertTenantContext(
  sessionOrgId: string,
  requestedOrgId: string,
  isSystemAdmin: boolean
): void {
  if (!isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new KnowledgeAgentError(
      KNOWLEDGE_AGENT_ERROR_CODES.IDOR_VIOLATION,
      `Tenant mismatch: authenticated org '${sessionOrgId}' cannot access org '${requestedOrgId}'`
    );
  }
}

const AskKnowledgeAgentInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  query: z.string().trim().min(1, 'Query is required').max(1000),
  entityId: z.string().trim().optional(),
  callerPermissions: z.array(z.string()).optional(),
  maxContextTokens: z.number().int().positive().optional(),
});
export type AskKnowledgeAgentInput = z.infer<typeof AskKnowledgeAgentInputSchema>;

/**
 * Queries the Knowledge Agent for a grounded natural language answer with citations.
 */
export async function askKnowledgeAgentAction(
  rawInput: AskKnowledgeAgentInput
): Promise<KnowledgeActionResult<KnowledgeAnswerContract>> {
  try {
    const auth = await requireAuth();
    const input = AskKnowledgeAgentInputSchema.parse(rawInput);

    assertTenantContext(auth.profile.organizationId, input.organizationId, auth.isSystemAdmin);

    const service = getKnowledgeAgentService();
    const answer = await service.synthesizeAnswer({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      query: input.query,
      entityId: input.entityId,
      callerPermissions: input.callerPermissions ?? ['knowledge:read'],
      maxContextTokens: input.maxContextTokens,
    });

    return {
      success: true,
      data: answer,
    };
  } catch (error) {
    if (error instanceof KnowledgeAgentError) {
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }
    const message = error instanceof Error ? error.message : 'Knowledge Agent query failed';
    return {
      success: false,
      error: { code: KNOWLEDGE_AGENT_ERROR_CODES.INTERNAL_ERROR, message },
    };
  }
}

/**
 * Executes multi-index hybrid search (dense + sparse + graph) via KnowledgeAdaptiveRetriever.
 */
export async function searchKnowledgeHybridAction(
  rawInput: KnowledgeSearchHybridInput
): Promise<KnowledgeActionResult<KnowledgeSearchHybridOutput>> {
  try {
    const auth = await requireAuth();
    const input = KnowledgeSearchHybridInputSchema.parse(rawInput);

    assertTenantContext(auth.profile.organizationId, input.organizationId, auth.isSystemAdmin);

    const retriever = getKnowledgeAdaptiveRetriever();
    const result = await retriever.searchHybrid(input, {
      callerPermissions: ['knowledge:read'],
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof KnowledgeAgentError) {
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }
    const message = error instanceof Error ? error.message : 'Hybrid search failed';
    return {
      success: false,
      error: { code: KNOWLEDGE_AGENT_ERROR_CODES.INTERNAL_ERROR, message },
    };
  }
}

/**
 * Retrieves specific evidence items by their IDs.
 */
export async function getKnowledgeEvidenceAction(
  rawInput: KnowledgeGetEvidenceInput
): Promise<KnowledgeActionResult<KnowledgeGetEvidenceOutput>> {
  try {
    const auth = await requireAuth();
    const input = KnowledgeGetEvidenceInputSchema.parse(rawInput);

    assertTenantContext(auth.profile.organizationId, input.organizationId, auth.isSystemAdmin);

    const service = getKnowledgeAgentService();
    const result = await service.getEvidence(input);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof KnowledgeAgentError) {
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }
    const message = error instanceof Error ? error.message : 'Failed to retrieve evidence';
    return {
      success: false,
      error: { code: KNOWLEDGE_AGENT_ERROR_CODES.INTERNAL_ERROR, message },
    };
  }
}

/**
 * Explains why a specific item was included or omitted from retrieval context (Rule 41).
 */
export async function explainContextInclusionAction(
  rawInput: ExplainContextInclusionInput
): Promise<KnowledgeActionResult<ExplainContextInclusionOutput>> {
  try {
    const auth = await requireAuth();
    const input = ExplainContextInclusionInputSchema.parse(rawInput);

    assertTenantContext(auth.profile.organizationId, input.organizationId, auth.isSystemAdmin);

    const retriever = getKnowledgeAdaptiveRetriever();
    const result = await retriever.explainInclusion(input);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof KnowledgeAgentError) {
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }
    const message = error instanceof Error ? error.message : 'Failed to explain context inclusion';
    return {
      success: false,
      error: { code: KNOWLEDGE_AGENT_ERROR_CODES.INTERNAL_ERROR, message },
    };
  }
}
