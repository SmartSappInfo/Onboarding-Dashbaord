/**
 * @fileoverview Unit tests for Workforce AI & Role Advisor components
 *
 * Verifies that:
 * 1. Card descriptions are cleanly relocated to CardInfoTooltip beside card titles.
 * 2. Raw description paragraph clutter is eliminated from the DOM.
 * 3. Card titles render accessible information triggers.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkforceRiskRadar } from '../WorkforceRiskRadar';
import { AiRecommendationsFeed } from '../AiRecommendationsFeed';
import type { OrganizationRiskOverview, AiWorkforceRecommendation } from '@/lib/types';

describe('Workforce AI Components - Card Headers & Info Tooltips', () => {
  const mockOverview: OrganizationRiskOverview = {
    organizationId: 'org-1',
    averageScore: 35,
    criticalRiskCount: 0,
    highRiskCount: 0,
    mediumRiskCount: 1,
    lowRiskCount: 0,
    topRiskFactors: [
      'Unused Administrative Permissions',
      'Separation of Duties Toxic Pairings',
      'Dormant High-Privilege Accounts',
      'Orphaned Sales Pipeline Portfolios',
    ],
    evaluatedAt: new Date().toISOString(),
  };

  const mockRecommendations: AiWorkforceRecommendation[] = [
    {
      id: 'rec-1',
      organizationId: 'org-1',
      priority: 'high',
      title: 'Prune Dormant Admin Privileges',
      explanation: 'User Alice has not utilized system admin scopes in 90 days.',
      riskDelta: 15,
      evidence: ['No administrative API calls recorded for 90 days.'],
      type: 'dormant_permission_prune',
      targetPersonId: 'user-1',
      targetPersonName: 'Alice',
      proposedActionPayload: {
        type: 'remove_role',
        targetUserId: 'user-1',
        targetRole: 'admin',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ];

  describe('WorkforceRiskRadar', () => {
    it('renders titles with CardInfoTooltip and without raw description paragraphs', () => {
      render(<WorkforceRiskRadar overview={mockOverview} isLoading={false} />);

      // Verify Card Titles are present
      expect(screen.getByText('Average Workforce Risk')).toBeInTheDocument();
      expect(screen.getByText('Critical Vulnerabilities')).toBeInTheDocument();
      expect(screen.getByText('High Over-Privilege')).toBeInTheDocument();
      expect(screen.getByText('Least-Privilege Compliant')).toBeInTheDocument();
      expect(screen.getByText('Principal Exposure Drivers')).toBeInTheDocument();

      // Verify risk score & posture badge
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('/ 100')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();

      // Verify raw description paragraphs were removed
      expect(
        screen.queryByText('Members holding toxic SoD or dormant admin')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Members with <20% 90d permission usage/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Right-sized access profiles')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Dominant risk categories identified across workforce scans')
      ).not.toBeInTheDocument();

      // Accessible tooltip triggers should be rendered for each card
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('AiRecommendationsFeed', () => {
    it('renders AI Access & Role Advisor title with CardInfoTooltip instead of raw CardDescription', () => {
      render(
        <AiRecommendationsFeed
          recommendations={mockRecommendations}
          isLoading={false}
          onApply={vi.fn()}
          onDismiss={vi.fn()}
        />
      );

      // Verify title is present
      expect(screen.getByText('AI Access & Role Advisor')).toBeInTheDocument();

      // Verify raw CardDescription is removed
      expect(
        screen.queryByText('Actionable least-privilege pruning, SoD conflict remediation, and portfolio balancing')
      ).not.toBeInTheDocument();

      // Tooltip button should be present
      const tooltipButtons = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
