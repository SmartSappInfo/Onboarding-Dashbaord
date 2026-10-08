/**
 * @fileOverview Canonical Delegation Contracts & Schemas (Phase 13 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Zero any/any[] typing standard)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 9 & 23 (Resource Ceilings: Depth <= 3, Duration <= 120s)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Mathematical determinism in Authority Intersection Algebra)
 * - Rule 12 (Canonical Risk Taxonomy)
 * - Rule 16 (Agent Identity as First-Class Security Principal & Authority Intersection)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (Live TOCTOU Checking)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Cryptographic Token Signature)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Rollback Mapping)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 42 (Shadow Mode Simulation)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Operational Control & Audit Justification >= 5 chars)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';

// ============================================================================
// Resource Ceilings & Bounds (Rules 9, 23, 28, 56)
// ============================================================================

export const MAX_DELEGATION_DEPTH = 3;
export const DEFAULT_DELEGATION_TTL_SECONDS = 3600; // 1 hour default
export const MAX_DELEGATION_TTL_SECONDS = 86400;     // 24 hours hard cap (Rule 23)
export const MIN_DELEGATION_TTL_SECONDS = 60;        // 1 minute floor
export const MAX_SUBAGENT_TOKEN_BUDGET = 4000;       // 4,000 tokens ceiling (Rules 28 & 56)
export const MAX_SUBAGENT_DURATION_MS = 120000;      // 120 seconds ceiling (Rule 9)
export const MIN_REVOCATION_REASON_LENGTH = 5;       // Rule 61 audit trail

// ============================================================================
// Non-Delegable Patterns (Rule 17)
// ============================================================================

export const NON_DELEGABLE_CAPABILITY_PATTERNS = [
  'auth.*',
  'tenant.*',
  'security.*',
  'billing.transfer_ownership',
  'platform_config.*',
  'rbac:admin.*',
] as const;

// ============================================================================
// Statuses and Error Taxonomy (Rule 48)
// ============================================================================

export const DELEGATION_GRANT_STATUSES = ['active', 'revoked', 'expired'] as const;
export type DelegationGrantStatus = (typeof DELEGATION_GRANT_STATUSES)[number];

export const DELEGATION_ERROR_CODES = [
  'DELEGATION_NOT_FOUND',
  'DELEGATION_REVOKED',
  'DELEGATION_EXPIRED',
  'TENANT_MISMATCH',
  'MAX_DEPTH_EXCEEDED',
  'EMPTY_DELEGATED_SCOPES',
  'WILDCARD_SCOPE_FORBIDDEN',
  'NON_DELEGABLE_ACTION_FORBIDDEN',
  'SIGNATURE_TAMPERED',
  'PARENT_DELEGATION_INVALID',
  'PARENT_SCOPE_ESCALATION',
  'DELEGATION_DEAD_MAN_PAUSED',
  'INTERNAL_ERROR',
  'INVALID_INPUT',
  'UNAUTHORIZED',
] as const;
export type DelegationErrorCode = (typeof DELEGATION_ERROR_CODES)[number];

export class AgentDelegationError extends Error {
  constructor(
    public readonly code: DelegationErrorCode,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(`[${code}] ${message}`);
    this.name = 'AgentDelegationError';
  }
}

// ============================================================================
// Schemas: Scopes & Identity (Rule 10 & 16)
// ============================================================================

/**
 * Validates that an array of permission scopes does not contain wildcards (Rule 16).
 */
export const SafeScopesSchema = z
  .array(z.string().min(1))
  .refine(
    (scopes) => !scopes.some((scope) => scope === '*' || scope.endsWith(':*') || scope.endsWith('.*')),
    { message: "Wildcard permissions ('*' or '*.') are strictly forbidden for delegated agents (Rule 16)." }
  );

/**
 * Canonical payload of a delegation token before signing.
 */
