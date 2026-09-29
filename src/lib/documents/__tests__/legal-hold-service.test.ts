/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test Suite for Enterprise Legal Hold & Statutory Retention Service (Phase 9):
 * 1. Purpose:
 *    Ensures contracts flagged under litigation hold are strictly protected
 *    from modification, deletion, or premature disposal.
 * 2. Invariants Checked:
 *    - FM-P9-05: Accidental destruction under active legal hold is blocked.
 *    - Multi-tenant workspace isolation is strictly enforced.
 *    - Statutory retention periods calculated accurately per legal category.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  placeContractLegalHold,
  releaseContractLegalHold,
  assertContractNotUnderLegalHold,
  calculateRetentionSchedule,
  getContractLegalHoldStatus,
  LegalHoldActiveError,
} from '../legal-hold-service';

// Mock in-memory Firestore contracts store
const mockContracts = new Map<string, Record<string, unknown>>();
const mockEvidence = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: (coll: string) => {
        if (coll === 'contracts') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockContracts.has(id),
                data: () => mockContracts.get(id),
              }),
              update: async (updates: Record<string, unknown>) => {
                const current = mockContracts.get(id) || {};
                mockContracts.set(id, { ...current, ...updates });
              },
            }),
          };
        }

        if (coll === 'signing_evidence') {
          return {
            add: async (data: Record<string, unknown>) => {
              const id = `ev-${Date.now()}`;
              mockEvidence.set(id, { ...data, id });
              return { id };
            },
          };
        }

        throw new Error(`Unexpected collection in test: ${coll}`);
      },
    },
  };
});

describe('Enterprise Legal Hold & Statutory Retention Service', () => {
  const workspaceId = 'ws-legal-ops';
  const contractId = 'ctr-enterprise-99';

  beforeEach(() => {
    mockContracts.clear();
    mockEvidence.clear();

    mockContracts.set(contractId, {
      id: contractId,
      workspaceId,
      title: 'Enterprise Vendor Agreement 2026',
      status: 'signed',
      isUnderLegalHold: false,
    });
  });

  describe('placeContractLegalHold (FM-P9-05)', () => {
    it('places contract on legal hold and logs audit evidence', async () => {
      const hold = await placeContractLegalHold(
        workspaceId,
        contractId,
        {
          matterId: 'MATTER-2026-004',
          reason: 'Subpoena duces tecum regarding vendor pricing',
        },
        'usr-counsel-1'
      );

      expect(hold.isUnderLegalHold).toBe(true);
      expect(hold.matterId).toBe('MATTER-2026-004');
      expect(hold.placedByUserId).toBe('usr-counsel-1');

      // Verify contract updated in root store
      const updatedContract = mockContracts.get(contractId);
      expect(updatedContract?.isUnderLegalHold).toBe(true);

      // Verify evidence log created
      expect(mockEvidence.size).toBe(1);
      const evidence = Array.from(mockEvidence.values())[0];
      expect(evidence.envelopeId).toBe(contractId);
      expect((evidence.metadata as Record<string, unknown>)?.matterId).toBe('MATTER-2026-004');
    });

    it('rejects legal hold when workspace tenant ID does not match', async () => {
      await expect(
        placeContractLegalHold(
          'ws-wrong-tenant',
          contractId,
          { matterId: 'M-1', reason: 'Test' },
          'usr-1'
        )
      ).rejects.toThrow('Tenant isolation violation');
    });
  });

  describe('releaseContractLegalHold', () => {
    it('releases legal hold and unfreezes contract', async () => {
      // Place hold first
      await placeContractLegalHold(
        workspaceId,
        contractId,
        { matterId: 'MATTER-1', reason: 'Litigation pending' },
        'usr-1'
      );

      // Release hold
      const released = await releaseContractLegalHold(
        workspaceId,
        contractId,
        { reason: 'Settlement agreement executed' },
        'usr-counsel-2'
      );

      expect(released.isUnderLegalHold).toBe(false);
      expect(released.releasedByUserId).toBe('usr-counsel-2');
      expect(released.reason).toBe('Settlement agreement executed');

      const updatedContract = mockContracts.get(contractId);
      expect(updatedContract?.isUnderLegalHold).toBe(false);
    });
  });

  describe('assertContractNotUnderLegalHold (Deletion Barrier FM-P9-05)', () => {
    it('throws LegalHoldActiveError when contract is frozen under legal hold', async () => {
      await placeContractLegalHold(
        workspaceId,
        contractId,
        { matterId: 'MATTER-DISCOVERY-2026', reason: 'Regulatory investigation' },
        'usr-counsel-1'
      );

      await expect(assertContractNotUnderLegalHold(contractId)).rejects.toThrow(
        LegalHoldActiveError
      );
    });

    it('resolves silently when contract is not under legal hold', async () => {
      await expect(assertContractNotUnderLegalHold(contractId)).resolves.not.toThrow();
    });

    it('resolves silently when contract does not exist (caller handles 404)', async () => {
      await expect(assertContractNotUnderLegalHold('non-existent-contract')).resolves.not.toThrow();
    });
  });

  describe('calculateRetentionSchedule', () => {
    it('calculates 7 years for statutory_tax category', () => {
      const schedule = calculateRetentionSchedule('statutory_tax', '2026-01-15T00:00:00.000Z');
      expect(schedule.retentionYears).toBe(7);
      expect(schedule.expirationDate.startsWith('2033-01-15')).toBe(true);
      expect(schedule.isExpired).toBe(false);
    });

    it('calculates 20 years for intellectual_property category', () => {
      const schedule = calculateRetentionSchedule('intellectual_property', '2026-01-15T00:00:00.000Z');
      expect(schedule.retentionYears).toBe(20);
      expect(schedule.expirationDate.startsWith('2046-01-15')).toBe(true);
      expect(schedule.isExpired).toBe(false);
    });

    it('flags expired contracts correctly for old execution dates', () => {
      const schedule = calculateRetentionSchedule('standard', '2010-01-01T00:00:00.000Z'); // 3 years -> 2013
      expect(schedule.isExpired).toBe(true);
    });
  });

  describe('getContractLegalHoldStatus', () => {
    it('retrieves detailed status when held', async () => {
      await placeContractLegalHold(
        workspaceId,
        contractId,
        { matterId: 'CASE-77', reason: 'Arbitration' },
        'usr-1'
      );

      const status = await getContractLegalHoldStatus(contractId);
      expect(status?.isUnderLegalHold).toBe(true);
      expect(status?.matterId).toBe('CASE-77');
    });

    it('returns null for non-existent contract', async () => {
      const status = await getContractLegalHoldStatus('unknown-doc');
      expect(status).toBeNull();
    });
  });
});
