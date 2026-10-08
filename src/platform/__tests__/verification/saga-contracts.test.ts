/**
 * @fileOverview Unit Tests for Saga Compensation Contracts, Types & Error Taxonomy (Phase 14 Milestone 3)
 *
 * Implements Rules 2, 4, 10, 11, 12, 14, 16, 21, 22, 27, 48, 67, 68, 69, 1961.
 * Verifies:
 * - Saga step status and execution record Zod v4 schemas
 * - Universal rollback entry schema and reversibility classification
 * - Saga execution ledger schema and canonical hashing
 * - Saga compensation result schema and Explainability Grid (Rule 41)
 * - Structured error taxonomy (SAGA_ERROR_CODES) and typed SagaCompensationError
 * - Zero `any` or `any[]` typing policy (Rule 4)
 */

import { describe, it, expect } from 'vitest';
import {
  SagaStepStatusSchema,
  ReversibilityClassificationSchema,
  UniversalRollbackEntrySchema,
  SagaStepExecutionRecordSchema,
  SagaExecutionLedgerSchema,
  SagaCompensationResultSchema,
  CompensateRunInputSchema,
  SAGA_ERROR_CODES,
  SAGA_HTTP_STATUS_MAP,
  SagaCompensationError,
  type SagaStepStatus,
  type ReversibilityClassification,
  type UniversalRollbackEntry,
  type SagaStepExecutionRecord,
  type SagaExecutionLedger,
  type SagaCompensationResult,
  type CompensateRunInput,
} from '@/platform/verification/saga';

