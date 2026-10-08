/**
 * @fileOverview Canonical Multi-Agent Swarm Mesh Contracts, Schemas & Error Taxonomy (Phase 13 Milestone 4)
 *
 * Implements Rules 4, 8, 9, 10, 12, 13, 16, 17, 18, 19, 21, 22, 24, 25, 26, 27, 28, 30, 32, 40, 48, 60, and 69.
 * Single Source of Truth for the Inter-Agent Swarm Mesh, Circuit Breakers, and Saga Journal.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS } from '../../../identity/agent-persona-types';
import { DelegationTokenSchema } from '../../../identity/delegation/delegation-types';

export type { AgentPersonaId } from '../../../identity/agent-persona-types';
export type { DelegationToken } from '../../../identity/delegation/delegation-types';


// ============================================================================
// 1. CONSTANTS & BOUNDS
// ============================================================================

export const MESH_MAX_CONCURRENCY = 4; // Rule 9 Concurrency Ceiling
export const MESH_MAX_CONTEXT_TOKENS = 4000; // Rules 28 & 56 Knapsack Ceiling
export const MESH_DEFAULT_TIMEOUT_MS = 30000; // Default 30s timeout
export const MESH_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3; // Rule 24: Trip after 3 consecutive failures
export const MESH_CIRCUIT_BREAKER_RESET_MS = 60000; // 60s cooldown for half-open reset

// ============================================================================
// 2. ERROR TAXONOMY (Rules 48 & 60)
// ============================================================================

export const AGENT_MESH_ERROR_CODES = [
  'IDOR_VIOLATION',
  'HANDOFF_TIMEOUT',
  'PEER_UNAVAILABLE',
  'CIRCUIT_BREAKER_OPEN',
  'DEAD_MAN_PAUSED',
  'DELEGATION_DEPTH_EXCEEDED',
  'SAGA_COMPENSATION_FAILED',
  'PAYLOAD_TAMPERED',
  'UNAUTHORIZED_HANDOFF',
  'CONTEXT_OVERFLOW',
  'EXECUTION_ABORTED',
  'RATE_LIMITED',
  'TENANT_MISMATCH',
  'INVALID_INPUT',
  'INTERNAL_ERROR',
] as const;

export type AgentMeshErrorCode = (typeof AGENT_MESH_ERROR_CODES)[number];

export const AGENT_MESH_HTTP_STATUS_MAP: Readonly<Record<AgentMeshErrorCode, number>> = {
  IDOR_VIOLATION: 403,
  HANDOFF_TIMEOUT: 504,
  PEER_UNAVAILABLE: 503,
  CIRCUIT_BREAKER_OPEN: 503,
  DEAD_MAN_PAUSED: 503,
  DELEGATION_DEPTH_EXCEEDED: 403,
  SAGA_COMPENSATION_FAILED: 500,
  PAYLOAD_TAMPERED: 400,
  UNAUTHORIZED_HANDOFF: 403,
  CONTEXT_OVERFLOW: 413,
  EXECUTION_ABORTED: 499,
  RATE_LIMITED: 429,
  TENANT_MISMATCH: 403,
  INVALID_INPUT: 400,
  INTERNAL_ERROR: 500,
};

export class AgentMeshError extends Error {
  public readonly code: AgentMeshErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: AgentMeshErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'AgentMeshError';
    this.code = code;
    this.httpStatus = AGENT_MESH_HTTP_STATUS_MAP[code] ?? 500;
    this.details = details;
    Object.setPrototypeOf(this, AgentMeshError.prototype);
  }
}

// ============================================================================
// 3. ENVELOPE & BUDGET CONTRACTS (Rules 10, 16, 22, 28)
// ============================================================================

export const MeshBudgetSchema = z.object({
  maxTokens: z.number().int().positive().max(MESH_MAX_CONTEXT_TOKENS, 'Token budget cannot exceed 4,000'),
  maxDurationMs: z.number().int().positive().max(120000, 'Max duration cannot exceed 120s'),
});
export type MeshBudget = z.infer<typeof MeshBudgetSchema>;

export const AgentHandoffEnvelopeSchema = z.object({
  handoffId: z.string().min(1, 'Handoff ID is required'),
  missionId: z.string().min(1, 'Mission ID is required'),
  parentStepId: z.string().min(1, 'Parent step ID is required'),
  targetStepId: z.string().min(1, 'Target step ID is required'),
  sourceAgentPersona: z.enum(AGENT_PERSONA_IDS),
  targetAgentPersona: z.enum(AGENT_PERSONA_IDS),
  organizationId: z.string().min(1, 'Organization ID is required (Anti-IDOR)'),
  workspaceId: z.string().min(1, 'Workspace ID is required (Anti-IDOR)'),
  delegationToken: DelegationTokenSchema.refine((tok) => tok.depth <= 3, {
    message: 'Delegation depth cannot exceed 3',
  }),
  context: z.record(z.string(), z.unknown()),
  requiredCapabilities: z.array(z.string()).default([]),
  budget: MeshBudgetSchema,
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  timestamp: z.string().datetime(),
  payloadHash: z.string().min(1, 'Cryptographic payload hash is required'),
});

export type AgentHandoffEnvelope = z.infer<typeof AgentHandoffEnvelopeSchema>;
export type AgentHandoffEnvelopeRaw = z.input<typeof AgentHandoffEnvelopeSchema>;

// ============================================================================
// 4. DELIVERY RECEIPT & STATUS ENUMS (Rules 19, 20)
// ============================================================================

export const MESH_DELIVERY_STATUSES = [
  'DELIVERED',
  'ACKNOWLEDGED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
] as const;
export const MeshDeliveryStatusSchema = z.enum(MESH_DELIVERY_STATUSES);
export type MeshDeliveryStatus = z.infer<typeof MeshDeliveryStatusSchema>;

export const MeshDeliveryReceiptSchema = z.object({
  receiptId: z.string().min(1),
  handoffId: z.string().min(1),
  deliveryStatus: MeshDeliveryStatusSchema,
  latencyMs: z.number().nonnegative(),
  acknowledgedAt: z.string().datetime(),
  peerSignature: z.string().min(1),
  error: z.string().optional(),
});
export type MeshDeliveryReceipt = z.infer<typeof MeshDeliveryReceiptSchema>;

// ============================================================================
// 5. PEER REGISTRY & CIRCUIT BREAKER (Rule 24)
// ============================================================================

export const MESH_PEER_STATUSES = ['ACTIVE', 'DRAINING', 'OFFLINE'] as const;
export const MeshPeerStatusSchema = z.enum(MESH_PEER_STATUSES);
export type MeshPeerStatus = z.infer<typeof MeshPeerStatusSchema>;

export const MESH_CIRCUIT_BREAKER_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export const MeshCircuitBreakerStateSchema = z.enum(MESH_CIRCUIT_BREAKER_STATES);
export type MeshCircuitBreakerState = z.infer<typeof MeshCircuitBreakerStateSchema>;

export const MeshPeerRegistryEntrySchema = z.object({
  personaId: z.enum(AGENT_PERSONA_IDS),
  status: MeshPeerStatusSchema,
  circuitBreakerState: MeshCircuitBreakerStateSchema,
  concurrencyLimit: z.number().int().min(1).max(MESH_MAX_CONCURRENCY, `Concurrency limit cannot exceed ${MESH_MAX_CONCURRENCY}`),
  activeHandoffsCount: z.number().int().nonnegative(),
  consecutiveFailures: z.number().int().nonnegative().default(0),
  lastFailureTimestamp: z.string().datetime().nullable().default(null),
  lastHeartbeat: z.string().datetime(),
});
export type MeshPeerRegistryEntry = z.infer<typeof MeshPeerRegistryEntrySchema>;

// ============================================================================
// 6. SAGA COMPENSATION & JOURNAL (Rule 27)
// ============================================================================

export const MESH_COMPENSATION_STATUSES = [
  'PENDING',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
] as const;
export const MeshCompensationStatusSchema = z.enum(MESH_COMPENSATION_STATUSES);
export type MeshCompensationStatus = z.infer<typeof MeshCompensationStatusSchema>;

export const MeshCompensationRecordSchema = z.object({
  compensationId: z.string().min(1),
  missionId: z.string().min(1),
  stepId: z.string().min(1),
  capabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  status: MeshCompensationStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  executedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
  payloadSnapshot: z.record(z.string(), z.unknown()).optional(),
});
export type MeshCompensationRecord = z.infer<typeof MeshCompensationRecordSchema>;

export const MeshCompensationPlanSchema = z.object({
  missionId: z.string().min(1),
  plannedAt: z.string().datetime(),
  totalStepsToCompensate: z.number().int().nonnegative(),
  records: z.array(MeshCompensationRecordSchema),
  overallStatus: z.enum(['SUCCESS', 'PARTIAL_FAILURE', 'FAILED']),
  reason: z.string().optional(),
});
export type MeshCompensationPlan = z.infer<typeof MeshCompensationPlanSchema>;

// ============================================================================
// 7. DEAD-LETTER & DLQ RECORD (Rule 25)
// ============================================================================

export const MeshDeadLetterRecordSchema = z.object({
  deadLetterId: z.string().min(1),
  envelope: AgentHandoffEnvelopeSchema,
  reason: z.string().min(1),
  droppedAt: z.string().datetime(),
  attemptCount: z.number().int().nonnegative(),
});
export type MeshDeadLetterRecord = z.infer<typeof MeshDeadLetterRecordSchema>;

// ============================================================================
// 8. TOPOLOGY TELEMETRY (Rule 61)
// ============================================================================

export const MeshTopologySchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  activeNodes: z.number().int().nonnegative(),
  peers: z.array(MeshPeerRegistryEntrySchema),
  inFlightHandoffs: z.number().int().nonnegative(),
  completedHandoffs: z.number().int().nonnegative(),
  compensationsExecuted: z.number().int().nonnegative(),
  deadLetterCount: z.number().int().nonnegative().default(0),
});
export type MeshTopology = z.infer<typeof MeshTopologySchema>;

// ============================================================================
// 9. CRYPTOGRAPHIC & IDEMPOTENCY HELPERS (Rules 19 & 22)
// ============================================================================

/**
 * Normalizes an object into a canonical key-sorted JSON string.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Computes deterministic SHA-256 payload hash over key-sorted contents (Rule 22).
 */
export async function computeHandoffPayloadHash(payload: unknown): Promise<string> {
  const canonicalString = canonicalizeJson(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives deterministic handoff idempotency key (Rule 19).
 */
export function computeHandoffIdempotencyKey(
  organizationId: string,
  parentStepId: string,
  targetStepId: string,
  payloadHash: string
): string {
  return `mesh_hnd_${organizationId}_${parentStepId}_${targetStepId}_${payloadHash.slice(0, 16)}`;
}
