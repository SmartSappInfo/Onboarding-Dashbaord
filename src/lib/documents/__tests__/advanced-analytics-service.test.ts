import { describe, it, expect } from 'vitest';
import { aggregateWorkspaceAdvancedAnalytics } from '../advanced-analytics-service';
import type { Document, DocumentEvent, ViewerSession } from '@/lib/types/document-types';

describe('Advanced Analytics Service (Phase 11)', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc_1',
      title: '2026 Admissions Prospectus',
      slug: 'admissions-2026',
      workspaceId: 'ws_1',
      status: 'published',
      documentType: 'brochure',
      activeVersionId: 'v1',
      defaultViewerMode: 'flipbook',
      createdBy: 'usr_admin',
      metadata: { pageCount: 10 },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'doc_2',
      title: 'Tuition Fee Schedule',
      slug: 'tuition-fees',
      workspaceId: 'ws_1',
      status: 'published',
      documentType: 'brochure',
      activeVersionId: 'v1',
      defaultViewerMode: 'flipbook',
      createdBy: 'usr_admin',
      metadata: { pageCount: 4 },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockSessions: ViewerSession[] = [
    {
      id: 'sess_1',
      documentId: 'doc_1',
      versionId: 'v1',
      workspaceId: 'ws_1',
      visitorId: 'vis_alpha',
      browser: 'Chrome',
      os: 'macOS',
      startedAt: '2026-01-02T10:00:00Z',
      lastActivityAt: '2026-01-02T10:05:00Z',
      pagesViewed: [1, 2, 3, 4, 5],
      completionPercentage: 50,
      totalDwellTimeMs: 120000,
      engagementScore: 25,
      device: { type: 'desktop' },
      campaignId: 'spring_email',
      distributionId: 'dist_link_1',
    },
    {
      id: 'sess_2',
      documentId: 'doc_1',
      versionId: 'v1',
      workspaceId: 'ws_1',
      visitorId: 'vis_beta',
      browser: 'Safari',
      os: 'iOS',
      startedAt: '2026-01-02T11:00:00Z',
      lastActivityAt: '2026-01-02T11:10:00Z',
      pagesViewed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      completionPercentage: 100,
      totalDwellTimeMs: 300000,
      engagementScore: 45,
      device: { type: 'mobile' },
      campaignId: 'spring_email',
      distributionId: 'dist_link_1',
    },
    {
      id: 'sess_3',
      documentId: 'doc_2',
      versionId: 'v1',
      workspaceId: 'ws_1',
      visitorId: 'vis_alpha', // Returning reader
      browser: 'Safari',
      os: 'iOS',
      startedAt: '2026-01-03T09:00:00Z',
      lastActivityAt: '2026-01-03T09:02:00Z',
      pagesViewed: [1, 2],
      completionPercentage: 50,
      totalDwellTimeMs: 60000,
      engagementScore: 15,
      device: { type: 'tablet' },
    },
  ];

  const mockEvents: DocumentEvent[] = [
    {
      id: 'ev_1',
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      visitorId: 'vis_alpha',
      sessionId: 'sess_1',
      eventType: 'document_opened',
      occurredAt: '2026-01-02T10:00:00Z',
    },
    {
      id: 'ev_2',
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      visitorId: 'vis_beta',
      sessionId: 'sess_2',
      eventType: 'link_clicked',
      occurredAt: '2026-01-02T11:05:00Z',
    },
  ];

  const mockLeads = [
    {
      id: 'lead_1',
      documentId: 'doc_1',
      campaignId: 'spring_email',
      createdAt: '2026-01-02T11:08:00Z',
    },
  ];

  it('aggregates portfolio-wide totals and average performance metrics accurately', () => {
    const summary = aggregateWorkspaceAdvancedAnalytics({
      workspaceId: 'ws_1',
      period: 'last_30_days',
      documents: mockDocuments,
      sessions: mockSessions,
      events: mockEvents,
      leads: mockLeads,
    });

    expect(summary.workspaceId).toBe('ws_1');
    expect(summary.totalPortfolioViews).toBe(3);
    expect(summary.totalUniqueReaders).toBe(2); // vis_alpha and vis_beta
    expect(summary.totalLeadsGenerated).toBe(1);
    expect(summary.portfolioConversionRatePercentage).toBe(50.0); // 1 lead / 2 unique readers = 50%
    expect(summary.totalReadingTimeSeconds).toBe(480); // (120k + 300k + 60k) / 1000 = 480s
  });

  it('generates multi-document comparison ranking matrix', () => {
    const summary = aggregateWorkspaceAdvancedAnalytics({
      workspaceId: 'ws_1',
      period: 'last_30_days',
      documents: mockDocuments,
      sessions: mockSessions,
      events: mockEvents,
      leads: mockLeads,
    });

    expect(summary.documentMetrics.length).toBe(2);
    // doc_1 has 2 views, doc_2 has 1 view -> doc_1 ranked first
    expect(summary.documentMetrics[0].documentId).toBe('doc_1');
    expect(summary.documentMetrics[0].totalViews).toBe(2);
    expect(summary.documentMetrics[0].leadsGenerated).toBe(1);
    expect(summary.documentMetrics[0].conversionRatePercentage).toBe(50.0);

    expect(summary.documentMetrics[1].documentId).toBe('doc_2');
    expect(summary.documentMetrics[1].totalViews).toBe(1);
  });

  it('generates a 5-stage document conversion funnel with drop-off percentages', () => {
    const summary = aggregateWorkspaceAdvancedAnalytics({
      workspaceId: 'ws_1',
      period: 'last_30_days',
      documents: mockDocuments,
      sessions: mockSessions,
      events: mockEvents,
      leads: mockLeads,
    });

    expect(summary.funnelStages.length).toBe(5);
    expect(summary.funnelStages[0].stageName).toBe('Total Document Impressions');
    expect(summary.funnelStages[1].stageName).toBe('Document Opens & Readers');
    expect(summary.funnelStages[2].stageName).toBe('Deep Readers (50%+ Read)');
    expect(summary.funnelStages[3].stageName).toBe('Interactive CTA / Hotspot Clicks');
    expect(summary.funnelStages[4].stageName).toBe('Lead Inquiries Captured');
    expect(summary.funnelStages[4].count).toBe(1);
  });

  it('calculates campaign attribution and cohort reader retention', () => {
    const summary = aggregateWorkspaceAdvancedAnalytics({
      workspaceId: 'ws_1',
      period: 'last_30_days',
      documents: mockDocuments,
      sessions: mockSessions,
      events: mockEvents,
      leads: mockLeads,
    });

    // Campaign metrics
    expect(summary.campaignMetrics.length).toBe(2); // 'spring_email' and 'Direct / Organic'
    const springEmail = summary.campaignMetrics.find((c) => c.campaignId === 'spring_email');
    expect(springEmail).toBeDefined();
    expect(springEmail?.totalViews).toBe(2);
    expect(springEmail?.leadsGenerated).toBe(1);

    // Cohort retention
    expect(summary.cohortMetrics.length).toBe(1);
    expect(summary.cohortMetrics[0].returningVisitors).toBe(1); // vis_alpha has 2 sessions
    expect(summary.cohortMetrics[0].returnRatePercentage).toBe(50.0);
  });
});
