/**
 * @fileoverview Test Suite: Deal Intelligence, Recommendations & Meeting Brief UI Components (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 41 (Explainability grid: WHAT, WHY, IMPACT), and `theme.md` §8 (Standardized Modal Architecture).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountRecommendationsCard } from '@/components/crm/intelligence/AccountRecommendationsCard';
import { DealIntelligenceCard } from '@/components/crm/intelligence/DealIntelligenceCard';
import { MeetingBriefDrawer } from '@/components/crm/intelligence/MeetingBriefDrawer';
import type {
  AccountRecommendations,
  DealIntelligence,
  MeetingBrief,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';

describe('CRM Recommendations & Deal Intelligence UI Components (Phase 9 Milestone 3)', () => {
  const mockRecommendations: AccountRecommendations = {
    entityId: 'ent_greenfield_01',
    workspaceId: 'ws_demo_01',
    items: [
      {
        id: 'rec_01',
        title: 'Schedule Contract Review Follow-up',
        description: 'Coordinate review call regarding enterprise renewal terms.',
        priority: 'HIGH',
        category: 'COMMERCIAL',
        actionType: 'SCHEDULE_MEETING',
        explainability: {
          what: 'Schedule 30-minute review call with Head of Admissions.',
          why: 'Renewal proposal has been pending for 18 days without executive response.',
          impact: 'Mitigates stall risk on $45,000 ARR contract before Q4 budget lock.',
        },
        payloadDelta: {
          meetingType: 'renewal_review',
        },
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockDealIntel: DealIntelligence = {
    dealId: 'deal_882',
    dealTitle: 'Greenfield 3-Campus Bundle',
    dealValue: 75000,
    currency: 'USD',
    stageVelocity: {
      daysInStage: 8,
      averageDaysInStage: 14,
      velocityStatus: 'FAST',
    },
    winProbability: 78,
    healthScore: 82,
    healthCategory: 'STRONG',
    stallRisk: {
      isStalled: false,
      daysSinceActivity: 3,
    },
    buyingSignals: [
      {
        signal: 'CFO attended pricing review and requested payment terms.',
        detectedAt: '2026-10-02T10:00:00Z',
        confidence: 0.9,
      },
    ],
    riskFactors: [
      {
        risk: 'Competitor offering subsidized hardware onboarding.',
        severity: 'MEDIUM',
        mitigationPrompt: 'Highlight zero-hardware cloud architecture.',
      },
    ],
    competitorAnalysis: [
      {
        competitorName: 'LegacyEduSoft',
        objection: 'Existing contract runs through summer.',
        counterStrategy: 'Offer early migration discount matching balance.',
      },
    ],
    recommendedPlaybook: {
      strategyName: 'Multi-Campus Executive Alignment',
      tacticalSteps: [
        'Send compliance questionnaire to IT director',
        'Review contract terms with CFO',
      ],
      expectedOutcome: 'Secures contract approval before year-end.',
    },
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockBrief: MeetingBrief = {
    meetingId: 'meet_990',
    title: 'Admissions Alignment Briefing',
    startTime: '2026-10-06T15:00:00Z',
    attendees: [
      {
        name: 'Sarah Jenkins',
        email: 'sarah.j@greenfield.edu',
        role: 'Head of Admissions',
        pastInteractionsCount: 3,
        lastSentiment: 'positive',
      },
    ],
    relationshipSummary: 'Active relationship in final evaluation phase.',
    openCommitments: [
      {
        id: 'com_01',
        title: 'Provide FERPA compliance certification letter',
        dueDate: '2026-10-05T00:00:00Z',
        isOverdue: false,
      },
    ],
    likelyObjectives: ['Finalize rollout schedule', 'Confirm SIS credentials'],
    potentialObjections: ['IT department bandwidth in Q4'],
    suggestedQuestions: ['What is your target launch date for staff training?'],
    recommendedStrategy: 'Lead with FERPA certification document, then present rollout timeline.',
    generatedAt: '2026-10-04T12:00:00Z',
  };

  describe('AccountRecommendationsCard', () => {
    it('renders recommendations with Rule 41 explainability grid (WHAT, WHY, IMPACT)', () => {
      render(<AccountRecommendationsCard recommendations={mockRecommendations} />);

      expect(screen.getByText('Schedule Contract Review Follow-up')).toBeDefined();
      expect(screen.getByText('HIGH')).toBeDefined();
      expect(screen.getByText(/Schedule 30-minute review call/)).toBeDefined();
      expect(screen.getByText(/Renewal proposal has been pending for 18 days/)).toBeDefined();
      expect(screen.getByText(/Mitigates stall risk on \$45,000 ARR contract/)).toBeDefined();
    });

    it('triggers onActionClick when action button is clicked', () => {
      const onActionClick = vi.fn();
      render(<AccountRecommendationsCard recommendations={mockRecommendations} onActionClick={onActionClick} />);

      const actionButton = screen.getByRole('button', { name: /schedule meeting|take action/i });
      fireEvent.click(actionButton);
      expect(onActionClick).toHaveBeenCalledWith(mockRecommendations.items[0]);
    });
  });

  describe('DealIntelligenceCard', () => {
    it('renders stage velocity meter, win probability gauge, competitor objections, and playbook', () => {
      render(<DealIntelligenceCard dealIntelligence={mockDealIntel} />);

      expect(screen.getByText('Greenfield 3-Campus Bundle')).toBeDefined();
      expect(screen.getByText('78%')).toBeDefined();
      expect(screen.getByText('FAST')).toBeDefined();
      expect(screen.getByText('Multi-Campus Executive Alignment')).toBeDefined();
      expect(screen.getByText(/Send compliance questionnaire to IT director/)).toBeDefined();
      expect(screen.getByText(/LegacyEduSoft/)).toBeDefined();
    });
  });

  describe('MeetingBriefDrawer', () => {
    it('renders meeting brief modal conforming to theme.md §8', () => {
      render(<MeetingBriefDrawer brief={mockBrief} isOpen={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText('Pre-Meeting Intelligence Brief')).toBeDefined();
      expect(screen.getByText('Admissions Alignment Briefing')).toBeDefined();
      expect(screen.getByText('Sarah Jenkins')).toBeDefined();
      expect(screen.getByText('Provide FERPA compliance certification letter')).toBeDefined();
      expect(screen.getByText(/What is your target launch date/)).toBeDefined();
    });
  });
});
