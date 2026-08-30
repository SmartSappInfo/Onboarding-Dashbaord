import { describe, it, expect } from 'vitest';
import type { Deal, DealStage, UserProfile, Activity } from '../../types';
import {
  calculateStageConversionFunnel,
  calculateSalesVelocity,
  calculateRepPerformance,
  detectPipelineBottlenecks,
  calculateRevenueAttribution,
  calculateForecastRiskSummary,
  buildConsolidatedAnalyticsDataset,
} from '../deal-analytics-engine';

describe('Deals Platform 2.0 - Pure Revenue Analytics Engine', () => {
  const mockStages: DealStage[] = [
    {
      id: 'stage_qual',
      name: 'Qualification',
      order: 0,
      slaDays: 5,
      pipelineId: 'pipe_1',
      color: '#3b82f6',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'stage_disc',
      name: 'Discovery',
      order: 1,
      slaDays: 7,
      pipelineId: 'pipe_1',
      color: '#8b5cf6',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'stage_prop',
      name: 'Proposal',
      order: 2,
      slaDays: 5,
      pipelineId: 'pipe_1',
      color: '#f59e0b',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'stage_won',
      name: 'Closed Won',
      order: 3,
      terminalType: 'won',
      pipelineId: 'pipe_1',
      color: '#10b981',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const mockUsers: UserProfile[] = [
    {
      id: 'user_1',
      name: 'Ama Mensah',
      email: 'ama@example.com',
      phone: '',
      organizationId: 'org_1',
      workspaceIds: ['ws_1'],
      isAuthorized: true,
      roles: ['admin'],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user_2',
      name: 'Kofi Boateng',
      email: 'kofi@example.com',
      phone: '',
      organizationId: 'org_1',
      workspaceIds: ['ws_1'],
      isAuthorized: true,
      roles: ['member'],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const now = new Date('2026-08-30T12:00:00.000Z');

  const mockDeals: Deal[] = [
    // Won Deal 1 (Ama)
    {
      id: 'deal_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      entityId: 'ent_1',
      name: 'Alpha Corp Contract',
      value: 50000,
      status: 'won',
      stageId: 'stage_won',
      pipelineId: 'pipe_1',
      probability: 100,
      forecastCategory: 'closed',
      source: 'lead_conversion',
      assignedTo: { userId: 'user_1', name: 'Ama Mensah', email: 'ama@example.com' },
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z', // 19 days cycle
    },
    // Won Deal 2 (Kofi)
    {
      id: 'deal_2',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      entityId: 'ent_2',
      name: 'Beta High School',
      value: 30000,
      status: 'won',
      stageId: 'stage_won',
      pipelineId: 'pipe_1',
      probability: 100,
      forecastCategory: 'closed',
      source: 'marketing_campaign',
      assignedTo: { userId: 'user_2', name: 'Kofi Boateng', email: 'kofi@example.com' },
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z', // 20 days cycle
    },
    // Lost Deal (Ama)
    {
      id: 'deal_3',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      entityId: 'ent_3',
      name: 'Gamma Tech',
      value: 20000,
      status: 'lost',
      stageId: 'stage_prop',
      pipelineId: 'pipe_1',
      probability: 0,
      forecastCategory: 'omitted',
      source: 'call_centre',
      assignedTo: { userId: 'user_1', name: 'Ama Mensah', email: 'ama@example.com' },
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    },
    // Open Deal 4 (Commit, At Risk, Closing in 5 days)
    {
      id: 'deal_4',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      entityId: 'ent_4',
      name: 'Delta International',
      value: 40000,
      status: 'open',
      stageId: 'stage_prop',
      pipelineId: 'pipe_1',
      probability: 80,
      forecastCategory: 'commit',
      healthStatus: 'at_risk',
      expectedCloseDate: '2026-09-04T00:00:00.000Z', // 5 days from now
      nextStep: { type: 'task', title: 'Send signed addendum', dueDate: '2026-09-02' },
      assignedTo: { userId: 'user_1', name: 'Ama Mensah', email: 'ama@example.com' },
      stageEnteredAt: '2026-08-10T00:00:00.000Z', // 20 days in Proposal (SLA is 5 => Delay 4.0x)
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    },
    // Open Deal 5 (Pipeline, Healthy, No Next Step)
    {
      id: 'deal_5',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      entityId: 'ent_5',
      name: 'Epsilon Academy',
      value: 15000,
      status: 'open',
      stageId: 'stage_disc',
      pipelineId: 'pipe_1',
      probability: 50,
      forecastCategory: 'pipeline',
      healthStatus: 'healthy',
      expectedCloseDate: '2026-09-30T00:00:00.000Z',
      nextStep: null, // No next step
      assignedTo: { userId: 'user_2', name: 'Kofi Boateng', email: 'kofi@example.com' },
      stageEnteredAt: '2026-08-26T00:00:00.000Z', // 4 days in Discovery (SLA is 7)
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    },
  ];

  describe('Stage Conversion Funnel Calculation', () => {
    it('computes step progression, conversion rates, and average days per stage', () => {
      const funnel = calculateStageConversionFunnel(mockDeals, mockStages);
      expect(funnel).toHaveLength(4);

      // Qualification (First Stage) - All 5 deals entered
      expect(funnel[0].stageName).toBe('Qualification');
      expect(funnel[0].dealsEntered).toBe(5);
      expect(funnel[0].conversionRate).toBeGreaterThan(0);
    });

    it('returns empty array when stages are empty', () => {
      const funnel = calculateStageConversionFunnel(mockDeals, []);
      expect(funnel).toEqual([]);
    });
  });

  describe('Sales Velocity & Pipeline Metrics', () => {
    it('computes win rate, average cycle duration, and velocity per day accurately', () => {
      const velocity = calculateSalesVelocity(mockDeals);

      expect(velocity.totalWonDeals).toBe(2);
      expect(velocity.winRatePercentage).toBe(67); // 2 won out of 3 closed = 66.7% -> 67%
      expect(velocity.avgSalesCycleDays).toBe(20); // (19 + 20) / 2 = 19.5 -> 20 days
      expect(velocity.avgDealSize).toBe(40000); // (50,000 + 30,000) / 2 = 40,000
      expect(velocity.salesVelocityPerDay).toBeGreaterThan(0);
      expect(velocity.activePipelineValue).toBe(55000); // deal_4 (40k) + deal_5 (15k)
    });

    it('handles zero closed deals gracefully with zero division protection', () => {
      const velocity = calculateSalesVelocity([]);
      expect(velocity.winRatePercentage).toBe(0);
      expect(velocity.avgSalesCycleDays).toBe(30);
      expect(velocity.avgDealSize).toBe(0);
      expect(velocity.salesVelocityPerDay).toBe(0);
      expect(velocity.activePipelineValue).toBe(0);
    });
  });

  describe('Sales Rep Performance Scorecard', () => {
    it('groups deals by assigned rep and computes rep-specific conversion metrics', () => {
      const activities: Activity[] = [
        { id: 'act_1', organizationId: 'org_1', workspaceId: 'ws_1', userId: 'user_1', type: 'call', source: 'system', description: 'Call', timestamp: '2026-08-10' },
        { id: 'act_2', organizationId: 'org_1', workspaceId: 'ws_1', userId: 'user_1', type: 'email', source: 'system', description: 'Email', timestamp: '2026-08-12' },
      ];

      const reps = calculateRepPerformance(mockDeals, mockUsers, activities);
      expect(reps.length).toBeGreaterThanOrEqual(2);

      const ama = reps.find(r => r.userId === 'user_1');
      expect(ama).toBeDefined();
      expect(ama?.dealsCount).toBe(3); // deal_1 (won), deal_3 (lost), deal_4 (open)
      expect(ama?.dealsWonCount).toBe(1);
      expect(ama?.dealsLostCount).toBe(1);
      expect(ama?.winRatePercentage).toBe(50); // 1 won out of 2 closed
      expect(ama?.revenueWon).toBe(50000);
      expect(ama?.activePipelineValue).toBe(40000);
      expect(ama?.activitiesCount).toBe(2);

      const kofi = reps.find(r => r.userId === 'user_2');
      expect(kofi).toBeDefined();
      expect(kofi?.dealsWonCount).toBe(1);
      expect(kofi?.revenueWon).toBe(30000);
    });
  });

  describe('Pipeline Bottleneck Detection', () => {
    it('detects SLA breaches and flags severe stage delays', () => {
      const bottlenecks = detectPipelineBottlenecks(mockDeals, mockStages);
      expect(bottlenecks.length).toBeGreaterThanOrEqual(1);

      // Proposal stage has deal_4 with 20 days in stage vs 5 days SLA (4.0x)
      const proposalBottleneck = bottlenecks.find(b => b.stageId === 'stage_prop');
      expect(proposalBottleneck).toBeDefined();
      expect(proposalBottleneck?.slaDays).toBe(5);
      expect(proposalBottleneck?.severity).toBe('critical'); // >= 2.5x
    });
  });

  describe('Revenue Attribution by Lead Source', () => {
    it('aggregates won revenue by source and calculates percentage contributions', () => {
      const attributions = calculateRevenueAttribution(mockDeals);
      expect(attributions.length).toBe(2);

      // Lead Conversion: 50,000 (63%), Marketing Campaign: 30,000 (38%)
      const leadConv = attributions.find(a => a.source.includes('Lead Conversion'));
      expect(leadConv).toBeDefined();
      expect(leadConv?.revenueWon).toBe(50000);
      expect(leadConv?.percentage).toBe(63);

      const mktg = attributions.find(a => a.source.includes('Marketing Campaign'));
      expect(mktg).toBeDefined();
      expect(mktg?.revenueWon).toBe(30000);
      expect(mktg?.percentage).toBe(38);
    });
  });

  describe('Forecast Risk Summary', () => {
    it('identifies at-risk commit deals, deals closing within 14 days, and missing next steps', () => {
      const risk = calculateForecastRiskSummary(mockDeals, mockStages, now);

      // High-Risk Commit: deal_4 (value 40,000)
      expect(risk.highRiskCommitCount).toBe(1);
      expect(risk.highRiskCommitValue).toBe(40000);
      expect(risk.highRiskCommitDeals[0].id).toBe('deal_4');

      // Closing in 14 days: deal_4 (close date Sept 4 is in 5 days)
      expect(risk.closingIn14DaysCount).toBe(1);
      expect(risk.closingIn14DaysValue).toBe(40000);

      // Without next steps: deal_5 (value 15,000)
      expect(risk.withoutNextStepsCount).toBe(1);
      expect(risk.withoutNextStepsValue).toBe(15000);
      expect(risk.noNextStepDeals[0].id).toBe('deal_5');
    });
  });

  describe('Consolidated 3-Tier Analytics Dataset Builder', () => {
    it('builds full Executive, Management, and Operations datasets with target quota calculations', () => {
      const targetAmount = 100000;
      const dataset = buildConsolidatedAnalyticsDataset(mockDeals, mockStages, mockUsers, targetAmount, 'GHS');

      // Executive Tier
      expect(dataset.executive.totalRevenueWon).toBe(80000);
      expect(dataset.executive.totalPipelineValue).toBe(55000);
      expect(dataset.executive.targetAmount).toBe(100000);
      expect(dataset.executive.pipelineCoverageRatio).toBe(0.55); // 55k / 100k
      expect(dataset.executive.winRatePercentage).toBe(67);

      // Management Tier
      expect(dataset.management.funnel).toHaveLength(4);
      expect(dataset.management.velocity.totalWonDeals).toBe(2);
      expect(dataset.management.reps.length).toBeGreaterThanOrEqual(2);

      // Operations Tier
      expect(dataset.operations.riskSummary.highRiskCommitCount).toBe(1);
      expect(dataset.operations.attributions).toHaveLength(2);
    });
  });
});
