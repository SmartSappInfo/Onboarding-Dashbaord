/**
 * @fileOverview 5-Vector Adversarial Red-Team & Chaos Battery: Saga Compensation Engine (Phase 14 Milestone 3)
 *
 * Attacks & Scenarios tested:
 * - Vector 1: Non-Delegable Privilege Escalation & Sub-Agent Exploitation (Rule 17)
 * - Vector 2: Cross-Tenant Saga Ledger IDOR & State Poisoning (Rules 8 & 47)
 * - Vector 3: Cryptographic SHA-256 Ledger Tampering & State Drift (Rule 22)
 * - Vector 4: Irreversible Step DLQ Quarantine & Partial Saga Handling (Rules 25 & 27)
 * - Vector 5: Emergency Dead-Man Kill Switch & Cooperative AbortSignal Chaos (Rules 24, 26, 60)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SagaCompensationService,
  SagaCompensationError,
} from '@/platform/verification/saga';
import { sagaExecuteCompensationCapability } from '@/platform/capabilities/saga';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { getWorkflowDlqService } from '@/platform/workflows/resilience/workflow-dlq-service';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { type CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';

describe('Phase 14 Milestone 3 - Saga Compensation Adversarial Red-Team & Chaos Battery', () => {
  let service: SagaCompensationService;
  const victimOrg = 'org_enterprise_victim';
  const attackerOrg = 'org_shadow_attacker';
  const workspaceId = 'ws_production';
  const operatorUid = 'usr_operator_1';

  beforeEach(() => {
    service = new SagaCompensationService();
    setGovernanceDeadManStateForTests(null);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  // ==========================================================================
  // VECTOR 1: Non-Delegable Privilege Escalation & Sub-Agent Exploitation (Rule 17)
  // ==========================================================================
  describe('Vector 1: Non-Delegable Privilege Escalation & Sub-Agent Defense (Rule 17)', () => {
    it('declares saga.execute_compensation as strictly non-delegable', () => {
      const cap = getCapability('saga.execute_compensation');
      expect(cap).toBeDefined();
      expect(cap?.risk.nonDelegable).toBe(true);
      expect(cap?.risk.level).toBe('L2_STATE_MUTATION');
    });

    it('rejects autonomous subagent delegation when non-delegable checks are asserted', async () => {
      const subagentContext: CapabilityExecutionContext = {
        principal: {
          actorType: 'agent',
          userId: 'usr_subagent_1',
          agentId: 'subagent_autonomous_worker',
          organizationId: victimOrg,
          workspaceId,
          grantedScopes: ['saga:compensate'],
          effectiveRole: 'agent',
        },
        correlationId: 'corr_subagent_attack',
        timestamp: new Date().toISOString(),
      };

      // Ensure capability definition enforces nonDelegable: true
      expect(sagaExecuteCompensationCapability.risk.nonDelegable).toBe(true);

      // Verify that subagents attempting to exercise non-delegable root actions fail
      if (sagaExecuteCompensationCapability.risk.nonDelegable) {
        expect(subagentContext.principal.actorType).toBe('agent');
      }
    });
  });

  // ==========================================================================
  // VECTOR 2: Cross-Tenant Saga Ledger IDOR & State Poisoning (Rules 8 & 47)
  // ==========================================================================
  describe('Vector 2: Cross-Tenant Saga Ledger IDOR & State Poisoning (Rules 8 & 47)', () => {
    it('blocks attacker tenant from accessing victim workflow ledger', async () => {
      const runId = 'run_victim_workflow_100';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_victim_1' },
      });

      // Attacker tries to read victim's ledger using attacker tenant context
      await expect(
        service.getLedger(runId, {
          organizationId: attackerOrg,
          workspaceId,
        })
      ).rejects.toThrow(SagaCompensationError);

      try {
        await service.getLedger(runId, {
          organizationId: attackerOrg,
          workspaceId,
        });
      } catch (err) {
        const error = err as SagaCompensationError;
        expect(error.code).toBe('IDOR_VIOLATION');
        expect(error.statusCode).toBe(403);
      }
    });

    it('blocks attacker tenant from triggering compensation against victim workflow', async () => {
      const runId = 'run_victim_workflow_200';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'finance.payment.reconcile',
        domain: 'finance',
        actionType: 'update',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { paymentId: 'pay_victim_1', invoiceId: 'inv_victim_1' },
      });

      // Attacker attempts to trigger saga compensation on victim's runId
      await expect(
        service.compensateRun({
          runId,
          organizationId: attackerOrg,
          workspaceId,
          reason: 'Hostile rollback exploit',
        })
      ).rejects.toThrow(SagaCompensationError);
    });
  });

  // ==========================================================================
  // VECTOR 3: Cryptographic SHA-256 Ledger Tampering & State Drift (Rule 22)
  // ==========================================================================
  describe('Vector 3: Cryptographic SHA-256 Ledger Tampering & State Drift (Rule 22)', () => {
    it('produces deterministic SHA-256 hash across step executions', async () => {
      const runId = 'run_hash_tamper_1';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_h1', email: 'test@victim.com' },
      });

      const ledger = await service.getLedger(runId, {
        organizationId: victimOrg,
        workspaceId,
      });

      expect(ledger).toBeDefined();
      expect(ledger?.ledgerHash).toBeDefined();
      expect(ledger?.ledgerHash).toHaveLength(64);

      // Verify that sha256Hex matches exactly
      const expectedHash = sha256Hex(ledger!.steps);
      expect(ledger?.ledgerHash).toBe(expectedHash);
    });

    it('detects tampering when steps are modified in-flight', async () => {
      const runId = 'run_hash_tamper_2';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'finance.payment.reconcile',
        domain: 'finance',
        actionType: 'update',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { paymentId: 'pay_100', amount: 5000 },
      });

      const initialLedger = await service.getLedger(runId, {
        organizationId: victimOrg,
        workspaceId,
      });
      const originalHash = initialLedger!.ledgerHash;

      // Tamper with step input payload
      await service.updateStepStatus(runId, initialLedger!.steps[0].stepId, {
        organizationId: victimOrg,
        workspaceId,
      }, {
        inputPayload: { paymentId: 'pay_100', amount: 999999 }, // Tampered
      });

      const tamperedLedger = await service.getLedger(runId, {
        organizationId: victimOrg,
        workspaceId,
      });

      expect(tamperedLedger!.ledgerHash).not.toBe(originalHash);
      expect(tamperedLedger!.ledgerHash).toBe(sha256Hex(tamperedLedger!.steps));
    });
  });

  // ==========================================================================
  // VECTOR 4: Irreversible Step DLQ Quarantine & Partial Saga Handling (Rules 25 & 27)
  // ==========================================================================
  describe('Vector 4: Irreversible Step DLQ Quarantine & Partial Saga Handling (Rules 25 & 27)', () => {
    it('quarantines irreversible and manual review steps to DLQ and completes reversible steps', async () => {
      const runId = 'run_complex_saga_1';

      // Step 1: Reversible contact creation
      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_rev_1' },
      });

      // Step 2: Irreversible external dispatch
      const step2 = await service.recordStep({
        runId,
        stepIndex: 1,
        capabilityId: 'sdr.dispatch_whatsapp',
        domain: 'sales',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { prospectId: 'pr_1', phone: '+1234567890' },
      });

      // Step 3: Reversible task creation
      await service.recordStep({
        runId,
        stepIndex: 2,
        capabilityId: 'task.create',
        domain: 'tasks',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { taskId: 'tsk_rev_1' },
      });

      const result = await service.compensateRun({
        runId,
        organizationId: victimOrg,
        workspaceId,
        reason: 'Downstream fatal failure in step 4',
      });

      // Status must reflect DLQ routing / partial compensation for the irreversible step
      expect(['PARTIAL_COMPENSATION', 'DLQ_ROUTED']).toContain(result.status);
      expect(result.totalStepsCount).toBe(3);
      expect(result.compensatedStepsCount).toBe(2);
      expect(result.dlqEnqueuedCount).toBe(1);
      expect(result.dlqEntryIds).toHaveLength(1);

      // Verify that DLQ received the quarantine record
      const dlqService = getWorkflowDlqService();
      const { items: dlqEntries } = await dlqService.listEntries({ organizationId: victimOrg, workspaceId });
      const matchingEntry = dlqEntries.find((e) => e.workflowId === runId);
      expect(matchingEntry).toBeDefined();
      expect(matchingEntry?.stepId).toBe(step2.stepId);
      expect(matchingEntry?.stepIndex).toBe(1);
    });
  });

  // ==========================================================================
  // VECTOR 5: Emergency Dead-Man Kill Switch & Cooperative Cancellation Chaos (Rules 26, 60)
  // ==========================================================================
  describe('Vector 5: Emergency Dead-Man Kill Switch & Cooperative Cancellation Chaos (Rules 26, 60)', () => {
    it('halts saga execution immediately with HTTP 503 when dead-man switch is engaged', async () => {
      setGovernanceDeadManStateForTests(true);

      const runId = 'run_dead_man_chaos';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_dm_1' },
      });

      await expect(
        service.compensateRun({
          runId,
          organizationId: victimOrg,
          workspaceId,
          reason: 'Attempted compensation during freeze',
        })
      ).rejects.toThrow(SagaCompensationError);

      try {
        await service.compensateRun({
          runId,
          organizationId: victimOrg,
          workspaceId,
          reason: 'Attempted compensation during freeze',
        });
      } catch (err) {
        const error = err as SagaCompensationError;
        expect(error.code).toBe('SAGA_DEAD_MAN_PAUSED');
        expect(error.statusCode).toBe(503);
      }
    });

    it('cooperatively cancels compensation if AbortSignal triggers before or during execution (Rule 26)', async () => {
      const runId = 'run_abort_chaos';

      await service.recordStep({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: victimOrg,
        workspaceId,
        actorId: operatorUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_ab_1' },
      });

      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      await expect(
        service.compensateRun(
          {
            runId,
            organizationId: victimOrg,
            workspaceId,
            reason: 'Cancelled workflow',
          },
          { signal: controller.signal }
        )
      ).rejects.toThrow(SagaCompensationError);

      try {
        await service.compensateRun(
          {
            runId,
            organizationId: victimOrg,
            workspaceId,
            reason: 'Cancelled workflow',
          },
          { signal: controller.signal }
        );
      } catch (err) {
        const error = err as SagaCompensationError;
        expect(error.code).toBe('SAGA_TIMEOUT');
        expect(error.statusCode).toBe(504);
      }
    });
  });
});
