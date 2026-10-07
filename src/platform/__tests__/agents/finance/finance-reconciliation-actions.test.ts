/**
 * @fileOverview Unit & Security Tests for Finance Payment Reconciliation Server Actions
 *
 * Implements Rules 4, 8, 13, 20, 22, 40, 47, 48, 51, and 60.
 * Verifies:
 * - Session authentication guarding (requireAuth)
 * - Anti-IDOR multi-tenant boundary checks
 * - Emergency dead-man switch fail-closed semantics (RECONCILIATION_DEAD_MAN_PAUSED)
 * - Cryptographic SHA-256 payload tampering detection (Rule 22)
 * - Deterministic batch matching and exception resolution workflows
 * - Executive metrics retrieval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  matchPaymentBatchAction,
  resolveReconciliationExceptionAction,
  getReconciliationMetricsAction,
  getReconciliationExceptionsAction,
} from '@/app/actions/finance-reconciliation-actions';
import {
  computePayloadHash,
  getReconciliationEngine,
} from '@/platform/agents/finance/reconciliation/reconciliation-engine';
import {
  BankPayoutTransaction,
  InvoiceCandidate,
  ReconciliationBatchMatchInput,
} from '@/platform/agents/finance/reconciliation/reconciliation-types';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/platform/capabilities/events/domain-event', () => ({
  createDomainEvent: vi.fn((args: unknown) => args),
}));

describe('Finance Reconciliation Server Actions (Phase 12 Milestone 3)', () => {
  const validOrgId = 'org_finance_test';
  const validWsId = 'ws_finance_main';
  const callerUid = 'usr_operator_100';

  const samplePayout: BankPayoutTransaction = {
    id: 'payout_act_001',
    reference: 'WIRE-ACT-9901-INV-2026-088',
    amount: 1500.0,
    currency: 'GHS',
    settlementDate: '2026-10-01T12:00:00Z',
    sourceGateway: 'bank_wire',
    counterpartyName: 'Abena Osei',
  };

  const sampleInvoice: InvoiceCandidate = {
    id: 'inv_act_088',
    invoiceNumber: 'INV-2026-088',
    entityId: 'student_adm_088',
    entityName: 'Abena Osei',
    totalPayable: 1500.0,
    amountPaid: 0.0,
    balanceDue: 1500.0,
    dueDate: '2026-10-01T00:00:00Z',
    currency: 'GHS',
    status: 'issued',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue({
      uid: callerUid,
      profile: {
        id: callerUid,
        name: 'Finance Controller',
        email: 'finance@smartsapp.com',
        role: 'admin',
        organizationId: validOrgId,
        lastActiveWorkspaceId: validWsId,
        workspaceIds: [validWsId],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isSystemAdmin: false,
    });

    const { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } = await import(
      '@/platform/policy/governance-dead-man'
    );
    vi.mocked(checkGovernanceDeadManSwitch).mockImplementation(async (orgId?: string) => {
      if (orgId === 'org_paused') {
        throw new AgentGovernanceEmergencyPausedError(
          'Emergency dead-man switch engaged for testing.'
        );
      }
    });
  });

  describe('matchPaymentBatchAction', () => {
    it('executes batch match successfully for authorized caller', async () => {
      const input: ReconciliationBatchMatchInput = {
        organizationId: validOrgId,
        workspaceId: validWsId,
        payouts: [samplePayout],
        invoices: [sampleInvoice],
        toleranceUSD: 0.5,
      };

      const res = await matchPaymentBatchAction(input);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.matchedCount).toBe(1);
      expect(res.data?.matches[0].matchTier).toBe('EXACT_MATCH');
      expect(res.data?.matches[0].invoiceId).toBe('inv_act_088');
    });

    it('enforces Anti-IDOR validation and rejects cross-tenant requests (Rule 8 & 47)', async () => {
      const input: ReconciliationBatchMatchInput = {
        organizationId: 'org_attacker_evil',
        workspaceId: validWsId,
        payouts: [samplePayout],
        invoices: [sampleInvoice],
      };

      const res = await matchPaymentBatchAction(input);

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
      expect(res.error?.message).toContain('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is engaged (Rule 60)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockResolvedValueOnce({
        uid: callerUid,
        profile: {
          id: callerUid,
          name: 'Paused Admin',
          email: 'admin@smartsapp.com',
          role: 'admin',
          organizationId: 'org_paused',
          lastActiveWorkspaceId: validWsId,
          workspaceIds: [validWsId],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      });

      const input: ReconciliationBatchMatchInput = {
        organizationId: 'org_paused',
        workspaceId: validWsId,
        payouts: [samplePayout],
        invoices: [sampleInvoice],
      };

      const res = await matchPaymentBatchAction(input);

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('RECONCILIATION_DEAD_MAN_PAUSED');
    });
  });

  describe('resolveReconciliationExceptionAction', () => {
    it('detects cryptographic SHA-256 payload tampering and rejects with PAYLOAD_TAMPERED (Rule 22)', async () => {
      const res = await resolveReconciliationExceptionAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        exceptionId: 'exc_test_001',
        payoutId: 'payout_001',
        selectedInvoiceId: 'inv_001',
        action: 'APPROVE_MATCH',
        varianceAmount: 0,
        resolutionNotes: 'Legitimate note',
        payloadHash: 'tampered_invalid_sha256_hash_value',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('PAYLOAD_TAMPERED');
      expect(res.error?.message).toContain('Cryptographic payload tampering detected');
    });

    it('successfully resolves exception with valid canonical payloadHash', async () => {
      // First seed an exception in the engine
      const engine = getReconciliationEngine();
      const batch = await engine.matchBatch({
        organizationId: validOrgId,
        workspaceId: validWsId,
        payouts: [
          {
            id: 'payout_unmatched_resolve',
            reference: 'WIRE-UNMATCHED-99',
            amount: 2500.0,
            currency: 'GHS',
            settlementDate: '2026-10-01T12:00:00Z',
            sourceGateway: 'bank_wire',
          },
        ],
        invoices: [sampleInvoice],
        toleranceUSD: 0.5,
      });

      expect(batch.exceptions).toHaveLength(1);
      const exc = batch.exceptions[0];

      const resolutionPayload = {
        exceptionId: exc.exceptionId,
        payoutId: exc.payoutId,
        selectedInvoiceId: sampleInvoice.id,
        action: 'APPROVE_MATCH' as const,
        varianceAmount: 0,
        resolutionNotes: 'Matched verified with bank teller stamp.',
      };

      const validHash = computePayloadHash(resolutionPayload);

      const res = await resolveReconciliationExceptionAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        ...resolutionPayload,
        payloadHash: validHash,
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('RESOLVED');
      expect(res.data?.reconciledPaymentId).toBeDefined();
    });
  });

  describe('getReconciliationMetricsAction & getReconciliationExceptionsAction', () => {
    it('returns executive metrics for authorized organization', async () => {
      const res = await getReconciliationMetricsAction(validOrgId, validWsId);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.currency).toBe('GHS');
      expect(typeof res.data?.unmatchedSettlementsCount).toBe('number');
    });

    it('returns exception list for authorized organization', async () => {
      const res = await getReconciliationExceptionsAction(validOrgId, validWsId, 'OPEN');

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
    });
  });
});
