/**
 * @fileOverview Universal Saga Rollback Matrix (Phase 14 Milestone 3)
 *
 * Implements Rule 2 (FMEA Failure Analysis), Rule 4 (Strict Typing),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 14 (Schema Fingerprinting), Rule 16 (Explicit Scoped RBAC),
 * Rule 27 (Formal Saga / Compensation Model), Rule 48 (Sanitized Error Taxonomy),
 * Rule 67, Rule 68, Rule 69 (Strangler Fig Invariant), Rule 1961.
 *
 * Unifies domain-level rollback mappings (CRM, Sales, Finance, Knowledge, Meetings, Supervisor)
 * into a single authoritative platform-wide registry.
 */

import {
  type UniversalRollbackEntry,
  UniversalRollbackEntrySchema,
} from './saga-compensation-types';

// ============================================================================
// 1. UNIVERSAL SAGA ROLLBACK REGISTRY (Rule 27 & 69)
// ============================================================================

export const UNIVERSAL_SAGA_ROLLBACK_MATRIX: Readonly<Record<string, UniversalRollbackEntry>> = Object.freeze({
  // --------------------------------------------------------------------------
  // CRM Domain Capabilities
  // --------------------------------------------------------------------------
  'crm.deal.advance_stage': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.deal.advance_stage',
    compensatingCapabilityId: 'crm.deal.revert_stage',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Reverts stage advancement and restores previous pipeline metrics using pre-state snapshot',
    requiresManualReview: false,
  }),

  'crm.entity.update': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.entity.update',
    compensatingCapabilityId: 'crm.entity.update',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Re-applies pre-mutation attributes from ResourceSnapshot to undo modifications',
    requiresManualReview: false,
  }),

  'crm.entity.tag_add': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.entity.tag_add',
    compensatingCapabilityId: 'crm.entity.tag_remove',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Removes added contact/deal tags',
    requiresManualReview: false,
  }),

  'crm.entity.tag_remove': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.entity.tag_remove',
    compensatingCapabilityId: 'crm.entity.tag_add',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Restores removed tags',
    requiresManualReview: false,
  }),

  'crm.task.create': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.task.create',
    compensatingCapabilityId: 'crm.task.delete',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Soft-deletes or archives created CRM follow-up task',
    requiresManualReview: false,
  }),

  'crm.task.delete': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.task.delete',
    compensatingCapabilityId: 'crm.task.create',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Re-creates deleted task using snapshot attributes',
    requiresManualReview: false,
  }),

  'crm.deal.transfer_owner': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'crm.deal.transfer_owner',
    compensatingCapabilityId: 'crm.deal.transfer_owner',
    reversibility: 'REVERSIBLE',
    domain: 'crm',
    description: 'Transfers deal ownership back to previous owner from pre-state snapshot',
    requiresManualReview: false,
  }),

  // --------------------------------------------------------------------------
  // Sales & Outreach Domain Capabilities
  // --------------------------------------------------------------------------
  'sdr.draft_outreach': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'sdr.draft_outreach',
    compensatingCapabilityId: 'noop',
    reversibility: 'REVERSIBLE',
    domain: 'sales',
    description: 'Discards staged outreach draft without external side effects',
    requiresManualReview: false,
  }),

  'sdr.prepare_sequence': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'sdr.prepare_sequence',
    compensatingCapabilityId: 'noop',
    reversibility: 'REVERSIBLE',
    domain: 'sales',
    description: 'Discards un-dispatched outreach sequence',
    requiresManualReview: false,
  }),

  'sdr.dispatch_email': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'sdr.dispatch_email',
    compensatingCapabilityId: 'sdr.log_outreach_revoked',
    reversibility: 'PARTIALLY_REVERSIBLE',
    domain: 'sales',
    description: 'Outbound email already sent over network; logs revocation event and flags deal',
    requiresManualReview: true,
  }),

  'sdr.dispatch_whatsapp': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'sdr.dispatch_whatsapp',
    compensatingCapabilityId: 'sdr.log_outreach_revoked',
    reversibility: 'PARTIALLY_REVERSIBLE',
    domain: 'sales',
    description: 'WhatsApp message already dispatched; logs revocation event and marks message revoked',
    requiresManualReview: true,
  }),

  'lead.enrich': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'lead.enrich',
    compensatingCapabilityId: 'noop',
    reversibility: 'REVERSIBLE',
    domain: 'sales',
    description: 'Lead enrichment updates can be restored from pre-state snapshot or no-op',
    requiresManualReview: false,
  }),

  // --------------------------------------------------------------------------
  // Finance & Operations Domain Capabilities
  // --------------------------------------------------------------------------
  'reconciliation.resolve_exception': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'reconciliation.resolve_exception',
    compensatingCapabilityId: 'reconciliation.unresolve_exception',
    reversibility: 'REVERSIBLE',
    domain: 'finance',
    description: 'Re-opens bank reconciliation discrepancy item and detaches settlement',
    requiresManualReview: false,
  }),

  'collections.execute_proposal': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'collections.execute_proposal',
    compensatingCapabilityId: 'collections.rollback_proposal',
    reversibility: 'REVERSIBLE',
    domain: 'finance',
    description: 'Voids payment plan milestones and restores prior debtor collection status',
    requiresManualReview: false,
  }),

  'collections.create_installment_plan': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'collections.create_installment_plan',
    compensatingCapabilityId: 'collections.rollback_proposal',
    reversibility: 'REVERSIBLE',
    domain: 'finance',
    description: 'Cancels scheduled installment plan and resets payment timeline',
    requiresManualReview: false,
  }),

  'finance.payment.reconcile': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'finance.payment.reconcile',
    compensatingCapabilityId: 'finance.payment.unreconcile',
    reversibility: 'REVERSIBLE',
    domain: 'finance',
    description: 'Un-reconciles payment entry and restores open ledger balance',
    requiresManualReview: false,
  }),

  'finance.invoice.create': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'finance.invoice.create',
    compensatingCapabilityId: 'finance.invoice.void',
    reversibility: 'REVERSIBLE',
    domain: 'finance',
    description: 'Voids newly generated draft invoice',
    requiresManualReview: false,
  }),

  // --------------------------------------------------------------------------
  // Knowledge & Memory Domain Capabilities
  // --------------------------------------------------------------------------
  'knowledge.candidate.decide': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'knowledge.candidate.decide',
    compensatingCapabilityId: 'knowledge.candidate.reopen',
    reversibility: 'REVERSIBLE',
    domain: 'knowledge',
    description: 'Reverts candidate status to PENDING and invalidates approved memory fact (Rule 29)',
    requiresManualReview: false,
  }),

  'knowledge.conflict.resolve': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'knowledge.conflict.resolve',
    compensatingCapabilityId: 'knowledge.conflict.reopen',
    reversibility: 'REVERSIBLE',
    domain: 'knowledge',
    description: 'Re-opens contradictory memory conflict for human adjudication',
    requiresManualReview: false,
  }),

  // --------------------------------------------------------------------------
  // Supervisor Swarm Domain Capabilities
  // --------------------------------------------------------------------------
  'supervisor.mesh.route_handoff': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'supervisor.mesh.route_handoff',
    compensatingCapabilityId: 'supervisor.mesh.revert_handoff',
    reversibility: 'REVERSIBLE',
    domain: 'supervisor',
    description: 'Reclaims execution authority from delegated specialist subagent',
    requiresManualReview: false,
  }),

  'supervisor.delegation.issue_token': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'supervisor.delegation.issue_token',
    compensatingCapabilityId: 'supervisor.delegation.revoke_token',
    reversibility: 'REVERSIBLE',
    domain: 'supervisor',
    description: 'Revokes issued delegation token and invalidates cryptographic nonce',
    requiresManualReview: false,
  }),

  'supervisor.task.assign': UniversalRollbackEntrySchema.parse({
    mutatingCapabilityId: 'supervisor.task.assign',
    compensatingCapabilityId: 'supervisor.task.unassign',
    reversibility: 'REVERSIBLE',
    domain: 'supervisor',
    description: 'Un-assigns task from persona back to unassigned mesh queue',
    requiresManualReview: false,
  }),
});

