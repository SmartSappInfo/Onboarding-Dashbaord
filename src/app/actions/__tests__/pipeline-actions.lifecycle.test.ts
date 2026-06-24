// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deletePipelineAction, archivePipelineAction } from '../../../../lib/pipeline-actions';

// Mock canUser to always grant permissions
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

// Mock activity-logger to avoid side effects
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Setup captures
let deletedRefs: string[] = [];
let updatedFields: Record<string, unknown> | null = null;
const pipelinesCollection: Record<string, unknown> = {
  'pipe-1': {
    exists: true,
    data: () => ({ workspaceIds: ['workspace-1'] }),
  },
};

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      batch: vi.fn(() => ({
        delete: vi.fn((ref: { id: string }) => {
          deletedRefs.push(ref.id);
        }),
        update: vi.fn((ref: unknown, data: Record<string, unknown>) => {
          updatedFields = data;
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
      collection: vi.fn((name: string) => {
        if (name === 'pipelines') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const docData = pipelinesCollection[id];
                if (docData) {
                  return docData;
                }
                return { exists: false };
              }),
              update: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                updatedFields = data;
                return { success: true };
              }),
            })),
          };
        }
        if (name === 'deals') {
          return {
            where: vi.fn((field1: string, op1: string, val1: string) => {
              return {
                where: vi.fn((field2: string, op2: string, val2: string) => {
                  return {
                    limit: vi.fn((num: number) => ({
                      get: vi.fn().mockImplementation(async () => {
                        // mock open deals check
                        if (val1 === 'pipe-active-deals' && val2 === 'open') {
                          return { empty: false, docs: [{ id: 'deal-active' }] };
                        }
                        return { empty: true, docs: [] };
                      }),
                    })),
                    get: vi.fn().mockImplementation(async () => {
                      if (val1 === 'pipe-1') {
                        return {
                          docs: [
                            { ref: { id: 'deal-closed-1' } },
                            { ref: { id: 'deal-closed-2' } }
                          ],
                        };
                      }
                      return { docs: [] };
                    }),
                  };
                }),
              };
            }),
          };
        }
        if (name === 'onboardingStages') {
          return {
            where: vi.fn((field: string, op: string, val: string) => ({
              get: vi.fn().mockImplementation(async () => {
                if (val === 'pipe-1') {
                  return {
                    docs: [
                      { ref: { id: 'stage-1' } },
                      { ref: { id: 'stage-2' } }
                    ],
                  };
                }
                return { docs: [] };
              }),
            })),
          };
        }
        return {};
      }),
    },
  };
});

describe('Pipeline Lifecycle Actions', () => {
  beforeEach(() => {
    deletedRefs = [];
    updatedFields = null;
    vi.clearAllMocks();
  });

  describe('deletePipelineAction', () => {
    it('aborts deletion and returns error if open deals exist', async () => {
      const result = await deletePipelineAction('pipe-active-deals', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete pipeline with active leads.');
      expect(deletedRefs.length).toBe(0);
    });

    it('cascades deletion to stages and closed deals if no open deals exist', async () => {
      const result = await deletePipelineAction('pipe-1', 'user-1');
      expect(result.success).toBe(true);
      // pipe-1, stage-1, stage-2, deal-closed-1, deal-closed-2
      expect(deletedRefs).toContain('pipe-1');
      expect(deletedRefs).toContain('stage-1');
      expect(deletedRefs).toContain('stage-2');
      expect(deletedRefs).toContain('deal-closed-1');
      expect(deletedRefs).toContain('deal-closed-2');
      expect(deletedRefs.length).toBe(5);
    });
  });

  describe('archivePipelineAction', () => {
    it('successfully updates isArchived field', async () => {
      const result = await archivePipelineAction('pipe-1', true, 'user-1');
      expect(result.success).toBe(true);
      expect(updatedFields).not.toBeNull();
      expect(updatedFields?.isArchived).toBe(true);
    });
  });
});
