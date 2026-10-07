/**
 * @fileOverview Unit & Governance Tests for Finance Agent Permission, Tool, Failure & Rollback Matrices (Phase 12 M2)
 *
 * Implements Rules 2, 4, 10, 12, 14, 16, 27, 44, 48, 67, and 69.
 * Validates:
 * - FINANCE_PERMISSION_MATRIX: Explicit non-wildcard RBAC scopes per persona
 * - FINANCE_TOOL_MATRIX: Canonical mapping of 15 finance & school capabilities with risk levels
 * - FINANCE_FAILURE_MATRIX: 12 structured error taxonomy codes and recovery strategies
 * - FINANCE_ROLLBACK_MATRIX: Reverse-LIFO Saga compensation mapping for mutating tools
 * - Helper functions: validateFinancePersonaToolAccess, getFinanceRollbackCapability, resolveFinanceFailureStrategy
 */

import { describe, it, expect } from 'vitest';
import {
  FINANCE_PERMISSION_MATRIX,
  FINANCE_TOOL_MATRIX,
  FINANCE_FAILURE_MATRIX,
  FINANCE_ROLLBACK_MATRIX,
  FinanceToolMatrixEntrySchema,
  FinanceFailureMatrixEntrySchema,
  FinanceRollbackMatrixEntrySchema,
  validateFinancePersonaToolAccess,
  getFinanceRollbackCapability,
  resolveFinanceFailureStrategy,
  getPersonaAllowedCapabilities,
  getPersonaPermissionList,
} from '@/platform/agents/finance/personas/finance-agent-matrix';
import { FINANCE_PERSONA_IDS } from '@/platform/agents/finance/personas/finance-persona-definitions';

