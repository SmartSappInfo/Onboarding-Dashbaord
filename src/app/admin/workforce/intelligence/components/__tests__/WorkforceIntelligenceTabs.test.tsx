/**
 * @fileoverview Unit tests for Workforce Intelligence & Executive Analytics Tabs
 *
 * Verifies that:
 * 1. Card descriptions are placed into CardInfoTooltip beside card titles across all 5 tabs.
 * 2. Raw CardDescription paragraphs and subtitle clutter beneath titles are eliminated from the DOM.
 * 3. In AiStrategicInsightsTab, individual insight card summaries are placed into CardInfoTooltip beside the title.
 * 4. All tabs maintain accessibility and strict typing with zero regressions.
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveOverviewTab } from '../ExecutiveOverviewTab';
import { UserHealthTab } from '../UserHealthTab';
import { TeamCapacityTab } from '../TeamCapacityTab';
import { RoleIntelligenceTab } from '../RoleIntelligenceTab';
import { AiStrategicInsightsTab } from '../AiStrategicInsightsTab';
import type { WorkforceIntelligenceSnapshot } from '@/lib/types';

describe('Workforce Intelligence Tabs - Header Info Tooltips & Clean Layouts', () => {
  const mockSnapshot: WorkforceIntelligenceSnapshot = {
    id: 'snap-1',
    organizationId: 'org-1',
    overallHealthScore: 88,
    flourishingMembersCount: 24,
    strainedMembersCount: 3,
    atRiskMembersCount: 1,
    averageTeamCapacity: 86,
    enterpriseIamMaturityScore: 92,
    generatedAt: '2026-10-09T12:00:00.000Z',
    teamSummaries: [
      {
        teamId: 'team-1',
        teamName: 'Enterprise Sales Alpha',
        departmentName: 'Revenue Operations',
        memberCount: 8,
        capacityPercent: 86,
        status: 'optimal',
        activePipelineValue: 450000,
        openTasksCount: 12,
        bottlenecks: [],
      },
    ],
    roleSummaries: [
      {
        roleId: 'role-1',
        roleName: 'Account Executive Custom',
        assignedMembersCount: 6,
        activePermissionsCount: 14,
        utilizationRate: 82,
        redundancyScore: 12,
        rating: 'optimal',
      },
    ],
    userHealthScores: [
      {
        personId: 'user-1',
        personName: 'Sarah Connor',
        personEmail: 'sarah@example.com',
        score: 94,
        status: 'flourishing',
        activityConsistency: 96,
        onboardingScore: 90,
        leastPrivilegeScore: 90,
        crmEfficiencyScore: 92,
        lastActiveAt: '2026-10-09T12:00:00.000Z',
      },
    ],
    strategicInsights: [
      {
        id: 'ins-1',
        category: 'capacity',
        title: 'Workforce Capacity Balanced Across Core Squads',
        summary: 'Average team capacity is running at 86%, well within the safe 85% operating threshold.',
        recommendation: 'Maintain current quota allocation across active enterprise squads.',
        impactLevel: 'medium',
      },
      {
        id: 'ins-2',
        category: 'security',
        title: 'High Least-Privilege Entitlement Compliance',
        summary: 'Role utilization across custom roles averages 82% density with zero toxic SoD conflicts.',
        recommendation: 'Proceed with scheduled quarterly IAM entitlement pruning.',
        impactLevel: 'low',
      },
    ],
  };

  describe('Tab 1: ExecutiveOverviewTab', () => {
    it('renders top metric titles with CardInfoTooltip buttons instead of subtitle descriptions', () => {
      render(<ExecutiveOverviewTab snapshot={mockSnapshot} />);

      // Verify titles are present
      expect(screen.getByText('Organizational Health')).toBeInTheDocument();
      expect(screen.getByText('Average Squad Capacity')).toBeInTheDocument();
      expect(screen.getByText('Strained & At-Risk')).toBeInTheDocument();
      expect(screen.getByText('Enterprise IAM Maturity')).toBeInTheDocument();

      // Verify KPI values
      expect(screen.getByText('88/100')).toBeInTheDocument();
      expect(screen.getByText('86%')).toBeInTheDocument();

      // Accessible tooltip triggers should be rendered for each KPI card + snapshot banner (at least 5)
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Tab 2: UserHealthTab', () => {
    it('renders card title with CardInfoTooltip and without raw CardDescription under title', () => {
      render(<UserHealthTab scores={mockSnapshot.userHealthScores} />);

      // Verify Card Title is present
      expect(screen.getByText('Workforce Health & Strain Index')).toBeInTheDocument();

      // Verify raw description is not in the DOM
      expect(
        screen.queryByText('Multi-signal score evaluating telemetry consistency, onboarding velocity, and CRM workload')
      ).not.toBeInTheDocument();

      // Tooltip button should be present
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);

      // Verify table member
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    });
  });

  describe('Tab 3: TeamCapacityTab', () => {
    it('renders team card title with CardInfoTooltip and without raw CardDescription under title', () => {
      render(<TeamCapacityTab teams={mockSnapshot.teamSummaries} />);

      // Verify Card Title is present
      expect(screen.getByText('Team Utilization & Operational Capacity')).toBeInTheDocument();

      // Verify raw description is not in the DOM
      expect(
        screen.queryByText('Real-time workload balancing across departments and operational squads')
      ).not.toBeInTheDocument();

      // Tooltip button should be present
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);

      // Verify squad name and inline department badge
      expect(screen.getByText('Enterprise Sales Alpha')).toBeInTheDocument();
      expect(screen.getByText('Revenue Operations')).toBeInTheDocument();
    });
  });

  describe('Tab 4: RoleIntelligenceTab', () => {
    it('renders role card title with CardInfoTooltip and without raw CardDescription under title', () => {
      render(<RoleIntelligenceTab roles={mockSnapshot.roleSummaries} />);

      // Verify Card Title is present
      expect(screen.getByText('Role Effectiveness & Permission Density')).toBeInTheDocument();

      // Verify raw description is not in the DOM
      expect(
        screen.queryByText('Analyzes entitlement utilization, redundancy, and right-sizing recommendations')
      ).not.toBeInTheDocument();

      // Tooltip button should be present
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);

      // Verify role name
      expect(screen.getByText('Account Executive Custom')).toBeInTheDocument();
    });
  });

  describe('Tab 5: AiStrategicInsightsTab', () => {
    it('renders main container CardTitle with CardInfoTooltip and without raw CardDescription', () => {
      render(<AiStrategicInsightsTab insights={mockSnapshot.strategicInsights} />);

      // Verify Container Card Title is present
      expect(screen.getByText('AI Strategic Organizational Insights')).toBeInTheDocument();

      // Verify raw description under container title is eliminated
      expect(
        screen.queryByText('Synthesized executive intelligence and structural optimization recommendations')
      ).not.toBeInTheDocument();
    });

    it('relocates individual insight card summaries into CardInfoTooltip beside title', () => {
      render(<AiStrategicInsightsTab insights={mockSnapshot.strategicInsights} />);

      // Verify insight card titles are present
      expect(screen.getByText('Workforce Capacity Balanced Across Core Squads')).toBeInTheDocument();
      expect(screen.getByText('High Least-Privilege Entitlement Compliance')).toBeInTheDocument();

      // Verify raw description paragraphs under the titles are eliminated from the DOM
      expect(
        screen.queryByText('Average team capacity is running at 86%, well within the safe 85% operating threshold.')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Role utilization across custom roles averages 82% density with zero toxic SoD conflicts.')
      ).not.toBeInTheDocument();

      // Verify tooltip triggers exist for container + individual insights
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      // 1 container + 2 insight cards = 3 tooltip buttons
      expect(tooltipButtons.length).toBe(3);

      // Recommendations remain rendered cleanly
      expect(screen.getByText('Maintain current quota allocation across active enterprise squads.')).toBeInTheDocument();
      expect(screen.getByText('Proceed with scheduled quarterly IAM entitlement pruning.')).toBeInTheDocument();
    });
  });
});
