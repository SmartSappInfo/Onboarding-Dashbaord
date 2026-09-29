/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test suite for the Post-Signing Contract Lifecycle & Relationship Engine (Phase 3 Task 3).
 * Verifies contract state-machine transitions, non-destructive amendment/renewal relationships,
 * and commercial renewal urgency/countdown calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  transitionContractStatus,
  createContractAmendment,
  createContractRenewal,
  calculateRenewalUrgency,
  type ContractRenewalUrgency,
} from '@/lib/documents/contract-lifecycle-service';
import type { ContractRecord } from '@/lib/types/document-signing';

describe('Post-Signing Contract Lifecycle Engine (contract-lifecycle-service)', () => {
  const baseContract: ContractRecord = {
    id: 'cnt_msa_001',
    workspaceId: 'ws_legal_1',
    title: 'Master Cloud Agreement 2026',
    status: 'proposed',
    templateId: 'tmpl_cloud_1',
    templateVersionId: 'ver_001',
    envelopeIds: ['env_001'],
    partyLinks: [
      {
        name: 'Jane Doe',
        email: 'jane@client.com',
        role: 'signatory',
      },
    ],
    contractValue: {
      amount: 60000,
      currency: 'USD',
      cadence: 'annually',
    },
    effectiveAt: '2026-01-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
    renewalAt: '2026-11-01T00:00:00Z',
    noticePeriodDays: 60,
    ownerId: 'user_rep_1',
    tagIds: ['cloud', 'enterprise'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  describe('transitionContractStatus', () => {
    it('advances a contract through valid lifecycle states', () => {
      // proposed -> negotiation
      const c1 = transitionContractStatus(baseContract, 'negotiation');
      expect(c1.status).toBe('negotiation');

      // negotiation -> pending_execution
      const c2 = transitionContractStatus(c1, 'pending_execution');
      expect(c2.status).toBe('pending_execution');

      // pending_execution -> executed
      const c3 = transitionContractStatus(c2, 'executed');
      expect(c3.status).toBe('executed');

      // executed -> active
      const c4 = transitionContractStatus(c3, 'active');
      expect(c4.status).toBe('active');
    });

    it('allows one-click termination with mandatory audit reason', () => {
      const activeContract: ContractRecord = {
        ...baseContract,
        status: 'active',
      };

      const terminated = transitionContractStatus(activeContract, 'terminated', {
        reason: 'Material breach of SLA terms by counterparty.',
      });

      expect(terminated.status).toBe('terminated');
    });

    it('rejects invalid lifecycle transitions', () => {
      const terminatedContract: ContractRecord = {
        ...baseContract,
        status: 'terminated',
      };

      // Cannot go from terminated -> active directly
      expect(() =>
        transitionContractStatus(terminatedContract, 'active')
      ).toThrowError(/Invalid contract status transition from "terminated" to "active"/);
    });
  });

  describe('createContractAmendment', () => {
    it('creates child amendment contract and non-destructive relationship link', () => {
      const activeContract: ContractRecord = {
        ...baseContract,
        status: 'active',
        executedPdfStoragePath: 'signed/cnt_msa_001.pdf',
        executedPdfSha256: 'orig_sha_123',
      };

      const result = createContractAmendment({
        parentContract: activeContract,
        amendmentTitle: 'Amendment #1: Extended SLA Scope',
        description: 'Increases coverage to 24/7 dedicated telephone support.',
        createdBy: 'user_ops_lead',
      });

      // Child amendment contract
      expect(result.amendmentContract.title).toBe('Amendment #1: Extended SLA Scope');
      expect(result.amendmentContract.parentContractId).toBe(activeContract.id);
      expect(result.amendmentContract.status).toBe('proposed');
      expect(result.amendmentContract.workspaceId).toBe(activeContract.workspaceId);
      expect(result.amendmentContract.partyLinks).toEqual(activeContract.partyLinks);

      // Parent contract status updated to amended
      expect(result.updatedParentContract.status).toBe('amended');
      // Original executed PDF remains preserved
      expect(result.updatedParentContract.executedPdfStoragePath).toBe('signed/cnt_msa_001.pdf');

      // Non-destructive relationship link
      expect(result.relationship.sourceContractId).toBe(activeContract.id);
      expect(result.relationship.targetContractId).toBe(result.amendmentContract.id);
      expect(result.relationship.relationshipType).toBe('amendment');
      expect(result.relationship.description).toBe('Increases coverage to 24/7 dedicated telephone support.');
    });
  });

  describe('createContractRenewal', () => {
    it('creates renewed agreement, sets renewal date, and links relationship', () => {
      const activeContract: ContractRecord = {
        ...baseContract,
        status: 'active',
        expiresAt: '2027-01-01T00:00:00Z',
      };

      const result = createContractRenewal({
        parentContract: activeContract,
        renewalTitle: 'Master Cloud Agreement 2027 (Renewal)',
        newEffectiveAt: '2027-01-01T00:00:00Z',
        newExpiresAt: '2028-01-01T00:00:00Z',
        createdBy: 'user_account_exec',
      });

      expect(result.renewalContract.title).toBe('Master Cloud Agreement 2027 (Renewal)');
      expect(result.renewalContract.effectiveAt).toBe('2027-01-01T00:00:00Z');
      expect(result.renewalContract.expiresAt).toBe('2028-01-01T00:00:00Z');
      expect(result.renewalContract.parentContractId).toBe(activeContract.id);

      expect(result.updatedParentContract.status).toBe('renewed');

      expect(result.relationship.relationshipType).toBe('renewal');
      expect(result.relationship.sourceContractId).toBe(activeContract.id);
      expect(result.relationship.targetContractId).toBe(result.renewalContract.id);
    });
  });

  describe('calculateRenewalUrgency', () => {
    it('identifies critical upcoming renewal within notice period', () => {
      // Mock reference time: 2026-10-15
      const referenceDate = new Date('2026-10-15T00:00:00Z');

      const contract: ContractRecord = {
        ...baseContract,
        status: 'active',
        expiresAt: '2026-11-15T00:00:00Z', // 31 days to expiry
        renewalAt: '2026-10-25T00:00:00Z', // 10 days to renewal decision
        noticePeriodDays: 30,
      };

      const urgency: ContractRenewalUrgency = calculateRenewalUrgency(contract, referenceDate);

      expect(urgency.daysUntilRenewal).toBe(10);
      expect(urgency.daysUntilExpiration).toBe(31);
      expect(urgency.isRenewalDue).toBe(true);
      expect(urgency.urgencyLevel).toBe('critical');
      expect(urgency.badgeLabel).toBe('Renews in 10 days');
    });

    it('identifies an already expired contract', () => {
      const referenceDate = new Date('2027-02-01T00:00:00Z');

      const contract: ContractRecord = {
        ...baseContract,
        status: 'active',
        expiresAt: '2027-01-01T00:00:00Z', // Expired 31 days ago
      };

      const urgency: ContractRenewalUrgency = calculateRenewalUrgency(contract, referenceDate);

      expect(urgency.isExpired).toBe(true);
      expect(urgency.urgencyLevel).toBe('expired');
      expect(urgency.badgeLabel).toBe('Expired 31 days ago');
    });

    it('returns normal status for a contract well in advance of renewal', () => {
      const referenceDate = new Date('2026-02-01T00:00:00Z');

      const contract: ContractRecord = {
        ...baseContract,
        status: 'active',
        expiresAt: '2027-01-01T00:00:00Z', // 334 days away
        renewalAt: '2026-11-01T00:00:00Z', // 273 days away
      };

      const urgency: ContractRenewalUrgency = calculateRenewalUrgency(contract, referenceDate);

      expect(urgency.isRenewalDue).toBe(false);
      expect(urgency.isExpired).toBe(false);
      expect(urgency.urgencyLevel).toBe('normal');
      expect(urgency.badgeLabel).toBe('Expires in 334 days');
    });
  });
});
