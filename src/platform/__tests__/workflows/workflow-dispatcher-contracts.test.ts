/**
 * @fileOverview Unit tests for Dispatcher, Lease, Recovery & Replay Contracts (Phase 7 Milestone 2)
 */

import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_WORKER_QUEUE,
  WORKFLOW_STEP_ENDPOINT,
  WorkflowTaskPayloadSchema,
  DISPATCH_ERROR_CODES,
  WorkflowDispatchError,
} from '../../workflows/dispatcher/workflow-dispatcher-types';
import {
  DEFAULT_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
  WorkflowLeaseSchema,
  ReplayVerificationResultSchema,
  ZombieReapResultSchema,
  StepExecutionResultSchema,
  LEASE_ERROR_CODES,
  WorkflowLeaseError,
  REPLAY_ERROR_CODES,
  WorkflowReplayError,
  RECOVERY_ERROR_CODES,
  WorkflowRecoveryError,
  EXECUTION_PIPELINE_ERROR_CODES,
  WorkflowExecutionError,
} from '../../workflows/execution/workflow-execution-types';

describe('Workflow Dispatcher & Execution Contracts', () => {
  describe('Constants & Endpoint Routing', () => {
    it('defines expected queue and endpoint names', () => {
      expect(WORKFLOW_WORKER_QUEUE).toBe('workflow-worker-queue');
      expect(WORKFLOW_STEP_ENDPOINT).toBe('/api/tasks/workflow-step');
      expect(DEFAULT_LEASE_TTL_MS).toBe(120_000);
      expect(MAX_LEASE_TTL_MS).toBe(300_000);
    });
  });

  describe('WorkflowTaskPayloadSchema', () => {
    it('validates a valid task payload and applies defaults', () => {
      const valid = {
        workflowId: 'wf_001',
        stepId: 'step_001',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        idempotencyKey: 'idem_001',
        correlationId: 'corr_001',
      };

      const parsed = WorkflowTaskPayloadSchema.parse(valid);
      expect(parsed.workflowId).toBe('wf_001');
      expect(parsed.stepId).toBe('step_001');
      expect(parsed.attempt).toBe(0); // default applied
      expect(parsed.correlationId).toBe('corr_001');
    });

    it('rejects payloads missing required tenant or routing fields', () => {
      const missingTenant = {
        workflowId: 'wf_001',
        stepId: 'step_001',
        idempotencyKey: 'idem_001',
        correlationId: 'corr_001',
      };
      expect(WorkflowTaskPayloadSchema.safeParse(missingTenant).success).toBe(false);

      const missingStep = {
        workflowId: 'wf_001',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        idempotencyKey: 'idem_001',
        correlationId: 'corr_001',
      };
      expect(WorkflowTaskPayloadSchema.safeParse(missingStep).success).toBe(false);
    });
  });

  describe('WorkflowLeaseSchema', () => {
    it('validates a valid lease with ISO timestamps', () => {
      const validLease = {
        workflowId: 'wf_001',
        stepId: 'step_001',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        workerId: 'worker_cloudrun_001',
        leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        acquiredAt: new Date().toISOString(),
      };

      const parsed = WorkflowLeaseSchema.parse(validLease);
      expect(parsed.workerId).toBe('worker_cloudrun_001');
      expect(parsed.leaseVersion).toBe(1); // default applied
    });

    it('rejects invalid non-datetime strings in leaseExpiresAt', () => {
      const invalidLease = {
        workflowId: 'wf_001',
        stepId: 'step_001',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        workerId: 'worker_cloudrun_001',
        leaseExpiresAt: 'not-a-datetime',
        acquiredAt: new Date().toISOString(),
      };
      expect(WorkflowLeaseSchema.safeParse(invalidLease).success).toBe(false);
    });
  });

  describe('ReplayVerificationResultSchema & ZombieReapResultSchema', () => {
    it('validates a valid replay result', () => {
      const replayResult = {
        workflowId: 'wf_001',
        isValid: true,
        totalCheckpoints: 5,
        verifiedCheckpoints: 5,
        lastVerifiedSequence: 4,
      };
      expect(ReplayVerificationResultSchema.safeParse(replayResult).success).toBe(true);
    });

    it('validates a valid zombie reap result', () => {
      const reapResult = {
        scannedSteps: 3,
        recoveredSteps: ['step_001'],
        failedSteps: ['step_002'],
        errors: [],
      };
      expect(ZombieReapResultSchema.safeParse(reapResult).success).toBe(true);
    });

    it('validates StepExecutionResultSchema', () => {
      const stepResult = {
        stepId: 'step_001',
        status: 'COMPLETED',
        output: { enriched: true },
        durationMs: 250,
        nextStepsScheduled: ['step_002'],
      };
      const parsed = StepExecutionResultSchema.parse(stepResult);
      expect(parsed.status).toBe('COMPLETED');
      expect(parsed.retryScheduled).toBe(false);
    });
  });

  describe('Error Taxonomies', () => {
    it('instantiates and formats WorkflowDispatchError', () => {
      expect(DISPATCH_ERROR_CODES).toContain('DISPATCH_FAILED');
      const err = new WorkflowDispatchError('DISPATCH_FAILED', 'Failed to dispatch Cloud Task');
      expect(err.name).toBe('WorkflowDispatchError');
      expect(err.code).toBe('DISPATCH_FAILED');
    });

    it('instantiates and formats WorkflowLeaseError', () => {
      expect(LEASE_ERROR_CODES).toContain('LEASE_ALREADY_ACQUIRED');
      const err = new WorkflowLeaseError('LEASE_ALREADY_ACQUIRED', 'Step is currently locked');
      expect(err.name).toBe('WorkflowLeaseError');
      expect(err.code).toBe('LEASE_ALREADY_ACQUIRED');
    });

    it('instantiates and formats WorkflowReplayError', () => {
      expect(REPLAY_ERROR_CODES).toContain('HASH_CHAIN_BROKEN');
      const err = new WorkflowReplayError('HASH_CHAIN_BROKEN', 'Hash mismatch at sequence 3');
      expect(err.name).toBe('WorkflowReplayError');
      expect(err.code).toBe('HASH_CHAIN_BROKEN');
    });

    it('instantiates and formats WorkflowRecoveryError', () => {
      expect(RECOVERY_ERROR_CODES).toContain('RECOVERY_FAILED');
      const err = new WorkflowRecoveryError('RECOVERY_FAILED', 'Failed to recover zombie step');
      expect(err.name).toBe('WorkflowRecoveryError');
      expect(err.code).toBe('RECOVERY_FAILED');
    });

    it('instantiates and formats WorkflowExecutionError', () => {
      expect(EXECUTION_PIPELINE_ERROR_CODES).toContain('FINGERPRINT_DRIFT_DETECTED');
      const err = new WorkflowExecutionError('FINGERPRINT_DRIFT_DETECTED', 'Capability changed');
      expect(err.name).toBe('WorkflowExecutionError');
      expect(err.code).toBe('FINGERPRINT_DRIFT_DETECTED');
    });
  });
});
