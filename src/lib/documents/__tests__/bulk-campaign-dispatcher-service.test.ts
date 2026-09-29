/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test Suite for Bulk Campaign Dispatcher Service (Phase 9):
 * 1. Purpose:
 *    Validates chunked batch slice processing, deterministic idempotency keys,
 *    and partial failure isolation.
 * 2. Invariants Checked:
 *    - FM-P9-02: Idempotent deduplication prevents double send.
 *    - FM-P9-03: Safe retry targets strictly failed recipients without resend storm.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deriveRecipientIdempotencyKey,
  createBulkCampaign,
  dispatchCampaignBatchSlice,
  retryFailedCampaignRecipients,
  getCampaignProgress,
} from '../bulk-campaign-dispatcher-service';
import { CreateBulkCampaignRequest } from '@/lib/types/document-signing';

// Mock in-memory Firestore
const mockCampaigns = new Map<string, Record<string, unknown>>();
const mockRecipients = new Map<string, Record<string, unknown>>();
const mockEnvelopes = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    FieldValue: {
      increment: (n: number) => ({ __type: 'increment', value: n }),
      delete: () => '__FIELD_DELETE__',
    },
    adminDb: {
      collection: (coll: string) => {
        if (coll === 'bulk_campaigns') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockCampaigns.has(id),
                data: () => mockCampaigns.get(id),
              }),
              set: async (data: Record<string, unknown>) => {
                mockCampaigns.set(id, { ...data });
              },
              update: async (updates: Record<string, unknown>) => {
                const current = mockCampaigns.get(id) || {};
                const next = { ...current };
                Object.entries(updates).forEach(([k, v]) => {
                  if (v && typeof v === 'object' && (v as { __type?: string }).__type === 'increment') {
                    next[k] = ((current[k] as number) || 0) + ((v as { value: number }).value || 0);
                  } else {
                    next[k] = v;
                  }
                });
                mockCampaigns.set(id, next);
              },
            }),
          };
        }

        if (coll === 'bulk_campaign_recipients') {
          return {
            doc: (id: string) => ({
              set: async (data: Record<string, unknown>) => {
                mockRecipients.set(id, { ...data });
              },
              update: async (updates: Record<string, unknown>) => {
                const current = mockRecipients.get(id) || {};
                mockRecipients.set(id, { ...current, ...updates });
              },
            }),
            where: (field1: string, op1: string, val1: unknown) => ({
              where: (field2: string, op2: string, val2: unknown) => ({
                limit: (lim: number) => ({
                  get: async () => {
                    const matches: Array<{ id: string; ref: { update: (u: Record<string, unknown>) => Promise<void> }; data: () => Record<string, unknown> }> = [];
                    for (const [id, r] of mockRecipients.entries()) {
                      if (r[field1] === val1 && r[field2] === val2) {
                        matches.push({
                          id,
                          ref: {
                            update: async (updates: Record<string, unknown>) => {
                              const curr = mockRecipients.get(id) || {};
                              mockRecipients.set(id, { ...curr, ...updates });
                            },
                          },
                          data: () => r,
                        });
                        if (matches.length >= lim) break;
                      }
                    }
                    return {
                      empty: matches.length === 0,
                      docs: matches,
                    };
                  },
                }),
                get: async () => {
                  const matches: Array<{ id: string; ref: { update: (u: Record<string, unknown>) => Promise<void> }; data: () => Record<string, unknown> }> = [];
                  for (const [id, r] of mockRecipients.entries()) {
                    if (r[field1] === val1 && r[field2] === val2) {
                      matches.push({
                        id,
                        ref: {
                          update: async (updates: Record<string, unknown>) => {
                            const curr = mockRecipients.get(id) || {};
                            mockRecipients.set(id, { ...curr, ...updates });
                          },
                        },
                        data: () => r,
                      });
                    }
                  }
                  return {
                    empty: matches.length === 0,
                    docs: matches,
                  };
                },
              }),
            }),
          };
        }

        if (coll === 'signing_envelopes') {
          return {
            doc: (id: string) => ({
              set: async (data: Record<string, unknown>) => {
                mockEnvelopes.set(id, { ...data });
              },
            }),
            where: (_field: string, _op: string, _val: unknown) => ({
              limit: (_l: number) => ({
                get: async () => ({
                  empty: true,
                  docs: [],
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected collection in test: ${coll}`);
      },
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          set: (docRef: { set?: (data: Record<string, unknown>) => Promise<void> }, data: Record<string, unknown>) => {
            operations.push(() => {
              if (docRef.set) void docRef.set(data);
            });
          },
          update: (docRef: { update?: (data: Record<string, unknown>) => Promise<void> }, updates: Record<string, unknown>) => {
            operations.push(() => {
              if (docRef.update) void docRef.update(updates);
            });
          },
          commit: async () => {
            operations.forEach((op) => op());
          },
        };
      },
    },
  };
});

describe('Bulk Campaign Dispatcher Service', () => {
  beforeEach(() => {
    mockCampaigns.clear();
    mockRecipients.clear();
    mockEnvelopes.clear();
  });

  describe('deriveRecipientIdempotencyKey (FM-P9-02)', () => {
    it('produces deterministic key for identical recipient & campaign', () => {
      const key1 = deriveRecipientIdempotencyKey('camp-1', 'john@test.com', { role: 'Lead', dept: 'Eng' });
      const key2 = deriveRecipientIdempotencyKey('camp-1', 'john@test.com', { dept: 'Eng', role: 'Lead' });
      expect(key1).toBe(key2);
      expect(key1.startsWith('idemp_camp-1_john@test.com_')).toBe(true);
    });

    it('produces distinct keys for different emails or variables', () => {
      const key1 = deriveRecipientIdempotencyKey('camp-1', 'user1@test.com', { a: '1' });
      const key2 = deriveRecipientIdempotencyKey('camp-1', 'user2@test.com', { a: '1' });
      const key3 = deriveRecipientIdempotencyKey('camp-1', 'user1@test.com', { a: '2' });
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('createBulkCampaign & stageBulkRecipients', () => {
    it('creates campaign aggregate and stages recipients in queued status', async () => {
      const input: CreateBulkCampaignRequest = {
        title: 'Q4 Global Grant Agreements',
        templateId: 'tmpl-grant-1',
        routingMode: 'single_signer',
        tags: ['grants', 'q4'],
        recipients: [
          { name: 'Alice Walker', email: 'alice@corp.com', variables: { grantAmount: '$5,000' } },
          { name: 'Bob Smith', email: 'bob@corp.com', variables: { grantAmount: '$7,500' } },
        ],
      };

      const campaign = await createBulkCampaign('ws-enterprise', input, 'usr-exec-1');

      expect(campaign.id).toBeDefined();
      expect(campaign.title).toBe('Q4 Global Grant Agreements');
      expect(campaign.totalCount).toBe(2);
      expect(campaign.status).toBe('ready');

      expect(mockCampaigns.has(campaign.id)).toBe(true);
      expect(mockRecipients.size).toBe(2);

      const stagedList = Array.from(mockRecipients.values());
      expect(stagedList[0].status).toBe('queued');
      expect(stagedList[1].status).toBe('queued');
    });
  });

  describe('dispatchCampaignBatchSlice & FM-P9-03 Partial Failure Isolation', () => {
    it('dispatches a slice of queued recipients and updates counts', async () => {
      const input: CreateBulkCampaignRequest = {
        title: 'Vendor SOWs',
        templateId: 'tmpl-sow',
        routingMode: 'single_signer',
        tags: [],
        recipients: [
          { name: 'Vendor A', email: 'a@vendor.com', variables: {} },
          { name: 'Vendor B', email: 'b@vendor.com', variables: {} },
        ],
      };

      const campaign = await createBulkCampaign('ws-ent', input, 'usr-1');
      const result = await dispatchCampaignBatchSlice(campaign.id, 10);

      expect(result.processedCount).toBe(2);
      expect(result.successfulCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockEnvelopes.size).toBe(2);

      const progress = await getCampaignProgress(campaign.id);
      expect(progress.dispatchedCount).toBe(2);
      expect(progress.progressPercentage).toBe(100);
      expect(progress.isComplete).toBe(true);
    });
  });

  describe('retryFailedCampaignRecipients (FM-P9-03)', () => {
    it('resets strictly failed recipients to queued without touching successful ones', async () => {
      const campaignId = 'camp-partial-retry';
      mockCampaigns.set(campaignId, {
        id: campaignId,
        title: 'Partial Retry Campaign',
        status: 'active',
        totalCount: 3,
        dispatchedCount: 2,
        failedCount: 1,
      });

      mockRecipients.set('rec-success-1', {
        id: 'rec-success-1',
        campaignId,
        name: 'Success 1',
        status: 'dispatched',
        envelopeId: 'env-1',
      });
      mockRecipients.set('rec-success-2', {
        id: 'rec-success-2',
        campaignId,
        name: 'Success 2',
        status: 'signed',
        envelopeId: 'env-2',
      });
      mockRecipients.set('rec-failed-3', {
        id: 'rec-failed-3',
        campaignId,
        name: 'Failed 3',
        status: 'failed',
        error: 'Network connection reset during gateway push',
      });

      const retryResult = await retryFailedCampaignRecipients(campaignId);

      expect(retryResult.retriedCount).toBe(1);

      // Verify success records remained completely intact
      expect(mockRecipients.get('rec-success-1')?.status).toBe('dispatched');
      expect(mockRecipients.get('rec-success-2')?.status).toBe('signed');

      // Verify failed record was reset to queued
      const failedRec = mockRecipients.get('rec-failed-3');
      expect(failedRec?.status).toBe('queued');

      // Verify campaign status reset to ready
      const updatedCampaign = mockCampaigns.get(campaignId);
      expect(updatedCampaign?.status).toBe('ready');
      expect(updatedCampaign?.failedCount).toBe(0);
    });
  });
});
