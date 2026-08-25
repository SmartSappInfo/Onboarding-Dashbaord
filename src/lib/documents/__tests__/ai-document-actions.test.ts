import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDocumentSummaryAction,
  recommendDocumentHotspotsAction,
  askDocumentQuestionAction,
  applyAiRecommendedHotspotAction,
  saveAiSummaryToDocumentMetadataAction,
} from '../ai-document-actions';
import type { DocumentAiCtaRecommendation, DocumentAiSummary } from '@/lib/types/document-types';

let mockDocExists = true;
let mockPageExists = true;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      const queryObj: any = {
        where: vi.fn().mockImplementation(() => queryObj),
        orderBy: vi.fn().mockImplementation(() => queryObj),
        limit: vi.fn().mockImplementation(() => queryObj),
        doc: vi.fn().mockImplementation((id?: string) => ({
          id: id || 'layer_new_123',
          get: vi.fn().mockImplementation(async () => ({
            exists: mockDocExists,
            data: () => ({
              id: 'doc_1',
              workspaceId: 'ws_test',
              title: 'Admissions Prospectus 2026',
              activeVersionId: 'v1',
            }),
          })),
          set: vi.fn().mockResolvedValue(true),
          update: vi.fn().mockResolvedValue(true),
        })),
        get: vi.fn().mockImplementation(async () => {
          if (colName === 'document_pages') {
            return {
              empty: !mockPageExists,
              docs: [
                {
                  id: 'page_doc_1',
                  data: () => ({
                    pageNumber: 1,
                    extractedText: 'Apply now for fall 2026 admission before May 15. Call +1 555 019 2834.',
                  }),
                },
              ],
            };
          }
          return { empty: true, docs: [] };
        }),
      };
      return queryObj;
    }),
  },
}));

describe('AI Document Intelligence Server Actions (Phase 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocExists = true;
    mockPageExists = true;
  });

  it('generates summary for document active version', async () => {
    const res = await generateDocumentSummaryAction('ws_test', 'doc_1');
    expect(res.success).toBe(true);
    expect(res.summary).toBeDefined();
    expect(res.summary?.documentId).toBe('doc_1');
  });

  it('generates CTA recommendations for document active version', async () => {
    const res = await recommendDocumentHotspotsAction('ws_test', 'doc_1');
    expect(res.success).toBe(true);
    expect(res.recommendations).toBeDefined();
    expect(res.recommendations?.length).toBeGreaterThan(0);
  });

  it('answers questions with page citations', async () => {
    const res = await askDocumentQuestionAction('ws_test', 'doc_1', 'When is the deadline?');
    expect(res.success).toBe(true);
    expect(res.response).toBeDefined();
    expect(res.response?.citations.length).toBeGreaterThan(0);
  });

  it('applies an AI recommendation to create a DocumentLayer entity', async () => {
    const mockRec: DocumentAiCtaRecommendation = {
      id: 'rec_1',
      pageNumber: 1,
      suggestedLayerType: 'cta',
      buttonLabel: 'Apply Online',
      intentDescription: 'Application deadline',
      confidenceScore: 95,
      x: 70,
      y: 85,
      width: 25,
      height: 8,
      suggestedAction: {
        type: 'url',
        targetUrl: 'https://smart-sapp.com/apply',
      },
    };

    const res = await applyAiRecommendedHotspotAction('ws_test', 'doc_1', mockRec);
    expect(res.success).toBe(true);
    expect(res.layerId).toBeDefined();
  });

  it('saves AI summary into document metadata', async () => {
    const mockSummary: DocumentAiSummary = {
      documentId: 'doc_1',
      executiveSummary: 'Test Summary',
      keyTakeaways: ['Point 1'],
      topics: ['Education'],
      targetAudience: 'Students',
      estimatedReadingTimeMinutes: 2,
      generatedAt: '2026-01-01T00:00:00Z',
    };

    const res = await saveAiSummaryToDocumentMetadataAction('ws_test', 'doc_1', mockSummary);
    expect(res.success).toBe(true);
  });
});
