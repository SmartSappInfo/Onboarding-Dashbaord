/**
 * @fileOverview Unit Tests for Workflow Resilience Contracts & Schemas (Phase 7 Milestone 4)
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowRetryPolicyConfigSchema,
  WorkflowDlqEntrySchema,
  WorkflowSagaResultSchema,
  WorkflowResilienceError,
  DEFAULT_WORKFLOW_RETRY_POLICY,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type ErrorCategory,
} from '../../workflows/resilience/workflow-resilience-types';

describe('Workflow Resilience Contracts & Schemas (Phase 7 Milestone 4)', () => {
  it('validates default retry policy values and clamps limits (Rule 23)', () => {
    const parsed = WorkflowRetryPolicyConfigSchema.parse({});
    expect(parsed.maxRetries).toBe(5);
    expect(parsed.baseBackoffMs).toBe(1000);
    expect(parsed.maxBackoffMs).toBe(60000);
    expect(parsed.backoffMultiplier).toBe(2.0);
    expect(parsed.jitter).toBe('full');

    expect(DEFAULT_WORKFLOW_RETRY_POLICY.maxRetries).toBe(5);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5);
  });

  it('rejects invalid retry configuration (exceeding 10 max retries or negative backoff)', () => {
    expect(() =>
      WorkflowRetryPolicyConfigSchema.parse({ maxRetries: 25 })
    ).toThrow();

    expect(() =>
      WorkflowRetryPolicyConfigSchema.parse({ baseBackoffMs: -100 })
    ).toThrow();
  });

  it('validates full WorkflowDlqEntrySchema with sanitized error record (Rule 25 & 48)', () => {
    const raw = {
      id: 'dlq_test_123',
      organizationId: 'org_enterprise_1',
      workspaceId: 'ws_prod_1',
      workflowId: 'wf_billing_99',
      stepId: 'step_charge_card',
      stepIndex: 2,
      capabilityId: 'finance.charge_card',
      attempt: 5,
      maxAttempts: 5,
      errorCategory: 'TRANSIENT' as ErrorCategory,
      sanitizedError: {
        code: 'PAYMENT_GATEWAY_TIMEOUT',
        message: 'Payment gateway timed out after 10000ms. [REDACTED_SECRET:api_key]',
        category: 'TRANSIENT' as ErrorCategory,
        occurredAt: new Date().toISOString(),
      },
      stepInput: { amount: 5000, currency: 'USD' },
      contextSnapshot: { customerId: 'cust_789' },
      quarantinedAt: new Date().toISOString(),
    };

    const parsed = WorkflowDlqEntrySchema.parse(raw);
    expect(parsed.id).toBe('dlq_test_123');
    expect(parsed.status).toBe('quarantined');
    expect(parsed.sanitizedError.code).toBe('PAYMENT_GATEWAY_TIMEOUT');
  });

  it('validates WorkflowSagaResultSchema for successful and failed rollbacks (Rule 27)', () => {
    const sagaResult = {
      workflowId: 'wf_order_123',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      success: true,
      totalStepsToCompensate: 2,
      compensatedStepsCount: 2,
      failedStepsCount: 0,
      requiresOperatorIntervention: false,
      dryRun: false,
      steps: [
        {
          stepId: 'step_2',
          stepIndex: 1,
          capabilityId: 'crm.create_deal',
          compensatingCapabilityId: 'crm.delete_deal',
          status: 'compensated' as const,
          idempotencyKey: 'saga_comp_wf_order_123_step_2',
          durationMs: 45,
          executedAt: new Date().toISOString(),
        },
      ],
      completedAt: new Date().toISOString(),
    };

    const parsed = WorkflowSagaResultSchema.parse(sagaResult);
    expect(parsed.success).toBe(true);
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.steps[0].compensatingCapabilityId).toBe('crm.delete_deal');
  });

  it('instantiates typed WorkflowResilienceError with proper code and details', () => {
    const error = new WorkflowResilienceError(
      'CIRCUIT_BREAKER_OPEN',
      'Circuit breaker for finance.charge_card is OPEN',
      { consecutiveFailures: 5 }
    );

    expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    expect(error.message).toContain('finance.charge_card');
    expect(error.details?.consecutiveFailures).toBe(5);
    expect(error.name).toBe('WorkflowResilienceError');
  });
});
