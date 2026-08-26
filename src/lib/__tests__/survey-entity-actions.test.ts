import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  bulkApplyTagsToSurveyEntitiesAction, 
  bulkMoveSurveyEntitiesStageAction 
} from '../survey-entity-actions';

const { mockCommit, mockBatchUpdate, mockBatchSet, mockDoc, _mockQuery, mockCollection } = vi.hoisted(() => {
  const commit = vi.fn().mockResolvedValue([]);
  const batchUpdate = vi.fn();
  const batchSet = vi.fn();
  const docFn = vi.fn((path: string) => ({ path, id: path.split('/').pop() }));
  
  let currentChunk: string[] = [];
  const queryObj = {
    where: vi.fn((field: string, op: string, val: string | string[]) => {
      if (op === 'in' && Array.isArray(val)) {
        currentChunk = val;
      }
      return queryObj;
    }),
    get: vi.fn(async () => {
      // Return a mock doc for each item in the chunk if it was the entityByEntityId query
      const docs = currentChunk.map((id) => ({
        id,
        ref: { path: `workspace_entities/${id}` },
        data: () => ({ entityId: id, name: `Entity ${id}` }),
      }));
      return { docs };
    }),
  };
  const colFn = vi.fn(() => queryObj);

  return {
    mockCommit: commit,
    mockBatchUpdate: batchUpdate,
    mockBatchSet: batchSet,
    mockDoc: docFn,
    mockQuery: queryObj,
    mockCollection: colFn,
  };
});

// Mock adminDb in firebase-admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    batch: vi.fn(() => ({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockCommit,
    })),
    doc: mockDoc,
    collection: mockCollection,
  },
  FieldValue: {
    arrayUnion: (...elements: string[]) => ({ _methodName: 'arrayUnion', elements }),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

describe('Survey Entity Management Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bulkApplyTagsToSurveyEntitiesAction', () => {
    it('rejects missing workspaceId, entityIds, or tagIds', async () => {
      const res1 = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: '',
        entityIds: ['ent-1'],
        tagIds: ['tag-1'],
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('Workspace context is required.');

      const res2 = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: 'ws-1',
        entityIds: [],
        tagIds: ['tag-1'],
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('No entity records selected.');

      const res3 = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: 'ws-1',
        entityIds: ['ent-1'],
        tagIds: [],
      });
      expect(res3.success).toBe(false);
      expect(res3.error).toBe('No tags selected to apply.');
    });

    it('processes batch tag applications atomically in chunks of 30', async () => {
      // 35 mock entities -> should produce 2 batches (30 + 5)
      const entityIds = Array.from({ length: 35 }, (_, i) => `entity_${i + 1}`);
      const tagIds = ['tag_alpha', 'tag_beta'];

      const res = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: 'ws_demo',
        entityIds,
        tagIds,
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(35);
      expect(mockCommit).toHaveBeenCalledTimes(2);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(35);
    });
  });

  describe('bulkMoveSurveyEntitiesStageAction', () => {
    it('rejects missing parameters', async () => {
      const res1 = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: '',
        entityIds: ['ent-1'],
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('Workspace context is required.');

      const res2 = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws-1',
        entityIds: [],
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('No entity records selected.');

      const res3 = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws-1',
        entityIds: ['ent-1'],
        pipelineId: '',
        stageId: 'stage-1',
      });
      expect(res3.success).toBe(false);
      expect(res3.error).toBe('Pipeline and stage selection are required.');
    });

    it('updates pipelineId and stageId across workspace_entities and contacts collections', async () => {
      const entityIds = ['ent_100', 'ent_200'];
      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws_demo',
        entityIds,
        pipelineId: 'pipeline_sales',
        stageId: 'stage_qualified',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });
  });
});
