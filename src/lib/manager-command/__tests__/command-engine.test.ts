/**
 * @fileoverview Unit Test Suite for SmartSapp Manager Command Center Pure Engine (Phase 3).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTeamMacroKPIs,
  evaluateWorkloadStatus,
  detectAtRiskDeal,
  synthesizeTeamBrief,
  compile1on1CoachingBrief,
  type RawDealInput,
  type RawRepInput,
} from '../command-engine';
import type { PerformanceScorecard, SalesTarget } from '@/lib/sales-performance/types';

describe('Manager Command Pure Engine (Phase 3)', () => {
  const mockScorecard: PerformanceScorecard = {
    compositeIndex: 82,
    activityScore: 85,
    effortScore: 90,
    qualityScore: 60,
    effectivenessScore: 75,
    outcomeScore: 80,
    dimensionWeights: {
      activity: 20,
      effort: 30,
      quality: 15,
      effectiveness: 15,
      outcome: 20,
    },
  };

  const sampleDeals: RawDealInput[] = [
    {
      id: 'd1',
      name: 'Sunrise Academy Expansion',
      value: 15000,
      stage: 'proposal',
      status: 'open',
      assignedTo: 'rep_1',
      assignedRepName: 'Kwame Mensah',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      stageChangedAt: '2026-08-10T00:00:00.000Z', // 25 days stalled
      lastActivityAt: '2026-08-15T00:00:00.000Z', // 20 days inactive
    },
    {
      id: 'd2',
      name: 'Greenfield School Pilot',
      value: 8000,
      stage: 'closed_won',
      status: 'won',
      assignedTo: 'rep_2',
      assignedRepName: 'Ama Osei',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
      closedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'd3',
      name: 'Beacon College SaaS',
      value: 5000,
      stage: 'discovery',
      status: 'open',
      assignedTo: 'rep_1',
      assignedRepName: 'Kwame Mensah',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      stageChangedAt: '2026-09-01T00:00:00.000Z',
      lastActivityAt: '2026-09-03T00:00:00.000Z', // Fresh activity
    },
  ];

  const sampleTargets: SalesTarget[] = [
    {
      id: 't1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      ownerType: 'team',
      ownerId: 'team_1',
      ownerName: 'Enterprise Team',
      metric: 'revenue',
      period: 'monthly',
      targetValue: 20000,
      actualValue: 8000,
      attainmentPercent: 40,
      requiredDailyPace: 500,
      paceStatus: 'behind',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  describe('calculateTeamMacroKPIs', () => {
    it('accurately aggregates closed revenue, active pipeline, and weighted forecast', () => {
      const fixedNow = new Date('2026-09-04T12:00:00.000Z');
      const kpis = calculateTeamMacroKPIs({
        allDeals: sampleDeals,
        targets: sampleTargets,
        overloadedRepsCount: 1,
        now: fixedNow,
      });

      expect(kpis.closedRevenueWon).toBe(8000);
      expect(kpis.activePipelineValue).toBe(20000); // 15000 + 5000
      expect(kpis.weightedForecastValue).toBeGreaterThan(0);
      expect(kpis.quotaAttainmentPercent).toBe(40);
      expect(kpis.winRatePercent).toBe(100); // 1 won, 0 lost
      expect(kpis.dealsAtRiskCount).toBeGreaterThan(0);
    });
  });

  describe('evaluateWorkloadStatus', () => {
    it('classifies overloaded rep when queue and deals exceed thresholds', () => {
      const overloadedRep: RawRepInput = {
        userId: 'rep_overloaded',
        userName: 'Overloaded Rep',
        userEmail: 'overloaded@example.com',
        role: 'sales_rep',
        maxOpenLeads: 15,
        maxOpenDeals: 10,
        activeLeadsCount: 18,
        activeDealsCount: 12,
        activeQueueItemsCount: 28,
        performanceIndex: 70,
        targetAttainmentPercent: 60,
        paceStatus: 'behind',
        scorecard: mockScorecard,
        recentPointsEarned: 150,
        slaBreachCount: 3,
        stalledTasksCount: 5,
      };

      const res = evaluateWorkloadStatus(overloadedRep);
      expect(res.workloadStatus).toBe('overloaded');
      expect(res.capacityUtilizationPercent).toBeGreaterThanOrEqual(90);
    });

    it('classifies underutilized rep when volume is very low', () => {
      const underutilizedRep: RawRepInput = {
        userId: 'rep_underutilized',
        userName: 'Underutilized Rep',
        userEmail: 'underutilized@example.com',
        role: 'sales_rep',
        maxOpenLeads: 15,
        maxOpenDeals: 10,
        activeLeadsCount: 2,
        activeDealsCount: 1,
        activeQueueItemsCount: 3,
        performanceIndex: 85,
        targetAttainmentPercent: 80,
        paceStatus: 'on_track',
        scorecard: mockScorecard,
        recentPointsEarned: 80,
        slaBreachCount: 0,
        stalledTasksCount: 0,
      };

      const res = evaluateWorkloadStatus(underutilizedRep);
      expect(res.workloadStatus).toBe('underutilized');
      expect(res.capacityUtilizationPercent).toBeLessThan(50);
    });
  });

  describe('detectAtRiskDeal', () => {
    it('flags stalled deal with high risk score and clear justifications', () => {
      const fixedNow = new Date('2026-09-04T12:00:00.000Z');
      const atRisk = detectAtRiskDeal(sampleDeals[0], fixedNow);

      expect(atRisk).not.toBeNull();
      expect(atRisk?.riskScore).toBeGreaterThanOrEqual(60);
      expect(atRisk?.riskReasons.length).toBeGreaterThan(0);
      expect(atRisk?.riskReasons[0]).toContain('Stalled');
    });

    it('returns null for recently updated deal', () => {
      const fixedNow = new Date('2026-09-04T12:00:00.000Z');
      const atRisk = detectAtRiskDeal(sampleDeals[2], fixedNow);

      expect(atRisk).toBeNull();
    });
  });

  describe('synthesizeTeamBrief', () => {
    it('produces actionable executive narrative when quota is lagging', () => {
      const fixedNow = new Date('2026-09-04T12:00:00.000Z');
      const kpis = calculateTeamMacroKPIs({
        allDeals: sampleDeals,
        targets: sampleTargets,
        overloadedRepsCount: 1,
        now: fixedNow,
      });

      const atRiskDeal = detectAtRiskDeal(sampleDeals[0], fixedNow)!;
      const brief = synthesizeTeamBrief({
        macroKPIs: kpis,
        atRiskDeals: [atRiskDeal],
        reps: [],
      });

      expect(brief.headline).toContain('lagging');
      expect(brief.keyRisks.length).toBeGreaterThan(0);
      expect(brief.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('compile1on1CoachingBrief', () => {
    it('generates structured dossier with strongest and weakest dimensions', () => {
      const fixedNow = new Date('2026-09-04T12:00:00.000Z');
      const rep: RawRepInput = {
        userId: 'rep_1',
        userName: 'Kwame Mensah',
        userEmail: 'kwame@example.com',
        role: 'sales_rep',
        activeLeadsCount: 8,
        activeDealsCount: 5,
        activeQueueItemsCount: 12,
        performanceIndex: 82,
        targetAttainmentPercent: 75,
        paceStatus: 'on_track',
        scorecard: mockScorecard,
        recentPointsEarned: 240,
        slaBreachCount: 0,
        stalledTasksCount: 1,
      };

      const brief = compile1on1CoachingBrief({
        rep: {
          ...rep,
          weeklyCapacityHours: 40,
          maxOpenLeads: 15,
          maxOpenDeals: 10,
          workloadStatus: 'optimal',
          capacityUtilizationPercent: 65,
        },
        deals: sampleDeals,
        now: fixedNow,
      });

      expect(brief.repName).toBe('Kwame Mensah');
      expect(brief.strongestDimension).toContain('Effort'); // 90 was highest
      expect(brief.weakestDimension).toContain('Quality'); // 60 was lowest
      expect(brief.stalledDeals.length).toBe(1); // Sunrise Academy
      expect(brief.discussionPoints.length).toBeGreaterThanOrEqual(2);
      expect(brief.suggestedCommitments.length).toBeGreaterThanOrEqual(1);
    });
  });
});
