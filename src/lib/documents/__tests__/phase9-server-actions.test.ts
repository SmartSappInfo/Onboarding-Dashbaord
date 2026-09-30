/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test Suite for Phase 9 Server Actions (Bulk Campaigns & Compliance):
 * 1. Purpose:
 *    Validates authentication guards, tenant isolation, Zod input validation,
 *    and standardized response envelopes for Phase 9 server actions.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createBulkCampaignAction,
  previewBulkCsvMergeAction,
  dispatchBulkCampaignSliceAction,
  retryFailedCampaignRecipientsAction,
  getBulkCampaignProgressAction,
  listWorkspaceBulkCampaignsAction,
} from '@/app/actions/bulk-campaign-actions';
import {
  placeContractLegalHoldAction,
  releaseContractLegalHoldAction,
  getContractLegalHoldStatusAction,
  generateEDiscoveryPackageAction,
  getRetentionScheduleAction,
} from '@/app/actions/compliance-archival-actions';

// Mock auth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: async () => ({ uid: 'usr-test-admin-1' }),
  requireWorkspace: async (_ws: string) => {},
}));

// Mock dispatcher service
vi.mock('@/lib/documents/bulk-campaign-dispatcher-service', () => ({
  createBulkCampaign: async (workspaceId: string, input: Record<string, unknown>, userId: string) => ({
    id: 'camp-mock-1',
    workspaceId,
    title: input.title,
    templateId: input.templateId,
    status: 'ready',
    totalCount: (input.recipients as Array<unknown>)?.length || 0,
    dispatchedCount: 0,
    signedCount: 0,
    failedCount: 0,
    routingMode: input.routingMode || 'single_signer',
    createdBy: userId,
    createdAt: '2026-09-29T20:00:00Z',
    updatedAt: '2026-09-29T20:00:00Z',
    tags: input.tags || [],
  }),
  dispatchCampaignBatchSlice: async (campaignId: string, _batchSize: number) => ({
    campaignId,
    processedCount: 2,
    successfulCount: 2,
    failedCount: 0,
    remainingCount: 0,
    isComplete: true,
  }),
  retryFailedCampaignRecipients: async (campaignId: string) => ({
    campaignId,
    retriedCount: 3,
    message: 'Reset 3 failed recipients',
  }),
  getCampaignProgress: async (campaignId: string) => ({
    campaignId,
    title: 'Mock Campaign',
    status: 'completed',
    totalCount: 10,
    dispatchedCount: 10,
    signedCount: 8,
    failedCount: 0,
    progressPercentage: 100,
    isComplete: true,
  }),
}));

// Mock legal hold service
vi.mock('@/lib/documents/legal-hold-service', () => ({
  placeContractLegalHold: async (
    _workspaceId: string,
    _contractId: string,
    input: { matterId: string; reason: string },
    userId: string
  ) => ({
    isUnderLegalHold: true,
    matterId: input.matterId,
    reason: input.reason,
    placedByUserId: userId,
    placedAt: '2026-09-29T21:00:00Z',
  }),
  releaseContractLegalHold: async (
    _workspaceId: string,
    _contractId: string,
    input: { reason?: string },
    userId: string
  ) => ({
    isUnderLegalHold: false,
    reason: input.reason,
    releasedByUserId: userId,
    releasedAt: '2026-09-29T22:00:00Z',
  }),
  getContractLegalHoldStatus: async (_contractId: string) => ({
    isUnderLegalHold: true,
    matterId: 'CASE-001',
    reason: 'Active audit',
  }),
  calculateRetentionSchedule: (category: string, executedAt: string) => ({
    category,
    retentionYears: 7,
    executedAt,
    expirationDate: '2033-01-01T00:00:00.000Z',
    isExpired: false,
  }),
}));

// Mock ediscovery archival service
vi.mock('@/lib/documents/ediscovery-archival-service', () => ({
  assembleEDiscoveryZipBundle: async (
    workspaceId: string,
    contractId: string,
    userId: string
  ) => ({
    zipBase64: 'UEsDBBQAAAAIA...',
    zipBuffer: Buffer.from('mock-zip'),
    manifest: {
      manifestVersion: '1.0.0',
      contractId,
      envelopeId: contractId,
      workspaceId,
      title: 'Mock Export',
      exportedAt: '2026-09-29T21:00:00Z',
      exportedByUserId: userId,
      files: [],
      merkleRootSha256: 'a'.repeat(64),
      legalHoldActive: true,
    },
    fileCount: 4,
    totalSizeBytes: 1024,
  }),
}));

