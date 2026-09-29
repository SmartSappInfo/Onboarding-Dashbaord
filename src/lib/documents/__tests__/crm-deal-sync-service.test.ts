/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for CRM Master-Record Federation & Bi-Directional Deal Stage Sync (P4.1 & P4.2).
 * 2. Invariants Tested:
 *    - Tenant isolation: linking deals and envelopes requires matching workspaceId (FM-P4-04).
 *    - Deal stage and contract status synchronizer on sent, signed, and declined (FM-P4-01).
 *    - Contract value attribution with cadence (monthly ARR vs one-off) (FM-P4-08).
 *    - Reverse task completion hook: completing CRM tasks fulfills contractual obligations.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Deal } from '@/lib/types';
import type { SigningEnvelope, ContractObligation } from '@/lib/types/document-signing';

const mockDealsStore: Map<string, Deal> = new Map();
const mockEnvelopesStore: Map<string, SigningEnvelope> = new Map();
const mockObligationsStore: Map<string, ContractObligation> = new Map();
const mockCrmLinksStore: Array<Record<string, unknown>> = [];

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'deals') {
        return {
          doc: vi.fn().mockImplementation((dealId: string) => ({
            get: vi.fn().mockImplementation(async () => {
              const data = mockDealsStore.get(dealId);
              return {
                exists: !!data,
                id: dealId,
                data: () => data,
              };
            }),
            update: vi.fn().mockImplementation(async (updates: Partial<Deal>) => {
              const existing = mockDealsStore.get(dealId);
              if (!existing) throw new Error('Deal not found');
              mockDealsStore.set(dealId, { ...existing, ...updates });
              return {};
            }),
          })),
          where: vi.fn().mockImplementation((field: string, op: string, val: string) => {
            const allDeals = Array.from(mockDealsStore.values());
            let filtered = allDeals.filter(
              (item) => (item as unknown as Record<string, unknown>)[field] === val
            );
            const queryObj: {
              where: ReturnType<typeof vi.fn>;
              limit: ReturnType<typeof vi.fn>;
              get: ReturnType<typeof vi.fn>;
            } = {
              where: vi.fn().mockImplementation((nextField: string, nextOp: string, nextVal: string) => {
                filtered = filtered.filter(
                  (item) => (item as unknown as Record<string, unknown>)[nextField] === nextVal
                );
                return queryObj;
              }),
              limit: vi.fn().mockImplementation(() => queryObj),
              get: vi.fn().mockImplementation(async () => ({
                empty: filtered.length === 0,
                docs: filtered.map((d) => ({
                  id: d.id,
                  data: () => d,
                })),
              })),
            };
            return queryObj;
          }),
        };
      }
      if (colName === 'signing_envelopes') {
        return {
          doc: vi.fn().mockImplementation((envId: string) => ({
            get: vi.fn().mockImplementation(async () => {
              const data = mockEnvelopesStore.get(envId);
              return {
                exists: !!data,
                id: envId,
                data: () => data,
              };
            }),
            update: vi.fn().mockImplementation(async (updates: Partial<SigningEnvelope>) => {
              const existing = mockEnvelopesStore.get(envId);
              if (!existing) throw new Error('Envelope not found');
              mockEnvelopesStore.set(envId, { ...existing, ...updates });
              return {};
            }),
          })),
        };
      }
      if (colName === 'contract_obligations') {
        return {
          doc: vi.fn().mockImplementation((obId: string) => ({
            get: vi.fn().mockImplementation(async () => {
              const data = mockObligationsStore.get(obId);
              return {
                exists: !!data,
                id: obId,
                data: () => data,
              };
            }),
            update: vi.fn().mockImplementation(async (updates: Partial<ContractObligation>) => {
              const existing = mockObligationsStore.get(obId);
              if (!existing) throw new Error('Obligation not found');
              mockObligationsStore.set(obId, { ...existing, ...updates });
              return {};
            }),
          })),
        };
      }
      if (colName === 'crm_document_links') {
        return {
          doc: vi.fn().mockImplementation(() => ({
            set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
              mockCrmLinksStore.push(data);
              return {};
            }),
          })),
        };
      }
      return {};
    }),
  },
}));

// Mock Deal Event Bus & Document Event Bus
const mockEmitDealDomainEvent = vi.fn();
vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: (...args: unknown[]) => mockEmitDealDomainEvent(...args),
}));

const mockEmitDocumentDomainEvent = vi.fn();
vi.mock('@/lib/documents/document-event-bus', () => ({
  emitDocumentDomainEvent: (...args: unknown[]) => mockEmitDocumentDomainEvent(...args),
}));

