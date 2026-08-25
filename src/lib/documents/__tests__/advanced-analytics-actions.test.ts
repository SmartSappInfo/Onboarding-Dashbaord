import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWorkspaceAdvancedAnalyticsAction } from '../advanced-analytics-actions';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      const queryObj: any = {
        where: vi.fn().mockImplementation(() => queryObj),
        get: vi.fn().mockImplementation(async () => {
          if (colName === 'documents') {
            return {
              docs: [
                {
                  id: 'doc_1',
                  data: () => ({
                    id: 'doc_1',
                    title: 'Admissions 2026',
                    workspaceId: 'ws_test',
                    status: 'published',
                    pageCount: 8,
                  }),
                },
              ],
            };
          }
          if (colName === 'viewer_sessions') {
            return {
              docs: [
                {
                  id: 's_1',
                  data: () => ({
                    id: 's_1',
                    workspaceId: 'ws_test',
                    documentId: 'doc_1',
                    visitorId: 'v_1',
                    startedAt: '2026-01-01T00:00:00Z',
                    totalDwellTimeMs: 60000,
                    completionPercentage: 80,
                    engagementScore: 30,
                  }),
                },
              ],
            };
          }
          if (colName === 'document_events') {
            return {
              docs: [
                {
                  id: 'ev_1',
                  data: () => ({
                    id: 'ev_1',
                    workspaceId: 'ws_test',
                    documentId: 'doc_1',
                    visitorId: 'v_1',
                    eventType: 'document_opened',
                  }),
                },
              ],
            };
          }
          if (colName === 'flipbook_leads') {
            return {
              docs: [
                {
                  id: 'lead_1',
                  data: () => ({
                    documentId: 'doc_1',
                    createdAt: '2026-01-01T00:00:00Z',
                  }),
                },
              ],
            };
          }
          return { docs: [] };
        }),
      };
      return queryObj;
    }),
  },
}));

describe('Advanced Analytics Server Actions (Phase 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects calls without workspaceId', async () => {
    const res = await getWorkspaceAdvancedAnalyticsAction('');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Workspace ID is required.');
  });

  it('fetches workspace advanced analytics and aggregates data successfully', async () => {
    const res = await getWorkspaceAdvancedAnalyticsAction('ws_test', 'last_30_days');
    expect(res.success).toBe(true);
    expect(res.analytics).toBeDefined();
    expect(res.analytics?.workspaceId).toBe('ws_test');
    expect(res.analytics?.totalPortfolioViews).toBe(1);
    expect(res.analytics?.totalLeadsGenerated).toBe(1);
    expect(res.analytics?.documentMetrics.length).toBe(1);
  });
});
