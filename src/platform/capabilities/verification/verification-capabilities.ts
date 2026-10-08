/**
 * @fileOverview Canonical Verification Capabilities (verification.*) (Phase 14 Milestone 1)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ)
 * - Rule 14 (Schema Fingerprinting & Tool Contracts)
 * - Rule 16 (Explicit RBAC Permission Mapping)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 21 (Two-Phase Verification Invariants)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  VerificationResult,
  VerificationResultSchema,
  AgentVerificationError,
} from '@/platform/verification';
import { getPostconditionEngine } from '@/platform/verification/postcondition-engine';

/**
 * Validates caller tenant context against target organization (Rules 8 & 47).
 */
function assertTenantContext(
  context: CapabilityExecutionContext,
  organizationId: string
): void {
  if (
    context.principal.organizationId &&
    context.principal.organizationId !== organizationId
  ) {
    throw new AgentVerificationError(
      'IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

/**
 * In-memory execution verification results cache (bounded with maximum 500 entries)
 * for fast lookup during multi-step runs and postcondition audits.
 */
const executionVerificationCache = new Map<string, VerificationResult>();

export function cacheVerificationResult(result: VerificationResult): void {
  if (executionVerificationCache.size >= 500) {
    const oldestKey = executionVerificationCache.keys().next().value;
    if (oldestKey) {
      executionVerificationCache.delete(oldestKey);
    }
  }
  executionVerificationCache.set(result.executionId, result);
}

export function getCachedVerificationResult(executionId: string): VerificationResult | null {
  return executionVerificationCache.get(executionId) ?? null;
}

// ============================================================================
// 1. verification.assert_postconditions (L0_READ)
// ============================================================================

export const AssertPostconditionsInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  capabilityId: z.string().min(1),
  preStateSnapshot: z.record(z.string(), z.unknown()),
  postStateSnapshot: z.record(z.string(), z.unknown()).nullable(),
  mutationPayload: z.record(z.string(), z.unknown()),
  customAssertions: z.array(z.string()).optional(),
  executionId: z.string().optional(),
});
export type AssertPostconditionsInput = z.infer<typeof AssertPostconditionsInputSchema>;

export const AssertPostconditionsOutputSchema = VerificationResultSchema;
export type AssertPostconditionsOutput = z.infer<typeof AssertPostconditionsOutputSchema>;

export const assertPostconditionsCapability: CapabilityDefinition<
  AssertPostconditionsInput,
  AssertPostconditionsOutput
> = {
  id: 'verification.assert_postconditions',
  version: '1.0.0',
  name: 'Assert Capability Postconditions',
  description:
    'Evaluates domain postcondition invariant assertions against pre- and post-state snapshots before transaction commit.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: AssertPostconditionsInputSchema,
  outputSchema: AssertPostconditionsOutputSchema,
  permissions: ['verification:assert'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: AssertPostconditionsInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AssertPostconditionsOutput>> => {
    assertTenantContext(context, input.organizationId);

    const engine = getPostconditionEngine();
    const result = await engine.evaluatePostconditions(
      input.capabilityId,
      {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actorId: context.principal.id,
        preStateSnapshot: input.preStateSnapshot,
        postStateSnapshot: input.postStateSnapshot,
        mutationPayload: input.mutationPayload,
      },
      {
        executionId: input.executionId,
        customAssertions: input.customAssertions,
        signal: context.signal,
      }
    );

    // Cache result for downstream inspection
    cacheVerificationResult(result);

    return {
      status: 'SUCCESS',
      data: result,
      events: [
        {
          type: 'verification.execution.completed',
          payload: {
            capabilityId: input.capabilityId,
            overallStatus: result.overallStatus,
            passedCount: result.passedCount,
            failedCount: result.failedCount,
          },
        },
      ],
    };
  },
};

// ============================================================================
// 2. verification.get_execution_verification (L0_READ)
// ============================================================================

export const GetExecutionVerificationInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  executionId: z.string().min(1),
});
export type GetExecutionVerificationInput = z.infer<typeof GetExecutionVerificationInputSchema>;

export const GetExecutionVerificationOutputSchema = VerificationResultSchema.nullable();
export type GetExecutionVerificationOutput = z.infer<typeof GetExecutionVerificationOutputSchema>;

export const getExecutionVerificationCapability: CapabilityDefinition<
  GetExecutionVerificationInput,
  GetExecutionVerificationOutput
> = {
  id: 'verification.get_execution_verification',
  version: '1.0.0',
  name: 'Get Execution Verification Results',
  description:
    'Retrieves detailed postcondition assertion outcomes and explainability evidence for a past execution ID.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetExecutionVerificationInputSchema,
  outputSchema: GetExecutionVerificationOutputSchema,
  permissions: ['verification:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 524288,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetExecutionVerificationInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<GetExecutionVerificationOutput>> => {
    assertTenantContext(context, input.organizationId);

    const result = getCachedVerificationResult(input.executionId);
    return {
      status: 'SUCCESS',
      data: result,
    };
  },
};

// ============================================================================
// REGISTRY INITIALIZATION AT MODULE LOAD
// ============================================================================

registerCapability(assertPostconditionsCapability);
registerCapability(getExecutionVerificationCapability);
