/**
 * @fileOverview Canonical Security, Adversarial Red-Team & Chaos Contracts (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 4, 8, 12, 13, 14, 16, 17, 18, 19, 22, 24, 25, 26, 27, 30, 40, 45, 46, 47, 48, 51, 60, 67, 68, 69,
 * and Rules 1940-1953 (The 4 Mandatory Governance Matrices).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { CAPABILITY_RISK_LEVELS, CapabilityRiskLevel } from '@/platform/cost/contracts/cost-types';

// ============================================================================
// 1. 10-Vector Adversarial Ingress Taxonomy (Rule 46 & §2.3)
// ============================================================================

export const ADVERSARIAL_INGRESS_VECTORS = [
  'EMAIL_BODY',
  'WEBSITE_DOM',
  'PDF_DOCUMENT',
  'CRM_NOTE',
  'MEETING_TRANSCRIPT',
  'FORM_FIELD',
  'CUSTOMER_CHAT',
  'MCP_METADATA',
  'TOOL_OUTPUT',
  'KNOWLEDGE_POISONING',
] as const;

export type AdversarialIngressVector = (typeof ADVERSARIAL_INGRESS_VECTORS)[number];
export const AdversarialIngressVectorSchema = z.enum(ADVERSARIAL_INGRESS_VECTORS);

export const NEUTRALIZATION_STRATEGIES = [
  'CLEAN',
  'STRIP_DIRECTIVE',
  'XML_ISOLATION',
  'BLOCK_EXECUTION',
  'MASK_SECRET',
  'BLOCKED',
] as const;
export type NeutralizationStrategy = (typeof NEUTRALIZATION_STRATEGIES)[number];
export const NeutralizationStrategySchema = z.enum(NEUTRALIZATION_STRATEGIES);

export const AdversarialAttackPayloadSchema = z.object({
  id: z.string().min(1),
  vector: AdversarialIngressVectorSchema,
  rawPayload: z.string().min(1),
  targetDomain: z.string().min(1),
  expectedNeutralization: NeutralizationStrategySchema,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
export type AdversarialAttackPayload = z.infer<typeof AdversarialAttackPayloadSchema>;

export const AdversarialScanResultSchema = z.object({
  isInjectionDetected: z.boolean(),
  detectedPatterns: z.array(z.string()),
  riskScore: z.number().min(0).max(100),
  sanitizedText: z.string(),
  neutralizationStrategy: NeutralizationStrategySchema,
  scannedAt: z.string().datetime(),
});
export type AdversarialScanResult = z.infer<typeof AdversarialScanResultSchema>;

// ============================================================================
// 2. Chaos Fault Injection Taxonomy (Rules 45, 1972)
// ============================================================================

export const CHAOS_FAULT_TYPES = [
  'HTTP_429_RATE_LIMIT',
  'HTTP_500_PROVIDER_TIMEOUT',
  'NETWORK_LATENCY_JITTER',
  'CONCURRENT_STATE_COLLISION',
  'PARTIAL_EXECUTION_FAILURE',
] as const;

export type ChaosFaultType = (typeof CHAOS_FAULT_TYPES)[number];
export const ChaosFaultTypeSchema = z.enum(CHAOS_FAULT_TYPES);

export const ChaosFaultRuleSchema = z.object({
  id: z.string().min(1),
  targetCapabilityId: z.string().min(1),
  targetPersonaId: z.string().optional(),
  faultType: ChaosFaultTypeSchema,
  probabilityPercent: z.number().int().min(1).max(100).default(100),
  durationMs: z.number().int().nonnegative().default(0),
  delayMs: z.number().int().nonnegative().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  createdByUserId: z.string().min(1).default('system'),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ChaosFaultRule = z.infer<typeof ChaosFaultRuleSchema>;

export const ChaosExecutionOutcomeSchema = z.object({
  faultInjected: z.boolean(),
  faultType: ChaosFaultTypeSchema.optional(),
  recovered: z.boolean().default(true),
  recoveryStrategy: z.string().default('NONE'),
  simulatedLatencyMs: z.number().int().nonnegative().default(0),
  latencyMs: z.number().int().nonnegative().optional(),
  circuitBreakerTripped: z.boolean().default(false),
  sagaCompensated: z.boolean().default(false),
  dlqRouted: z.boolean().default(false),
  quarantinedToDlq: z.boolean().default(false),
  executionId: z.string().min(1).default('sim_execution'),
  resolvedRecoveryStrategy: z.string().optional(),
  errorDetails: z.string().optional(),
  executedAt: z.string().datetime().optional(),
});
export type ChaosExecutionOutcome = z.infer<typeof ChaosExecutionOutcomeSchema>;

// ============================================================================
// 3. Cryptographic Tool Fingerprinting (Rule 14 & 1974)
// ============================================================================

export const TOOL_FINGERPRINT_STATUSES = ['APPROVED', 'DRIFTED', 'LOCKED', 'REVOKED'] as const;
export type ToolFingerprintStatus = (typeof TOOL_FINGERPRINT_STATUSES)[number];
export const ToolFingerprintStatusSchema = z.enum(TOOL_FINGERPRINT_STATUSES);

export const ToolFingerprintRecordSchema = z.object({
  toolId: z.string().min(1),
  serverId: z.string().min(1),
  serverVersion: z.string().min(1),
  toolVersion: z.string().min(1),
  schemaHash: z.string().length(64),
  descriptionHash: z.string().length(64),
  permissionHash: z.string().length(64),
  riskHash: z.string().length(64),
  compositeFingerprint: z.string().length(64),
  status: ToolFingerprintStatusSchema,
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1).default('system'),
  approvedByUserId: z.string().min(1).optional(),
  organizationId: z.string().min(1).default('default_org'),
  workspaceId: z.string().optional(),
});
export type ToolFingerprintRecord = z.infer<typeof ToolFingerprintRecordSchema>;

// ============================================================================
// 4. Error Taxonomy & Typed Domain Error (Rule 48)
// ============================================================================

export const SECURITY_ERROR_CODES = {
  SECURITY_PROMPT_INJECTION_DETECTED: 'SECURITY_PROMPT_INJECTION_DETECTED',
  SECURITY_TOOL_DRIFT_DETECTED: 'SECURITY_TOOL_DRIFT_DETECTED',
  SECURITY_TOOL_LOCKED: 'SECURITY_TOOL_LOCKED',
  CHAOS_FAULT_INJECTED: 'CHAOS_FAULT_INJECTED',
  CHAOS_TIMEOUT: 'CHAOS_TIMEOUT',
  CONCURRENCY_VIOLATION: 'CONCURRENCY_VIOLATION',
  SECURITY_IDOR_VIOLATION: 'SECURITY_IDOR_VIOLATION',
  SECURITY_UNAUTHORIZED_APPROVAL: 'SECURITY_UNAUTHORIZED_APPROVAL',
  SECURITY_DEAD_MAN_PAUSED: 'SECURITY_DEAD_MAN_PAUSED',
  SECURITY_INVALID_PAYLOAD: 'SECURITY_INVALID_PAYLOAD',
} as const;

export type SecurityErrorCode = (typeof SECURITY_ERROR_CODES)[keyof typeof SECURITY_ERROR_CODES];

export class SecurityDomainError extends Error {
  public readonly code: SecurityErrorCode;
  public readonly httpStatus: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: SecurityErrorCode,
    message: string,
    httpStatus: number = 400,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityDomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
    Object.setPrototypeOf(this, SecurityDomainError.prototype);
  }
}

// ============================================================================
// 5. The 4 Mandatory Governance Matrices (Rules 1940-1953)
// ============================================================================

/**
 * 1. SECURITY_CHAOS_PERMISSION_MATRIX:
 * Strictly defines RBAC permission scopes for all personas (Rules 8, 16, 17).
 */
