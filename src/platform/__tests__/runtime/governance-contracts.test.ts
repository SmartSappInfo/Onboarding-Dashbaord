/**
 * @fileOverview Unit Tests for Governance Contracts & Schemas (Rules 4, 19, 20, 23, 48)
 */

import { describe, it, expect } from 'vitest';
import {
  BudgetCheckResultSchema,
  CompensationStepSchema,
  SagaExecutionResultSchema,
  GOVERNANCE_ERROR_CODES,
  GovernanceError,
} from '@/platform/runtime/governance/governance-types';

describe('Governance Contracts & Schemas (Rules 4, 19, 20, 23, 48)', () => {
  it('validates BudgetCheckResultSchema with tracing context', () => {
    const valid = BudgetCheckResultSchema.safeParse({
      allowed: true,
      currentUsage: {
        tokensUsed: 1200,
        toolCallsExecuted: 3,
        durationMs: 4500,
        recordsMutated: 2,
        financialAmount: 0,
        currentDelegationDepth: 1,
      },
      remainingBudgets: {
        maxTokens: 48800,
        maxToolCalls: 12,
        maxDurationMs: 115500,
        maxRecordsMutated: 23,
        maxFinancialAmount: 0,
        maxDelegationDepth: 2,
      },
      traceId: 'trace_abc',
      correlationId: 'corr_xyz',
    });
    expect(valid.success).toBe(true);

    const exhausted = BudgetCheckResultSchema.safeParse({
      allowed: false,
      breachedDimensions: ['tokens', 'toolCalls'],
      currentUsage: {
        tokensUsed: 50000,
        toolCallsExecuted: 15,
        durationMs: 120000,
        recordsMutated: 25,
        financialAmount: 0,
        currentDelegationDepth: 1,
      },
      remainingBudgets: {
        maxTokens: 0,
        maxToolCalls: 0,
        maxDurationMs: 0,
        maxRecordsMutated: 0,
        maxFinancialAmount: 0,
        maxDelegationDepth: 0,
      },
      rejectionReason: 'Ceilings exhausted',
    });
    expect(exhausted.success).toBe(true);
  });

  it('validates CompensationStepSchema with deterministic idempotencyKey', () => {
    const valid = CompensationStepSchema.safeParse({
      stepId: 'step_1',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      idempotencyKey: 'saga_comp_step_1',
      compensationArguments: { contactId: 'con_123' },
      status: 'pending',
    });
    expect(valid.success).toBe(true);
  });

  it('validates SagaExecutionResultSchema with operator intervention flag', () => {
    const valid = SagaExecutionResultSchema.safeParse({
      success: false,
      totalCompensations: 2,
      completedCompensations: 1,
      failedCompensations: 1,
      compensationSteps: [
        {
          stepId: 'step_1',
          capabilityId: 'crm.create_contact',
          compensatingCapabilityId: 'crm.delete_contact',
          idempotencyKey: 'saga_comp_step_1',
          compensationArguments: { contactId: 'con_123' },
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
        {
          stepId: 'step_2',
          capabilityId: 'iam.grant_access',
          compensatingCapabilityId: 'iam.revoke_access',
          idempotencyKey: 'saga_comp_step_2',
          compensationArguments: { userId: 'usr_456' },
          status: 'failed',
          error: 'User not found',
        },
      ],
      error: 'One or more compensating operations failed during rollback.',
      compensatedAt: new Date().toISOString(),
      dryRun: false,
      requiresOperatorIntervention: true,
    });
    expect(valid.success).toBe(true);
  });

  it('throws GovernanceError with structured taxonomy', () => {
    const err = new GovernanceError({
      code: 'BUDGET_EXCEEDED',
      message: 'Token ceiling exceeded: 52000 > 50000',
      runId: 'run_123',
      organizationId: 'org_acme',
    });
    expect(err.code).toBe('BUDGET_EXCEEDED');
    expect(err.message).toContain('Token ceiling exceeded');
  });

  it('verifies GOVERNANCE_ERROR_CODES completeness', () => {
    expect(GOVERNANCE_ERROR_CODES).toContain('BUDGET_EXCEEDED');
    expect(GOVERNANCE_ERROR_CODES).toContain('RUN_CANCELLED');
    expect(GOVERNANCE_ERROR_CODES).toContain('COMPENSATION_FAILED');
    expect(GOVERNANCE_ERROR_CODES).toContain('CONTEXT_OVERFLOW');
    expect(GOVERNANCE_ERROR_CODES).toContain('DATA_EXFILTRATION_BLOCKED');
    expect(GOVERNANCE_ERROR_CODES).toContain('DEAD_MAN_PAUSED');
  });
});
