import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  associateVisitorWithContact,
  recordDocumentEngagementActivity,
  awardContactDocumentScore,
  getContactDocumentEngagements,
} from '../crm-integration-service';

// Mock Firebase Admin
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        id: docId,
        set: mockSet,
        update: mockUpdate,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: docId,
            title: '2026 Academic Catalog',
            slug: 'academic-catalog-2026',
            leadScore: 10,
          }),
        }),
      }),
      where: () => ({
        where: () => ({
          where: () => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ ref: { id: 'sess_1' } }],
            }),
          }),
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                data: () => ({
                  id: 'sess_1',
                  workspaceId: 'ws_test',
                  documentId: 'doc_123',
                  contactId: 'contact_456',
                  startedAt: '2026-01-01T00:00:00Z',
                  lastActivityAt: '2026-01-01T00:10:00Z',
                  pagesViewed: [1, 2, 3],
                  completionPercentage: 75,
                  totalDwellTimeMs: 60000,
                  engagementScore: 18,
                }),
              },
            ],
          }),
        }),
      }),
    }),
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  },
}));

// Mock Activity Logger
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/activity-logger', () => ({
  logActivity: (args: unknown) => mockLogActivity(args),
}));

describe('CRM Integration Service (Phase 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('associates an anonymous visitor with a verified CRM contact', async () => {
    const success = await associateVisitorWithContact({
      workspaceId: 'ws_test',
      visitorId: 'vis_anon_999',
      contactId: 'contact_456',
    });

    expect(success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'contact_456' }),
      { merge: true }
    );
  });

  it('records document engagement milestone activity on contact timeline', async () => {
    await recordDocumentEngagementActivity({
      workspaceId: 'ws_test',
      contactId: 'contact_456',
      contactName: 'Jane Smith',
      documentId: 'doc_123',
      documentTitle: '2026 Academic Catalog',
      type: 'document_completed',
      description: 'Finished reading 2026 Academic Catalog',
    });

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document_completed',
        entityId: 'contact_456',
      })
    );
  });

  it('awards contact document score atomically', async () => {
    const success = await awardContactDocumentScore({
      workspaceId: 'ws_test',
      contactId: 'contact_456',
      scoreDelta: 10,
      reason: 'Completed reading',
      documentId: 'doc_123',
      documentTitle: '2026 Academic Catalog',
    });

    expect(success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'score_changed' })
    );
  });

  it('retrieves full contact document engagements summary', async () => {
    const summary = await getContactDocumentEngagements('ws_test', 'contact_456');
    expect(summary.totalDocumentsRead).toBe(1);
    expect(summary.totalReadingTimeSeconds).toBe(60);
    expect(summary.averageCompletionPercentage).toBe(75);
    expect(summary.engagements.length).toBe(1);
    expect(summary.engagements[0].documentTitle).toBe('2026 Academic Catalog');
  });
});
