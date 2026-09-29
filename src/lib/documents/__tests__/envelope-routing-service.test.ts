/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Phase 2 Multi-Party State Machine & Sequential Routing Engine (P2.4).
 * 2. Invariants Tested:
 *    - Sequential routing lock: Recipient at order N cannot act while order < N is incomplete.
 *    - Parallel routing: Cohort at order 1 can act concurrently.
 *    - Mixed routing: Cohorts complete before advancing to subsequent stages.
 *    - Immediate terminal cancellation on decline.
 *    - Terminal completion when all cohorts finish.
 *    - Zero `any` or unchecked casts (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import type { SigningEnvelope, EnvelopeRecipient } from '@/lib/types/document-signing';
import {
  canRecipientAct,
  advanceEnvelopeRouting,
  calculateEnvelopeProgress,
  getCurrentActiveRecipients,
} from '@/lib/documents/envelope-routing-service';

function createMockEnvelope(overrides?: Partial<SigningEnvelope>): SigningEnvelope {
  const baseRecipients: EnvelopeRecipient[] = [
    {
      id: 'rec_1',
      workspaceId: 'ws_demo',
      envelopeId: 'env_100',
      role: 'signer',
      name: 'Signer One',
      email: 'signer1@example.com',
      routingOrder: 1,
      status: 'invited',
      tokenHash: 'hash1',
      tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: 'rec_2',
      workspaceId: 'ws_demo',
      envelopeId: 'env_100',
      role: 'signer',
      name: 'Signer Two',
      email: 'signer2@example.com',
      routingOrder: 2,
      status: 'pending',
      tokenHash: 'hash2',
      tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: 'rec_3',
      workspaceId: 'ws_demo',
      envelopeId: 'env_100',
      role: 'countersigner',
      name: 'Internal Counsel',
      email: 'counsel@example.com',
      routingOrder: 3,
      status: 'pending',
      tokenHash: 'hash3',
      tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ];

  return {
    id: 'env_100',
    workspaceId: 'ws_demo',
    title: 'Multi-Party Master Agreement',
    status: 'in_progress',
    routingMode: 'sequential',
    currentRoutingOrder: 1,
    recipients: baseRecipients,
    documentStoragePath: 'agreements/env_100.pdf',
    preExecutionSha256: 'sha256_mock_hash',
    expiresAt: new Date(Date.now() + 604800000).toISOString(),
    createdBy: 'usr_admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Envelope Routing Engine (P2.4)', () => {
  describe('canRecipientAct (Sequential Mode)', () => {
    it('allows recipient at current routing order to act', () => {
      const envelope = createMockEnvelope();
      const check = canRecipientAct(envelope, 'rec_1');
      expect(check.allowed).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it('blocks recipient at subsequent routing order (order 2 when current order is 1)', () => {
      const envelope = createMockEnvelope();
      const check = canRecipientAct(envelope, 'rec_2');
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/waiting for previous/i);
      expect(check.blockingRecipient?.id).toBe('rec_1');
    });

    it('blocks recipient if recipient has already signed', () => {
      const envelope = createMockEnvelope({
        recipients: [
          {
            id: 'rec_1',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer One',
            email: 'signer1@example.com',
            routingOrder: 1,
            status: 'signed',
            tokenHash: 'hash1',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_2',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer Two',
            email: 'signer2@example.com',
            routingOrder: 2,
            status: 'invited',
            tokenHash: 'hash2',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        currentRoutingOrder: 2,
      });

      const check = canRecipientAct(envelope, 'rec_1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/already signed/i);
    });

    it('blocks all recipients if envelope is terminal (e.g. voided or expired)', () => {
      const envelope = createMockEnvelope({ status: 'voided' });
      const check = canRecipientAct(envelope, 'rec_1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/envelope is voided/i);
    });

    it('blocks if envelope is still in draft', () => {
      const envelope = createMockEnvelope({ status: 'draft' });
      const check = canRecipientAct(envelope, 'rec_1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/not yet sent/i);
    });
  });

  describe('canRecipientAct (Parallel Mode)', () => {
    it('allows any incomplete recipient to act concurrently in parallel mode', () => {
      const envelope = createMockEnvelope({
        routingMode: 'parallel',
        recipients: [
          {
            id: 'rec_a',
            workspaceId: 'ws_demo',
            envelopeId: 'env_parallel',
            role: 'signer',
            name: 'Partner A',
            email: 'a@example.com',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'hA',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_b',
            workspaceId: 'ws_demo',
            envelopeId: 'env_parallel',
            role: 'signer',
            name: 'Partner B',
            email: 'b@example.com',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'hB',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      });

      expect(canRecipientAct(envelope, 'rec_a').allowed).toBe(true);
      expect(canRecipientAct(envelope, 'rec_b').allowed).toBe(true);
    });
  });

  describe('advanceEnvelopeRouting', () => {
    it('advances sequential envelope from order 1 to order 2 when recipient 1 signs', () => {
      const envelope = createMockEnvelope();
      const result = advanceEnvelopeRouting(envelope, 'rec_1', 'signed', {
        signedAt: '2026-09-29T10:00:00Z',
        signatureStoragePath: 'signatures/rec_1.png',
      });

      expect(result.isTerminal).toBe(false);
      expect(result.updatedEnvelope.status).toBe('in_progress');
      expect(result.updatedEnvelope.currentRoutingOrder).toBe(2);

      // Verify recipient 1 is now signed
      const rec1 = result.updatedEnvelope.recipients.find((r) => r.id === 'rec_1');
      expect(rec1?.status).toBe('signed');
      expect(rec1?.signedAt).toBe('2026-09-29T10:00:00Z');

      // Verify recipient 2 is now invited
      const rec2 = result.updatedEnvelope.recipients.find((r) => r.id === 'rec_2');
      expect(rec2?.status).toBe('invited');
      expect(rec2?.invitedAt).toBeDefined();

      // Verify newly invited list
      expect(result.newlyInvitedRecipients).toHaveLength(1);
      expect(result.newlyInvitedRecipients[0].id).toBe('rec_2');
    });

    it('waits at current order in mixed/parallel cohort until all cohort recipients sign', () => {
      const envelope = createMockEnvelope({
        routingMode: 'mixed',
        recipients: [
          {
            id: 'rec_1a',
            workspaceId: 'ws_demo',
            envelopeId: 'env_mixed',
            role: 'signer',
            name: 'Signer 1A',
            email: '1a@example.com',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'h1a',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_1b',
            workspaceId: 'ws_demo',
            envelopeId: 'env_mixed',
            role: 'signer',
            name: 'Signer 1B',
            email: '1b@example.com',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'h1b',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_2_counsel',
            workspaceId: 'ws_demo',
            envelopeId: 'env_mixed',
            role: 'countersigner',
            name: 'Counsel',
            email: 'counsel@example.com',
            routingOrder: 2,
            status: 'pending',
            tokenHash: 'h2',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      });

      // Recipient 1A signs, but 1B is still invited
      const intermediateResult = advanceEnvelopeRouting(envelope, 'rec_1a', 'signed');
      expect(intermediateResult.isTerminal).toBe(false);
      expect(intermediateResult.updatedEnvelope.currentRoutingOrder).toBe(1);
      expect(intermediateResult.newlyInvitedRecipients).toHaveLength(0);

      // Recipient 1B now signs: cohort completes, advancing to routing order 2
      const finalCohortResult = advanceEnvelopeRouting(
        intermediateResult.updatedEnvelope,
        'rec_1b',
        'signed'
      );
      expect(finalCohortResult.isTerminal).toBe(false);
      expect(finalCohortResult.updatedEnvelope.currentRoutingOrder).toBe(2);
      expect(finalCohortResult.newlyInvitedRecipients).toHaveLength(1);
      expect(finalCohortResult.newlyInvitedRecipients[0].id).toBe('rec_2_counsel');
    });

    it('transitions envelope to completed when final recipient completes', () => {
      const envelope = createMockEnvelope({
        currentRoutingOrder: 3,
        recipients: [
          {
            id: 'rec_1',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer One',
            email: 'signer1@example.com',
            routingOrder: 1,
            status: 'signed',
            tokenHash: 'h1',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_2',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer Two',
            email: 'signer2@example.com',
            routingOrder: 2,
            status: 'signed',
            tokenHash: 'h2',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'rec_3',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'countersigner',
            name: 'Internal Counsel',
            email: 'counsel@example.com',
            routingOrder: 3,
            status: 'invited',
            tokenHash: 'h3',
            tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      });

      const result = advanceEnvelopeRouting(envelope, 'rec_3', 'signed');
      expect(result.isTerminal).toBe(true);
      expect(result.updatedEnvelope.status).toBe('completed');
      expect(result.updatedEnvelope.completedAt).toBeDefined();
      expect(result.newlyInvitedRecipients).toHaveLength(0);
    });

    it('immediately declines envelope when any signatory declines', () => {
      const envelope = createMockEnvelope();
      const result = advanceEnvelopeRouting(envelope, 'rec_1', 'declined', {
        declineReason: 'Terms unacceptable on clause 4.2',
      });

      expect(result.isTerminal).toBe(true);
      expect(result.updatedEnvelope.status).toBe('declined');
      const rec1 = result.updatedEnvelope.recipients.find((r) => r.id === 'rec_1');
      expect(rec1?.status).toBe('declined');
      expect(rec1?.declineReason).toBe('Terms unacceptable on clause 4.2');
      expect(result.newlyInvitedRecipients).toHaveLength(0);
    });
  });

  describe('Helper Utilities', () => {
    it('calculates progress accurately across signers', () => {
      const envelope = createMockEnvelope({
        recipients: [
          {
            id: 'rec_1',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer 1',
            email: '1@example.com',
            routingOrder: 1,
            status: 'signed',
            tokenHash: 'h1',
            tokenExpiresAt: new Date().toISOString(),
          },
          {
            id: 'rec_2',
            workspaceId: 'ws_demo',
            envelopeId: 'env_100',
            role: 'signer',
            name: 'Signer 2',
            email: '2@example.com',
            routingOrder: 2,
            status: 'invited',
            tokenHash: 'h2',
            tokenExpiresAt: new Date().toISOString(),
          },
        ],
      });

      const progress = calculateEnvelopeProgress(envelope);
      expect(progress.completedCount).toBe(1);
      expect(progress.totalCount).toBe(2);
      expect(progress.percentage).toBe(50);
    });

    it('retrieves active recipients currently eligible to act', () => {
      const envelope = createMockEnvelope();
      const active = getCurrentActiveRecipients(envelope);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('rec_1');
    });
  });
});