// ============================================================================
// 2. DEFAULT FALLBACK ROLLBACK ENTRY (Rule 27)
// ============================================================================

export const DEFAULT_READONLY_ROLLBACK_ENTRY: Readonly<UniversalRollbackEntry> = Object.freeze({
  mutatingCapabilityId: 'default.read_only',
  compensatingCapabilityId: 'noop',
  reversibility: 'REVERSIBLE',
  domain: 'platform',
  description: 'Read-only or idempotent capability requires no compensation',
  requiresManualReview: false,
});

// ============================================================================
// 3. LOOKUP & REVERSIBILITY HELPERS
// ============================================================================

/**
 * Retrieves the universal rollback policy entry for a mutating capability, or null if unregistered.
 */
export function getUniversalRollbackEntry(
  capabilityId: string
): UniversalRollbackEntry | null {
  return UNIVERSAL_SAGA_ROLLBACK_MATRIX[capabilityId] ?? null;
}

/**
 * Checks whether a capability is fully reversible.
 * PARTIALLY_REVERSIBLE and IRREVERSIBLE capabilities return false.
 */
export function isCapabilityReversible(capabilityId: string): boolean {
  const entry = UNIVERSAL_SAGA_ROLLBACK_MATRIX[capabilityId];
  return entry?.reversibility === 'REVERSIBLE';
}

/**
 * Resolves the compensating capability ID for an action, falling back to 'noop' for unmapped read actions.
 */
export function getCompensatingCapabilityId(capabilityId: string): string {
  const entry = UNIVERSAL_SAGA_ROLLBACK_MATRIX[capabilityId];
  return entry ? entry.compensatingCapabilityId : 'noop';
}

/**
 * Returns all registered universal rollback entries.
 */
export function getAllUniversalRollbackEntries(): readonly UniversalRollbackEntry[] {
  return Object.values(UNIVERSAL_SAGA_ROLLBACK_MATRIX);
}