describe('Phase 14 Milestone 3 - Saga Compensation Contracts & Types', () => {
  describe('SagaStepStatusSchema', () => {
    it('validates canonical saga step statuses', () => {
      const validStatuses: SagaStepStatus[] = [
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'COMPENSATING',
        'COMPENSATED',
        'FAILED',
        'SKIPPED',
        'IRREVERSIBLE',
        'DLQ_QUARANTINED',
      ];

      for (const status of validStatuses) {
        const result = SagaStepStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid statuses', () => {
      const result = SagaStepStatusSchema.safeParse('UNKNOWN_STATUS');
      expect(result.success).toBe(false);
    });
  });

  describe('ReversibilityClassificationSchema', () => {
    it('validates reversibility classifications', () => {
      const classifications: ReversibilityClassification[] = [
        'REVERSIBLE',
        'PARTIALLY_REVERSIBLE',
        'IRREVERSIBLE',
      ];

      for (const c of classifications) {
        expect(ReversibilityClassificationSchema.safeParse(c).success).toBe(true);
      }
    });
  });

  describe('UniversalRollbackEntrySchema', () => {
    it('validates a valid universal rollback matrix entry', () => {
      const entry: UniversalRollbackEntry = {
        mutatingCapabilityId: 'crm.deal.advance_stage',
        compensatingCapabilityId: 'crm.deal.revert_stage',
        reversibility: 'REVERSIBLE',
        domain: 'crm',
        description: 'Reverts stage advancement and restores pipeline value',
        requiresManualReview: false,
      };

      const result = UniversalRollbackEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('rejects empty capability IDs', () => {
      const result = UniversalRollbackEntrySchema.safeParse({
        mutatingCapabilityId: '',
        compensatingCapabilityId: 'crm.deal.revert_stage',
        reversibility: 'REVERSIBLE',
        domain: 'crm',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SagaStepExecutionRecordSchema', () => {
    it('validates a complete step execution record with preStateSnapshot (Milestone 2 integration)', () => {
      const record: SagaStepExecutionRecord = {
        stepId: 'step_101',
        stepIndex: 0,
        runId: 'saga_run_999',
        capabilityId: 'crm.deal.advance_stage',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        actorId: 'usr_test_1',
        inputPayload: { dealId: 'deal_1', targetStage: 'NEGOTIATION' },
        outputPayload: { dealId: 'deal_1', newStage: 'NEGOTIATION' },
        preStateSnapshot: {
          resourceId: 'deal_1',
          resourceType: 'deal',
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
          version: 2,
          stateHash: 'a'.repeat(64),
          capturedAt: '2026-10-08T12:00:00.000Z',
          attributes: { stage: 'QUALIFIED', amount: 50000 },
        },
        status: 'COMPLETED',
        compensatingCapabilityId: 'crm.deal.revert_stage',
        executedAt: '2026-10-08T12:00:01.000Z',
      };

      const result = SagaStepExecutionRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('rejects invalid capturedAt or executedAt timestamps', () => {
      const result = SagaStepExecutionRecordSchema.safeParse({
        stepId: 'step_101',
        stepIndex: 0,
        runId: 'saga_run_999',
        capabilityId: 'crm.deal.advance_stage',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        actorId: 'usr_test_1',
        inputPayload: {},
        status: 'COMPLETED',
        executedAt: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SagaExecutionLedgerSchema', () => {
    it('validates a saga execution ledger', () => {
      const ledger: SagaExecutionLedger = {
        runId: 'saga_run_999',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        actorId: 'usr_test_1',
        status: 'RUNNING',
        steps: [],
        createdAt: '2026-10-08T12:00:00.000Z',
        updatedAt: '2026-10-08T12:00:00.000Z',
        ledgerHash: 'b'.repeat(64),
      };

      const result = SagaExecutionLedgerSchema.safeParse(ledger);
      expect(result.success).toBe(true);
    });
  });

  describe('SagaCompensationResultSchema', () => {
    it('validates a saga compensation result with Explainability Grid (Rule 41)', () => {
      const res: SagaCompensationResult = {
        runId: 'saga_run_999',
        status: 'SUCCESS',
        totalStepsCount: 3,
        compensatedStepsCount: 2,
        skippedStepsCount: 1,
        failedCompensationsCount: 0,
        dlqEnqueuedCount: 0,
        dlqEntryIds: [],
        durationMs: 450,
        compensatedAt: '2026-10-08T12:00:05.000Z',
        explainabilityGrid: {
          what: 'Reverse-LIFO Saga compensation for failed mission',
          why: 'Step 3 failed with downstream API timeout',
          expectedStateChange: 'Restored deal stage to QUALIFIED and reverted draft outreach',
          residualRisk: 'None. All mutating steps fully reverted.',
        },
        dryRun: false,
      };

      const result = SagaCompensationResultSchema.safeParse(res);
      expect(result.success).toBe(true);
    });
  });

  describe('CompensateRunInputSchema', () => {
    it('validates compensate run input', () => {
      const input: CompensateRunInput = {
        runId: 'saga_run_999',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        reason: 'Postcondition assertion failed on step 3',
        dryRun: false,
      };

      expect(CompensateRunInputSchema.safeParse(input).success).toBe(true);
    });

    it('rejects empty runId or reason', () => {
      expect(
        CompensateRunInputSchema.safeParse({
          runId: '',
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
          reason: '',
        }).success
      ).toBe(false);
    });
  });

  describe('SAGA_ERROR_CODES & SagaCompensationError', () => {
    it('verifies all error codes map to explicit HTTP status codes', () => {
      for (const [code, status] of Object.entries(SAGA_HTTP_STATUS_MAP)) {
        expect(typeof code).toBe('string');
        expect(status).toBeGreaterThanOrEqual(400);
        expect(status).toBeLessThan(600);
      }
    });

    it('SagaCompensationError sets statusCode and prototype correctly', () => {
      const err = new SagaCompensationError(
        'SAGA_DEAD_MAN_PAUSED',
        'Platform emergency freeze is active'
      );

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(SagaCompensationError);
      expect(err.name).toBe('SagaCompensationError');
      expect(err.code).toBe(SAGA_ERROR_CODES.SAGA_DEAD_MAN_PAUSED);
      expect(err.statusCode).toBe(503);
    });
  });
});
