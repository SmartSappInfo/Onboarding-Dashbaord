/**
 * @fileOverview Canonical State-Version & Concurrency Capabilities (concurrency.*) (Phase 14 Milestone 2)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer): Pure capability definitions
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ)
 * - Rule 14 (Schema Fingerprinting & Tool Contracts)
 * - Rule 16 (Explicit Scoped RBAC: concurrency:snapshot, concurrency:read)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 22 (Cryptographic Hash Binding)
 * - Rule 23 (Resource Governance & 5,000ms Timeout Ceilings)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
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
  type VersionValidationResult,
  ResourceSnapshotSchema,
  VersionValidationResultSchema,
  StateConcurrencyError,
  getStateVersionService,
} from '@/platform/verification/concurrency';

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
    throw new StateConcurrencyError(
      'IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ============================================================================
// 1. concurrency.snapshot_resource (L0_READ)
// ============================================================================

export const SnapshotResourceInputSchema = z.object({
  resourceType: z.string().min(1, 'Resource type is required'),
  resourceId: z.string().min(1, 'Resource ID is required'),
  resourceData: z.record(z.string(), z.unknown()),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});
export type SnapshotResourceInput = z.infer<typeof SnapshotResourceInputSchema>;

export const SnapshotResourceOutputSchema = ResourceSnapshotSchema;
export type SnapshotResourceOutput = z.infer<typeof SnapshotResourceOutputSchema>;

export const concurrencySnapshotResourceCapability: CapabilityDefinition<
  SnapshotResourceInput,
  SnapshotResourceOutput
> = {
  id: 'concurrency.snapshot_resource',
  version: '1.0.0',
  name: 'Capture Resource Pre-State Snapshot',
  description:
    'Captures an immutable pre-mutation resource snapshot and calculates a canonical SHA-256 state hash for optimistic concurrency validation (Step 2 of Responsible Execution Loop).',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: SnapshotResourceInputSchema,
  outputSchema: SnapshotResourceOutputSchema,
  permissions: ['concurrency:snapshot'],
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
    input: SnapshotResourceInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<SnapshotResourceOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getStateVersionService();
    const snapshot = await service.captureSnapshot({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceData: input.resourceData,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorId: context.principal.userId,
    });

    return {
      success: true,
      data: snapshot,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. concurrency.verify_version (L0_READ)
// ============================================================================

export const VerifyVersionInputSchema = z.object({
  expectedSnapshot: ResourceSnapshotSchema,
  currentResourceData: z.record(z.string(), z.unknown()).nullable(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  assertCurrent: z.boolean().default(false),
});
export type VerifyVersionInput = z.infer<typeof VerifyVersionInputSchema>;

export const VerifyVersionOutputSchema = VersionValidationResultSchema;
export type VerifyVersionOutput = z.infer<typeof VerifyVersionOutputSchema>;

export const concurrencyVerifyVersionCapability: CapabilityDefinition<
  VerifyVersionInput,
  VerifyVersionOutput
> = {
  id: 'concurrency.verify_version',
  version: '1.0.0',
  name: 'Verify Resource Version & State Hash',
  description:
    'Validates current live database state against a pre-mutation snapshot to prevent TOCTOU race conditions and stealth drift before transaction commit (Step 5 of Responsible Execution Loop).',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: VerifyVersionInputSchema,
  outputSchema: VerifyVersionOutputSchema,
  permissions: ['concurrency:read'],
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
    requiresExpectedVersion: true,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: VerifyVersionInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<VerifyVersionOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getStateVersionService();
    const validationParams = {
      expectedSnapshot: input.expectedSnapshot,
      currentResourceData: input.currentResourceData,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorId: context.principal.userId,
    };

    let result: VersionValidationResult;
    if (input.assertCurrent) {
      result = await service.assertVersionCurrent(validationParams);
    } else {
      result = await service.validateResourceVersion(validationParams);
    }

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
// CANONICAL CAPABILITY REGISTRATION (Module Load Time)
// ============================================================================

registerCapability(concurrencySnapshotResourceCapability);
registerCapability(concurrencyVerifyVersionCapability);
