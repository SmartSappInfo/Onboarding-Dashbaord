/**
 * @fileOverview Finance Agent Permission, Tool, Failure, and Rollback Matrices (Phase 12 Milestone 2)
 *
 * Implements Rules 1, 2, 4, 8, 12, 14, 16, 17, 27, 48, 59, 67, 68, and 69.
 * Single Source of Truth for the 4 Mandatory Governance Matrices of the Finance & School Workforce:
 *
 * 1. PERMISSION MATRIX (`FINANCE_PERMISSION_MATRIX`): Strict RBAC scope mapping per persona (zero wildcards).
 * 2. TOOL MATRIX (`FINANCE_TOOL_MATRIX`): Explicit capability inventory and risk level ceilings per persona.
 * 3. FAILURE MATRIX (`FINANCE_FAILURE_MATRIX`): Deterministic strategies for missing, stale, or timeout failures.
 * 4. ROLLBACK MATRIX (`FINANCE_ROLLBACK_MATRIX`): Reverse-LIFO Saga compensation mapping for mutating tools.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import {
  type FinancePersonaId,
  FINANCE_PERSONA_IDS,
} from './finance-persona-types';

/**
 * Zod Schema for Tool Matrix Entry.
 */
export const FinanceToolMatrixEntrySchema = z.object({
  capabilityId: z.string().min(1),
  domain: z.string().min(1),
  riskLevel: z.enum([
    'L0_READ',
    'L1_INTERNAL_DRAFT',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_COMMUNICATION_FINANCE',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  description: z.string().min(1),
  allowedPersonas: z.array(z.enum(FINANCE_PERSONA_IDS)),
  compensatingCapabilityId: z.string().optional(),
});

export type FinanceToolMatrixEntry = z.infer<typeof FinanceToolMatrixEntrySchema>;

/**
 * Zod Schema for Failure Matrix Entry.
 */
export const FinanceFailureMatrixEntrySchema = z.object({
  failureCode: z.string().min(1),
  strategy: z.enum([
    'FAIL_CLOSED',
    'RE_FETCH_AND_VERIFY',
    'FALLBACK_TO_STATIC',
    'DEGRADE_GRACEFULLY',
    'ROUTE_TO_PROPOSAL',
    'CIRCUIT_BREAKER_BACKOFF',
  ]),
  fallbackCode: z.string().min(1),
  description: z.string().min(1),
  retryable: z.boolean(),
  requiresIntervention: z.boolean(),
});

export type FinanceFailureMatrixEntry = z.infer<typeof FinanceFailureMatrixEntrySchema>;

/**
 * Zod Schema for Rollback Matrix Entry (Rule 27).
 */
export const FinanceRollbackMatrixEntrySchema = z.object({
  mutatingCapabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  strategy: z.literal('REVERSE_LIFO'),
  description: z.string().min(1),
});

export type FinanceRollbackMatrixEntry = z.infer<typeof FinanceRollbackMatrixEntrySchema>;

/**
 * 1. PERMISSION MATRIX
 * Maps each finance persona to explicit, non-wildcard RBAC permission scopes (Rule 16).
 */
export const FINANCE_PERMISSION_MATRIX: Readonly<Record<FinancePersonaId, readonly string[]>> = {
  billing_analyst: [
    'rbac:finance.invoices.view',
    'rbac:finance.invoices.create',
    'rbac:finance.invoices.edit',
    'rbac:finance.agreements.view',
    'rbac:operations.campuses.view',
  ],

  collections_agent: [
    'rbac:finance.invoices.view',
    'rbac:finance.agreements.view',
    'rbac:operations.campuses.view',
    'rbac:operations.tasks.create',
    'rbac:operations.tasks.view',
  ],

  reconciliation_agent: [
    'rbac:finance.invoices.view',
    'rbac:finance.invoices.edit',
    'rbac:finance.billingSetup.view',
  ],

  revenue_analyst: [
    'rbac:finance.invoices.view',
    'rbac:finance.cycles.view',
    'rbac:finance.agreements.view',
    'rbac:operations.dashboard.view',
  ],

  invoice_assistant: [
    'rbac:finance.invoices.view',
    'rbac:finance.invoices.create',
    'rbac:operations.campuses.view',
  ],

  finance_reporter: [
    'rbac:finance.invoices.view',
    'rbac:finance.agreements.view',
    'rbac:finance.cycles.view',
    'rbac:operations.dashboard.view',
  ],

  school_ops_agent: [
    'rbac:operations.campuses.view',
    'rbac:operations.classes.view',
    'rbac:operations.academicYears.view',
    'rbac:operations.terms.view',
    'rbac:finance.invoices.view',
    'rbac:finance.packages.view',
  ],

  attendance_analyst: [
    'rbac:operations.campuses.view',
    'rbac:operations.classes.view',
    'rbac:operations.attendance.view',
    'rbac:finance.invoices.view',
  ],

  fee_collection_agent: [
    'rbac:finance.invoices.view',
    'rbac:finance.invoices.edit',
    'rbac:operations.campuses.view',
    'rbac:operations.classes.view',
    'rbac:operations.tasks.create',
  ],
};

/**
 * 2. TOOL MATRIX
 * Maps all 15 canonical finance & school operations capabilities with risk levels and allowed personas.
 */
export const FINANCE_TOOL_MATRIX: readonly FinanceToolMatrixEntry[] = [
  {
    capabilityId: 'finance.invoice.create_draft',
    domain: 'finance_subscriptions',
    riskLevel: 'L1_INTERNAL_DRAFT',
    description: 'Creates an unissued draft invoice with calculated line items, VAT, and discounts without advancing sequence counters.',
    allowedPersonas: ['billing_analyst', 'invoice_assistant', 'school_ops_agent'],
    compensatingCapabilityId: 'finance.invoice.cancel_draft',
  },
  {
    capabilityId: 'finance.invoice.validate',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Validates line items, arithmetic consistency, currency constraints, and tax math for invoices.',
    allowedPersonas: ['billing_analyst', 'invoice_assistant', 'collections_agent', 'reconciliation_agent', 'school_ops_agent'],
  },
  {
    capabilityId: 'finance.invoice.issue',
    domain: 'finance_subscriptions',
    riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    description: 'Finalizes draft invoice, assigns sequential invoice number, locks balances, and posts ledger entries. Requires human approval.',
    allowedPersonas: ['billing_analyst'],
    compensatingCapabilityId: 'finance.invoice.void',
  },
  {
    capabilityId: 'finance.payment.search',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Searches recorded payment transactions across reference numbers, payer accounts, and date ranges.',
    allowedPersonas: ['reconciliation_agent', 'collections_agent', 'revenue_analyst', 'finance_reporter', 'fee_collection_agent'],
  },
  {
    capabilityId: 'finance.payment.get',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Retrieves single payment details, gateway settlement references, and payment allocation records.',
    allowedPersonas: ['reconciliation_agent', 'collections_agent', 'finance_reporter'],
  },
  {
    capabilityId: 'finance.payment.reconcile',
    domain: 'finance_subscriptions',
    riskLevel: 'L2_STATE_MUTATION',
    description: 'Applies payment to open invoice balances and updates account ledger settlement status.',
    allowedPersonas: ['reconciliation_agent'],
    compensatingCapabilityId: 'finance.payment.unreconcile',
  },
  {
    capabilityId: 'finance.account.get_balance',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Calculates real-time financial balance, paid-to-date total, and current receivables aging.',
    allowedPersonas: ['billing_analyst', 'collections_agent', 'reconciliation_agent', 'revenue_analyst', 'finance_reporter', 'fee_collection_agent'],
  },
  {
    capabilityId: 'finance.receivables.get_aging',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Computes aging receivables report broken down into 0-30, 31-60, 61-90, and >90 day buckets.',
    allowedPersonas: ['collections_agent', 'revenue_analyst', 'finance_reporter', 'fee_collection_agent'],
  },
  {
    capabilityId: 'finance.collection.propose_plan',
    domain: 'finance_subscriptions',
    riskLevel: 'L2_STATE_MUTATION',
    description: 'Proposes structured debt recovery installment schedule for overdue student/client balances.',
    allowedPersonas: ['collections_agent', 'fee_collection_agent'],
    compensatingCapabilityId: 'finance.collection.cancel_plan',
  },
  {
    capabilityId: 'finance.collection.record_promise',
    domain: 'finance_subscriptions',
    riskLevel: 'L2_STATE_MUTATION',
    description: 'Records debtor promise-to-pay date and expected amount with automated follow-up reminder.',
    allowedPersonas: ['collections_agent', 'fee_collection_agent'],
    compensatingCapabilityId: 'finance.collection.delete_promise',
  },
  {
    capabilityId: 'finance.fee.record_installment',
    domain: 'finance_subscriptions',
    riskLevel: 'L2_STATE_MUTATION',
    description: 'Records tuition installment milestone agreement against academic term billing ledger.',
    allowedPersonas: ['fee_collection_agent'],
    compensatingCapabilityId: 'finance.fee.void_installment',
  },
  {
    capabilityId: 'finance.analytics.get_cashflow_forecast',
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    description: 'Projects 30/60/90 day cash inflows based on invoice due dates, payment history, and collection velocity.',
    allowedPersonas: ['revenue_analyst', 'finance_reporter'],
  },
  {
    capabilityId: 'school.attendance.get_report',
    domain: 'school_operations',
    riskLevel: 'L0_READ',
    description: 'Retrieves daily student attendance logs, excused/unexcused rates, and class absenteeism patterns.',
    allowedPersonas: ['attendance_analyst', 'school_ops_agent'],
  },
  {
    capabilityId: 'school.attendance.correlate_fees',
    domain: 'school_operations',
    riskLevel: 'L0_READ',
    description: 'Correlates student attendance drops and chronic absenteeism with outstanding tuition fee balances.',
    allowedPersonas: ['attendance_analyst'],
  },
  {
    capabilityId: 'school.enrollment.get_fee_schedule',
    domain: 'school_operations',
    riskLevel: 'L0_READ',
    description: 'Retrieves official tuition packages, mandatory levies, meal fees, and discount tiers per grade/term.',
    allowedPersonas: ['school_ops_agent', 'billing_analyst', 'fee_collection_agent'],
  },
];

/**
 * 3. FAILURE MATRIX
 * Maps 12 structured finance failure codes to deterministic recovery strategies (Rule 2 & 48).
 */
export const FINANCE_FAILURE_MATRIX: readonly FinanceFailureMatrixEntry[] = [
  {
    failureCode: 'DISCREPANCY_EXCEEDS_TOLERANCE',
    strategy: 'ROUTE_TO_PROPOSAL',
    fallbackCode: 'RECONCILIATION_EXCEPTION_FLAGGED',
    description: 'Payment settlement variance exceeds configured threshold ($0.50); routed to human exception queue.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'INVOICE_ALREADY_PAID',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'DOUBLE_PAYMENT_PREVENTED',
    description: 'Target invoice balance is already 0; fails closed to prevent duplicate settlement or double charging.',
    retryable: false,
    requiresIntervention: false,
  },
  {
    failureCode: 'GATEWAY_TIMEOUT',
    strategy: 'CIRCUIT_BREAKER_BACKOFF',
    fallbackCode: 'PAYMENT_GATEWAY_BACKOFF',
    description: 'Payment processor or banking API timeout; triggers exponential backoff circuit breaker.',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'CURRENCY_MISMATCH',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'CURRENCY_CONVERSION_REQUIRED',
    description: 'Payment currency does not match invoice currency; fails closed to protect ledger integrity.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'STALE_BALANCE',
    strategy: 'RE_FETCH_AND_VERIFY',
    fallbackCode: 'BALANCE_REFRESHED',
    description: 'Concurrent transaction updated balance; re-fetches latest ledger state before proceeding.',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'DEAD_MAN_ENGAGED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'FINANCE_EMERGENCY_HALTED',
    description: 'Platform emergency dead-man pause switch is active; halts all mutations and returns HTTP 503.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'OVERDUE_BUCKET_OVERFLOW',
    strategy: 'DEGRADE_GRACEFULLY',
    fallbackCode: 'COARSE_AGING_RETURNED',
    description: 'Complex term ledger exceeds granular aging memory; falls back to coarse default bands.',
    retryable: false,
    requiresIntervention: false,
  },
  {
    failureCode: 'INVALID_PAYMENT_METHOD',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'PAYMENT_RAIL_REJECTED',
    description: 'Provided payment rail is unsupported or inactive in tenant configuration.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'IDOR_VIOLATION',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'TENANT_BOUNDARY_REJECTED',
    description: 'Cross-tenant account access detected; immediately rejected with HTTP 403.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'PROMPT_INJECTION_DETECTED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'PAYLOAD_NEUTRALIZED',
    description: 'Malicious directive found in payment memo or invoice notes; sanitized and execution halted.',
    retryable: false,
    requiresIntervention: true,
  },
  {
    failureCode: 'RATE_LIMITED',
    strategy: 'CIRCUIT_BREAKER_BACKOFF',
    fallbackCode: 'UPSTREAM_THROTTLED',
    description: 'Upstream banking gateway returned HTTP 429; applies backpressure backoff.',
    retryable: true,
    requiresIntervention: false,
  },
  {
    failureCode: 'UNAPPROVED_FINANCIAL_MUTATION',
    strategy: 'ROUTE_TO_PROPOSAL',
    fallbackCode: 'PROPOSAL_INTERCEPTED',
    description: 'Financial operation exceeds autonomous threshold; intercepted for operator review.',
    retryable: false,
    requiresIntervention: true,
  },
];

/**
 * 4. ROLLBACK MATRIX
 * Formal reverse-LIFO Saga compensation mapping for every state mutation (Rule 27).
 */
export const FINANCE_ROLLBACK_MATRIX: readonly FinanceRollbackMatrixEntry[] = [
  {
    mutatingCapabilityId: 'finance.invoice.create_draft',
    compensatingCapabilityId: 'finance.invoice.cancel_draft',
    strategy: 'REVERSE_LIFO',
    description: 'Cancels unissued draft invoice and deletes temporary staging record.',
  },
  {
    mutatingCapabilityId: 'finance.invoice.issue',
    compensatingCapabilityId: 'finance.invoice.void',
    strategy: 'REVERSE_LIFO',
    description: 'Voids posted invoice and issues credit memo reversal in ledger.',
  },
  {
    mutatingCapabilityId: 'finance.payment.reconcile',
    compensatingCapabilityId: 'finance.payment.unreconcile',
    strategy: 'REVERSE_LIFO',
    description: 'Unlinks payment allocation from invoice balance and restores outstanding status.',
  },
  {
    mutatingCapabilityId: 'finance.collection.propose_plan',
    compensatingCapabilityId: 'finance.collection.cancel_plan',
    strategy: 'REVERSE_LIFO',
    description: 'Cancels proposed installment schedule before execution.',
  },
  {
    mutatingCapabilityId: 'finance.collection.record_promise',
    compensatingCapabilityId: 'finance.collection.delete_promise',
    strategy: 'REVERSE_LIFO',
    description: 'Deletes recorded promise-to-pay commitment from debtor file.',
  },
  {
    mutatingCapabilityId: 'finance.fee.record_installment',
    compensatingCapabilityId: 'finance.fee.void_installment',
    strategy: 'REVERSE_LIFO',
    description: 'Voids term fee installment record and recalculates active term balance.',
  },
];

/**
 * Validates whether a finance persona has authority to execute a target capability (Rule 12 & 16).
 */
export function validateFinancePersonaToolAccess(
  personaId: FinancePersonaId,
  capabilityId: string
): { allowed: boolean; reason?: string } {
  const toolEntry = FINANCE_TOOL_MATRIX.find((t) => t.capabilityId === capabilityId);
  if (!toolEntry) {
    return {
      allowed: false,
      reason: `Capability '${capabilityId}' is not registered in the Finance Tool Matrix.`,
    };
  }

  const isPersonaAuthorized = (toolEntry.allowedPersonas as readonly string[]).includes(personaId);
  if (!isPersonaAuthorized) {
    return {
      allowed: false,
      reason: `Persona '${personaId}' is not authorized to execute '${capabilityId}'. Allowed: [${toolEntry.allowedPersonas.join(', ')}].`,
    };
  }

  return { allowed: true };
}

/**
 * Resolves the reverse-LIFO compensating capability for a mutating capability (Rule 27).
 */
export function getFinanceRollbackCapability(capabilityId: string): string | null {
  const entry = FINANCE_ROLLBACK_MATRIX.find((r) => r.mutatingCapabilityId === capabilityId);
  return entry ? entry.compensatingCapabilityId : null;
}

/**
 * Resolves the deterministic failure strategy for a structured failure code (Rule 2 & 48).
 */
export function resolveFinanceFailureStrategy(failureCode: string): FinanceFailureMatrixEntry {
  const entry = FINANCE_FAILURE_MATRIX.find((f) => f.failureCode === failureCode);
  if (entry) {
    return entry;
  }

  // Safe fallback for unclassified errors: fail closed
  return {
    failureCode,
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'UNKNOWN_FAILURE_HALTED',
    description: `Unclassified failure code '${failureCode}' - halted closed for safety.`,
    retryable: false,
    requiresIntervention: true,
  };
}

/**
 * Returns all capabilities authorized for a specific finance persona.
 */
export function getPersonaAllowedCapabilities(personaId: FinancePersonaId): readonly string[] {
  return FINANCE_TOOL_MATRIX.filter((t) =>
    (t.allowedPersonas as readonly string[]).includes(personaId)
  ).map((t) => t.capabilityId);
}

/**
 * Returns all explicit RBAC permission coordinates for a specific finance persona.
 */
export function getPersonaPermissionList(personaId: FinancePersonaId): readonly string[] {
  return FINANCE_PERMISSION_MATRIX[personaId] || [];
}
