import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyTagAction, removeTagAction, getEntityTagsAction } from '../scoped-tag-actions';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          update: vi.fn(),
        })),
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(),
            })),
          })),
        })),
      })),
      batch: vi.fn(() => ({
        update: vi.fn(),
        commit: vi.fn(),
      })),
    },
    FieldValue: {
      increment: vi.fn((n) => ({ _increment: n })),
    },
  };
});

describe('Scoped Tag Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('applyTagAction', () => {
    it('should apply global tags to entity.globalTags based on tag scope', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockEntityGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'entity-1',
        data: () => ({
          id: 'entity-1',
          organizationId: 'org-1',
          entityType: 'institution',
          name: 'Test School',
          globalTags: [],
          contacts: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
        }),
      });

      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'global' }),
      });

      const mockBatchUpdate = vi.fn();
      const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: mockEntityGet,
              update: mockUpdate,
            })),
          } as any;
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(adminDb.batch).mockReturnValue({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      } as any);

      const result = await applyTagAction(
        'entity-1',
        ['tag-1', 'tag-2'],
        null, // workspaceId not needed for global tags
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          globalTags: ['tag-1', 'tag-2'],
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should apply workspace tags to workspace_entities.workspaceTags based on tag scope', async () => {
      const mockWeUpdate = vi.fn().mockResolvedValue(undefined);
      const mockWeGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'we-1',
            ref: {
              update: mockWeUpdate,
            },
            data: () => ({
              id: 'we-1',
              entityId: 'entity-1',
              workspaceId: 'workspace-1',
              workspaceTags: [],
              organizationId: 'org-1',
              entityType: 'institution',
              pipelineId: 'pipeline-1',
              stageId: 'stage-1',
              status: 'active',
              displayName: 'Test School',
              addedAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
            }),
          },
        ],
      });

      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'workspace' }),
      });

      const mockBatchUpdate = vi.fn();
      const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: mockWeGet,
                })),
              })),
            })),
          } as any;
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(adminDb.batch).mockReturnValue({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      } as any);

      const result = await applyTagAction(
        'entity-1',
        ['tag-1', 'tag-2'],
        'workspace-1', // workspaceId required for workspace tags
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockWeUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTags: ['tag-1', 'tag-2'],
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should require workspaceId when scope is workspace', async () => {
      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'workspace' }),
      });

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      const result = await applyTagAction(
        'entity-1',
        ['tag-1'],
        null, // workspaceId is null
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('workspaceId is required');
    });

    it('should not duplicate tags when applying existing tags', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'entity-1',
        data: () => ({
          id: 'entity-1',
          organizationId: 'org-1',
          entityType: 'institution',
          name: 'Test School',
          globalTags: ['tag-1'], // Already has tag-1
          contacts: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
        }),
      });

      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'global' }),
      });

      const mockBatchUpdate = vi.fn();
      const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: mockGet,
              update: mockUpdate,
            })),
          } as any;
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(adminDb.batch).mockReturnValue({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      } as any);

      const result = await applyTagAction(
        'entity-1',
        ['tag-1', 'tag-2'], // tag-1 already exists
        null,
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          globalTags: ['tag-1', 'tag-2'], // Should not duplicate tag-1
        })
      );
    });
  });

  describe('removeTagAction', () => {
    it('should remove global tags from entity.globalTags', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'entity-1',
        data: () => ({
          id: 'entity-1',
          organizationId: 'org-1',
          entityType: 'institution',
          name: 'Test School',
          globalTags: ['tag-1', 'tag-2', 'tag-3'],
          contacts: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
        }),
      });

      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'global' }),
      });

      const mockBatchUpdate = vi.fn();
      const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: mockGet,
              update: mockUpdate,
            })),
          } as any;
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(adminDb.batch).mockReturnValue({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      } as any);

      const result = await removeTagAction(
        'entity-1',
        ['tag-1', 'tag-2'],
        null,
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          globalTags: ['tag-3'], // Only tag-3 remains
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should remove workspace tags from workspace_entities.workspaceTags', async () => {
      const mockWeUpdate = vi.fn().mockResolvedValue(undefined);
      const mockWeGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'we-1',
            ref: {
              update: mockWeUpdate,
            },
            data: () => ({
              id: 'we-1',
              entityId: 'entity-1',
              workspaceId: 'workspace-1',
              workspaceTags: ['tag-1', 'tag-2', 'tag-3'],
              organizationId: 'org-1',
              entityType: 'institution',
              pipelineId: 'pipeline-1',
              stageId: 'stage-1',
              status: 'active',
              displayName: 'Test School',
              addedAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
            }),
          },
        ],
      });

      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'workspace' }),
      });

      const mockBatchUpdate = vi.fn();
      const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: mockWeGet,
                })),
              })),
            })),
          } as any;
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(adminDb.batch).mockReturnValue({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      } as any);

      const result = await removeTagAction(
        'entity-1',
        ['tag-1', 'tag-2'],
        'workspace-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockWeUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTags: ['tag-3'], // Only tag-3 remains
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should require workspaceId when scope is workspace', async () => {
      const mockTagGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ scope: 'workspace' }),
      });

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'tags') {
          return {
            doc: vi.fn(() => ({
              get: mockTagGet,
            })),
          } as any;
        }
        return {} as any;
      });

      const result = await removeTagAction(
        'entity-1',
        ['tag-1'],
        null,
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('workspaceId is required');
    });
  });

  describe('getEntityTagsAction', () => {
    it('should return global tags and workspace tags', async () => {
      const mockEntityGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'entity-1',
        data: () => ({
          id: 'entity-1',
          organizationId: 'org-1',
          entityType: 'institution',
          name: 'Test School',
          globalTags: ['global-tag-1', 'global-tag-2'],
          contacts: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
        }),
      });

      const mockWeGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'we-1',
            data: () => ({
              id: 'we-1',
              entityId: 'entity-1',
              workspaceId: 'workspace-1',
              workspaceTags: ['workspace-tag-1', 'workspace-tag-2'],
              organizationId: 'org-1',
              entityType: 'institution',
              pipelineId: 'pipeline-1',
              stageId: 'stage-1',
              status: 'active',
              displayName: 'Test School',
              addedAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
            }),
          },
        ],
      });

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: mockEntityGet,
            })),
          } as any;
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: mockWeGet,
                })),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      const result = await getEntityTagsAction('entity-1', 'workspace-1');

      expect(result.success).toBe(true);
      expect(result.globalTags).toEqual(['global-tag-1', 'global-tag-2']);
      expect(result.workspaceTags).toEqual(['workspace-tag-1', 'workspace-tag-2']);
    });

    it('should return only global tags when workspaceId is not provided', async () => {
      const mockEntityGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'entity-1',
        data: () => ({
          id: 'entity-1',
          organizationId: 'org-1',
          entityType: 'institution',
          name: 'Test School',
          globalTags: ['global-tag-1', 'global-tag-2'],
          contacts: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
        }),
      });

      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: mockEntityGet,
        })),
      } as any);

      const result = await getEntityTagsAction('entity-1');

      expect(result.success).toBe(true);
      expect(result.globalTags).toEqual(['global-tag-1', 'global-tag-2']);
      expect(result.workspaceTags).toEqual([]);
    });
  });
});
