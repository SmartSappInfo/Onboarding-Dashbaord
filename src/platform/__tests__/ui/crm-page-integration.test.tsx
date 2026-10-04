/**
 * @fileoverview Test Suite: CRM In-Context Intelligence Page Integration (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 69 (Strangler Fig Invariant & Zero Regressions),
 * and verifies surface embedding in Entity and Deal views.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EntityAiOverviewSection } from '@/app/admin/entities/components/EntityAiOverviewSection';
import DealAiIntelligencePanel from '@/app/admin/deals/[id]/components/DealAiIntelligencePanel';
import * as crmActions from '@/app/actions/crm-agent-actions';
import type {
  AccountAiOverview,
  AccountKnowledge,
  AccountRecommendations,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';
import type { Deal } from '@/lib/types';

// Mock server actions
vi.mock('@/app/actions/crm-agent-actions', () => ({
  getAccountAiOverviewAction: vi.fn(),
  getAccountKnowledgeAction: vi.fn(),
  getAccountRecommendationsAction: vi.fn(),
  getDealIntelligenceAction: vi.fn(),
  getMeetingBriefAction: vi.fn(),
}));

vi.mock('@/app/actions/deal-ai-actions', () => ({
  generateDealAiInsightsAction: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'user_test_01' } }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_demo_01' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('CRM In-Context Page Integration (Phase 9 Milestone 3)', () => {
  const mockOverview: AccountAiOverview = {
    entityId: 'ent_01',
    workspaceId: 'ws_demo_01',
    healthScore: 84,
    healthStatus: 'HEALTHY',
    activeMomentum: 'ACCELERATING',
    executiveSummary: 'Greenfield demonstrates strong relationship health and active multi-campus expansion.',
    keyRisks: [],
    stakeholders: [
      { contactId: 'con_01', name: 'Dr. Robert Evans', role: 'Superintendent', engagementLevel: 'HIGH', isPrimary: true },
    ],
    recentSignals: [
      { id: 'sig_1', type: 'MEETING', title: 'Executive alignment completed', timestamp: '2026-10-01T10:00:00Z' },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockKnowledge: AccountKnowledge = {
    entityId: 'ent_01',
    workspaceId: 'ws_demo_01',
    groundedFacts: [
      {
        id: 'f_1',
        statement: 'Annual operating budget is $45M.',
        category: 'COMMERCIAL',
        confidence: 0.95,
        citationId: 'cit_1',
        sourceTitle: 'Q3 Financial Review',
        sourceType: 'note',
      },
    ],
    meetingTakeaways: [],
    citations: [
      {
        id: 'cit_1',
        sourceType: 'note',
        sourceId: 'note_01',
        title: 'Q3 Financial Review',
        snippet: 'Budget confirmed by finance director.',
        timestamp: '2026-09-15T00:00:00Z',
        isolatedSnippet: '<untrusted_reference_data id="cit_1">Budget confirmed by finance director.</untrusted_reference_data>',
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockRecommendations: AccountRecommendations = {
    entityId: 'ent_01',
    workspaceId: 'ws_demo_01',
    items: [
      {
        id: 'rec_1',
        title: 'Review Expansion Proposal',
        description: 'Prepare multi-campus addendum for review.',
        priority: 'HIGH',
        category: 'COMMERCIAL',
        actionType: 'SCHEDULE_MEETING',
        explainability: {
          what: 'Schedule 30-min addendum review.',
          why: 'Superintendent requested multi-campus pricing.',
          impact: 'Unlocks additional $30,000 ARR.',
        },
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EntityAiOverviewSection', () => {
    it('fetches and renders Account AI Overview, Recommendations, and Knowledge', async () => {
      vi.mocked(crmActions.getAccountAiOverviewAction).mockResolvedValue({
        success: true,
        data: mockOverview,
      });
      vi.mocked(crmActions.getAccountKnowledgeAction).mockResolvedValue({
        success: true,
        data: mockKnowledge,
      });
      vi.mocked(crmActions.getAccountRecommendationsAction).mockResolvedValue({
        success: true,
        data: mockRecommendations,
      });

      render(
        <EntityAiOverviewSection entityId="ent_01" workspaceId="ws_demo_01" />
      );

      await waitFor(() => {
        expect(screen.getByText('Account In-Context Intelligence')).toBeDefined();
        expect(screen.getByText('HEALTHY')).toBeDefined();
        expect(screen.getByText(/Greenfield demonstrates strong relationship health/)).toBeDefined();
        expect(screen.getByText('Review Expansion Proposal')).toBeDefined();
        expect(screen.getByText('Account Knowledge & Citations')).toBeDefined();
      });
    });

    it('renders error state with retry button when overview fails to load', async () => {
      vi.mocked(crmActions.getAccountAiOverviewAction).mockResolvedValue({
        success: false,
        error: { code: 'IDOR_VIOLATION', message: 'Tenant context mismatch' },
      });
      vi.mocked(crmActions.getAccountKnowledgeAction).mockResolvedValue({
        success: false,
        error: { code: 'IDOR_VIOLATION', message: 'Tenant context mismatch' },
      });
      vi.mocked(crmActions.getAccountRecommendationsAction).mockResolvedValue({
        success: false,
        error: { code: 'IDOR_VIOLATION', message: 'Tenant context mismatch' },
      });

      render(
        <EntityAiOverviewSection entityId="ent_01" workspaceId="ws_demo_01" />
      );

      await waitFor(() => {
        expect(screen.getByText('CRM Intelligence Unavailable')).toBeDefined();
        expect(screen.getByText('Tenant context mismatch')).toBeDefined();
        expect(screen.getByRole('button', { name: /Retry Intelligence Synthesis/i })).toBeDefined();
      });
    });
  });

  describe('DealAiIntelligencePanel Strangler Fig Compatibility', () => {
    const mockDeal: Deal = {
      id: 'deal_123',
      name: 'Campus Expansion Deal',
      entityId: 'ent_01',
      organizationId: 'org_demo_01',
      workspaceId: 'ws_demo_01',
      pipelineId: 'pipe_01',
      value: 50000,
      stageId: 'stage_01',
      status: 'open',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    it('renders ready state with analyze action button and preserves legacy controls', () => {
      render(<DealAiIntelligencePanel deal={mockDeal} />);

      expect(screen.getByText('AI Deal Intelligence & Next Best Actions')).toBeDefined();
      expect(screen.getByRole('button', { name: /Analyze Deal/i })).toBeDefined();
      expect(screen.getByText('AI Intelligence Ready')).toBeDefined();
    });
  });
});
