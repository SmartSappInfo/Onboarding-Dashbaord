import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  reorderDocumentPagesAction, 
  duplicateDocumentPageAction, 
  deleteDocumentPageAction 
} from '../document-page-actions';

// Mock Firebase Admin
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockCommit = vi.fn().mockResolvedValue(undefined);

const mockBatch = {
  update: mockUpdate,
  set: mockSet,
  delete: mockDelete,
  commit: mockCommit,
};

let mockDocData: Record<string, unknown> | null = null;
let mockPageData: Record<string, unknown> | null = null;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    batch: () => mockBatch,
    collection: (colName: string) => ({
      doc: (docId?: string) => ({
        id: docId || 'mock_doc_id',
        get: vi.fn().mockImplementation(async () => {
          if (colName === 'documents') {
            return {
              exists: !!mockDocData,
              data: () => mockDocData,
            };
          }
          if (colName === 'document_pages') {
            return {
              exists: !!mockPageData,
              data: () => mockPageData,
            };
          }
          return { exists: false, data: () => null };
        }),
      }),
      where: () => ({
        where: () => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              {
                id: 'page_2',
                ref: { id: 'page_2' },
                data: () => ({ pageNumber: 2 }),
              },
            ],
          }),
        }),
      }),
    }),
  },
}));

describe('Document Page Actions (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocData = {
      id: 'doc_123',
      workspaceId: 'ws_test',
      pageCount: 3,
    };
    mockPageData = {
      id: 'doc_123_page_1',
      documentId: 'doc_123',
      workspaceId: 'ws_test',
      pageNumber: 1,
      renderedAssetUrl: 'https://example.com/p1.jpg',
      thumbnailUrl: 'https://example.com/p1_thumb.jpg',
      width: 800,
      height: 1130,
      aspectRatio: 1.414,
    };
  });

  it('reorders document pages atomically in batches', async () => {
    const res = await reorderDocumentPagesAction('ws_test', 'doc_123', ['page_2', 'page_1']);
    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();
  });

  it('duplicates a document page and shifts subsequent pages', async () => {
    const res = await duplicateDocumentPageAction('ws_test', 'doc_123', 'doc_123_page_1');
    expect(res.success).toBe(true);
    expect(res.newPageId).toBeDefined();
    expect(mockSet).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();
  });

  it('deletes a document page and decrements total count', async () => {
    const res = await deleteDocumentPageAction('ws_test', 'doc_123', 'doc_123_page_1');
    expect(res.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();
  });

  it('rejects deletion when document has only 1 page', async () => {
    mockDocData = {
      id: 'doc_123',
      workspaceId: 'ws_test',
      pageCount: 1,
    };

    const res = await deleteDocumentPageAction('ws_test', 'doc_123', 'doc_123_page_1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Cannot delete the only page/i);
  });
});
