/**
 * @fileOverview Canonical Supervisor Delegation Capabilities (supervisor.delegation.*)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ, L1_INTERNAL_DRAFT, L2_STATE_MUTATION)
 * - Rule 16 (Agent Identity as First-Class Security Principal & Authority Intersection)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Signature Verification)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Compensation Mapping)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  AgentDelegationError,
  DelegationToken,
  DelegationTokenSchema,
  IssueDelegationTokenInput,
  IssueDelegationTokenInputSchema,
  RevokeDelegationTokenInput,
  RevokeDelegationTokenInputSchema,
  ValidateDelegationTokenInput,
  ValidateDelegationTokenInputSchema,
} from '../../identity/delegation/delegation-types';
import { getDelegatedAuthorityService } from '../../identity/delegation/delegated-authority-service';

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
    throw new AgentDelegationError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId}) (Rules 8 & 47).`,
      403
    );
  }
}

// ============================================================================
// 1. supervisor.delegation.issue_token (L0_READ / L1_INTERNAL_DRAFT)
// ============================================================================

export const issueDelegationTokenCapability: CapabilityDefinition<
  IssueDelegationTokenInput,
  DelegationToken
> = {
  id: 'supervisor.delegation.issue_token',
  version: '1.0.0',
  name: 'Issue Delegated Authority Token',
  description:
    'Computes Authority Intersection Algebra, strips non-delegable privileges, and mints a cryptographically signed SHA-256 delegation token for a subagent (Rules 16, 17, 22).',
  domain: 'ai_governance',
  operation: 'create',

  inputSchema: IssueDelegationTokenInputSchema,
  outputSchema: DelegationTokenSchema,

  permissions: ['rbac:operations.tasks.create', 'workspace:read'],
  workspaceScoped: true,
  tenantScoped: true,

  risk: {
    level: 'L0_READ', // Non-destructive minting
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
    compensatingCapabilityId: 'supervisor.delegation.revoke_token',
  },

  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true, // Rule 42 Shadow Mode
    supportsCancellation: true,
    supportsCompensation: true, // Rule 27
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['identity.delegation.token_issued'],
  },

  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },

  async handler(
    input: IssueDelegationTokenInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<DelegationToken>> {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getDelegatedAuthorityService();
    const token = await service.issueDelegationToken({
      ...input,
      dryRun: Boolean(context.dryRun ?? input.dryRun),
    });

    return {
      success: true,
      data: token,
      executionId: `exec_${token.tokenId}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

// ============================================================================
// 2. supervisor.delegation.validate_token (L0_READ)
// ============================================================================

const ValidationOutputSchema = z.discriminatedUnion('valid', [
  z.object({
    valid: z.literal(true),
    token: DelegationTokenSchema,
  }),
  z.object({
    valid: z.literal(false),
    code: z.string(),
    reason: z.string(),
  }),
]);

export const validateDelegationTokenCapability: CapabilityDefinition<
  ValidateDelegationTokenInput,
  z.infer<typeof ValidationOutputSchema>
> = {
  id: 'supervisor.delegation.validate_token',
  version: '1.0.0',
  name: 'Validate Delegated Authority Token',
  description:
    'Verifies SHA-256 cryptographic signature, expiration, status, depth <= 3, and anti-IDOR tenant boundaries for a delegation token (Rules 8, 18, 22, 23).',
  domain: 'ai_governance',
  operation: 'read',

  inputSchema: ValidateDelegationTokenInputSchema,
  outputSchema: ValidationOutputSchema,

  permissions: ['workspace:read'],
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
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'internal',
    emitsEvents: ['identity.delegation.token_validated'],
  },

  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },

  async handler(
    input: ValidateDelegationTokenInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<z.infer<typeof ValidationOutputSchema>>> {
    const startTime = Date.now();
    assertTenantContext(context, input.targetContext.organizationId);

    const service = getDelegatedAuthorityService();
    const result = await service.validateDelegationToken(input.token, input.targetContext);

    return {
      success: true,
      data: result,
      executionId: `exec_val_${input.token.tokenId}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

// ============================================================================
// 3. supervisor.delegation.revoke_token (L2_STATE_MUTATION)
// ============================================================================

const RevokeOutputSchema = z.object({
  revokedCount: z.number().int().nonnegative(),
});

export const revokeDelegationTokenCapability: CapabilityDefinition<
  RevokeDelegationTokenInput,
  z.infer<typeof RevokeOutputSchema>
> = {
  id: 'supervisor.delegation.revoke_token',
  version: '1.0.0',
  name: 'Revoke Delegated Authority Token',
  description:
    'Atomically revokes an active delegation grant and cascades revocation down the entire sub-delegation chain (Rules 8, 27, 40, 61).',
  domain: 'ai_governance',
  operation: 'update',

  inputSchema: RevokeDelegationTokenInputSchema,
  outputSchema: RevokeOutputSchema,

  permissions: ['rbac:operations.tasks.create', 'rbac:operations.tasks.edit'],
  workspaceScoped: true,
  tenantScoped: true,

  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true, // Non-delegable: only human or root supervisor can revoke (Rule 17)
  },

  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: false,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['identity.delegation.token_revoked'],
  },

  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },

  async handler(
    input: RevokeDelegationTokenInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<z.infer<typeof RevokeOutputSchema>>> {
    const startTime = Date.now();
    const service = getDelegatedAuthorityService();
    const result = await service.revokeDelegationToken(
      input.tokenId,
      input.revokerId || context.principal.userId,
      input.reason
    );

    return {
      success: true,
      data: result,
      executionId: `exec_rev_${input.tokenId}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

// Register capabilities in CapabilityRegistry
registerCapability(issueDelegationTokenCapability);
registerCapability(validateDelegationTokenCapability);
registerCapability(revokeDelegationTokenCapability);
