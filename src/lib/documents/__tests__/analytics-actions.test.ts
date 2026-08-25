import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocumentAnalyticsAction } from '../analytics-actions';

// Mock Firebase Admin
let mockDocExists = true;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => ({
      doc: () => ({
        get: vi.fn().mockImplementation(async () => ({
          exists: mockDocExists,
          data: () => ({
            workspaceId: 'ws_test',
            pageCount: 5,
            title: 'Prospectus 2026',
          }),
        })),
      }),
      where: () => ({
        where: () => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              {
                data: () => ({
                  id: 's_1',
                  workspaceId: 'ws_test',
                  documentId: 'doc_123',
                  visitorId: 'v1',
                  startedAt: '2026-01-01T00:00:00Z',
                  device: { type: 'desktop' },
                  pagesViewed: [1, 2, 3],
                  completionPercentage: 60,
                  totalDwellTimeMs: 45000,
                  engagementScore: 30,
                }),
              },
            ],
            size: 1,
          }),
        }),
      }),
    }),
  },
}));

describe('Analytics Server Actions (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocExists = true;
  });

  it('fetches document analytics successfully for all_time', async () => {
    const res = await getDocumentAnalyticsAction({
      workspaceId: 'ws_test',
      documentId: 'doc_123',
      period: 'all_time',
    });

    expect(res.success).toBe(true);
    expect(res.analytics).toBeDefined();
    expect(res.analytics?.documentId).toBe('doc_123');
    expect(res.analytics?.pageMetrics.length).toBe(5);
  });

  it('returns error when document is missing or unauthorized', async () => {
    mockDocExists = false;

    const res = await getDocumentAnalyticsAction({
      workspaceId: 'ws_test',
      documentId: 'doc_unknown',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Document not found|access denied/i);
  });
});
