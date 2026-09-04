import { describe, it, expect } from 'vitest';
import {
  safeDivide,
  simulateRevenueScenario,
  calculateTeamCapacity,
  computePredictiveAttainment,
  evaluatePredictiveChurnRisks,
  analyzeOrganizationalArchetypes,
  generatePacingTrajectory,
} from '../revenue-os-engine';
import type {
  BaselineRevenueContext,
  SimulationParameters,
  RepCapacityCohort,
} from '../types';

describe('Revenue Operating System Engine (Phase 10)', () => {
  describe('safeDivide', () => {
    it('returns correct division result for normal numbers', () => {
      expect(safeDivide(100, 25)).toBe(4);
      expect(safeDivide(50, 100)).toBe(0.5);
    });

    it('returns fallback on division by zero', () => {
      expect(safeDivide(100, 0, 0)).toBe(0);
      expect(safeDivide(100, 0, 99)).toBe(99);
    });

    it('handles NaN and non-finite numbers safely', () => {
      expect(safeDivide(NaN, 10, 0)).toBe(0);
      expect(safeDivide(10, NaN, 0)).toBe(0);
      expect(safeDivide(Infinity, 10, 0)).toBe(0);
      expect(safeDivide(10, Infinity, 0)).toBe(0);
    });
  });

  describe('simulateRevenueScenario', () => {
    const mockBaseline: BaselineRevenueContext = {
      baselineQuarterlyRevenue: 1000000,
      targetQuarterlyRevenue: 1200000,
      baselineWinRatePercent: 28,
      baselineAverageDealSize: 25000,
      baselineQuarterlyDealsCount: 40,
      baselineSlippageRatePercent: 20,
      baselineSalesCycleDays: 35,
      activeRepsCount: 8,
    };

    it('returns baseline revenue when all modifiers are zero', () => {
      const zeroParams: SimulationParameters = {
        winRateModifierPercent: 0,
        dealSizeModifierPercent: 0,
        slippageModifierPercent: 0,
        cycleTimeModifierPercent: 0,
        headcountDelta: 0,
        sdrToAeRatio: 1.5,
      };

      const res = simulateRevenueScenario({
        baseline: mockBaseline,
        parameters: zeroParams,
      });

      expect(res.simulatedQuarterlyRevenue).toBe(1000000);
      expect(res.deltaVsTargetDollars).toBe(-200000);
      expect(res.deltaVsTargetPercent).toBe(-17);
      expect(res.confidenceLowerBound).toBe(880000);
      expect(res.confidenceUpperBound).toBe(1120000);
    });

    it('simulates positive win rate and deal size increase accurately', () => {
      const params: SimulationParameters = {
        winRateModifierPercent: 5,   // +5% win rate
        dealSizeModifierPercent: 10, // +10% deal size
        slippageModifierPercent: 0,
        cycleTimeModifierPercent: 0,
        headcountDelta: 0,
        sdrToAeRatio: 1.5,
      };

      const res = simulateRevenueScenario({
        baseline: mockBaseline,
        parameters: params,
      });

      // 1,000,000 * 1.05 * 1.10 = 1,155,000
      expect(res.simulatedQuarterlyRevenue).toBe(1155000);
      expect(res.deltaVsTargetDollars).toBe(-45000);
    });

    it('enforces governance clamping on runaway slider values', () => {
      const extremeParams: SimulationParameters = {
        winRateModifierPercent: 100, // Should be clamped to 20%
        dealSizeModifierPercent: 80, // Should be clamped to 30%
        slippageModifierPercent: 0,
        cycleTimeModifierPercent: 0,
        headcountDelta: 0,
        sdrToAeRatio: 1.5,
      };

      const res = simulateRevenueScenario({
        baseline: mockBaseline,
        parameters: extremeParams,
        governance: {
          maxWinRateModifierPercent: 20,
          maxDealSizeModifierPercent: 30,
        },
      });

      expect(res.parameters.winRateModifierPercent).toBe(20);
      expect(res.parameters.dealSizeModifierPercent).toBe(30);
      // 1,000,000 * 1.20 * 1.30 = 1,560,000
      expect(res.simulatedQuarterlyRevenue).toBe(1560000);
    });

    it('applies 50% in-quarter ramp factor for newly added headcount', () => {
      const hiringParams: SimulationParameters = {
        winRateModifierPercent: 0,
        dealSizeModifierPercent: 0,
        slippageModifierPercent: 0,
        cycleTimeModifierPercent: 0,
        headcountDelta: 4, // +4 reps at 50% ramp = +2 effective reps -> (8 + 2) / 8 = 1.25x
        sdrToAeRatio: 1.5,
      };

      const res = simulateRevenueScenario({
        baseline: mockBaseline,
        parameters: hiringParams,
      });

      expect(res.simulatedQuarterlyRevenue).toBe(1250000);
      expect(res.deltaVsTargetDollars).toBe(50000);
      expect(res.deltaVsTargetPercent).toBe(4);
    });
  });

  describe('calculateTeamCapacity', () => {
    const mockCohorts: RepCapacityCohort[] = [
      {
        repId: 'rep_1',
        repName: 'Sarah Senior',
        tenureMonths: 18,
        rampTier: 'ramped',
        rampFactor: 1.0,
        assignedQuota: 300000,
        effectiveCapacityQuota: 300000,
        activeDealsCount: 20,
        dealCapacityLimit: 25,
        utilizationPercent: 80,
      },
      {
        repId: 'rep_2',
        repName: 'Dave Mid',
        tenureMonths: 5,
        rampTier: 'ramping',
        rampFactor: 0.7,
        assignedQuota: 250000,
        effectiveCapacityQuota: 175000,
        activeDealsCount: 15,
        dealCapacityLimit: 25,
        utilizationPercent: 60,
      },
      {
        repId: 'rep_3',
        repName: 'Anna New',
        tenureMonths: 2,
        rampTier: 'onboarding',
        rampFactor: 0.35,
        assignedQuota: 200000,
        effectiveCapacityQuota: 70000,
        activeDealsCount: 8,
        dealCapacityLimit: 20,
        utilizationPercent: 40,
      },
    ];

    it('calculates total effective capacity and shortfall accurately', () => {
      // 300,000 + 175,000 + 70,000 = 545,000
      const plan = calculateTeamCapacity({
        cohorts: mockCohorts,
        targetRevenue: 800000,
        totalPipelineDollars: 2400000,
      });

      expect(plan.effectiveCapacityTotal).toBe(545000);
      expect(plan.rampedRepsCount).toBe(1);
      expect(plan.rampingRepsCount).toBe(2);
      expect(plan.capacityShortfallDollars).toBe(255000); // 800k - 545k
      expect(plan.quotaCoverageRatio).toBe(3.0); // 2.4M / 800k
      expect(plan.recommendedHiresCount).toBe(1); // 255k / 300k avg ramped quota = 1
    });

    it('returns zero shortfall and zero recommended hires when capacity exceeds target', () => {
      const plan = calculateTeamCapacity({
        cohorts: mockCohorts,
        targetRevenue: 500000, // Below 545,000
        totalPipelineDollars: 2000000,
      });

      expect(plan.capacityShortfallDollars).toBe(0);
      expect(plan.recommendedHiresCount).toBe(0);
    });
  });

  describe('computePredictiveAttainment', () => {
    it('discounts pipeline by deal health score and stage probability', () => {
      const repsData = [
        {
          repId: 'rep_alice',
          repName: 'Alice Closer',
          quota: 200000,
          closedRevenue: 150000,
          pipelineDeals: [
            {
              value: 100000,
              healthScore: 80,     // 0.8
              stageProbability: 50, // 0.5 -> 100k * 0.8 * 0.5 = 40k
            },
            {
              value: 50000,
              healthScore: 60,     // 0.6
              stageProbability: 60, // 0.6 -> 50k * 0.6 * 0.6 = 18k
            },
          ],
        },
        {
          repId: 'rep_bob',
          repName: 'Bob Struggling',
          quota: 250000,
          closedRevenue: 60000,
          pipelineDeals: [
            {
              value: 40000,
              healthScore: 30,     // 0.3
              stageProbability: 30, // 0.3 -> 40k * 0.3 * 0.3 = 3.6k -> ~3600
            },
          ],
        },
      ];

      const res = computePredictiveAttainment(repsData);

      // Alice: 150,000 + 40,000 + 18,000 = 208,000 (104% of 200k)
      expect(res[0].predictedAttainmentDollars).toBe(208000);
      expect(res[0].predictedAttainmentPercent).toBe(104);
      expect(res[0].category).toBe('on_track');
      expect(res[0].pacingTrend).toBe('accelerating');

      // Bob: 60,000 + 3,600 = 63,600 (25% of 250k)
      expect(res[1].predictedAttainmentPercent).toBe(25);
      expect(res[1].category).toBe('critical');
      expect(res[1].primaryRiskFactor).toBeDefined();
    });
  });

  describe('evaluatePredictiveChurnRisks', () => {
    const fixedNow = new Date('2026-09-04T12:00:00Z');

    it('detects high-risk enterprise accounts with severe touch decay', () => {
      const deals = [
        {
          id: 'deal_silent',
          name: 'MegaCorp Expansion',
          value: 45000,
          status: 'open',
          stage: 'Proposal',
          lastActivityAt: '2026-08-10T12:00:00Z', // 25 days ago
          stakeholderCount: 1, // Single-threaded
        },
        {
          id: 'deal_fresh',
          name: 'SmallBiz Addon',
          value: 12000,
          status: 'open',
          stage: 'Discovery',
          lastActivityAt: '2026-09-03T12:00:00Z', // 1 day ago
          stakeholderCount: 3,
        },
      ];

      const risks = evaluatePredictiveChurnRisks({
        deals,
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      expect(risks.length).toBe(1);
      expect(risks[0].dealId).toBe('deal_silent');
      expect(risks[0].churnProbabilityPercent).toBeGreaterThanOrEqual(65);
      expect(risks[0].riskSeverity).toBe('critical');
      expect(risks[0].primaryDriver).toContain('silence');
    });

    it('gracefully handles unparseable dates without producing NaN', () => {
      const deals = [
        {
          id: 'deal_corrupt_date',
          name: 'Corrupt Date Opportunity',
          value: 30000,
          status: 'open',
          stage: 'Negotiation',
          lastActivityAt: 'not-a-valid-date',
          stakeholderCount: 1,
        },
      ];

      const risks = evaluatePredictiveChurnRisks({
        deals,
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      expect(risks.length).toBe(1);
      expect(risks[0].touchDecayDays).toBe(0);
      expect(isNaN(risks[0].churnProbabilityPercent)).toBe(false);
    });
  });

  describe('analyzeOrganizationalArchetypes', () => {
    it('categorizes team members into execution archetypes', () => {
      const reps = [
        {
          id: 'rep_1',
          name: 'Alice',
          winRatePercent: 45,
          averageCycleDays: 35,
          multiThreadedRatioPercent: 75,
          closedRevenue: 400000,
        },
        {
          id: 'rep_2',
          name: 'Bob',
          winRatePercent: 32,
          averageCycleDays: 18,
          multiThreadedRatioPercent: 40,
          closedRevenue: 250000,
        },
        {
          id: 'rep_3',
          name: 'Charlie',
          winRatePercent: 24,
          averageCycleDays: 60,
          multiThreadedRatioPercent: 20,
          closedRevenue: 180000,
        },
      ];

      const archetypes = analyzeOrganizationalArchetypes(reps);
      expect(archetypes.length).toBe(3);
      expect(archetypes[0].name).toContain('Strategic Closer');
      expect(archetypes[1].name).toContain('Transactional Hunter');
      expect(archetypes[2].name).toContain('Maverick');
    });
  });

  describe('generatePacingTrajectory', () => {
    it('generates 7 trajectory intervals from Day 1 to Day 90', () => {
      const trajectory = generatePacingTrajectory({
        targetRevenue: 1000000,
        currentQuarterDay: 45, // Halfway through quarter
        currentClosedRevenue: 480000,
        projectedEndRevenue: 950000,
      });

      expect(trajectory.length).toBe(7);
      expect(trajectory[0].dayNumber).toBe(1);
      expect(trajectory[6].dayNumber).toBe(90);

      // Day 45 should have both actual and target
      const day45 = trajectory.find((p) => p.dayNumber === 45);
      expect(day45).toBeDefined();
      expect(day45?.targetDollars).toBe(500000);
      expect(day45?.actualDollars).toBe(480000);

      // Day 90 projected should match projectedEndRevenue
      const day90 = trajectory.find((p) => p.dayNumber === 90);
      expect(day90?.projectedDollars).toBe(950000);
    });
  });
});
