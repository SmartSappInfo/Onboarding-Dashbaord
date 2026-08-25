import { describe, it, expect } from 'vitest';
import {
  safePercentage,
  calculateSessionEngagementScore,
  calculateRetentionFunnel,
  aggregateTelemetryData,
} from '../analytics-service';
import type { DocumentEvent, ViewerSession } from '@/lib/types/document-types';

describe('Analytics Service (Phase 8)', () => {
  describe('safePercentage', () => {
    it('calculates accurate percentages and prevents division by zero / NaN', () => {
      expect(safePercentage(50, 100)).toBe(50.0);
      expect(safePercentage(1, 3)).toBe(33.3);
      expect(safePercentage(0, 0)).toBe(0);
      expect(safePercentage(10, 0)).toBe(0);
      expect(safePercentage(-5, 100)).toBe(0);
    });
  });

  describe('calculateSessionEngagementScore', () => {
    it('calculates weighted engagement score matching PRD Section 30 formula', () => {
      // 1. Base open (+2) + 2 pages (+2) + 50% completion (+5) = 9
      const score1 = calculateSessionEngagementScore({
        pagesViewedCount: 2,
        totalPages: 4,
        interactionsCount: 0,
      });
      expect(score1).toBe(9);

      // 2. Full completion (+10) + 4 pages (+4) + Base (+2) + 2 CTA clicks (+20) + Lead (+20) = 56
      const score2 = calculateSessionEngagementScore({
        pagesViewedCount: 4,
        totalPages: 4,
        interactionsCount: 2,
        hasLeadSubmitted: true,
      });
      expect(score2).toBe(56);
    });
  });

  describe('calculateRetentionFunnel', () => {
    it('computes page retention percentages and dwell times', () => {
      const mockEvents: DocumentEvent[] = [
        {
          id: 'ev_1',
          workspaceId: 'ws_1',
          documentId: 'doc_1',
          sessionId: 's1',
          visitorId: 'v1',
          eventType: 'page_viewed',
          occurredAt: '2026-01-01T00:00:00Z',
          pageNumber: 1,
          durationMs: 15000,
        },
        {
          id: 'ev_2',
          workspaceId: 'ws_1',
          documentId: 'doc_1',
          sessionId: 's1',
          visitorId: 'v1',
          eventType: 'page_viewed',
          occurredAt: '2026-01-01T00:00:15Z',
          pageNumber: 2,
          durationMs: 10000,
        },
      ];

      const funnel = calculateRetentionFunnel(mockEvents, 3);
      expect(funnel.length).toBe(3);
      expect(funnel[0].pageNumber).toBe(1);
      expect(funnel[0].retentionPercentage).toBe(100);
      expect(funnel[1].pageNumber).toBe(2);
      expect(funnel[2].pageNumber).toBe(3);
    });
  });

  describe('aggregateTelemetryData', () => {
    it('aggregates raw events and sessions into DocumentAnalyticsSummary', () => {
      const mockSessions: ViewerSession[] = [
        {
          id: 'sess_1',
          workspaceId: 'ws_1',
          documentId: 'doc_1',
          versionId: 'ver_1',
          visitorId: 'v1',
          startedAt: '2026-01-01T00:00:00Z',
          lastActivityAt: '2026-01-01T00:05:00Z',
          device: { type: 'mobile' },
          browser: 'Chrome',
          os: 'iOS',
          pagesViewed: [1, 2],
          completionPercentage: 50,
          totalDwellTimeMs: 30000,
          engagementScore: 25,
        },
      ];

      const summary = aggregateTelemetryData({
        documentId: 'doc_1',
        workspaceId: 'ws_1',
        pageCount: 4,
        events: [],
        sessions: mockSessions,
        leadsCount: 1,
        period: 'last_7_days',
      });

      expect(summary.totalViews).toBe(1);
      expect(summary.uniqueVisitors).toBe(1);
      expect(summary.totalLeads).toBe(1);
      expect(summary.averageDurationSeconds).toBe(30);
      expect(summary.averageCompletionPercentage).toBe(50);
      expect(summary.averageEngagementScore).toBe(25);
      expect(summary.deviceBreakdown.mobile).toBe(1);
    });
  });
});
