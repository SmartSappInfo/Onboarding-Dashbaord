/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test suite for the Contract Obligations & Renewal Task Synchronization Engine (Phase 3 Task 4).
 * Verifies obligation creation, SmartSapp task core integration (`createTaskCore`),
 * obligation fulfillment with linked task auto-completion, reverse-hook synchronization,
 * overdue deliverable calculations, and reminder interval evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createContractObligation,
  fulfillObligation,
  syncObligationWithTask,
  getUpcomingObligations,
  evaluateObligationReminders,
} from '@/lib/documents/contract-obligation-service';
import type { ContractObligation } from '@/lib/types/document-signing';

// Mock task-core to verify integration without requiring live Firestore emulator
vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn(),
  updateTaskCore: vi.fn(),
}));

import { createTaskCore, updateTaskCore } from '@/lib/tasks/task-core';

describe('Contract Obligations & Renewal Task Synchronization (contract-obligation-service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseObligation: ContractObligation = {
    id: 'ob_soc2_audit_1',
    workspaceId: 'ws_legal_1',
    contractId: 'cnt_msa_001',
    title: 'Submit SOC2 Type II Audit Report',
    description: 'Provide certified SOC2 package to enterprise counterparty compliance team.',
    type: 'reporting',
    status: 'pending',
    dueDate: '2026-11-30T00:00:00Z',
    responsibleParty: 'internal',
    assignedUserId: 'user_security_lead',
    reminderDaysBefore: [7, 14, 30],
    createdAt: '2026-09-29T00:00:00Z',
    updatedAt: '2026-09-29T00:00:00Z',
  };

  describe('createContractObligation', () => {
    it('creates obligation and dispatches task to SmartSapp task core for internal assignee', async () => {
      vi.mocked(createTaskCore).mockResolvedValueOnce({
        success: true,
        id: 'task_core_9901',
      });

      const result = await createContractObligation({
        workspaceId: 'ws_legal_1',
        contractId: 'cnt_msa_001',
        title: 'Submit SOC2 Type II Audit Report',
        description: 'Provide certified SOC2 package to enterprise counterparty compliance team.',
        type: 'reporting',
        dueDate: '2026-11-30T00:00:00Z',
        responsibleParty: 'internal',
        assignedUserId: 'user_security_lead',
        reminderDaysBefore: [7, 14, 30],
        syncToTasks: true,
      });

      expect(result.obligation.title).toBe('Submit SOC2 Type II Audit Report');
      expect(result.obligation.status).toBe('pending');
      expect(result.obligation.linkedTaskId).toBe('task_core_9901');

      expect(createTaskCore).toHaveBeenCalledTimes(1);
      expect(createTaskCore).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_legal_1',
          title: '[Contract Deliverable] Submit SOC2 Type II Audit Report',
          dueDate: '2026-11-30T00:00:00Z',
        }),
        expect.objectContaining({ kind: 'system', source: 'contract_obligation' })
      );
    });

    it('does not dispatch task to task core if responsible party is counterparty', async () => {
      const result = await createContractObligation({
        workspaceId: 'ws_legal_1',
        contractId: 'cnt_msa_001',
        title: 'Counterparty Initial Escrow Deposit ($50,000)',
        type: 'payment',
        dueDate: '2026-10-15T00:00:00Z',
        responsibleParty: 'counterparty',
        syncToTasks: false,
      });

      expect(result.obligation.title).toBe('Counterparty Initial Escrow Deposit ($50,000)');
      expect(result.obligation.linkedTaskId).toBeUndefined();
      expect(createTaskCore).not.toHaveBeenCalled();
    });
  });

  describe('fulfillObligation', () => {
    it('marks obligation fulfilled and resolves linked task in SmartSapp task core', async () => {
      vi.mocked(updateTaskCore).mockResolvedValueOnce({ success: true });

      const obligationWithTask: ContractObligation = {
        ...baseObligation,
        linkedTaskId: 'task_core_9901',
      };

      const result = await fulfillObligation({
        obligation: obligationWithTask,
        fulfilledBy: 'user_compliance_officer',
      });

      expect(result.obligation.status).toBe('fulfilled');
      expect(result.obligation.fulfilledBy).toBe('user_compliance_officer');
      expect(result.obligation.fulfilledAt).toBeDefined();
      expect(result.wasAlreadyFulfilled).toBe(false);

      expect(updateTaskCore).toHaveBeenCalledWith(
        'task_core_9901',
        expect.objectContaining({ status: 'done' }),
        expect.objectContaining({ kind: 'system', source: 'contract_obligation' })
      );
    });

    it('returns success idempotently if obligation was already fulfilled without double update', async () => {
      const fulfilledObligation: ContractObligation = {
        ...baseObligation,
        status: 'fulfilled',
        fulfilledAt: '2026-10-01T12:00:00Z',
        fulfilledBy: 'user_prior',
      };

      const result = await fulfillObligation({
        obligation: fulfilledObligation,
        fulfilledBy: 'user_second',
      });

      expect(result.wasAlreadyFulfilled).toBe(true);
      expect(result.obligation.fulfilledBy).toBe('user_prior');
      expect(updateTaskCore).not.toHaveBeenCalled();
    });
  });

  describe('syncObligationWithTask (Reverse Hook)', () => {
    it('advances obligation to fulfilled when linked CRM task is marked done', () => {
      const updated = syncObligationWithTask({
        obligation: baseObligation,
        taskStatus: 'done',
        updatedBy: 'user_crm_agent',
      });

      expect(updated.status).toBe('fulfilled');
      expect(updated.fulfilledBy).toBe('user_crm_agent');
      expect(updated.fulfilledAt).toBeDefined();
    });

    it('reverts obligation to in_progress if completed task is re-opened in CRM', () => {
      const fulfilledObligation: ContractObligation = {
        ...baseObligation,
        status: 'fulfilled',
        fulfilledAt: '2026-10-01T12:00:00Z',
        fulfilledBy: 'user_prior',
      };

      const reverted = syncObligationWithTask({
        obligation: fulfilledObligation,
        taskStatus: 'todo',
        updatedBy: 'user_crm_agent',
      });

      expect(reverted.status).toBe('in_progress');
      expect(reverted.fulfilledAt).toBeUndefined();
    });
  });

  describe('getUpcomingObligations & evaluateObligationReminders', () => {
    it('computes days remaining and sorts pending obligations by due date', () => {
      const refDate = new Date('2026-11-01T00:00:00Z');

      const obDueLater: ContractObligation = {
        ...baseObligation,
        id: 'ob_later',
        dueDate: '2026-11-20T00:00:00Z', // 19 days away
      };

      const obOverdue: ContractObligation = {
        ...baseObligation,
        id: 'ob_past',
        dueDate: '2026-10-25T00:00:00Z', // 7 days overdue
      };

      const list = getUpcomingObligations([obDueLater, obOverdue], refDate);

      expect(list).toHaveLength(2);
      expect(list[0].obligation.id).toBe('ob_past');
      expect(list[0].isOverdue).toBe(true);
      expect(list[0].daysRemaining).toBe(-7);

      expect(list[1].obligation.id).toBe('ob_later');
      expect(list[1].isOverdue).toBe(false);
      expect(list[1].daysRemaining).toBe(19);
    });

    it('evaluates reminder intervals matching 7, 14, or 30 days before due date', () => {
      // 14 days before 2026-11-30 is 2026-11-16
      const refDateMatching14 = new Date('2026-11-16T00:00:00Z');

      const evaluation = evaluateObligationReminders(baseObligation, refDateMatching14);
      expect(evaluation.shouldSendReminder).toBe(true);
      expect(evaluation.daysRemaining).toBe(14);
      expect(evaluation.matchedReminderDay).toBe(14);

      // Not on a reminder day (e.g. 18 days before)
      const refDateNonMatching = new Date('2026-11-12T00:00:00Z');
      const evalNonMatching = evaluateObligationReminders(baseObligation, refDateNonMatching);
      expect(evalNonMatching.shouldSendReminder).toBe(false);
      expect(evalNonMatching.daysRemaining).toBe(18);
    });
  });
});
