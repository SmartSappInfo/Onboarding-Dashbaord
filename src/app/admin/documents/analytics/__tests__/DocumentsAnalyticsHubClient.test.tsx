import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DocumentsAnalyticsHubClient from '../DocumentsAnalyticsHubClient';
import type { WorkspaceAdvancedAnalyticsSummary } from '@/lib/types/document-types';

const mockSummary: WorkspaceAdvancedAnalyticsSummary = {
  workspaceId: 'ws_test',
  period: 'last_30_days',
  totalPortfolioViews: 350,
  totalUniqueReaders: 280,
  totalLeadsGenerated: 28,
  portfolioConversionRatePercentage: 10.0,
  totalReadingTimeSeconds: 12500,
  averagePortfolioCompletionPercentage: 68.5,
  averagePortfolioEngagementScore: 24.2,
  documentMetrics: [
    {
      documentId: 'doc_1',
      title: '2026 Admissions Prospectus',
      slug: 'admissions-2026',
      status: 'published',
      pageCount: 12,
      totalViews: 200,
      uniqueVisitors: 160,
      leadsGenerated: 20,
      conversionRatePercentage: 12.5,
      averageDwellTimeSeconds: 120,
      averageCompletionPercentage: 75.0,
      averageEngagementScore: 30.0,
    },
  ],
  campaignMetrics: [
    {
      campaignId: 'spring_email',
      channelType: 'trackable_link',
      totalViews: 150,
      uniqueVisitors: 120,
      leadsGenerated: 15,
      conversionRatePercentage: 12.5,
    },
  ],
  cohortMetrics: [
    {
      periodLabel: 'Last 30 Days',
      newVisitors: 200,
      returningVisitors: 80,
      returnRatePercentage: 28.5,
      averageSessionsPerVisitor: 1.4,
    },
  ],
  funnelStages: [
    {
      stageName: 'Total Document Impressions',
      count: 500,
      dropOffRatePercentage: 0,
      conversionRatePercentage: 100,
    },
    {
      stageName: 'Document Opens & Readers',
      count: 350,
      dropOffRatePercentage: 30,
      conversionRatePercentage: 70,
    },
  ],
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/documents/advanced-analytics-actions', () => ({
  getWorkspaceAdvancedAnalyticsAction: vi.fn().mockImplementation(async () => ({
    success: true,
    analytics: mockSummary,
  })),
}));

describe('DocumentsAnalyticsHubClient Component (Phase 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the analytics hub header and top-level KPI metric cards', async () => {
    render(<DocumentsAnalyticsHubClient />);

    expect(screen.getByText('Documents Analytics Hub')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('350')).toBeDefined(); // Total Portfolio Views
      expect(screen.getByText('280')).toBeDefined(); // Unique Readers
      expect(screen.getByText('28')).toBeDefined(); // Total Leads
      expect(screen.getByText('10%')).toBeDefined(); // Conversion Rate
    });
  });

  it('renders document performance leaderboard table', async () => {
    render(<DocumentsAnalyticsHubClient />);

    await waitFor(() => {
      expect(screen.getByText('2026 Admissions Prospectus')).toBeDefined();
      expect(screen.getByText('200')).toBeDefined();
      expect(screen.getByText('12.5%')).toBeDefined();
    });
  });
});