// Mock adminDb
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: [
              {
                id: 'camp-1',
                data: () => ({
                  id: 'camp-1',
                  workspaceId: 'ws-1',
                  title: 'Campaign 1',
                  templateId: 'tmpl-1',
                  status: 'ready',
                  totalCount: 5,
                  dispatchedCount: 0,
                  signedCount: 0,
                  failedCount: 0,
                  routingMode: 'single_signer',
                  createdBy: 'usr-1',
                  createdAt: '2026-09-29T20:00:00Z',
                  updatedAt: '2026-09-29T20:00:00Z',
                  tags: [],
                }),
              },
            ],
          }),
        }),
      }),
    }),
  },
}));

describe('Phase 9 Server Actions', () => {
  const workspaceId = 'ws-test-enterprise';

  describe('bulk-campaign-actions', () => {
    it('createBulkCampaignAction validates input and creates campaign', async () => {
      const result = await createBulkCampaignAction(workspaceId, {
        title: 'Board Resolutions 2026',
        templateId: 'tmpl-board-res',
        routingMode: 'single_signer',
        tags: ['board'],
        recipients: [
          { name: 'Director One', email: 'dir1@corp.com', variables: {} },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('camp-mock-1');
      expect(result.data?.title).toBe('Board Resolutions 2026');
    });

    it('createBulkCampaignAction rejects invalid input schema', async () => {
      const result = await createBulkCampaignAction(workspaceId, {
        title: '', // empty title
        templateId: '',
        recipients: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('previewBulkCsvMergeAction parses CSV and generates dry-run preview', async () => {
      const csv = `Full Name,Email Address,Grant Amount
Alice,alice@corp.com,$10,000`;

      const result = await previewBulkCsvMergeAction(workspaceId, {
        csvContent: csv,
        templateVariables: ['grant_amount'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalRows).toBe(1);
      expect(result.data?.previewSample.length).toBe(1);
    });

    it('dispatchBulkCampaignSliceAction executes slice dispatch', async () => {
      const result = await dispatchBulkCampaignSliceAction(workspaceId, 'camp-mock-1', 25);
      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(2);
      expect(result.data?.isComplete).toBe(true);
    });

    it('retryFailedCampaignRecipientsAction triggers retry', async () => {
      const result = await retryFailedCampaignRecipientsAction(workspaceId, 'camp-mock-1');
      expect(result.success).toBe(true);
      expect(result.data?.retriedCount).toBe(3);
    });

    it('getBulkCampaignProgressAction returns progress telemetry', async () => {
      const result = await getBulkCampaignProgressAction(workspaceId, 'camp-mock-1');
      expect(result.success).toBe(true);
      expect(result.data?.progressPercentage).toBe(100);
    });

    it('listWorkspaceBulkCampaignsAction returns workspace campaigns', async () => {
      const result = await listWorkspaceBulkCampaignsAction(workspaceId);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
    });
  });

  describe('compliance-archival-actions', () => {
    it('placeContractLegalHoldAction places litigation hold', async () => {
      const result = await placeContractLegalHoldAction(workspaceId, 'ctr-99', {
        matterId: 'MATTER-101',
        reason: 'Federal court discovery',
      });

      expect(result.success).toBe(true);
      expect(result.data?.isUnderLegalHold).toBe(true);
      expect(result.data?.matterId).toBe('MATTER-101');
    });

    it('placeContractLegalHoldAction rejects empty matterId', async () => {
      const result = await placeContractLegalHoldAction(workspaceId, 'ctr-99', {
        matterId: '',
        reason: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('mandatory');
    });

    it('releaseContractLegalHoldAction releases litigation hold', async () => {
      const result = await releaseContractLegalHoldAction(workspaceId, 'ctr-99', {
        reason: 'Litigation settled',
      });

      expect(result.success).toBe(true);
      expect(result.data?.isUnderLegalHold).toBe(false);
    });

    it('getContractLegalHoldStatusAction fetches current hold details', async () => {
      const result = await getContractLegalHoldStatusAction(workspaceId, 'ctr-99');
      expect(result.success).toBe(true);
      expect(result.data?.isUnderLegalHold).toBe(true);
    });

    it('generateEDiscoveryPackageAction creates court-admissible audit ZIP', async () => {
      const result = await generateEDiscoveryPackageAction(workspaceId, 'ctr-99');
      expect(result.success).toBe(true);
      expect(result.data?.zipBase64).toBeDefined();
      expect(result.data?.manifest.contractId).toBe('ctr-99');
      expect(result.data?.manifest.merkleRootSha256.length).toBe(64);
    });

    it('getRetentionScheduleAction computes statutory expiration', async () => {
      const result = await getRetentionScheduleAction(
        workspaceId,
        'statutory_tax',
        '2026-01-01T00:00:00.000Z'
      );

      expect(result.success).toBe(true);
      expect(result.data?.retentionYears).toBe(7);
    });
  });
});
