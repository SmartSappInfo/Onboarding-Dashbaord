/**
 * @fileOverview Capability Verification Policy Matrix & Failure Recovery Routing (Phase 14 Milestone 1)
 *
 * Implements Rule 2 (FMEA Failure Analysis), Rule 4 (Strict Typing: zero any/any[]),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 21 (Two-Phase Verification Invariants), Rule 27 (Saga Rollback Recovery),
 * Rule 48 (Sanitized Error Taxonomy), Rule 67 (The Agent Implementation Gate),
 * and Rule 69 (Strangler Fig Invariant).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This matrix is the authoritative registry of required postconditions for every mutating capability.
 * - Capabilities not listed in this matrix are either read-only (L0_READ) or non-mutating,
 *   which do not require post-state mutation assertions.
 * - When a postcondition assertion fails:
 *   - CRITICAL severity with FAIL_AND_COMPENSATE immediately halts the commit phase
 *     and triggers Reverse-LIFO Saga compensation (Rule 27).
 *   - WARNING severity with RECORD_WARNING records telemetry and marks status DEGRADED,
 *     allowing non-critical side-effects to proceed.
 * - Zero `any` or `any[]` are permitted.
 */

import {
  PostconditionSeverity,
  VerificationStrategy,
} from './verification-types';

export interface CapabilityVerificationPolicy {
  capabilityId: string;
  requiredAssertions: readonly string[];
  severity: PostconditionSeverity;
  failureStrategy: VerificationStrategy;
  description: string;
}

/**
 * Authoritative mapping of mutating capabilities to required postconditions and failure strategies.
 */
export const VERIFICATION_POLICY_MATRIX: readonly CapabilityVerificationPolicy[] = [
  // --------------------------------------------------------------------------
  // CRM DOMAIN CAPABILITIES
  // --------------------------------------------------------------------------
  {
    capabilityId: 'crm.deal.advance_stage',
    requiredAssertions: ['crm:deal_stage_advanced'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts target deal post-state exists and reflects the advanced stage',
  },
  {
    capabilityId: 'crm.entity.update',
    requiredAssertions: ['crm:entity_updated'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts entity post-state reflects all mutated attributes',
  },
  {
    capabilityId: 'crm.note.create',
    requiredAssertions: ['crm:note_created'],
    severity: 'WARNING',
    failureStrategy: 'RECORD_WARNING',
    description: 'Asserts note record exists in entity timeline',
  },

  // --------------------------------------------------------------------------
  // SALES & SDR DOMAIN CAPABILITIES
  // --------------------------------------------------------------------------
  {
    capabilityId: 'sdr.dispatch_whatsapp',
    requiredAssertions: ['sales:outreach_sent'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts WhatsApp outreach status is sent/queued with provider message ID',
  },
  {
    capabilityId: 'sdr.dispatch_email',
    requiredAssertions: ['sales:outreach_sent'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts email outreach status is sent/queued with message ID',
  },

  // --------------------------------------------------------------------------
  // FINANCE & COLLECTIONS CAPABILITIES
  // --------------------------------------------------------------------------
  {
    capabilityId: 'collections.execute_proposal',
    requiredAssertions: ['finance:remainder_balanced'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts installment milestones balance total principal down to the cent (Rule 11)',
  },
  {
    capabilityId: 'finance.payment.reconcile',
    requiredAssertions: ['finance:reconciliation_matched'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts 3-way match consistency and ledger balance update',
  },

  // --------------------------------------------------------------------------
  // KNOWLEDGE & MEMORY CAPABILITIES
  // --------------------------------------------------------------------------
  {
    capabilityId: 'knowledge.candidate.decide',
    requiredAssertions: ['knowledge:fact_superseded'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts temporal validity window and fact supersession links (Rule 29)',
  },

  // --------------------------------------------------------------------------
  // SUPERVISOR & MESH CAPABILITIES
  // --------------------------------------------------------------------------
  {
    capabilityId: 'supervisor.mesh.route_handoff',
    requiredAssertions: ['supervisor:delegation_bounded'],
    severity: 'CRITICAL',
    failureStrategy: 'FAIL_AND_COMPENSATE',
    description: 'Asserts delegation depth <= 3 and token budget <= 4,000 (Rules 9, 23, 28)',
  },
] as const;

/**
 * Fast lookup map for capability verification policy.
 */
const POLICY_BY_CAPABILITY_MAP = new Map<string, CapabilityVerificationPolicy>(
  VERIFICATION_POLICY_MATRIX.map((policy) => [policy.capabilityId, policy])
);

/**
 * Retrieves the verification policy for a given capability ID.
 */
export function getVerificationPolicyForCapability(
  capabilityId: string
): CapabilityVerificationPolicy | undefined {
  return POLICY_BY_CAPABILITY_MAP.get(capabilityId);
}

/**
 * Resolves the required assertion rule names for a given capability ID.
 */
export function getRequiredAssertionsForCapability(
  capabilityId: string
): readonly string[] {
  const policy = POLICY_BY_CAPABILITY_MAP.get(capabilityId);
  return policy ? policy.requiredAssertions : [];
}

/**
 * Resolves the failure strategy when a capability postcondition fails.
 * Defaults to 'RECORD_WARNING' for unmapped read-only operations.
 */
export function resolveVerificationFailureStrategy(
  capabilityId: string
): VerificationStrategy {
  const policy = POLICY_BY_CAPABILITY_MAP.get(capabilityId);
  return policy ? policy.failureStrategy : 'RECORD_WARNING';
}

/**
 * Determines whether a capability requires postcondition verification.
 */
export function isVerificationRequired(capabilityId: string): boolean {
  const policy = POLICY_BY_CAPABILITY_MAP.get(capabilityId);
  return Boolean(policy && policy.requiredAssertions.length > 0);
}
