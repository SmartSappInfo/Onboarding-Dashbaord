/**
 * @fileOverview Unit Tests for Execution Contracts, Schemas & Error Taxonomy (Rules 4, 13, 21, 22, 30, 31, 48)
 */

import { describe, it, expect } from 'vitest';
import {
  StepValidationResultSchema,
  StepVerificationResultSchema,
  ApprovalInterceptionResultSchema,
  ExecutionLoopOptionsSchema,
  EXECUTION_ERROR_CODES,
  ExecutionError,
} from '@/platform/runtime/execution/execution-types';

describe('Execution Contracts & Schemas (Rules 4, 13, 21, 22, 30, 31, 48)', () => {
  it('validates StepValidationResultSchema for success and failure', () => {
    const successResult = StepValidationResultSchema.safeParse({
      valid: true,
      validatedOutput: { contactId: 'con_123', status: 'created' },
      isolatedXmlOutput: '<untrusted_reference_data id="step_output_step_1">{"contactId":"con_123"}</untrusted_reference_data>',
      tokensUsed: 45,
    });
    expect(successResult.success).toBe(true);

    const failureResult = StepValidationResultSchema.safeParse({
      valid: false,
      sanitizedError: {
        code: 'SCHEMA_VALIDATION_FAILED',
        message: 'Required field "email" is missing.',
      },
      validationErrors: ['email is required'],
      isolatedXmlOutput: '<untrusted_reference_data id="step_output_step_1">ERROR: email is required</untrusted_reference_data>',
      tokensUsed: 15,
    });
    expect(failureResult.success).toBe(true);
  });

  it('validates StepVerificationResultSchema with state assertions', () => {
    const verified = StepVerificationResultSchema.safeParse({
      verified: true,
      assertionDetails: 'Entity con_123 verified created with status active',
      observedState: { exists: true, status: 'active' },
    });
    expect(verified.success).toBe(true);

    const failed = StepVerificationResultSchema.safeParse({
      verified: false,
      rejectionReason: 'Expected status "active", observed "pending"',
      observedState: { exists: true, status: 'pending' },
      suggestedRemediation: 'Trigger status activation step',
    });
    expect(failed.success).toBe(true);
  });

  it('validates ApprovalInterceptionResultSchema', () => {
    const intercepted = ApprovalInterceptionResultSchema.safeParse({
      requiresApproval: true,
      actionProposalId: 'prop_abc123',
      payloadHash: 'a'.repeat(64),
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      reason: 'Outbound communication requires human operator approval',
    });
    expect(intercepted.success).toBe(true);

    const allowed = ApprovalInterceptionResultSchema.safeParse({
      requiresApproval: false,
    });
    expect(allowed.success).toBe(true);
  });

  it('validates ExecutionLoopOptionsSchema defaults', () => {
    const opts = ExecutionLoopOptionsSchema.safeParse({});
    expect(opts.success).toBe(true);
    if (opts.success) {
      expect(opts.data.dryRun).toBe(false);
      expect(opts.data.maxReplans).toBe(3);
      expect(opts.data.verifyPostConditions).toBe(true);
    }
  });

  it('throws ExecutionError with structured taxonomy', () => {
    const err = new ExecutionError({
      code: 'VERIFICATION_FAILED',
      message: 'Post-condition failed: contact was not activated',
      runId: 'run_123',
      stepId: 'step_1',
      organizationId: 'org_acme',
    });
    expect(err.code).toBe('VERIFICATION_FAILED');
    expect(EXECUTION_ERROR_CODES).toContain('VERIFICATION_FAILED');
    expect(EXECUTION_ERROR_CODES).toContain('APPROVAL_REQUIRED');
    expect(EXECUTION_ERROR_CODES).toContain('PAYLOAD_TAMPERED');
  });
});