export const DelegationTokenPayloadSchema = z.object({
  tokenId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  supervisorAgentId: z.string().min(1),
  subAgentId: z.string().min(1),
  parentRunId: z.string().optional(),
  parentDelegationId: z.string().optional(),
  delegationChain: z.array(z.string().min(1)).min(1),
  depth: z.number().int().min(1).max(MAX_DELEGATION_DEPTH),
  allowedScopes: SafeScopesSchema,
  allowedCapabilities: z.array(z.string().min(1)).optional(),
  tokenBudget: z.number().int().min(1).max(MAX_SUBAGENT_TOKEN_BUDGET).default(MAX_SUBAGENT_TOKEN_BUDGET),
  timeoutMs: z.number().int().min(1000).max(MAX_SUBAGENT_DURATION_MS).default(MAX_SUBAGENT_DURATION_MS),
  policyVersion: z.string().min(1).default('1.0.0'),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type DelegationTokenPayload = z.infer<typeof DelegationTokenPayloadSchema>;

/**
 * Full signed Delegation Token with cryptographic SHA-256 signature (Rule 22).
 */
export const DelegationTokenSchema = DelegationTokenPayloadSchema.extend({
  tokenSignature: z.string().min(1),
  status: z.enum(DELEGATION_GRANT_STATUSES).default('active'),
  revokedAt: z.string().datetime().optional(),
  revokedBy: z.string().min(1).optional(),
  revocationReason: z.string().min(MIN_REVOCATION_REASON_LENGTH).optional(),
});

export type DelegationToken = z.infer<typeof DelegationTokenSchema>;

/**
 * Execution context injected into subagent tool calls (Rule 16).
 */
export const DelegationContextSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  supervisorAgentId: z.string().min(1),
  subAgentId: z.string().min(1),
  delegationId: z.string().min(1),
  delegationDepth: z.number().int().min(1).max(MAX_DELEGATION_DEPTH),
  permittedScopes: SafeScopesSchema,
  permittedCapabilities: z.array(z.string().min(1)).optional(),
  tokenBudget: z.number().int().min(1).max(MAX_SUBAGENT_TOKEN_BUDGET),
  timeoutMs: z.number().int().min(1000).max(MAX_SUBAGENT_DURATION_MS),
  policyVersion: z.string().min(1),
});

export type DelegationContext = z.infer<typeof DelegationContextSchema>;

/**
 * Authority Intersection Result (Rule 16 & Rule 17).
 */
export const AuthorityIntersectionResultSchema = z.object({
  effectiveScopes: z.array(z.string()),
  effectiveCapabilities: z.array(z.string()),
  strippedNonDelegableCapabilities: z.array(z.string()),
  strippedNonDelegableScopes: z.array(z.string()),
  strippedWildcards: z.array(z.string()),
  userScopeCount: z.number().int().nonnegative(),
  supervisorScopeCount: z.number().int().nonnegative(),
  subAgentScopeCount: z.number().int().nonnegative(),
  workspaceScopeCount: z.number().int().nonnegative(),
  isElevated: z.literal(false),
});

export type AuthorityIntersectionResult = z.infer<typeof AuthorityIntersectionResultSchema>;

// ============================================================================
// Service Action Input Schemas
// ============================================================================

export const IssueDelegationTokenInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  supervisorAgentId: z.string().min(1).default('supervisor'),
  subAgentId: z.string().min(1),
  parentRunId: z.string().optional(),
  parentDelegationId: z.string().optional(),
  requestedScopes: z.array(z.string().min(1)),
  requestedCapabilities: z.array(z.string().min(1)).optional(),
  userPermissions: z.array(z.string().min(1)),
  workspaceScopes: z.array(z.string().min(1)).optional(),
  tokenBudget: z.number().int().min(1).max(MAX_SUBAGENT_TOKEN_BUDGET).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  dryRun: z.boolean().optional().default(false), // Rule 42
});

export type IssueDelegationTokenInput = z.input<typeof IssueDelegationTokenInputSchema>;
export type IssueDelegationTokenOutput = z.infer<typeof IssueDelegationTokenInputSchema>;

