/**
 * @fileoverview Unit tests for Revenue Attribution & Predictive Forecasting Engine (Phase 7).
 *
 * Tests:
 * 1. autoBalanceAttributionWeights normalizes and clamps negative weights.
 * 2. calculateMultiTouchAttribution handles First-Touch, Last-Touch, Linear, Time-Decay, Position-Based, and Custom-Weighted.
 * 3. Exact penny reconciliation (sum of rep splits === dealValue without rounding leak).
 * 4. Fallback attribution for deals with zero touchpoints.
 * 5. runMonteCarloPipelineSimulation produces monotonic percentiles (P10 <= P50 <= P90).
 * 6. Seeded simulation produces deterministic reproducible outputs.
 * 7. detectDealSlippage accurately calculates slip velocity and severity tiers.
 * 8. calculateForecastPaceAttainment computes run rates and required daily pacing.
 */

import { describe, it, expect } from 'vitest';
import {
  autoBalanceAttributionWeights,
  calculateMultiTouchAttribution,
  runMonteCarloPipelineSimulation,
  detectDealSlippage,
  calculateForecastPaceAttainment,
  generateAiForecastExplanation,
  DEFAULT_FORECASTING_GOVERNANCE,
} from '../forecasting-engine';
import type {
  AttributionTouchpoint,
  CustomStageAttributionWeights,
} from '../types';