import {
  syncEnvelopeWithDeal,
  handleEnvelopeSigned,
  handleEnvelopeDeclined,
  syncTaskCompletionToObligation,
} from '../crm-deal-sync-service';

describe('P4.1 CRM Deal Synchronization & Master-Record Federation', () => {
  beforeEach(() => {
    mockDealsStore.clear();
    mockEnvelopesStore.clear();
    mockObligationsStore.clear();
    mockCrmLinksStore.length = 0;
    mockEmitDealDomainEvent.mockClear();
    mockEmitDocumentDomainEvent.mockClear();
    vi.clearAllMocks();

    // Seed default Deal
    mockDealsStore.set('deal_123', {
      id: 'deal_123',
      name: 'Acme Enterprise Agreement',
      workspaceId: 'ws_prod',
      organizationId: 'org_1',
      stageId: 'stage_negotiation',
      status: 'open',
      value: 50000,
      contractStatus: 'none',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as Deal);

    // Seed default Envelope
    mockEnvelopesStore.set('env_999', {
      id: 'env_999',
      workspaceId: 'ws_prod',
      title: 'MSA & SOW',
      status: 'sent',
      recipients: [],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
    } as unknown as SigningEnvelope);
  });

  describe('syncEnvelopeWithDeal (Dispatch / Out for Signature)', () => {
    it('links envelope to deal, sets contractStatus = out_for_signature and emits deal.contract.sent', async () => {
      const result = await syncEnvelopeWithDeal({
        workspaceId: 'ws_prod',
        dealId: 'deal_123',
        envelopeId: 'env_999',
        contractId: 'ctr_001',
      });

      expect(result.success).toBe(true);

      const updatedDeal = mockDealsStore.get('deal_123');
      expect(updatedDeal?.contractId).toBe('ctr_001');
      expect(updatedDeal?.contractStatus).toBe('out_for_signature');

      expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
        'deal.contract.sent',
        expect.objectContaining({
          dealId: 'deal_123',
          envelopeId: 'env_999',
          contractId: 'ctr_001',
        })
      );

      // Verify CrmDocumentLink persisted
      expect(mockCrmLinksStore).toHaveLength(1);
      expect(mockCrmLinksStore[0].dealId).toBe('deal_123');
    });

    it('rejects cross-tenant linking if workspaceId does not match (FM-P4-04)', async () => {
      await expect(
        syncEnvelopeWithDeal({
          workspaceId: 'ws_other_workspace',
          dealId: 'deal_123',
          envelopeId: 'env_999',
        })
      ).rejects.toThrow(/workspace/i);
    });
  });

  describe('handleEnvelopeSigned (Execution / Won)', () => {
    it('advances deal to won, sets contractStatus = signed and normalizes monthly ARR (FM-P4-01 & FM-P4-08)', async () => {
      const result = await handleEnvelopeSigned({
        workspaceId: 'ws_prod',
        dealId: 'deal_123',
        envelopeId: 'env_999',
        contractValue: {
          amount: 5000,
          currency: 'USD',
          cadence: 'monthly',
        },
      });

      expect(result.success).toBe(true);
      expect(result.dealUpdated).toBe(true);

      const updatedDeal = mockDealsStore.get('deal_123');
      expect(updatedDeal?.contractStatus).toBe('signed');
      expect(updatedDeal?.status).toBe('won');
      expect(updatedDeal?.mrr).toBe(5000);
      expect(updatedDeal?.arr).toBe(60000);
      expect(updatedDeal?.value).toBe(60000);

      expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
        'deal.contract.signed',
        expect.objectContaining({
          dealId: 'deal_123',
          envelopeId: 'env_999',
        })
      );
    });

    it('handles one-off contract valuation without setting MRR', async () => {
      const result = await handleEnvelopeSigned({
        workspaceId: 'ws_prod',
        dealId: 'deal_123',
        envelopeId: 'env_999',
        contractValue: {
          amount: 15000,
          currency: 'USD',
          cadence: 'one_off',
        },
      });

      expect(result.success).toBe(true);
      const updatedDeal = mockDealsStore.get('deal_123');
      expect(updatedDeal?.value).toBe(15000);
      expect(updatedDeal?.mrr).toBeUndefined();
    });
  });

  describe('handleEnvelopeDeclined', () => {
    it('updates deal contractStatus = declined and emits deal.contract.declined (FM-P4-01)', async () => {
      const result = await handleEnvelopeDeclined({
        workspaceId: 'ws_prod',
        dealId: 'deal_123',
        envelopeId: 'env_999',
        reason: 'Client requested modified indemnity terms',
      });

      expect(result.success).toBe(true);
      const updatedDeal = mockDealsStore.get('deal_123');
      expect(updatedDeal?.contractStatus).toBe('declined');

      expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
        'deal.contract.declined',
        expect.objectContaining({
          dealId: 'deal_123',
          envelopeId: 'env_999',
        })
      );
    });
  });

  describe('syncTaskCompletionToObligation (Reverse Hook)', () => {
    it('marks contractual obligation fulfilled when CRM task completes', async () => {
      mockObligationsStore.set('ob_1', {
        id: 'ob_1',
        workspaceId: 'ws_prod',
        type: 'compliance',
        contractId: 'ctr_001',
        title: 'Submit SOC2 Audit Report',
        status: 'pending',
        dueDate: '2026-10-15T00:00:00.000Z',
        responsibleParty: 'internal',
        linkedTaskId: 'task_abc_1',
        reminderDaysBefore: [7, 14],
        createdAt: '2026-09-29T00:00:00.000Z',
        updatedAt: '2026-09-29T00:00:00.000Z',
      });

      const result = await syncTaskCompletionToObligation({
        workspaceId: 'ws_prod',
        taskId: 'task_abc_1',
        contractId: 'ctr_001',
        obligationId: 'ob_1',
        actorUserId: 'usr_ops_lead',
      });

      expect(result.success).toBe(true);
      expect(result.obligationUpdated).toBe(true);

      const updated = mockObligationsStore.get('ob_1');
      expect(updated?.status).toBe('fulfilled');
      expect(updated?.fulfilledBy).toBe('usr_ops_lead');
      expect(updated?.fulfilledAt).toBeDefined();

      expect(mockEmitDocumentDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'obligation.fulfilled',
          contractId: 'ctr_001',
        })
      );
    });

    // SECURITY (PR-0 review, 2026-09-29): only the task the obligation created may fulfil it.
    function seedObligation(id: string, overrides: Partial<ContractObligation> = {}): void {
      mockObligationsStore.set(id, {
        id,
        workspaceId: 'ws_prod',
        type: 'compliance',
        contractId: 'ctr_001',
        title: 'Deliver onboarding pack',
        status: 'pending',
        dueDate: '2026-10-15T00:00:00.000Z',
        responsibleParty: 'internal',
        linkedTaskId: 'task_linked',
        reminderDaysBefore: [7],
        createdAt: '2026-09-29T00:00:00.000Z',
        updatedAt: '2026-09-29T00:00:00.000Z',
        ...overrides,
      });
    }

    it('refuses to fulfil from a task that is not the obligation\'s linked task', async () => {
      seedObligation('ob_foreign_task');
      const result = await syncTaskCompletionToObligation({
        workspaceId: 'ws_prod',
        taskId: 'task_someone_else_pointed_here',
        contractId: 'ctr_001',
        obligationId: 'ob_foreign_task',
        actorUserId: 'usr_low_priv',
      });
      expect(result).toEqual({ success: true, obligationUpdated: false });
      expect(mockObligationsStore.get('ob_foreign_task')?.status).toBe('pending');
    });

    it('refuses to fulfil when the task claims a different contract', async () => {
      seedObligation('ob_foreign_contract');
      const result = await syncTaskCompletionToObligation({
        workspaceId: 'ws_prod',
        taskId: 'task_linked',
        contractId: 'survey_123',
        obligationId: 'ob_foreign_contract',
      });
      expect(result.obligationUpdated).toBe(false);
      expect(mockObligationsStore.get('ob_foreign_contract')?.status).toBe('pending');
    });

    it('is idempotent for an obligation that is already fulfilled (forward sync re-fires the hook)', async () => {
      seedObligation('ob_done', { status: 'fulfilled', fulfilledAt: '2026-09-01T00:00:00.000Z', fulfilledBy: 'usr_a' });
      const result = await syncTaskCompletionToObligation({
        workspaceId: 'ws_prod',
        taskId: 'task_linked',
        contractId: 'ctr_001',
        obligationId: 'ob_done',
        actorUserId: 'usr_b',
      });
      expect(result.obligationUpdated).toBe(false);
      expect(mockObligationsStore.get('ob_done')).toMatchObject({ fulfilledAt: '2026-09-01T00:00:00.000Z', fulfilledBy: 'usr_a' });
    });
  });
});
