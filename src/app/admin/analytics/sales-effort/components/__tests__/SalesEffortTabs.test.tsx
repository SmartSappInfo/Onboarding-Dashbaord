/**
 * @fileoverview Unit tests for Sales Effort & Performance Analytics Tabs
 * 
 * Verifies that:
 * 1. Card descriptions are cleanly relocated to CardInfoTooltip beside card titles.
 * 2. No raw description paragraph clutter is rendered directly beneath card titles.
 * 3. Card titles render accessible information triggers.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PerformanceOverviewTab } from '../PerformanceOverviewTab';
import { TargetCenterTab } from '../TargetCenterTab';
import { StandingsTableTab } from '../StandingsTableTab';
import { RepProfileTab } from '../RepProfileTab';
import type { PerformanceOverviewData, SalesTarget, LeaderboardRepSummary } from '@/lib/sales-performance/types';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container">{children}</div>
    ),
  };
});

vi.mock('@/app/actions/sales-performance-actions', () => ({
  getRepPerformanceDetailAction: vi.fn().mockResolvedValue({
    success: true,
    scorecard: {
      compositeIndex: 88,
      activityScore: 90,
      effortScore: 85,
      qualityScore: 82,
      effectivenessScore: 89,
      outcomeScore: 92,
      dimensionWeights: {
        activity: 0.3,
        effort: 0.25,
        quality: 0.15,
        effectiveness: 0.15,
        outcome: 0.15,
      },
    },
    whyExplanation: {
      trendText: 'Alice Rep maintains great outreach cadence.',
      drivers: [
        {
          label: 'High call volume',
          type: 'positive',
          impactPercent: 12,
          explanation: '30 calls logged this week',
        },
      ],
      aiRecommendation: 'Keep up the high touch cadence with priority accounts.',
    },
  }),
  getRepAuditLedgerAction: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  createOrUpdateTargetAction: vi.fn().mockResolvedValue({ success: true }),
  deleteTargetAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Sales Effort Analytics Tabs - Card Headers & Info Tooltips', () => {
  const mockOverviewData: PerformanceOverviewData = {
    timeRange: 'week',
    startDate: '2026-10-01',
    endDate: '2026-10-08',
    workspaceId: 'ws-1',
    teamKPIs: {
      averagePerformanceIndex: 78,
      totalWorkspaceEffortPoints: 1250,
      activeRepsCount: 4,
      targetPaceAttainment: 80,
      topRep: {
        userId: 'rep-1',
        userName: 'Alice Rep',
        totalPoints: 450,
        performanceIndex: 88,
      },
    },
    teamScorecard: {
      compositeIndex: 78,
      activityScore: 80,
      effortScore: 75,
      qualityScore: 72,
      effectivenessScore: 76,
      outcomeScore: 85,
      dimensionWeights: {
        activity: 0.3,
        effort: 0.25,
        quality: 0.15,
        effectiveness: 0.15,
        outcome: 0.15,
      },
    },
    leaderboard: [
      {
        userId: 'rep-1',
        userName: 'Alice Rep',
        userEmail: 'alice@example.com',
        totalPoints: 450,
        performanceIndex: 88,
        meetings: 12,
        calls: 30,
        deals: 5,
        tasks: 25,
        scorecard: {
          compositeIndex: 88,
          activityScore: 90,
          effortScore: 85,
          qualityScore: 82,
          effectivenessScore: 89,
          outcomeScore: 92,
          dimensionWeights: {
            activity: 0.3,
            effort: 0.25,
            quality: 0.15,
            effectiveness: 0.15,
            outcome: 0.15,
          },
        },
        lastUpdated: new Date().toISOString(),
      },
    ],
    chartDataTopReps: [
      { name: 'Alice', points: 450, performanceIndex: 88 },
      { name: 'Bob', points: 350, performanceIndex: 75 },
    ],
    chartDataActionMix: [
      { name: 'Calls', count: 60 },
      { name: 'Meetings', count: 25 },
    ],
    dailyTrends: [],
    activeTargets: [],
  };

  const mockTargets: SalesTarget[] = [
    {
      id: 'target-1',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      ownerType: 'agent',
      ownerId: 'rep-1',
      ownerName: 'Alice Rep',
      metric: 'meetings',
      period: 'monthly',
      targetValue: 20,
      actualValue: 15,
      attainmentPercent: 75,
      requiredDailyPace: 1,
      paceStatus: 'on_track',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 864000000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockLeaderboard: LeaderboardRepSummary[] = mockOverviewData.leaderboard;

  describe('PerformanceOverviewTab', () => {
    it('renders titles with CardInfoTooltip and without raw description paragraphs', () => {
      render(
        <PerformanceOverviewTab
          overviewData={mockOverviewData}
          isLoading={false}
          onSelectRep={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Verify Card Titles are present
      expect(screen.getByText('Leader Standout')).toBeInTheDocument();
      expect(screen.getByText('Team Performance Index')).toBeInTheDocument();
      expect(screen.getByText('Total Workspace Effort')).toBeInTheDocument();
      expect(screen.getByText('Active Reps & Quotas')).toBeInTheDocument();
      expect(screen.getByText('Workspace 5-Dimension Balance')).toBeInTheDocument();
      expect(screen.getByText('Active Quotas & Pacing')).toBeInTheDocument();
      expect(screen.getByText('Quick Navigation')).toBeInTheDocument();
      expect(screen.getByText('Effort by Executive (Top 8)')).toBeInTheDocument();
      expect(screen.getByText('CRM Action Mix')).toBeInTheDocument();

      // Verify that raw description paragraphs were removed and moved to tooltips
      expect(
        screen.queryByText('Evaluates team execution beyond volume across effort, hygiene, conversion, and revenue.')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Distribution of scored operational activity points across leading reps.')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Proportion of meetings, calls, tasks, deals, and campaigns executed.')
      ).not.toBeInTheDocument();

      // Accessible tooltip triggers should be rendered
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('TargetCenterTab', () => {
    it('renders Target & Quota Center title with CardInfoTooltip', () => {
      render(
        <TargetCenterTab
          workspaceId="ws-1"
          organizationId="org-1"
          targets={mockTargets}
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText('Target & Quota Center')).toBeInTheDocument();
      // Description is no longer a loose <p>
      expect(
        screen.queryByText('Track real-time attainment progress and required daily operational velocity.')
      ).not.toBeInTheDocument();

      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('StandingsTableTab', () => {
    it('renders Performance Standings title with CardInfoTooltip', () => {
      render(
        <StandingsTableTab
          workspaceId="ws-1"
          leaderboard={mockLeaderboard}
          selectedRepId={null}
          onSelectRep={vi.fn()}
        />
      );

      expect(screen.getByText('Performance Standings')).toBeInTheDocument();
      // Description should not be rendered as raw CardDescription
      expect(
        screen.queryByText(/Rep ranking based on multi-dimensional performance index and effort points/i)
      ).not.toBeInTheDocument();

      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RepProfileTab', () => {
    it('renders 5-Dimension Performance Scorecard with CardInfoTooltip', async () => {
      render(
        <RepProfileTab
          workspaceId="ws-1"
          reps={mockLeaderboard}
          onOpenLedger={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('5-Dimension Performance Scorecard')).toBeInTheDocument();
      });

      expect(
        screen.queryByText('Multi-factor breakdown separating volume, intentional effort, quality, response, and results.')
      ).not.toBeInTheDocument();

      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