describe('forecasting-engine', () => {
  describe('autoBalanceAttributionWeights', () => {
    it('normalizes arbitrary stage weights so they sum to exactly 1.00', () => {
      const weights: CustomStageAttributionWeights = {
        lead: 0.3,
        discovery: 0.3,
        demo: 0.3,
        proposal: 0.3,
        closing: 0.3,
      };

      const balanced = autoBalanceAttributionWeights(weights);
      const sum =
        balanced.lead +
        balanced.discovery +
        balanced.demo +
        balanced.proposal +
        balanced.closing;

      expect(Math.round(sum * 100) / 100).toBe(1.0);
    });

    it('safely handles negative weights by clamping to non-negative numbers', () => {
      const weights: CustomStageAttributionWeights = {
        lead: -0.5,
        discovery: 0.4,
        demo: 0.4,
        proposal: 0.2,
        closing: -0.2,
      };

      const balanced = autoBalanceAttributionWeights(weights);
      expect(balanced.lead).toBe(0);
      expect(balanced.closing).toBe(0);

      const sum =
        balanced.lead +
        balanced.discovery +
        balanced.demo +
        balanced.proposal +
        balanced.closing;

      expect(Math.round(sum * 100) / 100).toBe(1.0);
    });

    it('defaults to equal distribution (0.20 each) if all weights are zero', () => {
      const weights: CustomStageAttributionWeights = {
        lead: 0,
        discovery: 0,
        demo: 0,
        proposal: 0,
        closing: 0,
      };

      const balanced = autoBalanceAttributionWeights(weights);
      expect(balanced.lead).toBe(0.2);
      expect(balanced.discovery).toBe(0.2);
      expect(balanced.demo).toBe(0.2);
      expect(balanced.proposal).toBe(0.2);
      expect(balanced.closing).toBe(0.2);
    });
  });

  describe('calculateMultiTouchAttribution', () => {
    const mockTouchpoints: AttributionTouchpoint[] = [
      {
        id: 't1',
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealId: 'd1',
        touchType: 'email',
        channel: 'email',
        actorId: 'usr_sdr',
        actorName: 'Kwame (SDR)',
        actorRole: 'sdr',
        title: 'Initial Outbound Email',
        timestamp: '2026-08-01T10:00:00Z',
        lifecycleStage: 'lead',
      },
      {
        id: 't2',
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealId: 'd1',
        touchType: 'meeting',
        channel: 'in_person',
        actorId: 'usr_ae',
        actorName: 'Ama (AE)',
        actorRole: 'ae',
        title: 'Discovery Meeting',
        timestamp: '2026-08-10T14:00:00Z',
        lifecycleStage: 'discovery',
      },
      {
        id: 't3',
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealId: 'd1',
        touchType: 'demo',
        channel: 'web',
        actorId: 'usr_se',
        actorName: 'Kofi (SE)',
        actorRole: 'se',
        title: 'Technical Deep Dive Demo',
        timestamp: '2026-08-18T11:00:00Z',
        lifecycleStage: 'demo',
      },
      {
        id: 't4',
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealId: 'd1',
        touchType: 'contract',
        channel: 'in_person',
        actorId: 'usr_ae',
        actorName: 'Ama (AE)',
        actorRole: 'ae',
        title: 'Contract Negotiation & Signing',
        timestamp: '2026-08-28T16:00:00Z',
        lifecycleStage: 'closing',
      },
    ];

    it('awards 100% credit to the first touch under first_touch model', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd1',
          name: 'Enterprise Cloud Expansion',
          value: 100000,
          currency: 'GHS',
          ownerId: 'usr_ae',
          ownerName: 'Ama',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: mockTouchpoints,
        model: 'first_touch',
      });

      expect(record.modelUsed).toBe('first_touch');
      expect(record.repSplits.length).toBe(1);
      expect(record.repSplits[0].actorId).toBe('usr_sdr');
      expect(record.repSplits[0].attributedAmount).toBe(100000);
      expect(record.repSplits[0].percentageCredit).toBe(100);
    });

    it('awards 100% credit to the last touch under last_touch model', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd1',
          name: 'Enterprise Cloud Expansion',
          value: 100000,
          currency: 'GHS',
          ownerId: 'usr_ae',
          ownerName: 'Ama',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: mockTouchpoints,
        model: 'last_touch',
      });

      expect(record.modelUsed).toBe('last_touch');
      expect(record.repSplits.length).toBe(1);
      expect(record.repSplits[0].actorId).toBe('usr_ae');
      expect(record.repSplits[0].attributedAmount).toBe(100000);
    });

    it('splits revenue equally under linear model', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd1',
          name: 'Enterprise Cloud Expansion',
          value: 100000,
          currency: 'GHS',
          ownerId: 'usr_ae',
          ownerName: 'Ama',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: mockTouchpoints,
        model: 'linear',
      });

      // 4 touches -> 25% each
      expect(record.touchpointSplits.length).toBe(4);
      expect(record.touchpointSplits[0].attributedAmount).toBe(25000);
      expect(record.touchpointSplits[1].attributedAmount).toBe(25000);

      // Rep Ama has 2 touches (25k + 25k = 50k)
      const amaSplit = record.repSplits.find((r) => r.actorId === 'usr_ae');
      expect(amaSplit?.attributedAmount).toBe(50000);
      expect(amaSplit?.percentageCredit).toBe(50);
    });

    it('applies position-based weighting (40% first, 40% last, 20% middle)', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd1',
          name: 'Enterprise Cloud Expansion',
          value: 100000,
          currency: 'GHS',
          ownerId: 'usr_ae',
          ownerName: 'Ama',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: mockTouchpoints,
        model: 'position_based',
      });

      // First touch (t1, Kwame SDR) gets 40% -> 40,000
      expect(record.touchpointSplits[0].attributedAmount).toBe(40000);
      // Last touch (t4, Ama AE) gets 40% -> 40,000
      expect(record.touchpointSplits[3].attributedAmount).toBe(40000);
      // Middle touches (t2, t3) share 20% -> 10,000 each
      expect(record.touchpointSplits[1].attributedAmount).toBe(10000);
      expect(record.touchpointSplits[2].attributedAmount).toBe(10000);

      // Reconciles to exactly 100,000
      const totalRepSplits = record.repSplits.reduce((acc, r) => acc + r.attributedAmount, 0);
      expect(totalRepSplits).toBe(100000);
    });

    it('reconciles multi-rep splits to the exact cent without rounding leakage on odd deal amounts', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd1',
          name: 'Enterprise Cloud Expansion',
          value: 33333.33, // Odd decimal amount that creates float round-off
          currency: 'GHS',
          ownerId: 'usr_ae',
          ownerName: 'Ama',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: mockTouchpoints,
        model: 'linear',
      });

      const totalAttributed = Math.round(
        record.repSplits.reduce((acc, r) => acc + r.attributedAmount, 0) * 100
      ) / 100;

      expect(totalAttributed).toBe(33333.33);
    });

    it('gracefully falls back to primary deal owner if deal has zero touchpoints', () => {
      const record = calculateMultiTouchAttribution({
        deal: {
          id: 'd_empty',
          name: 'Orphaned Opportunity',
          value: 50000,
          currency: 'GHS',
          ownerId: 'usr_owner',
          ownerName: 'Sarah Jenkins',
          closedAt: '2026-08-28T16:00:00Z',
        },
        touchpoints: [],
        model: 'position_based',
      });

      expect(record.repSplits.length).toBe(1);
      expect(record.repSplits[0].actorId).toBe('usr_owner');
      expect(record.repSplits[0].attributedAmount).toBe(50000);
      expect(record.repSplits[0].percentageCredit).toBe(100);
    });
  });

  describe('runMonteCarloPipelineSimulation', () => {
    const sampleDeals = [
      { id: '1', name: 'Deal 1', value: 100000, stageName: 'Proposal', healthScore: 85, forecastCategory: 'committed' as const },
      { id: '2', name: 'Deal 2', value: 80000, stageName: 'Negotiation', healthScore: 75, forecastCategory: 'likely' as const },
      { id: '3', name: 'Deal 3', value: 120000, stageName: 'Discovery', healthScore: 60, forecastCategory: 'best_case' as const },
      { id: '4', name: 'Deal 4', value: 50000, stageName: 'Demo', healthScore: 40, forecastCategory: 'upside' as const },
      { id: '5', name: 'Deal 5', value: 60000, stageName: 'Lead', healthScore: 20, forecastCategory: 'omitted' as const },
    ];

    it('produces monotonic percentiles: P10 <= P50 <= P90', () => {
      const result = runMonteCarloPipelineSimulation({
        deals: sampleDeals,
        iterations: 1000,
      });

      expect(result.iterations).toBe(1000);
      expect(result.dealCount).toBe(5);
      expect(result.totalPipelineValue).toBe(410000);
      expect(result.p10Floor).toBeLessThanOrEqual(result.p50Likely);
      expect(result.p50Likely).toBeLessThanOrEqual(result.p90Ceiling);
      expect(result.distributionBuckets.length).toBeGreaterThan(0);
    });

    it('generates reproducible outputs when seeded PRNG is supplied', () => {
      // Linear congruential pseudo-random generator with fixed seed
      let seed = 42;
      const seededRng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      let seed2 = 42;
      const seededRng2 = () => {
        seed2 = (seed2 * 9301 + 49297) % 233280;
        return seed2 / 233280;
      };

      const res1 = runMonteCarloPipelineSimulation({
        deals: sampleDeals,
        iterations: 500,
        randomFn: seededRng,
      });

      const res2 = runMonteCarloPipelineSimulation({
        deals: sampleDeals,
        iterations: 500,
        randomFn: seededRng2,
      });

      expect(res1.p50Likely).toBe(res2.p50Likely);
      expect(res1.p10Floor).toBe(res2.p10Floor);
      expect(res1.p90Ceiling).toBe(res2.p90Ceiling);
    });
  });

  describe('detectDealSlippage', () => {
    it('flags critical severity when deal is pushed past quarter end', () => {
      const slippage = detectDealSlippage({
        deal: {
          id: 'd_slip',
          name: 'Delayed Enterprise Contract',
          value: 150000,
          ownerId: 'usr_1',
          ownerName: 'Kofi',
          stageName: 'Negotiation',
          originalCloseDate: '2026-08-15T00:00:00Z',
          currentCloseDate: '2026-10-15T00:00:00Z', // Pushed across quarter boundary
          slipCount: 3,
        },
        quarterEndDate: '2026-09-30T23:59:59Z',
      });

      expect(slippage.isPushedPastQuarterEnd).toBe(true);
      expect(slippage.severity).toBe('critical');
      expect(slippage.daysSlipped).toBeGreaterThanOrEqual(60);
      expect(slippage.recommendedMitigation).toContain('executive');
    });

    it('assigns low severity for deals with minor delay within the same period', () => {
      const slippage = detectDealSlippage({
        deal: {
          id: 'd_minor',
          name: 'Small Business Onboarding',
          value: 15000,
          ownerId: 'usr_1',
          ownerName: 'Kofi',
          stageName: 'Proposal',
          originalCloseDate: '2026-09-10T00:00:00Z',
          currentCloseDate: '2026-09-15T00:00:00Z', // 5 days slip
          slipCount: 1,
        },
        quarterEndDate: '2026-09-30T23:59:59Z',
      });

      expect(slippage.isPushedPastQuarterEnd).toBe(false);
      expect(slippage.severity).toBe('low');
      expect(slippage.daysSlipped).toBe(5);
    });
  });

  describe('calculateForecastPaceAttainment', () => {
    it('accurately computes required daily pace and pace status', () => {
      const pacing = calculateForecastPaceAttainment({
        targetQuota: 500000,
        actualWon: 300000,
        committedPipeline: 150000,
        daysElapsed: 60,
        daysRemaining: 30,
        totalDaysInPeriod: 90,
      });

      // Remaining quota: 200,000 / 30 days = 6,666.67
      expect(Math.round(pacing.requiredDailyPace)).toBe(6667);
      // Current pace: 300,000 / 60 days = 5,000
      expect(Math.round(pacing.currentDailyPace)).toBe(5000);
      expect(pacing.attainmentPercentage).toBe(60);
      expect(pacing.quotaGap).toBe(200000);
    });
  });

  describe('generateAiForecastExplanation', () => {
    it('produces explainable headline and structured key risk deals', () => {
      const explanation = generateAiForecastExplanation({
        overallConfidenceScore: 78,
        weeklyConfidenceDelta: -5,
        riskDeals: [
          {
            dealId: 'd1',
            dealName: 'Acme Mega Deal',
            dealValue: 120000,
            riskReason: 'Close date pushed by 3 weeks past quarter end',
          },
        ],
        paceHealth: 'behind',
        attainmentPercentage: 62,
      });

      expect(explanation.overallConfidenceScore).toBe(78);
      expect(explanation.weeklyConfidenceDelta).toBe(-5);
      expect(explanation.headline).toContain('78%');
      expect(explanation.keyRiskDeals.length).toBe(1);
      expect(explanation.recommendedActions.length).toBeGreaterThan(0);
    });
  });
});