describe('Finance & School Operations Governance Matrices', () => {
  it('defines explicit non-wildcard permissions for every persona (Rule 16)', () => {
    for (const personaId of FINANCE_PERSONA_IDS) {
      const perms = FINANCE_PERMISSION_MATRIX[personaId];
      expect(perms).toBeDefined();
      expect(perms.length).toBeGreaterThan(0);
      for (const p of perms) {
        expect(p).not.toContain('*');
        expect(p).not.toBe('all');
      }
    }
  });

  it('maps all 15 canonical capabilities in the Tool Matrix with valid risk levels (Rule 12 & 14)', () => {
    expect(FINANCE_TOOL_MATRIX.length).toBeGreaterThanOrEqual(15);
    const capIds = FINANCE_TOOL_MATRIX.map((e) => e.capabilityId);

    // Canonical invoice capabilities
    expect(capIds).toContain('finance.invoice.create_draft');
    expect(capIds).toContain('finance.invoice.validate');
    expect(capIds).toContain('finance.invoice.issue');

    // Canonical payment capabilities
    expect(capIds).toContain('finance.payment.search');
    expect(capIds).toContain('finance.payment.get');
    expect(capIds).toContain('finance.payment.reconcile');

    // Canonical balance & receivables capabilities
    expect(capIds).toContain('finance.account.get_balance');
    expect(capIds).toContain('finance.receivables.get_aging');

    // Collections & fee capabilities
    expect(capIds).toContain('finance.collection.propose_plan');
    expect(capIds).toContain('finance.collection.record_promise');
    expect(capIds).toContain('finance.fee.record_installment');
    expect(capIds).toContain('finance.analytics.get_cashflow_forecast');

    // School operations capabilities
    expect(capIds).toContain('school.attendance.get_report');
    expect(capIds).toContain('school.attendance.correlate_fees');
    expect(capIds).toContain('school.enrollment.get_fee_schedule');

    // Schema validation for every entry
    for (const entry of FINANCE_TOOL_MATRIX) {
      const parsed = FinanceToolMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
    }
  });

  it('handles at least 12 distinct failure codes in the Failure Matrix (Rule 48)', () => {
    expect(FINANCE_FAILURE_MATRIX.length).toBeGreaterThanOrEqual(12);
    const failureCodes = FINANCE_FAILURE_MATRIX.map((e) => e.failureCode);
    expect(failureCodes).toContain('DISCREPANCY_EXCEEDS_TOLERANCE');
    expect(failureCodes).toContain('INVOICE_ALREADY_PAID');
    expect(failureCodes).toContain('GATEWAY_TIMEOUT');
    expect(failureCodes).toContain('CURRENCY_MISMATCH');
    expect(failureCodes).toContain('STALE_BALANCE');
    expect(failureCodes).toContain('DEAD_MAN_ENGAGED');
    expect(failureCodes).toContain('OVERDUE_BUCKET_OVERFLOW');
    expect(failureCodes).toContain('INVALID_PAYMENT_METHOD');
    expect(failureCodes).toContain('IDOR_VIOLATION');
    expect(failureCodes).toContain('PROMPT_INJECTION_DETECTED');
    expect(failureCodes).toContain('RATE_LIMITED');
    expect(failureCodes).toContain('UNAPPROVED_FINANCIAL_MUTATION');

    // Schema validation for every entry
    for (const entry of FINANCE_FAILURE_MATRIX) {
      const parsed = FinanceFailureMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
    }
  });

  it('binds compensating capabilities in the Rollback Matrix for mutating operations (Rule 27)', () => {
    expect(FINANCE_ROLLBACK_MATRIX.length).toBeGreaterThanOrEqual(5);
    for (const entry of FINANCE_ROLLBACK_MATRIX) {
      const parsed = FinanceRollbackMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
      expect(entry.mutatingCapabilityId).toBeTruthy();
      expect(entry.compensatingCapabilityId).toBeTruthy();
      expect(entry.strategy).toBe('REVERSE_LIFO');
    }
  });

  it('validates tool access correctly using validateFinancePersonaToolAccess', () => {
    // Authorized read-only access
    const readCheck = validateFinancePersonaToolAccess('revenue_analyst', 'finance.receivables.get_aging');
    expect(readCheck.allowed).toBe(true);

    // Forbidden mutating access for read-only persona
    const forbiddenMutate = validateFinancePersonaToolAccess('revenue_analyst', 'finance.payment.reconcile');
    expect(forbiddenMutate.allowed).toBe(false);
    expect(forbiddenMutate.reason).toContain('not authorized');

    // Unknown capability
    const unknownCap = validateFinancePersonaToolAccess('billing_analyst', 'finance.unknown.do_something');
    expect(unknownCap.allowed).toBe(false);
    expect(unknownCap.reason).toContain('not registered');
  });

  it('resolves rollback capabilities accurately with getFinanceRollbackCapability', () => {
    expect(getFinanceRollbackCapability('finance.invoice.create_draft')).toBe('finance.invoice.cancel_draft');
    expect(getFinanceRollbackCapability('finance.payment.reconcile')).toBe('finance.payment.unreconcile');
    expect(getFinanceRollbackCapability('finance.collection.propose_plan')).toBe('finance.collection.cancel_plan');
    expect(getFinanceRollbackCapability('finance.fee.record_installment')).toBe('finance.fee.void_installment');
    expect(getFinanceRollbackCapability('finance.account.get_balance')).toBeNull(); // Read-only tool has no rollback
  });

  it('resolves failure strategies deterministically with resolveFinanceFailureStrategy', () => {
    const knownFailure = resolveFinanceFailureStrategy('DISCREPANCY_EXCEEDS_TOLERANCE');
    expect(knownFailure.strategy).toBe('ROUTE_TO_PROPOSAL');
    expect(knownFailure.requiresIntervention).toBe(true);

    const staleFailure = resolveFinanceFailureStrategy('STALE_BALANCE');
    expect(staleFailure.strategy).toBe('RE_FETCH_AND_VERIFY');
    expect(staleFailure.retryable).toBe(true);

    const unknownFailure = resolveFinanceFailureStrategy('SOME_UNKNOWN_CODE');
    expect(unknownFailure.strategy).toBe('FAIL_CLOSED');
    expect(unknownFailure.requiresIntervention).toBe(true);
  });

  it('retrieves persona allowed capabilities and permissions correctly', () => {
    const billingTools = getPersonaAllowedCapabilities('billing_analyst');
    expect(billingTools).toContain('finance.invoice.create_draft');
    expect(billingTools).toContain('finance.invoice.validate');

    const billingPerms = getPersonaPermissionList('billing_analyst');
    expect(billingPerms).toContain('rbac:finance.invoices.view');
    expect(billingPerms).toContain('rbac:finance.invoices.create');
  });
});
