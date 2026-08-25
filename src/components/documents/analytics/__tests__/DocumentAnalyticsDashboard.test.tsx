import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentAnalyticsDashboard } from '../DocumentAnalyticsDashboard';
import type { DocumentAnalyticsSummary } from '@/lib/types/document-types';

const mockAnalytics: DocumentAnalyticsSummary = {
  documentId: 'doc_1',
  workspaceId: 'ws_1',
  totalViews: 125,
  uniqueVisitors: 98,
  totalLeads: 14,
  averageDurationSeconds: 110,
  averageCompletionPercentage: 74.2,
  averageEngagementScore: 32.5,
  pageMetrics: [
    {
      pageNumber: 1,
      views: 125,
      averageDwellTimeSeconds: 22,
      dropOffRatePercentage: 10,
      retentionPercentage: 100,
    },
    {
      pageNumber: 2,
      views: 112,
      averageDwellTimeSeconds: 35,
      dropOffRatePercentage: 15,
      retentionPercentage: 89.6,
    },
  ],
  deviceBreakdown: {
    mobile: 70,
    tablet: 15,
    desktop: 40,
  },
  topHotspots: [
    {
      hotspotId: 'hs_1',
      title: 'Apply Now CTA',
      type: 'link',
      pageNumber: 2,
      clicks: 42,
      ctr: 33.6,
    },
  ],
  channelMetrics: [
    {
      distributionId: 'dist_1',
      type: 'campaign',
      campaignId: 'spring-admissions-2026',
      views: 85,
      uniqueVisitors: 65,
      leads: 10,
    },
  ],
  period: 'last_30_days',
};

describe('DocumentAnalyticsDashboard Component', () => {
  it('renders all 6 KPI cards with correct metric values', () => {
    render(
      <DocumentAnalyticsDashboard
        analytics={mockAnalytics}
        selectedPeriod="last_30_days"
        onPeriodChange={vi.fn()}
        documentTitle="Admissions Brochure 2026"
      />
    );

    expect(screen.getByText('125')).toBeDefined(); // Total views
    expect(screen.getByText('98')).toBeDefined();  // Unique readers
    expect(screen.getByText('14')).toBeDefined();  // Leads generated
    expect(screen.getByText('1m 50s')).toBeDefined(); // Formatted read time
    expect(screen.getByText('74.2%')).toBeDefined();  // Avg completion
    expect(screen.getByText('32.5')).toBeDefined();   // Engagement score
  });

  it('switches between sub-tabs to display retention funnel, hotspots, and channel metrics', () => {
    render(
      <DocumentAnalyticsDashboard
        analytics={mockAnalytics}
        selectedPeriod="last_30_days"
        onPeriodChange={vi.fn()}
        documentTitle="Admissions Brochure 2026"
      />
    );

    // Initial sub-tab: Page Retention Funnel
    expect(screen.getByText(/Reading Retention & Dwell Time/i)).toBeDefined();

    // Switch to Hotspots
    const hotspotsTab = screen.getByRole('button', { name: /Hotspot Clicks/i });
    fireEvent.click(hotspotsTab);
    expect(screen.getByText('Apply Now CTA')).toBeDefined();
    expect(screen.getByText('42 clicks')).toBeDefined();

    // Switch to Channels
    const channelsTab = screen.getByRole('button', { name: /Distribution Channels/i });
    fireEvent.click(channelsTab);
    expect(screen.getByText(/Campaign: spring-admissions-2026/i)).toBeDefined();
  });

  it('triggers period change callback when date filter button is clicked', () => {
    const onPeriodChange = vi.fn();

    render(
      <DocumentAnalyticsDashboard
        analytics={mockAnalytics}
        selectedPeriod="last_30_days"
        onPeriodChange={onPeriodChange}
        documentTitle="Admissions Brochure 2026"
      />
    );

    const sevenDaysBtn = screen.getByRole('button', { name: /7 Days/i });
    fireEvent.click(sevenDaysBtn);
    expect(onPeriodChange).toHaveBeenCalledWith('last_7_days');
  });
});