export const ValidateDelegationTokenInputSchema = z.object({
  token: DelegationTokenSchema,
  targetContext: z.object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
  }),
});

export type ValidateDelegationTokenInput = z.infer<typeof ValidateDelegationTokenInputSchema>;

export const RevokeDelegationTokenInputSchema = z.object({
  tokenId: z.string().min(1),
  revokerId: z.string().min(1).optional(),
  reason: z.string().min(MIN_REVOCATION_REASON_LENGTH),
});

export type RevokeDelegationTokenInput = z.infer<typeof RevokeDelegationTokenInputSchema>;

export type DelegationValidationResult =
  | { valid: true; token: DelegationToken }
  | { valid: false; code: DelegationErrorCode; reason: string };

// ============================================================================
// 7 Mandatory Deliverables Governance Matrices (Rules 1940-1953)
// ============================================================================

/**
 * 1. Delegation Permission Matrix (Rule 16)
 */
export const DELEGATION_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  supervisor: [
    'rbac:operations.tasks.create',
    'rbac:operations.pipeline.view',
    'rbac:operations.campuses.view',
    'workspace:read',
  ],
  admin_user: [
    'workspace:read',
    'workspace:write',
    'rbac:operations.*',
  ],
  standard_user: [
    'workspace:read',
    'crm:contacts:read',
  ],
};

/**
 * 2. Delegation Tool Matrix (Rules 12, 14, 17)
 */
export const DELEGATION_TOOL_MATRIX = {
  'supervisor.delegation.issue_token': {
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    nonDelegable: false,
  },
  'supervisor.delegation.validate_token': {
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    nonDelegable: false,
  },
  'supervisor.delegation.revoke_token': {
    riskLevel: 'L2_STATE_MUTATION',
    requiresIdempotencyKey: true,
    requiresExpectedVersion: true,
    auditRequired: true,
    nonDelegable: true,
  },
} as const;

/**
 * 3. Delegation Failure Matrix (Rule 2 & 48)
 */
export const DELEGATION_FAILURE_MATRIX: Readonly<
  Record<
    DelegationErrorCode,
    { httpStatus: number; retryable: boolean; action: 'FAIL_CLOSED' | 'RE_FETCH' | 'RETRY_BACKOFF' }
  >
> = {
  DELEGATION_NOT_FOUND: { httpStatus: 404, retryable: false, action: 'FAIL_CLOSED' },
  DELEGATION_REVOKED: { httpStatus: 403, retryable: false, action: 'FAIL_CLOSED' },
  DELEGATION_EXPIRED: { httpStatus: 401, retryable: false, action: 'FAIL_CLOSED' },
  TENANT_MISMATCH: { httpStatus: 403, retryable: false, action: 'FAIL_CLOSED' },
  MAX_DEPTH_EXCEEDED: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  EMPTY_DELEGATED_SCOPES: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  WILDCARD_SCOPE_FORBIDDEN: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  NON_DELEGABLE_ACTION_FORBIDDEN: { httpStatus: 403, retryable: false, action: 'FAIL_CLOSED' },
  SIGNATURE_TAMPERED: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  PARENT_DELEGATION_INVALID: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  PARENT_SCOPE_ESCALATION: { httpStatus: 403, retryable: false, action: 'FAIL_CLOSED' },
  DELEGATION_DEAD_MAN_PAUSED: { httpStatus: 503, retryable: true, action: 'RETRY_BACKOFF' },
  INTERNAL_ERROR: { httpStatus: 500, retryable: true, action: 'RETRY_BACKOFF' },
  INVALID_INPUT: { httpStatus: 400, retryable: false, action: 'FAIL_CLOSED' },
  UNAUTHORIZED: { httpStatus: 401, retryable: false, action: 'FAIL_CLOSED' },
};

/**
 * 4. Delegation Rollback Matrix (Rule 27)
 */
export const DELEGATION_ROLLBACK_MATRIX: Readonly<Record<string, string>> = {
  'supervisor.delegation.issue_token': 'supervisor.delegation.revoke_token',
};