export const SECURITY_CHAOS_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  crm_agent: ['security:read'],
  sales_agent: ['security:read'],
  meeting_intelligence_agent: ['security:read'],
  knowledge_agent: ['security:read'],
  billing_analyst: ['security:read'],
  collections_agent: ['security:read'],
  reconciliation_agent: ['security:read'],
  revenue_analyst: ['security:read'],
  invoice_assistant: ['security:read'],
  finance_reporter: ['security:read'],
  school_ops_agent: ['security:read'],
  attendance_analyst: ['security:read'],
  fee_collection_agent: ['security:read'],
  supervisor: ['security:read'],
  qa_agent: ['security:read', 'chaos:inject'],
  admin_user: ['security:read', 'security:manage', 'chaos:inject'],
};

export function validateSecurityPersonaPermission(
  personaId: string,
  permission: string
): boolean {
  const allowed = SECURITY_CHAOS_PERMISSION_MATRIX[personaId];
  if (!allowed) return false;
  return allowed.includes(permission);
}

/**
 * 2. SECURITY_CHAOS_TOOL_MATRIX:
 * Capabilities with risk tiers, idempotency, audit flags, and non-delegable security (Rules 12, 14, 17).
 */
export interface SecurityToolDescriptor {
  readonly capabilityId: string;
  readonly riskLevel: CapabilityRiskLevel;
  readonly requiresIdempotencyKey: boolean;
  readonly auditRequired: boolean;
  readonly nonDelegable?: boolean;
}

