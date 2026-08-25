import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDocumentVersionAction,
  promoteDocumentVersionAction,
  archiveDocumentVersionAction,
  getDocumentVersionsAction,
} from '../document-version-actions';
import type { Document, DocumentVersion, DocumentPage } from '@/lib/types/document-types';

const mockStore: Record<string, Record<string, Record<string, unknown>>> = {
  documents: {},
  document_versions: {},
  document_pages: {},
  flipbook_pages: {},
};

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: (colName: string) => {
        if (!mockStore[colName]) {
          mockStore[colName] = {};
        }
        const collectionMap = mockStore[colName];

        return {
          doc: (id?: string) => {
            const docId = id || `${colName}_${Date.now()}`;
            return {
              id: docId,
              get: vi.fn().mockImplementation(async () => ({
                exists: !!collectionMap[docId],
                data: () => collectionMap[docId],
              })),
              set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                collectionMap[docId] = { ...data, id: docId };
                return { id: docId };
              }),
              update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                if (collectionMap[docId]) {
                  collectionMap[docId] = { ...collectionMap[docId], ...updates };
                }
                return { id: docId };
              }),
              delete: vi.fn().mockImplementation(async () => {
                delete collectionMap[docId];
              }),
            };
          },
          where: (field: string, op: string, value: string) => {
            return {
              get: vi.fn().mockImplementation(async () => {
                const matchingDocs = Object.values(collectionMap)
                  .filter((item) => (item as Record<string, unknown>)[field] === value)
                  .map((item) => {
                    const rec = item as { id: string };
                    return {
                      ref: {
                        delete: async () => { delete collectionMap[rec.id]; },
                      },
                      data: () => item,
                    };
                  });
                return { docs: matchingDocs };
              }),
              where: (f2: string, op2: string, v2: string) => {
                return {
                  get: vi.fn().mockImplementation(async () => {
                    const matchingDocs = Object.values(collectionMap)
                      .filter((item) => {
                        const rec = item as Record<string, unknown>;
                        return rec[field] === value && rec[f2] === v2;
                      })
                      .map((item) => ({
                        data: () => item,
                      }));
                    return { docs: matchingDocs };
                  }),
                };
              },
            };
          },
        };
      },
      batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return {
          set: (ref: { set: (d: unknown) => Promise<void> }, data: unknown) => {
            ops.push(async () => { await ref.set(data); });
          },
          delete: (ref: { delete: () => Promise<void> }) => {
            ops.push(async () => { await ref.delete(); });
          },
          commit: async () => {
            for (const op of ops) {
              await op();
            }
          },
        };
      },
    },
  };
});

describe('Document Version Actions', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      mockStore[key] = {};
    }

    // Seed test document
    mockStore.documents['doc_1'] = {
      id: 'doc_1',
      workspaceId: 'ws_1',
      title: 'Company Handbook',
      activeVersionId: 'doc_1_v1',
      viewsCount: 10,
    } as unknown as Record<string, unknown>;

    mockStore.document_versions['doc_1_v1'] = {
      id: 'doc_1_v1',
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      versionNumber: 1,
      status: 'ready',
    } as unknown as Record<string, unknown>;

    mockStore.document_pages['doc_1_v1_page_1'] = {
      id: 'doc_1_v1_page_1',
      documentId: 'doc_1',
      versionId: 'doc_1_v1',
      workspaceId: 'ws_1',
      pageNumber: 1,
      renderedAssetUrl: 'https://example.com/page1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      width: 800,
      height: 1130,
    } as unknown as Record<string, unknown>;
  });

  it('creates a new version and auto-increments versionNumber', async () => {
    const result = await createDocumentVersionAction({
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
      cloneFromVersionId: 'doc_1_v1',
    });

    expect(result.success).toBe(true);
    expect(result.versionNumber).toBe(2);
    expect(result.versionId).toBe('doc_1_v2');
    expect(mockStore.document_versions['doc_1_v2']).toBeDefined();
    expect(mockStore.document_pages['doc_1_v2_page_1']).toBeDefined();
  });

  it('rejects version creation for unauthorized workspace', async () => {
    const result = await createDocumentVersionAction({
      documentId: 'doc_1',
      workspaceId: 'ws_unauthorized',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized workspace access');
  });

  it('promotes a version to activeVersion and syncs legacy pages', async () => {
    mockStore.document_versions['doc_1_v2'] = {
      id: 'doc_1_v2',
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      versionNumber: 2,
      status: 'ready',
    } as unknown as Record<string, unknown>;

    mockStore.document_pages['doc_1_v2_page_1'] = {
      id: 'doc_1_v2_page_1',
      documentId: 'doc_1',
      versionId: 'doc_1_v2',
      workspaceId: 'ws_1',
      pageNumber: 1,
      renderedAssetUrl: 'https://example.com/page1_v2.jpg',
      thumbnailUrl: 'https://example.com/thumb1_v2.jpg',
      width: 800,
      height: 1130,
    } as unknown as Record<string, unknown>;

    const result = await promoteDocumentVersionAction('doc_1', 'doc_1_v2', 'ws_1');

    expect(result.success).toBe(true);
    expect((mockStore.documents['doc_1'] as unknown as Document).activeVersionId).toBe('doc_1_v2');
    expect(mockStore.flipbook_pages['doc_1_page_1']).toBeDefined();
  });

  it('archives a document version successfully', async () => {
    const result = await archiveDocumentVersionAction('doc_1', 'doc_1_v1', 'ws_1');

    expect(result.success).toBe(true);
    expect((mockStore.document_versions['doc_1_v1'] as unknown as DocumentVersion).status).toBe('archived');
  });

  it('fetches version history sorted descending by versionNumber', async () => {
    mockStore.document_versions['doc_1_v2'] = {
      id: 'doc_1_v2',
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      versionNumber: 2,
      status: 'ready',
    } as unknown as Record<string, unknown>;

    const result = await getDocumentVersionsAction('doc_1', 'ws_1');

    expect(result.success).toBe(true);
    expect(result.versions).toHaveLength(2);
    expect(result.versions?.[0].versionNumber).toBe(2);
    expect(result.versions?.[1].versionNumber).toBe(1);
  });
});
