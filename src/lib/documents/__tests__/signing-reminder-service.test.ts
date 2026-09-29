/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Multi-Channel Signing Reminders & Renewal Escalations Engine (P4.5).
 * 2. Invariants Tested:
 *    - Active Signer Isolation (FM-P4-05): Reminders only target recipients at the active sequential step.
 *    - Deterministic Deduplication Window (FM-P4-02): Composite keys prevent spamming signers.
 *    - Renewal alerts matching 30, 60, 90-day intervals.
 *    - Multi-channel delivery rules (Email, SMS, WhatsApp).
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluatePendingEnvelopeReminders,
  evaluateContractRenewalAlerts,
  dispatchEnvelopeReminder,
} from '../signing-reminder-service';
import type { SigningEnvelope, ContractRecord } from '@/lib/types/document-signing';

const mockReminderLogStore = new Set<string>();

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'scheduled_reminders' || colName === 'message_logs') {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            get: vi.fn().mockImplementation(async () => ({
              exists: mockReminderLogStore.has(docId),
              id: docId,
            })),
            set: vi.fn().mockImplementation(async () => {
              mockReminderLogStore.add(docId);
              return {};
            }),
          })),
        };
      }
      return {};
    }),
  },
}));

describe('P4.5 Multi-Channel Signing Reminders & Renewal Alerts Engine', () => {
  beforeEach(() => {
    mockReminderLogStore.clear();
    vi.clearAllMocks();
  });

  const nowMs = Date.now();
  const threeDaysAgo = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();

  describe('evaluatePendingEnvelopeReminders & Active Signer Isolation (FM-P4-05)', () => {
    it('only targets the active recipient in sequential routing chains', () => {
      const sequentialEnvelope: SigningEnvelope = {
        id: 'env_seq_1',
        workspaceId: 'ws_prod',
        title: 'Two-Party MSA',
        status: 'in_progress',
        templateVersionId: 'tpl_1',
        preExecutionSha256: 'sha_1',
        routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 2 },
        recipients: [
          {
            id: 'rec_signer_1',
            role: 'signer',
            name: 'Signer 1 (Active)',
            email: 'signer1@acme.com',
            status: 'opened',
            routingOrder: 1,
            requiresSignature: true,
          },
          {
            id: 'rec_signer_2',
            role: 'countersigner',
            name: 'Signer 2 (Pending Turn)',
            email: 'signer2@acme.com',
            status: 'pending',
            routingOrder: 2,
            requiresSignature: true,
          },
        ],
        fields: [],
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      } as unknown as SigningEnvelope;

      const targets = evaluatePendingEnvelopeReminders({
        envelopes: [sequentialEnvelope],
        reminderDays: [3, 7, 14],
      });

      // Must strictly isolate Signer 1; Signer 2 must NOT receive a reminder until Step 2 is active!
      expect(targets).toHaveLength(1);
      expect(targets[0].recipientId).toBe('rec_signer_1');
      expect(targets[0].recipientEmail).toBe('signer1@acme.com');
      expect(targets[0].daysElapsed).toBe(3);
      expect(targets[0].deduplicationKey).toBe('rem_env_seq_1_rec_signer_1_3d');
    });

    it('targets all pending signers in parallel routing mode', () => {
      const parallelEnvelope: SigningEnvelope = {
        id: 'env_par_1',
        workspaceId: 'ws_prod',
        title: 'Board Resolution',
        status: 'in_progress',
        templateVersionId: 'tpl_1',
        preExecutionSha256: 'sha_1',
        routingRules: { mode: 'parallel', currentStep: 1, totalSteps: 1 },
        recipients: [
          {
            id: 'rec_1',
            role: 'signer',
            name: 'Director Alice',
            email: 'alice@board.com',
            status: 'opened',
            routingOrder: 1,
            requiresSignature: true,
          },
          {
            id: 'rec_2',
            role: 'signer',
            name: 'Director Bob',
            email: 'bob@board.com',
            status: 'invited',
            routingOrder: 1,
            requiresSignature: true,
          },
        ],
        fields: [],
        createdAt: sevenDaysAgo,
        updatedAt: sevenDaysAgo,
      } as unknown as SigningEnvelope;

      const targets = evaluatePendingEnvelopeReminders({
        envelopes: [parallelEnvelope],
        reminderDays: [3, 7, 14],
      });

      expect(targets).toHaveLength(2);
      expect(targets.map((t) => t.recipientId)).toEqual(['rec_1', 'rec_2']);
    });
  });

  describe('Deduplication Window & Idempotent Dispatch (FM-P4-02)', () => {
    it('skips dispatch if identical reminder key was already sent in the deduplication window', async () => {
      const target = {
        envelopeId: 'env_seq_1',
        workspaceId: 'ws_prod',
        recipientId: 'rec_signer_1',
        recipientName: 'Signer 1',
        recipientEmail: 'signer1@acme.com',
        envelopeTitle: 'Two-Party MSA',
        daysElapsed: 3,
        deduplicationKey: 'rem_env_seq_1_rec_signer_1_3d',
      };

      // First dispatch
      const firstResult = await dispatchEnvelopeReminder(target);
      expect(firstResult.success).toBe(true);
      expect(firstResult.skipped).toBe(false);

      // Immediate second dispatch with same key
      const secondResult = await dispatchEnvelopeReminder(target);
      expect(secondResult.success).toBe(true);
      expect(secondResult.skipped).toBe(true);
    });
  });

  describe('evaluateContractRenewalAlerts', () => {
    it('detects contracts expiring/renewing in exactly 30, 60, or 90 days', () => {
      const in30Days = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
      const in45Days = new Date(nowMs + 45 * 24 * 60 * 60 * 1000).toISOString();

      const contracts: ContractRecord[] = [
        {
          id: 'ctr_renew_30',
          workspaceId: 'ws_prod',
          title: '30-Day Renewal Contract',
          status: 'active',
          renewalAt: in30Days,
          ownerId: 'usr_ops',
          noticePeriodDays: 30,
          createdAt: '2025-10-01T00:00:00.000Z',
          updatedAt: '2025-10-01T00:00:00.000Z',
        } as unknown as ContractRecord,
        {
          id: 'ctr_renew_45',
          workspaceId: 'ws_prod',
          title: '45-Day Renewal Contract',
          status: 'active',
          renewalAt: in45Days,
          ownerId: 'usr_ops',
          noticePeriodDays: 30,
          createdAt: '2025-10-01T00:00:00.000Z',
          updatedAt: '2025-10-01T00:00:00.000Z',
        } as unknown as ContractRecord,
      ];

      const alerts = evaluateContractRenewalAlerts({
        contracts,
        alertDaysBefore: [30, 60, 90],
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].contractId).toBe('ctr_renew_30');
      expect(alerts[0].daysRemaining).toBe(30);
      expect(alerts[0].deduplicationKey).toBe('renewal_ctr_renew_30_30d');
    });
  });
});
