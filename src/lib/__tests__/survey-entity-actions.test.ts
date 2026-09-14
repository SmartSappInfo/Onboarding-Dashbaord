import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  bulkApplyTagsToSurveyEntitiesAction, 
  bulkMoveSurveyEntitiesStageAction 
} from '../survey-entity-actions';

const { 
  mockCommit, 
  mockBatchUpdate, 
  mockBatchSet, 
  mockDocSet, 
  mockDocUpdate, 
  mockDoc, 
  mockCanUser,
  mockRequireWorkspace,
  state
} = vi.hoisted(() => {
  const commit = vi.fn().mockResolvedValue([]);
  const batchUpdate = vi.fn();
  const batchSet = vi.fn();
  const canUser = vi.fn().mockResolvedValue({ granted: true });
  const requireWorkspace = vi.fn().mockResolvedValue({ uid: 'mock_user_123', workspaceId: 'ws_demo' });

  const state = {
    existingDeals: [] as Array<Record<string, unknown>>,
  };

  const docGet = vi.fn().mockImplementation((_path?: string) => {
    return Promise.resolve({
      exists: true,
      id: 'mock_doc_id',
      data: () => ({ 
        name: 'Qualified Stage', 
        displayName: 'Mock School', 
        isWon: false,
        isLost: false,
        probability: 70,
        entityContacts: [{ id: 'contact_headmaster', name: 'Mr. Headmaster', isPrimary: true }] 
      }),
    });
  });

  const docSet = vi.fn().mockResolvedValue(undefined);
  const docUpdate = vi.fn().mockResolvedValue(undefined);

  const docFn = vi.fn((path?: string) => ({ 
    path: path || 'deals/new_deal_id', 
    id: path ? path.split('/').pop() : 'new_deal_id',
    get: docGet,
    set: docSet,
    update: docUpdate,
  }));
  
  let currentChunk: string[] = [];

  const queryObj = {
    where: vi.fn((_field: string, op: string, val: unknown) => {
      if (op === 'in' && Array.isArray(val)) {
        currentChunk = val as string[];
      }
      return queryObj;
    }),
    get: vi.fn(async () => {
      const docs = currentChunk.map((id) => ({
        id,
        ref: { path: `workspace_entities/${id}` },
        data: () => ({ entityId: id, name: `Entity ${id}` }),
      }));
      return { docs };
    }),
  };

  return {
    mockCommit: commit,
    mockBatchUpdate: batchUpdate,
    mockBatchSet: batchSet,
    mockDocSet: docSet,
    mockDocUpdate: docUpdate,
    mockDoc: docFn,
    mockCanUser: canUser,
    mockRequireWorkspace: requireWorkspace,
    state,
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
    collection: vi.fn((name: string) => {
      if (name === 'deals') {
        return {
          where: vi.fn().mockReturnThis(),
          doc: mockDoc,
          get: vi.fn(async () => ({
            docs: state.existingDeals.map((d, i) => ({
              id: (d.id as string) || `deal_${i}`,
              ref: { path: `deals/${(d.id as string) || `deal_${i}`}` },
              data: () => d,
            })),
          })),
        };
      }
      if (name === 'onboardingStages') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              id: 'stage_test',
              data: () => ({ name: 'Qualified Stage', isWon: false, isLost: false, probability: 70 }),
            }),
          })),
        };
      }
      let currentChunk: string[] = [];
      const queryObj = {
        where: vi.fn((_f: string, op: string, val: unknown) => {
          if (op === 'in' && Array.isArray(val)) {
            currentChunk = val as string[];
          }
          return queryObj;
        }),
        get: vi.fn(async () => {
          if (name === 'contacts') {
            return { docs: [] };
          }
          return {
            docs: currentChunk.map((id) => ({
              id,
              ref: { path: `${name}/${id}` },
              data: () => ({ entityId: id, name: `Record ${id}` }),
            })),
          };
        }),
        doc: mockDoc,
      };
      return queryObj;
    }),
  },
  FieldValue: {
    arrayUnion: (...elements: string[]) => ({ _methodName: 'arrayUnion', elements }),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'mock_user_123' }),
  requireWorkspace: mockRequireWorkspace,
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: mockCanUser,
}));

vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: vi.fn(),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('Survey Entity Management Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.existingDeals = [];
    mockCanUser.mockResolvedValue({ granted: true });
    mockRequireWorkspace.mockResolvedValue({ uid: 'mock_user_123', workspaceId: 'ws_demo' });
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

    it('rejects execution when user lacks contacts:edit permission', async () => {
      mockCanUser.mockResolvedValueOnce({ granted: false, reason: 'Unauthorized tag operation' });

      const res = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: 'ws_demo',
        entityIds: ['ent_1'],
        tagIds: ['tag_vip'],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized tag operation');
    });

    it('processes batch tag applications atomically in chunks of 30', async () => {
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

    it('rejects execution when user lacks pipeline:edit permission', async () => {
      mockCanUser.mockResolvedValueOnce({ granted: false, reason: 'You do not have access to edit pipelines' });

      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws_demo',
        entityIds: ['ent_1'],
        pipelineId: 'pipe_sales',
        stageId: 'stage_demo',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('You do not have access to edit pipelines');
    });

    it('BRANCH B: creates a new deal for the contact positioned in target stage with isArchived: false', async () => {
      state.existingDeals = [];

      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws_demo',
        entityIds: ['ent_glating'],
        pipelineId: 'pipeline_school_campaign',
        stageId: 'stage_completed_request',
        targetContactId: 'contact_headmaster',
        targetContactName: 'Dr. Glating Principal',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipeline_school_campaign',
          stageId: 'stage_completed_request',
          primaryContactId: 'contact_headmaster',
          source: 'survey_response',
          status: 'open',
          isArchived: false,
          probability: 70,
          focalContacts: expect.arrayContaining([
            expect.objectContaining({
              id: 'contact_headmaster',
              isPrimary: true,
            })
          ]),
        })
      );
    });

    it('BRANCH A: moves existing contact deal to target stage and logs stageHistory with SLA duration', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      state.existingDeals = [
        {
          id: 'deal_existing_bob',
          primaryContactId: 'contact_bob',
          focalContacts: [{ id: 'contact_bob', name: 'Bob Teacher' }],
          stageId: 'stage_initial',
          stageName: 'Initial Stage',
          stageEnteredAt: tenMinutesAgo,
          stageHistory: [],
          isArchived: false,
        },
      ];

      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws_demo',
        entityIds: ['ent_glating'],
        pipelineId: 'pipeline_sales',
        stageId: 'stage_completed_request',
        targetContactId: 'contact_bob',
        targetContactName: 'Bob Teacher',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: 'stage_completed_request',
          stageName: 'Qualified Stage',
          status: 'open',
          probability: 70,
          stageHistory: expect.arrayContaining([
            expect.objectContaining({
              stageId: 'stage_initial',
              stageName: 'Initial Stage',
              changedByUserId: 'mock_user_123',
              durationSeconds: expect.any(Number),
            }),
          ]),
        })
      );
    });

    it('ADOPTS single unassigned legacy deal if no contact match is found', async () => {
      state.existingDeals = [
        {
          id: 'legacy_unassigned_deal',
          stageId: 'stage_initial',
          isArchived: false,
          // No primaryContactId or focalContacts
        },
      ];

      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: 'ws_demo',
        entityIds: ['ent_glating'],
        pipelineId: 'pipeline_sales',
        stageId: 'stage_completed_request',
        targetContactId: 'contact_alice',
        targetContactName: 'Alice Vice Principal',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: 'stage_completed_request',
          primaryContactId: 'contact_alice',
          focalContacts: expect.arrayContaining([
            expect.objectContaining({
              id: 'contact_alice',
              name: 'Alice Vice Principal',
            }),
          ]),
        })
      );
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
