// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup Mock for firebase-admin adminDb
const {
  mockUpdate,
  mockGet,
  mockSet,
  mockAdd,
  mockBatchCommit,
  mockBatchUpdate,
  mockRunTransaction,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockAdd: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockRunTransaction: vi.fn(),
}));

vi.mock('../firebase-admin', () => {
  const queryRef = {
    get: mockGet,
  };

  const collectionRef = {
    doc: vi.fn((path) => ({
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
      collection: vi.fn(() => collectionRef),
    })),
    where: vi.fn(() => collectionRef),
    limit: vi.fn(() => collectionRef),
    get: mockGet,
    add: mockAdd,
  };

  return {
    adminDb: {
      collection: vi.fn(() => collectionRef),
      batch: vi.fn(() => ({
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      })),
      runTransaction: mockRunTransaction,
    },
    FieldValue: {
      arrayUnion: vi.fn((...args) => ({ type: 'arrayUnion', args })),
      arrayRemove: vi.fn((...args) => ({ type: 'arrayRemove', args })),
    },
    __mocks: {
      mockUpdate,
      mockGet,
      mockSet,
      mockAdd,
      mockBatchCommit,
      mockBatchUpdate,
      mockRunTransaction,
    },
  };
});

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    id: 'ent-456',
    name: 'Resolved Entity',
    slug: 'resolved-entity',
    contacts: [],
    entityContacts: [],
    migrationStatus: 'migrated' as const,
    entityId: 'ent-456',
  }),
}));

// Mock automation actions
const mockHandleCreateDeal = vi.fn().mockResolvedValue({ success: true });
const mockHandleCreateTask = vi.fn().mockResolvedValue({ success: true });

vi.mock('../automations/actions/deal-automation-actions', () => ({
  handleCreateDeal: mockHandleCreateDeal,
}));

vi.mock('../automations/actions/task-actions', () => ({
  handleCreateTask: mockHandleCreateTask,
}));

import { cancelCampaignABTest, resumeCampaignABTest } from '../campaign-automation-jobs';
import { applyCampaignPostSendTags } from '../campaign-post-send';
import { logCampaignEventToTimeline } from '../campaign-events';

describe('Messaging Campaign Integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('A/B Test Control Transactions', () => {
    it('cancelCampaignABTest transitions status to paused and cancels pending eval jobs', async () => {
      // Setup transaction mock
      mockRunTransaction.mockImplementation(async (cb) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: 'camp-123',
              status: 'testing',
              abTestEnabled: true,
            }),
          }),
          update: vi.fn(),
        };
        await cb(transaction);
        return null;
      });

      // Setup query mock for pending jobs
      mockGet.mockResolvedValue({
        docs: [
          { ref: { update: mockUpdate } },
        ],
      });

      // Setup batch update/commit mocks
      mockBatchCommit.mockResolvedValue(true);

      await cancelCampaignABTest('camp-123');

      expect(mockRunTransaction).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('resumeCampaignABTest transitions status to testing and schedules evaluation job', async () => {
      // Setup transaction mock
      mockRunTransaction.mockImplementation(async (cb) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: 'camp-123',
              status: 'paused',
              abTestEnabled: true,
              abTestConfig: { testDurationHours: 12 },
            }),
          }),
          update: vi.fn(),
        };
        await cb(transaction);
        return null;
      });

      // Mock campaign get after transaction
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'camp-123',
          status: 'testing',
          abTestEnabled: true,
          abTestConfig: { testDurationHours: 12 },
        }),
      });

      // Mock scheduled job creation
      mockAdd.mockResolvedValue({ id: 'job-999' });

      await resumeCampaignABTest('camp-123');

      expect(mockRunTransaction).toHaveBeenCalled();
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
        targetNodeId: '__campaign_ab_evaluate__',
        status: 'pending',
        payload: { campaignId: 'camp-123' },
      }));
    });
  });

  describe('Idempotent Activity Timeline Logging', () => {
    it('computes deterministic event timeline document ID', async () => {
      const mockSet = vi.fn();
      
      // Stub the collection and doc resolver
      const firestoreDocMock = vi.fn().mockReturnValue({ set: mockSet });
      const firestoreColMock = vi.fn(() => ({ doc: firestoreDocMock }));
      
      const { adminDb } = await import('../firebase-admin');
      vi.mocked(adminDb).collection.mockImplementationOnce(firestoreColMock);

      await logCampaignEventToTimeline({
        entityId: 'ent-456',
        campaignId: 'camp-123',
        event: 'campaign_opened',
        workspaceId: 'ws-789',
        organizationId: 'org-111',
        channel: 'email',
        recipient: 'test@example.com',
      });

      expect(firestoreColMock).toHaveBeenCalledWith('activities');
      // Deterministic key check: camp_ent-456_camp-123_campaign_opened
      expect(firestoreDocMock).toHaveBeenCalledWith('camp_ent-456_camp-123_campaign_opened');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'campaign_event',
          entityId: 'ent-456',
          workspaceId: 'ws-789',
          metadata: expect.objectContaining({
            campaignId: 'camp-123',
          }),
        }),
        { merge: true }
      );
    });
  });

  describe('Post-Send Automation Rules Engine', () => {
    it('applies rules based on cohort and resolved entities', async () => {
      // Stub get campaign
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'camp-123',
          internalName: 'Post Send Campaign',
          workspaceId: 'ws-789',
          organizationId: 'org-111',
          jobId: 'job-123',
          postSendTagRules: [
            {
              appliesTo: 'delivered',
              actionType: 'create_deal',
              dealPipelineId: 'pipe-1',
              dealStageId: 'stage-1',
              dealTitleTemplate: 'Post-Send Deal for {{entityName}}',
            },
            {
              appliesTo: 'failed',
              actionType: 'create_task',
              taskTitleTemplate: 'Follow-up on failure',
              taskDueDateOffsetDays: 5,
            }
          ]
        })
      });

      // Stub get tasks
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'task-1',
            data: () => ({ status: 'sent', entityId: 'ent-aaa', recipient: 'a@a.com' }),
          },
          {
            id: 'task-2',
            data: () => ({ status: 'failed', entityId: 'ent-bbb', recipient: 'b@b.com' }),
          }
        ]
      });

      const result = await applyCampaignPostSendTags('camp-123');

      expect(result.success).toBe(true);
      
      // Should invoke handleCreateDeal for ent-aaa (sent task)
      expect(mockHandleCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipe-1',
          stageId: 'stage-1',
          name: 'Post-Send Deal for {{entityName}}',
        }),
        expect.objectContaining({
          entityId: 'ent-aaa',
          workspaceId: 'ws-789',
        })
      );

      // Should invoke handleCreateTask for ent-bbb (failed task)
      expect(mockHandleCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Follow-up on failure',
          dueOffsetDays: 5,
        }),
        expect.objectContaining({
          entityId: 'ent-bbb',
          workspaceId: 'ws-789',
        })
      );
    });
  });
});
