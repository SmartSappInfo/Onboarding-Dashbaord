/**
 * @fileOverview Unit tests for Workflow Contracts, Schemas & Error Taxonomy (Phase 7 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_STATES,
  WorkflowStateSchema,
  WAIT_CONDITION_TYPES,
  WaitConditionTypeSchema,
  WaitConditionSchema,
  WORKFLOW_STEP_STATUSES,
  WorkflowStepStatusSchema,
  WorkflowBudgetsSchema,
  WorkflowStepSchema,
  WorkflowCheckpointSchema,
  WorkflowInstanceSchema,
  WORKFLOW_ERROR_CODES,
  WorkflowError,
  mapWorkflowErrorToHttpStatus,
} from '../../workflows/workflow-types';

describe('Workflow Contracts & Schemas', () => {
  describe('WorkflowStateSchema', () => {
    it('accepts all 10 valid states', () => {
      const expectedStates = [
        'CREATED',
        'QUEUED',
        'RUNNING',
        'WAITING',
        'RESUMED',
        'VERIFYING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'TIMED_OUT',
      ];
      expect(WORKFLOW_STATES).toEqual(expectedStates);

      for (const state of expectedStates) {
        const parsed = WorkflowStateSchema.safeParse(state);
        expect(parsed.success).toBe(true);
      }
    });

    it('rejects invalid state strings', () => {
      expect(WorkflowStateSchema.safeParse('UNKNOWN').success).toBe(false);
      expect(WorkflowStateSchema.safeParse('pending').success).toBe(false);
      expect(WorkflowStateSchema.safeParse('').success).toBe(false);
    });
  });

  describe('WaitConditionSchema', () => {
    it('accepts all 5 wait condition types', () => {
      const expectedTypes = ['approval', 'webhook', 'schedule', 'human_input', 'external_system'];
      expect(WAIT_CONDITION_TYPES).toEqual(expectedTypes);

      for (const t of expectedTypes) {
        const parsed = WaitConditionTypeSchema.safeParse(t);
        expect(parsed.success).toBe(true);
      }
    });

    it('parses valid wait conditions with default details', () => {
      const parsed = WaitConditionSchema.parse({
        type: 'approval',
        token: 'token_123',
        expiresAt: '2026-10-10T00:00:00.000Z',
      });
      expect(parsed.type).toBe('approval');
      expect(parsed.token).toBe('token_123');
      expect(parsed.details).toEqual({});
    });

    it('rejects invalid wait condition types', () => {
      expect(WaitConditionSchema.safeParse({ type: 'invalid_type' }).success).toBe(false);
    });
  });

  describe('WorkflowStepSchema', () => {
    it('parses a valid workflow step with defaults', () => {
      const validStep = {
        id: 'step_enrich',
        workflowId: 'wf_123',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        stepIndex: 0,
        capabilityId: 'crm.enrich_contact',
        name: 'Enrich Contact Info',
        status: 'PENDING',
        idempotencyKey: 'idem_wf123_step0',
      };

      const parsed = WorkflowStepSchema.parse(validStep);
      expect(parsed.status).toBe('PENDING');
      expect(parsed.attempt).toBe(0);
      expect(parsed.maxAttempts).toBe(3);
      expect(parsed.isMutating).toBe(false);
      expect(parsed.compensationStatus).toBe('none');
      expect(parsed.dependsOn).toEqual([]);
      expect(parsed.input).toEqual({});
    });

    it('accepts step with compensation and risk metadata', () => {
      const mutatingStep = {
        id: 'step_create_deal',
        workflowId: 'wf_123',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        stepIndex: 1,
        capabilityId: 'deals.create',
        name: 'Create Opportunity Deal',
        status: 'RUNNING',
        idempotencyKey: 'idem_wf123_step1',
        isMutating: true,
        compensatingCapabilityId: 'deals.delete',
        riskLevel: 'L2_STATE_MUTATION',
        isNonDelegable: false,
        attempt: 1,
        maxAttempts: 5,
        startedAt: '2026-10-03T12:00:00.000Z',
      };

      const parsed = WorkflowStepSchema.parse(mutatingStep);
      expect(parsed.isMutating).toBe(true);
      expect(parsed.compensatingCapabilityId).toBe('deals.delete');
      expect(parsed.riskLevel).toBe('L2_STATE_MUTATION');
    });

    it('rejects step without mandatory tenant boundaries', () => {
      const invalid = {
        id: 'step_1',
        workflowId: 'wf_123',
        stepIndex: 0,
        capabilityId: 'crm.enrich',
        name: 'Step 1',
        status: 'PENDING',
        idempotencyKey: 'idem_1',
      };
      expect(WorkflowStepSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('WorkflowCheckpointSchema', () => {
    it('validates 64-character SHA-256 hash formatting', () => {
      const validHash = 'a'.repeat(64);
      const validPrevHash = 'b'.repeat(64);

      const parsed = WorkflowCheckpointSchema.parse({
        id: 'chk_1',
        workflowId: 'wf_123',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        checkpointSequence: 1,
        fromState: 'CREATED',
        toState: 'QUEUED',
        hash: validHash,
        previousHash: validPrevHash,
        timestamp: '2026-10-03T12:00:00.000Z',
      });

      expect(parsed.hash).toBe(validHash);
      expect(parsed.previousHash).toBe(validPrevHash);
      expect(parsed.checkpointSequence).toBe(1);
    });

    it('rejects invalid hash lengths', () => {
      const shortHash = 'abc123';
      expect(
        WorkflowCheckpointSchema.safeParse({
          id: 'chk_1',
          workflowId: 'wf_123',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          checkpointSequence: 1,
          fromState: 'CREATED',
          toState: 'QUEUED',
          hash: shortHash,
          timestamp: '2026-10-03T12:00:00.000Z',
        }).success
      ).toBe(false);
    });
  });

  describe('WorkflowInstanceSchema', () => {
    it('parses valid workflow instance with initiator and principal', () => {
      const validInstance = {
        id: 'wf_inst_001',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        definitionId: 'lead_onboarding',
        definitionVersion: '1.0.0',
        title: 'Lead Onboarding for Acme Corp',
        status: 'CREATED',
        initiator: {
          actorType: 'user',
          actorId: 'user_456',
        },
        principal: {
          actorType: 'agent',
          userId: 'user_456',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          grantedScopes: ['crm.read', 'crm.write'],
          effectiveRole: 'admin',
        },
        correlationId: 'corr_test_001',
        idempotencyKey: 'idem_inst_001',
        budgets: {
          maxTotalDurationMs: 86_400_000,
          maxSteps: 20,
          maxRetries: 3,
        },
        createdAt: '2026-10-03T12:00:00.000Z',
        updatedAt: '2026-10-03T12:00:00.000Z',
      };

      const parsed = WorkflowInstanceSchema.parse(validInstance);
      expect(parsed.status).toBe('CREATED');
      expect(parsed.dryRun).toBe(false);
      expect(parsed.stepCounts.total).toBe(0);
      expect(parsed.budgets.maxSteps).toBe(20);
    });

    it('rejects instance with missing tenant boundaries', () => {
      const invalid = {
        id: 'wf_inst_001',
        definitionId: 'lead_onboarding',
        title: 'Lead Onboarding',
        status: 'CREATED',
      };
      expect(WorkflowInstanceSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('WorkflowError Taxonomy', () => {
    it('creates WorkflowError with correct code and message', () => {
      const err = new WorkflowError('WORKFLOW_NOT_FOUND', 'Workflow wf_999 does not exist');
      expect(err.name).toBe('WorkflowError');
      expect(err.code).toBe('WORKFLOW_NOT_FOUND');
      expect(err.message).toBe('Workflow wf_999 does not exist');
      expect(mapWorkflowErrorToHttpStatus(err.code)).toBe(404);
    });

    it('maps all error codes to appropriate HTTP statuses', () => {
      expect(mapWorkflowErrorToHttpStatus('TENANT_SCOPE_VIOLATION')).toBe(403);
      expect(mapWorkflowErrorToHttpStatus('INVALID_TRANSITION')).toBe(400);
      expect(mapWorkflowErrorToHttpStatus('TERMINAL_STATE_IMMUTABLE')).toBe(409);
      expect(mapWorkflowErrorToHttpStatus('IDEMPOTENCY_CONFLICT')).toBe(409);
      expect(mapWorkflowErrorToHttpStatus('TOKEN_EXPIRED')).toBe(410);
      expect(mapWorkflowErrorToHttpStatus('TOKEN_INVALID')).toBe(401);
      expect(mapWorkflowErrorToHttpStatus('BUDGET_EXCEEDED')).toBe(429);
      expect(mapWorkflowErrorToHttpStatus('DEAD_MAN_PAUSED')).toBe(503);
      expect(mapWorkflowErrorToHttpStatus('CIRCUIT_BREAKER_OPEN')).toBe(503);
      expect(WORKFLOW_ERROR_CODES.length).toBeGreaterThan(10);
    });

    it('validates WorkflowStepStatusSchema and WorkflowBudgetsSchema', () => {
      expect(WORKFLOW_STEP_STATUSES).toContain('COMPLETED');
      expect(WorkflowStepStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
      const defaultBudgets = WorkflowBudgetsSchema.parse({});
      expect(defaultBudgets.maxSteps).toBe(50);
      expect(defaultBudgets.maxRetries).toBe(5);
    });
  });
});
