import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateSingleFlipbook } from '../migration-service';
import { adminDb } from '@/lib/firebase-admin';

vi.mock('@/lib/firebase-admin', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn().mockReturnValue({
    set: mockSet,
    delete: vi.fn(),
    commit: mockCommit,
  });

  const mockGet = vi.fn();

  const mockDoc = vi.fn().mockReturnValue({
    get: mockGet,
    set: mockSet,
  });

  const mockWhere = vi.fn().mockReturnValue({
    get: mockGet,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
  });

  return {
    adminDb: {
      collection: mockCollection,
      batch: mockBatch,
    },
  };
});

describe('Migration Service (Fetch-Enrich-Restore Protocol)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles non-existent flipbook gracefully', async () => {
    const mockCollection = adminDb.collection as unknown as ReturnType<typeof vi.fn>;
    const mockDoc = mockCollection().doc as unknown as ReturnType<typeof vi.fn>;
    mockDoc().get.mockResolvedValueOnce({ exists: false });

    const result = await migrateSingleFlipbook('non_existent_id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('migrates an existing flipbook successfully into document entities', async () => {
    const mockCollection = adminDb.collection as unknown as ReturnType<typeof vi.fn>;
    const mockDoc = mockCollection().doc as unknown as ReturnType<typeof vi.fn>;
    const mockWhere = mockCollection().where as unknown as ReturnType<typeof vi.fn>;

    mockDoc().get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'fb_1',
        workspaceId: 'ws_1',
        title: 'Prospectus 2026',
        slug: 'prospectus-2026',
        status: 'published',
        sourceFileUrl: 'https://example.com/doc.pdf',
        sourceFileType: 'pdf',
        sourceFileName: 'doc.pdf',
        pageCount: 5,
        aspectRatio: 1.414,
        style: {
          pageStyle: 'magazine',
          soundEnabled: true,
          hardcover: false,
          backgroundColor: '#ffffff',
          enableDownloadPdf: true,
          enablePrint: true,
          enableShare: true,
          enableSearch: true,
          enableThumbnails: true,
        },
        hotspots: [],
        leadGate: {
          enabled: false,
          triggerPage: 0,
          title: 'Gate',
          description: 'Desc',
          requireName: true,
          requireEmail: true,
          requirePhone: false,
          ctaText: 'Unlock',
        },
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      }),
    });

    mockWhere().get.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            id: 'fb_1_page_1',
            flipbookId: 'fb_1',
            pageNumber: 1,
            imageUrl: 'https://example.com/page1.jpg',
            thumbnailUrl: 'https://example.com/page1.jpg',
            width: 800,
            height: 1130,
          }),
        },
      ],
    });

    const result = await migrateSingleFlipbook('fb_1');
    expect(result.success).toBe(true);
  });
});
