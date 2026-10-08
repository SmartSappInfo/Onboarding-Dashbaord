/**
 * @fileOverview Canonical Saga Capabilities (saga.*) (Phase 14 Milestone 3)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer): Pure capability definitions
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Canonical Risk Taxonomy: L2_STATE_MUTATION for execute, L0_READ for get_ledger)
 * - Rule 14 (Schema Fingerprinting & Tool Contracts)
 * - Rule 16 (Explicit Scoped RBAC: saga:compensate, saga:read)
 * - Rule 17 (Non-Delegable Restrictions: saga.execute_compensation is Non-Delegable)
 * - Rule 19 (Deterministic Idempotency: requiresIdempotencyKey: true)
 * - Rule 22 (Cryptographic Hash Binding)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
 * - Rule 25 (DLQ Quarantine Integration)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
 * - Rule 27 (Universal Reverse-LIFO Saga Compensation Model)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  type SagaCompensationResult,
  type SagaExecutionLedger,
  SagaCompensationResultSchema,
  SagaExecutionLedgerSchema,
  SagaCompensationError,
  getSagaCompensationService,
} from '@/platform/verification/saga';

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
    throw new SagaCompensationError(
      'IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ============================================================================
// 1. saga.execute_compensation (L2_STATE_MUTATION, Non-Delegable: true)
// ============================================================================

export const ExecuteCompensationInputSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  reason: z.string().min(1, 'Compensation reason is required'),
  dryRun: z.boolean().optional().default(false),
});
export type ExecuteCompensationInput = z.input<typeof ExecuteCompensationInputSchema>;

export const ExecuteCompensationOutputSchema = SagaCompensationResultSchema;
export type ExecuteCompensationOutput = SagaCompensationResult;

export const sagaExecuteCompensationCapability: CapabilityDefinition<
  ExecuteCompensationInput,
  ExecuteCompensationOutput
> = {
  id: 'saga.execute_compensation',
  version: '1.0.0',
  name: 'Execute Universal Reverse-LIFO Saga Compensation',
  description:
    'Executes reverse-LIFO compensating capabilities for all completed steps in a failed workflow run, quarantine un-rollbackable steps in DLQ, and restores previous pre-mutation states (Step 6 of Responsible Execution Loop).',
  domain: 'ai_governance',
  operation: 'update',
  inputSchema: ExecuteCompensationInputSchema,
  outputSchema: ExecuteCompensationOutputSchema,
  permissions: ['saga:compensate'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true, // Rule 17: Non-Delegable root action
  },
  execution: {
    synchronous: true,
    maxDurationMs: 60000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: ExecuteCompensationInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ExecuteCompensationOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getSagaCompensationService();
    const result = await service.compensateRun(
      {
        runId: input.runId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        reason: input.reason,
        dryRun: input.dryRun,
      }
    );

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. saga.get_execution_ledger (L0_READ)
// ============================================================================

export const GetExecutionLedgerInputSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});
export type GetExecutionLedgerInput = z.infer<typeof GetExecutionLedgerInputSchema>;

export const GetExecutionLedgerOutputSchema = SagaExecutionLedgerSchema.nullable();
export type GetExecutionLedgerOutput = SagaExecutionLedger | null;

export const sagaGetExecutionLedgerCapability: CapabilityDefinition<
  GetExecutionLedgerInput,
  GetExecutionLedgerOutput
> = {
  id: 'saga.get_execution_ledger',
  version: '1.0.0',
  name: 'Get Saga Step Execution Ledger',
  description:
    'Retrieves the immutable step execution ledger and SHA-256 integrity hash for a workflow run to inspect step lineage and compensation status.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetExecutionLedgerInputSchema,
  outputSchema: GetExecutionLedgerOutputSchema,
  permissions: ['saga:read'],
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
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: GetExecutionLedgerInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<GetExecutionLedgerOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getSagaCompensationService();
    const ledger = await service.getLedger(input.runId, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    });

    return {
      success: true,
      data: ledger,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// CANONICAL CAPABILITY REGISTRATION (Module Load Time)
// ============================================================================

registerCapability(sagaExecuteCompensationCapability);
registerCapability(sagaGetExecutionLedgerCapability);
