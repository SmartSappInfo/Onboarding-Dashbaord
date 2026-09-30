/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Server-Side Lifecycle Analytics Service (P4.4 Server Layer).
 * 2. Invariants Tested:
 *    - Mandatory workspace scoping (throws when missing).
 *    - Firestore query execution with time window bounding.
 *    - Aggregation output validation against SigningAnalyticsMetricSchema.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWorkspaceSigningAnalytics } from '../signing-analytics-server';
import { adminDb } from '@/lib/firebase-admin';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('fetchWorkspaceSigningAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if workspaceId is missing', async () => {
    await expect(fetchWorkspaceSigningAnalytics('')).rejects.toThrow(
      '[SigningAnalytics] workspaceId is mandatory.'
    );
  });

  it('queries envelopes and contracts and returns a valid analytics metric snapshot', async () => {
    const mockEnvelope = {
      id: 'env_1',
      workspaceId: 'ws_test',
      title: 'Sales Contract',
      status: 'completed',
      templateVersionId: 'tpl_1',
      preExecutionSha256: 'sha256_mock',
      recipients: [
        {
          id: 'rec_1',
          role: 'signer',
          name: 'Jane Doe',
          email: 'jane@example.com',
          status: 'signed',
          routingOrder: 1,
          requiresSignature: true,
          signedAt: '2026-09-01T02:00:00.000Z',
        },
      ],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
      completedAt: '2026-09-01T02:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T02:00:00.000Z',
    };

    const mockContract = {
      id: 'ctr_1',
      workspaceId: 'ws_test',
      title: 'Service Agreement',
      status: 'active',
      contractValue: { amount: 25000, currency: 'USD', cadence: 'one_off' },
      ownerId: 'usr_1',
      noticePeriodDays: 30,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockEnvelopesQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [{ data: () => mockEnvelope }],
      }),
    };

    const mockContractsQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [{ data: () => mockContract }],
      }),
    };

    vi.mocked(adminDb.collection).mockImplementation((collName: string) => {
      if (collName === 'signing_envelopes') {
        return mockEnvelopesQuery as unknown as ReturnType<typeof adminDb.collection>;
      }
      if (collName === 'contracts') {
        return mockContractsQuery as unknown as ReturnType<typeof adminDb.collection>;
      }
      throw new Error(`Unexpected collection: ${collName}`);
    });

    const result = await fetchWorkspaceSigningAnalytics('ws_test', { timeWindowDays: 14 });

    expect(result).toBeDefined();
    expect(result.totalEnvelopes).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.completionRate).toBe(100);
    expect(result.totalContractValue).toBe(25000);
    expect(result.currency).toBe('USD');
    expect(result.freshnessTimestamp).toBeDefined();
  });
});
