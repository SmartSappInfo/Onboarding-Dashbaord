/**
 * @fileOverview Unit & Integration Tests for Universal Saga Compensation Engine (Phase 14 Milestone 3)
 *
 * Implements Rules 2, 4, 8, 10, 11, 12, 16, 17, 18, 19, 21, 22, 25, 26, 27, 40, 41, 42, 47, 48, 50, 60, 67, 68, 69, 1961.
 * Verifies:
 * - Recording steps in append-only execution ledger
 * - Reverse-LIFO execution ordering (Step 3 -> Step 2 -> Step 1)
 * - Injection of preStateSnapshot attributes into compensating payload (Milestone 2 integration)
 * - Anti-IDOR cross-tenant access rejection (Rules 8 & 47)
 * - Dead-man switch emergency freeze evaluation (Rule 60)
 * - Irreversible step automatic DLQ quarantine (Rule 25)
 * - Downstream compensation failure DLQ quarantine (Rule 25)
 * - Shadow Mode dry-run simulation (Rule 42)
 * - Cooperative cancellation via AbortSignal (Rule 26)
 * - Global singleton preservation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SagaCompensationService,
  getSagaCompensationService,
  SagaCompensationError,
  type SagaStepExecutionRecord,
} from '@/platform/verification/saga';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 14 Milestone 3 - Universal Saga Compensation Engine', () => {
  let service: SagaCompensationService;
  const orgId = 'org_test_1';
  const wsId = 'ws_test_1';
  const actorId = 'usr_operator_1';

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    service = new SagaCompensationService();
    vi.restoreAllMocks();
  });

  describe('Ledger Recording & Retrieval', () => {
    it('records steps and retrieves execution ledger', async () => {
      const runId = 'saga_run_101';

      const step1 = await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.deal.advance_stage',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { dealId: 'deal_1', targetStage: 'PROPOSAL' },
        outputPayload: { dealId: 'deal_1', newStage: 'PROPOSAL' },
        preStateSnapshot: {
          resourceId: 'deal_1',
          resourceType: 'deal',
          organizationId: orgId,
          workspaceId: wsId,
          version: 1,
          stateHash: '1'.repeat(64),
          capturedAt: '2026-10-08T12:00:00.000Z',
          attributes: { stage: 'QUALIFIED', amount: 50000 },
        },
      });

      expect(step1.stepId).toBeDefined();
      expect(step1.status).toBe('COMPLETED');
      expect(step1.compensatingCapabilityId).toBe('crm.deal.revert_stage');

      const ledger = await service.getLedger(runId, { organizationId: orgId, workspaceId: wsId });
      expect(ledger.runId).toBe(runId);
      expect(ledger.steps.length).toBe(1);
      expect(ledger.steps[0].capabilityId).toBe('crm.deal.advance_stage');
    });

    it('enforces Anti-IDOR: rejects cross-tenant ledger lookups (Rules 8 & 47)', async () => {
      const runId = 'saga_run_idor';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.task.create',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { title: 'Followup' },
      });

      await expect(
        service.getLedger(runId, { organizationId: 'org_attacker', workspaceId: wsId })
      ).rejects.toThrow(SagaCompensationError);

      await expect(
        service.getLedger(runId, { organizationId: 'org_attacker', workspaceId: wsId })
      ).rejects.toMatchObject({
        code: 'IDOR_VIOLATION',
        statusCode: 403,
      });
    });
  });

  describe('Reverse-LIFO Compensation Execution (Rule 27)', () => {
    it('compensates completed multi-step workflow in strict Reverse-LIFO order', async () => {
      const runId = 'saga_run_reverse_lifo';
      const executionOrder: string[] = [];

      // Mock event publishing to track execution order
      vi.spyOn(defaultEventBus, 'publish').mockImplementation(async (event) => {
        if (event.type === 'saga.step.compensated') {
          const payload = event.payload as { capabilityId: string };
          executionOrder.push(payload.capabilityId);
        }
      });

      // Step 0: crm.entity.update
      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.entity.update',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { entityId: 'ent_1', name: 'New Name' },
        preStateSnapshot: {
          resourceId: 'ent_1',
          resourceType: 'crm_entity',
          organizationId: orgId,
          workspaceId: wsId,
          version: 1,
          stateHash: 'a'.repeat(64),
          capturedAt: '2026-10-08T12:00:00.000Z',
          attributes: { name: 'Old Name' },
        },
      });

      // Step 1: crm.deal.advance_stage
      await service.recordStep({
        runId,
        stepIndex: 1,
        capabilityId: 'crm.deal.advance_stage',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { dealId: 'deal_1', targetStage: 'NEGOTIATION' },
        preStateSnapshot: {
          resourceId: 'deal_1',
          resourceType: 'deal',
          organizationId: orgId,
          workspaceId: wsId,
          version: 2,
          stateHash: 'b'.repeat(64),
          capturedAt: '2026-10-08T12:00:01.000Z',
          attributes: { stage: 'QUALIFIED' },
        },
      });

      // Step 2: crm.task.create
      await service.recordStep({
        runId,
        stepIndex: 2,
        capabilityId: 'crm.task.create',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { taskId: 'task_100', title: 'Prepare Contract' },
      });

      // Execute compensation
      const result = await service.compensateRun({
        runId,
        organizationId: orgId,
        workspaceId: wsId,
        reason: 'Downstream billing contract generation timed out',
        dryRun: false,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.totalStepsCount).toBe(3);
      expect(result.compensatedStepsCount).toBe(3);
      expect(result.failedCompensationsCount).toBe(0);

      // Verify Reverse-LIFO order: Step 2 (crm.task.create -> crm.task.delete) -> Step 1 (crm.deal.advance_stage -> crm.deal.revert_stage) -> Step 0 (crm.entity.update -> crm.entity.update)
      expect(executionOrder).toEqual([
        'crm.task.create',
        'crm.deal.advance_stage',
        'crm.entity.update',
      ]);
    });

    it('injects preStateSnapshot attributes into compensating payload (Milestone 2 integration)', async () => {
      const runId = 'saga_run_snapshot_inject';
      let recordedCompensatingPayload: Record<string, unknown> | undefined;

      vi.spyOn(defaultEventBus, 'publish').mockImplementation(async (event) => {
        if (event.type === 'saga.step.compensated') {
          const payload = event.payload as { compensatingPayload: Record<string, unknown> };
          recordedCompensatingPayload = payload.compensatingPayload;
        }
      });

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.deal.advance_stage',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { dealId: 'deal_99', targetStage: 'WON', amount: 150000 },
        preStateSnapshot: {
          resourceId: 'deal_99',
          resourceType: 'deal',
          organizationId: orgId,
          workspaceId: wsId,
          version: 4,
          stateHash: '9'.repeat(64),
          capturedAt: '2026-10-08T12:00:00.000Z',
          attributes: { stage: 'NEGOTIATION', amount: 120000 },
        },
      });

      await service.compensateRun({
        runId,
        organizationId: orgId,
        workspaceId: wsId,
        reason: 'Postcondition assertion verification failed',
      });

      expect(recordedCompensatingPayload).toBeDefined();
      expect(recordedCompensatingPayload?.dealId).toBe('deal_99');
      expect(recordedCompensatingPayload?.isRollback).toBe(true);
      expect(recordedCompensatingPayload?.previousAttributes).toEqual({
        stage: 'NEGOTIATION',
        amount: 120000,
      });
    });
  });

  describe('DLQ Bridge & Quarantine (Rule 25)', () => {
    it('quarantines irreversible steps directly into DLQ', async () => {
      const runId = 'saga_run_irreversible';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'sdr.dispatch_email', // PARTIALLY_REVERSIBLE, requiresManualReview: true
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { recipient: 'ceo@enterprise.com', messageId: 'msg_1' },
      });

      const result = await service.compensateRun({
        runId,
        organizationId: orgId,
        workspaceId: wsId,
        reason: 'Workflow cancelled by user',
      });

      expect(result.dlqEnqueuedCount).toBe(1);
      expect(result.dlqEntryIds.length).toBe(1);
      expect(result.dlqEntryIds[0]).toMatch(/^dlq_/);
      expect(result.explainabilityGrid.residualRisk).toContain('DLQ');
    });

    it('quarantines failing compensating capability into DLQ and continues remaining steps', async () => {
      const runId = 'saga_run_comp_failure';

      // Step 0: Will succeed compensation
      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.task.create',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { taskId: 'task_0' },
      });

      // Step 1: Force failure during compensation by registering a failing mock handler
      const failingStep = await service.recordStep({
        runId,
        stepIndex: 1,
        capabilityId: 'reconciliation.resolve_exception',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { exceptionId: 'exc_fail' },
      });

      // Inject custom failing step compensation runner
      vi.spyOn(service as any, 'executeCompensatingCapability').mockImplementation(
        async (step: SagaStepExecutionRecord) => {
          if (step.stepId === failingStep.stepId) {
            throw new Error('Database locked; simulated compensation failure');
          }
          return { success: true };
        }
      );

      const result = await service.compensateRun({
        runId,
        organizationId: orgId,
        workspaceId: wsId,
        reason: 'Pipeline failed at step 2',
      });

      expect(result.compensatedStepsCount).toBe(1); // Step 0 succeeded
      expect(result.failedCompensationsCount).toBe(1); // Step 1 failed
      expect(result.dlqEnqueuedCount).toBe(1);
      expect(result.status).toBe('PARTIAL_COMPENSATION');
    });
  });

  describe('Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('fails closed immediately when platform emergency freeze is active', async () => {
      const runId = 'saga_run_deadman';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.task.create',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { taskId: 'task_deadman' },
      });

      setGovernanceDeadManStateForTests(true);

      await expect(
        service.compensateRun({
          runId,
          organizationId: orgId,
          workspaceId: wsId,
          reason: 'Emergency triggered mid-flight',
        })
      ).rejects.toThrow(SagaCompensationError);

      await expect(
        service.compensateRun({
          runId,
          organizationId: orgId,
          workspaceId: wsId,
          reason: 'Emergency triggered mid-flight',
        })
      ).rejects.toMatchObject({
        code: 'SAGA_DEAD_MAN_PAUSED',
        statusCode: 503,
      });
    });
  });

  describe('Shadow Mode Simulation (Rule 42)', () => {
    it('runs simulation with dryRun: true producing 0 live compensating writes', async () => {
      const runId = 'saga_run_dryrun';
      const spyExecute = vi.spyOn(service as any, 'executeCompensatingCapability');

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.deal.advance_stage',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { dealId: 'deal_1' },
      });

      const result = await service.compensateRun({
        runId,
        organizationId: orgId,
        workspaceId: wsId,
        reason: 'Testing dryRun rollback',
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.compensatedStepsCount).toBe(1);
      expect(spyExecute).not.toHaveBeenCalled();
    });
  });

  describe('Cooperative Cancellation (Rule 26)', () => {
    it('aborts immediately when AbortSignal is pre-triggered', async () => {
      const runId = 'saga_run_abort';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.task.create',
        organizationId: orgId,
        workspaceId: wsId,
        actorId,
        inputPayload: { taskId: 'task_abort' },
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        service.compensateRun(
          {
            runId,
            organizationId: orgId,
            workspaceId: wsId,
            reason: 'Client disconnected',
          },
          { signal: controller.signal }
        )
      ).rejects.toMatchObject({
        code: 'SAGA_TIMEOUT',
        statusCode: 504,
      });
    });
  });

  describe('Singleton Pattern (Rule 69)', () => {
    it('preserves singleton instance across calls', () => {
      const instance1 = getSagaCompensationService();
      const instance2 = getSagaCompensationService();
      expect(instance1).toBe(instance2);
    });
  });
});
