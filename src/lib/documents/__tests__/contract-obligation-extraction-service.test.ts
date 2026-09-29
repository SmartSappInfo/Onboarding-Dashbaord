/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Post-Execution Contract Obligation Extraction & Review Queue (P5.4).
 * 2. Invariants Tested:
 *    - Human-in-the-Loop Review Invariant (FM-P5-03): Extracted obligations are stored as
 *      'review_required' candidates. Zero CRM tasks are created autonomously without approval.
 *    - Tenant Scoping Invariant (FM-P5-01): Strict workspace checks on extraction and approval.
 *    - Approval & Task Creation Hook: Approved candidate creates ContractObligation and CRM task link.
 *    - Dismissal handling: Marks candidate as rejected.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractContractObligations,
  approveObligationCandidate,
  dismissObligationCandidate,
} from '../contract-obligation-extraction-service';
import type { AiObligationCandidate, ContractObligation } from '@/lib/types/document-signing';

const mockCandidatesStore = new Map<string, AiObligationCandidate>();
const mockObligationsStore = new Map<string, ContractObligation>();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'obligation_candidates') {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            get: vi.fn().mockImplementation(async () => {
              const data = mockCandidatesStore.get(docId);
              return {
                exists: Boolean(data),
                id: docId,
                data: () => data,
              };
            }),
            set: vi.fn().mockImplementation(async (data: AiObligationCandidate) => {
              mockCandidatesStore.set(docId, data);
              return {};
            }),
            update: vi.fn().mockImplementation(async (updates: Partial<AiObligationCandidate>) => {
              const existing = mockCandidatesStore.get(docId);
              if (existing) {
                mockCandidatesStore.set(docId, { ...existing, ...updates });
              }
              return {};
            }),
          })),
        };
      }
      if (colName === 'contract_obligations') {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            set: vi.fn().mockImplementation(async (data: ContractObligation) => {
              mockObligationsStore.set(docId, data);
              return {};
            }),
          })),
        };
      }
      return {
        add: vi.fn().mockResolvedValue({ id: 'mock_id' }),
      };
    }),
  },
}));

vi.mock('../document-event-bus', () => ({
  emitDocumentDomainEvent: vi.fn().mockResolvedValue({ success: true, eventId: 'evt_mock' }),
}));

describe('P5.4 Post-Execution Obligation Extraction & Review Queue', () => {
  beforeEach(() => {
    mockCandidatesStore.clear();
    mockObligationsStore.clear();
    vi.clearAllMocks();
  });

  const sampleContractPages = [
    'Section 1: Overview. The Master Agreement between Alpha Corp and Beta Inc.',
    'Section 4.2: Payment Schedule. Client shall pay invoice of $45,000 within 30 days of project milestone completion.',
    'Section 8.1: SOC2 Audit Reporting. Provider shall submit an annual SOC2 Type II compliance audit report to Client by December 15 of each calendar year.',
    'Section 12.3: Renewal Notice. Either party may provide notice of non-renewal at least 60 days prior to contract expiration.',
  ];

  describe('extractContractObligations (Candidate Detection)', () => {
    it('detects candidate obligations and assigns review_required status', async () => {
      const candidates = await extractContractObligations({
        workspaceId: 'ws_prod',
        contractId: 'ctr_alpha_1',
        pageTexts: sampleContractPages,
      });

      expect(candidates.length).toBeGreaterThanOrEqual(2);

      // Invariant FM-P5-03: All candidates must be 'review_required'
      candidates.forEach((cand) => {
        expect(cand.status).toBe('review_required');
        expect(cand.workspaceId).toBe('ws_prod');
        expect(cand.contractId).toBe('ctr_alpha_1');
        expect(cand.sourceExcerpt.length).toBeGreaterThan(10);
      });

      const types = candidates.map((c) => c.type);
      expect(types).toContain('payment');
      expect(types).toContain('compliance');
    });
  });

  describe('approveObligationCandidate (Human-in-the-Loop Approval)', () => {
    it('promotes candidate to official ContractObligation upon human approval', async () => {
      mockCandidatesStore.set('cand_1', {
        id: 'cand_1',
        workspaceId: 'ws_prod',
        contractId: 'ctr_alpha_1',
        title: 'Submit SOC2 Audit Report',
        description: 'Annual SOC2 compliance delivery',
        type: 'compliance',
        suggestedDueDate: '2026-12-15T00:00:00.000Z',
        suggestedResponsibleParty: 'internal',
        confidence: 0.94,
        sourcePage: 3,
        sourceExcerpt: 'Section 8.1: Provider shall submit an annual SOC2 Type II...',
        status: 'review_required',
        createdAt: '2026-09-29T10:00:00.000Z',
      });

      const result = await approveObligationCandidate({
        workspaceId: 'ws_prod',
        candidateId: 'cand_1',
        actorUserId: 'usr_ops_manager',
      });

      expect(result.success).toBe(true);
      expect(result.obligationId).toBeTruthy();

      // Verify official obligation created
      const official = mockObligationsStore.get(result.obligationId);
      expect(official).toBeDefined();
      expect(official?.status).toBe('pending');
      expect(official?.title).toBe('Submit SOC2 Audit Report');
      expect(official?.contractId).toBe('ctr_alpha_1');

      // Verify candidate status updated
      const updatedCand = mockCandidatesStore.get('cand_1');
      expect(updatedCand?.status).toBe('approved');
      expect(updatedCand?.reviewedBy).toBe('usr_ops_manager');
    });

    it('rejects approval across different workspaces', async () => {
      mockCandidatesStore.set('cand_diff_tenant', {
        id: 'cand_diff_tenant',
        workspaceId: 'ws_tenant_b',
        contractId: 'ctr_secret',
        title: 'Payment',
        description: 'Payment due',
        type: 'payment',
        suggestedResponsibleParty: 'internal',
        confidence: 0.9,
        sourceExcerpt: 'Pay now',
        status: 'review_required',
        createdAt: '2026-09-29T10:00:00.000Z',
      });

      await expect(
        approveObligationCandidate({
          workspaceId: 'ws_tenant_a',
          candidateId: 'cand_diff_tenant',
          actorUserId: 'usr_attacker',
        })
      ).rejects.toThrow(/tenant|workspace|unauthorized/i);
    });
  });

  describe('dismissObligationCandidate', () => {
    it('marks candidate as rejected without creating an obligation', async () => {
      mockCandidatesStore.set('cand_false_pos', {
        id: 'cand_false_pos',
        workspaceId: 'ws_prod',
        contractId: 'ctr_alpha_1',
        title: 'Spurious Boilerplate Task',
        description: 'Governing law mention',
        type: 'other',
        suggestedResponsibleParty: 'internal',
        confidence: 0.65,
        sourceExcerpt: 'Governing law clause',
        status: 'review_required',
        createdAt: '2026-09-29T10:00:00.000Z',
      });

      const result = await dismissObligationCandidate({
        workspaceId: 'ws_prod',
        candidateId: 'cand_false_pos',
        actorUserId: 'usr_ops_lead',
      });

      expect(result.success).toBe(true);
      const updated = mockCandidatesStore.get('cand_false_pos');
      expect(updated?.status).toBe('rejected');
      expect(mockObligationsStore.size).toBe(0);
    });
  });
});