export const SECURITY_CHAOS_TOOL_MATRIX: Readonly<Record<string, SecurityToolDescriptor>> = {
  'security.scan_text': {
    capabilityId: 'security.scan_text',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'security.run_adversarial_suite': {
    capabilityId: 'security.run_adversarial_suite',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: true,
  },
  'chaos.inject_fault': {
    capabilityId: 'chaos.inject_fault',
    riskLevel: 'L2_STATE_MUTATION',
    requiresIdempotencyKey: true,
    auditRequired: true,
  },
  'security.verify_tool_drift': {
    capabilityId: 'security.verify_tool_drift',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'security.approve_tool_fingerprint': {
    capabilityId: 'security.approve_tool_fingerprint',
    riskLevel: 'L2_STATE_MUTATION',
    requiresIdempotencyKey: true,
    auditRequired: true,
    nonDelegable: true,
  },
};

/**
 * 3. SECURITY_CHAOS_FAILURE_MATRIX:
 * Failure recovery strategies for structured error codes (Rules 2, 24, 48).
 */
export const SECURITY_FAILURE_RECOVERY_STRATEGIES = [
  'NEUTRALIZE_AND_ISOLATE',
  'LOCK_TOOL_AND_ALERT',
  'TRIGGER_REVERSE_LIFO_SAGA',
  'FAIL_CLOSED',
  'RETRY_WITH_BACKOFF',
] as const;
export type SecurityFailureStrategy = (typeof SECURITY_FAILURE_RECOVERY_STRATEGIES)[number];

export const SECURITY_CHAOS_FAILURE_MATRIX: Readonly<Record<SecurityErrorCode, SecurityFailureStrategy>> = {
  SECURITY_PROMPT_INJECTION_DETECTED: 'NEUTRALIZE_AND_ISOLATE',
  SECURITY_TOOL_DRIFT_DETECTED: 'LOCK_TOOL_AND_ALERT',
  SECURITY_TOOL_LOCKED: 'FAIL_CLOSED',
  CHAOS_FAULT_INJECTED: 'TRIGGER_REVERSE_LIFO_SAGA',
  CHAOS_TIMEOUT: 'FAIL_CLOSED',
  CONCURRENCY_VIOLATION: 'FAIL_CLOSED',
  SECURITY_IDOR_VIOLATION: 'FAIL_CLOSED',
  SECURITY_UNAUTHORIZED_APPROVAL: 'FAIL_CLOSED',
  SECURITY_DEAD_MAN_PAUSED: 'FAIL_CLOSED',
  SECURITY_INVALID_PAYLOAD: 'FAIL_CLOSED',
};

export function resolveSecurityFailureStrategy(
  code: SecurityErrorCode | string
): SecurityFailureStrategy {
  if (code in SECURITY_CHAOS_FAILURE_MATRIX) {
    return SECURITY_CHAOS_FAILURE_MATRIX[code as SecurityErrorCode];
  }
  return 'FAIL_CLOSED';
}

/**
 * 4. SECURITY_CHAOS_ROLLBACK_MATRIX:
 * Saga rollback compensation mapping for mutating security & chaos capabilities (Rule 27).
 */
export const SECURITY_CHAOS_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'security.approve_tool_fingerprint': 'security.revoke_tool_fingerprint',
  'chaos.inject_fault': 'chaos.clear_fault',
  'security.scan_text': null,
  'security.run_adversarial_suite': null,
  'security.verify_tool_drift': null,
};

export function getSecurityRollbackCapability(capabilityId: string): string | null {
  return SECURITY_CHAOS_ROLLBACK_MATRIX[capabilityId] ?? null;
}
