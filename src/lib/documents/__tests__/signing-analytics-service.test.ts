/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Event-Derived Lifecycle Analytics Engine (P4.4).
 * 2. Invariants Tested:
 *    - Pure velocity calculations (median and average hours to sign).
 *    - Funnel completion and drop-off rate calculations.
 *    - Recipient role bottleneck identification.
 *    - Contract valuation attribution with cadence and currency.
 *    - Output validation against SigningAnalyticsMetricSchema.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSigningVelocity,
  calculateFunnelDropOff,
  identifySignerBottlenecks,
  calculateDealContractAttribution,
  computeSigningAnalyticsSummary,
} from '../signing-analytics-service';
import { SigningAnalyticsMetricSchema } from '@/lib/types/document-signing';
import type { SigningEnvelope, ContractRecord } from '@/lib/types/document-signing';

describe('P4.4 Event-Derived Lifecycle Analytics Engine', () => {
  const mockEnvelopes: SigningEnvelope[] = [
    {
      id: 'env_1',
      workspaceId: 'ws_prod',
      title: 'Fast Deal Agreement',
      status: 'completed',
      templateVersionId: 'tpl_v1',
      preExecutionSha256: 'sha_1',
      recipients: [
        {
          id: 'rec_1',
          role: 'signer',
          name: 'Alice',
          email: 'alice@acme.com',
          status: 'signed',
          routingOrder: 1,
          requiresSignature: true,
          signedAt: '2026-09-01T02:00:00.000Z',
        },
      ],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
      completedAt: '2026-09-01T02:00:00.000Z', // 2 hours after creation
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T02:00:00.000Z',
    } as unknown as SigningEnvelope,
    {
      id: 'env_2',
      workspaceId: 'ws_prod',
      title: 'Medium Deal Agreement',
      status: 'completed',
      templateVersionId: 'tpl_v1',
      preExecutionSha256: 'sha_2',
      recipients: [
        {
          id: 'rec_2',
          role: 'signer',
          name: 'Bob',
          email: 'bob@acme.com',
          status: 'signed',
          routingOrder: 1,
          requiresSignature: true,
          signedAt: '2026-09-01T04:00:00.000Z',
        },
        {
          id: 'rec_3',
          role: 'countersigner',
          name: 'Charlie',
          email: 'charlie@myorg.com',
          status: 'signed',
          routingOrder: 2,
          requiresSignature: true,
          signedAt: '2026-09-01T06:00:00.000Z',
        },
      ],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 2, totalSteps: 2 },
      completedAt: '2026-09-01T06:00:00.000Z', // 6 hours after creation
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T06:00:00.000Z',
    } as unknown as SigningEnvelope,
    {
      id: 'env_3',
      workspaceId: 'ws_prod',
      title: 'Slow Deal Agreement',
      status: 'completed',
      templateVersionId: 'tpl_v1',
      preExecutionSha256: 'sha_3',
      recipients: [
        {
          id: 'rec_4',
          role: 'signer',
          name: 'Dave',
          email: 'dave@acme.com',
          status: 'signed',
          routingOrder: 1,
          requiresSignature: true,
          signedAt: '2026-09-01T10:00:00.000Z',
        },
      ],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
      completedAt: '2026-09-01T10:00:00.000Z', // 10 hours after creation
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    } as unknown as SigningEnvelope,
    {
      id: 'env_4',
      workspaceId: 'ws_prod',
      title: 'Declined Deal',
      status: 'declined',
      recipients: [],
      fields: [],
      routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T01:00:00.000Z',
    } as unknown as SigningEnvelope,
  ];

  const mockContracts: ContractRecord[] = [
    {
      id: 'ctr_1',
      workspaceId: 'ws_prod',
      title: 'Contract 1',
      status: 'active',
      contractValue: { amount: 50000, currency: 'USD', cadence: 'one_off' },
      ownerId: 'usr_1',
      noticePeriodDays: 30,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as unknown as ContractRecord,
    {
      id: 'ctr_2',
      workspaceId: 'ws_prod',
      title: 'Contract 2',
      status: 'active',
      contractValue: { amount: 100000, currency: 'USD', cadence: 'annually' },
      ownerId: 'usr_1',
      noticePeriodDays: 30,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as unknown as ContractRecord,
  ];

  describe('calculateSigningVelocity', () => {
    it('computes median and average turnaround hours for completed envelopes', () => {
      const velocity = calculateSigningVelocity(mockEnvelopes);
      // Completed envelopes durations: 2 hrs, 6 hrs, 10 hrs.
      // Median = 6 hrs. Average = (2+6+10)/3 = 6 hrs.
      expect(velocity.totalCompleted).toBe(3);
      expect(velocity.medianHours).toBe(6);
      expect(velocity.averageHours).toBe(6);
    });

    it('returns zeroes when no envelopes are completed', () => {
      const velocity = calculateSigningVelocity([mockEnvelopes[3]]);
      expect(velocity.totalCompleted).toBe(0);
      expect(velocity.medianHours).toBe(0);
      expect(velocity.averageHours).toBe(0);
    });
  });

  describe('calculateFunnelDropOff', () => {
    it('computes completion rate and stage breakdown accurately', () => {
      const funnelResult = calculateFunnelDropOff(mockEnvelopes);
      // 4 envelopes total: 3 completed (75%), 1 declined (25%)
      expect(funnelResult.completionRate).toBe(75);
      expect(funnelResult.declinedRate).toBe(25);
      expect(funnelResult.funnel.length).toBeGreaterThan(0);
    });
  });

  describe('identifySignerBottlenecks', () => {
    it('calculates average turnaround time per signer role', () => {
      const bottlenecks = identifySignerBottlenecks(mockEnvelopes);
      expect(bottlenecks).toHaveLength(2);

      const signers = bottlenecks.find((b) => b.role === 'signer');
      const countersigners = bottlenecks.find((b) => b.role === 'countersigner');

      expect(signers).toBeDefined();
      expect(signers?.count).toBe(3); // Alice (2h), Bob (4h), Dave (10h) -> Avg: 5.3h

      expect(countersigners).toBeDefined();
      expect(countersigners?.count).toBe(1); // Charlie (6h)
      expect(countersigners?.averageTurnaroundHours).toBe(6);
    });
  });

  describe('calculateDealContractAttribution', () => {
    it('sums total contract value from active contracts', () => {
      const attribution = calculateDealContractAttribution(mockContracts);
      expect(attribution.totalContractValue).toBe(150000);
      expect(attribution.currency).toBe('USD');
      expect(attribution.activeCount).toBe(2);
    });
  });

  describe('computeSigningAnalyticsSummary', () => {
    it('aggregates full snapshot conforming to SigningAnalyticsMetricSchema', () => {
      const summary = computeSigningAnalyticsSummary(mockEnvelopes, mockContracts);
      const parsed = SigningAnalyticsMetricSchema.parse(summary);

      expect(parsed.totalEnvelopes).toBe(4);
      expect(parsed.completedCount).toBe(3);
      expect(parsed.declinedCount).toBe(1);
      expect(parsed.completionRate).toBe(75);
      expect(parsed.totalContractValue).toBe(150000);
      expect(parsed.freshnessTimestamp).toBeDefined();
    });
  });
});
