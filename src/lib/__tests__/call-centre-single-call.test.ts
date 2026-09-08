// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CallCentreService } from '../services/call-centre-service';
import type { CallQueueItem, EntityContact } from '../types';

// Mock Firestore Admin
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockCollection = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (col: string) => mockCollection(col),
    runTransaction: vi.fn((fn: any) => fn({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'queue_100',
          campaignId: 'camp_100',
          workspaceId: 'ws_100',
          entityId: 'ent_100',
          entityType: 'person',
          entityName: 'Acme Corp',
          dealId: 'deal_999',
          status: 'in_progress',
          attempts: 1,
          isManualEnrolment: true,
        }),
      }),
      update: vi.fn(),
    })),
  },
  FieldValue: {
    serverTimestamp: vi.fn(),
  }
}));

// Mock permissions
vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock activity logger
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('../activity-logger', () => ({
  logActivity: (args: any) => mockLogActivity(args),
}));

// Mock messaging actions
vi.mock('../messaging-actions', () => ({
  previewCampaignAudience: vi.fn().mockResolvedValue({ success: true, preview: [], count: 0 }),
  resolveRecipientContacts: vi.fn().mockResolvedValue([]),
}));

describe('QA Test Suite: Universal Call Now Single-Call Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueueAndLockSingleCall', () => {
    it('successfully provisions an isolated manual queue item with dealId', async () => {
      const mockCampaignData = {
        id: 'camp_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        name: 'VIP Outreach',
        status: 'running',
      };

      const mockEntityData = {
        entityId: 'ent_1',
        displayName: 'Acme Corp',
        phone: '+1234567890',
        email: 'info@acme.com',
        entityType: 'institution',
        entityContacts: [
          {
            id: 'cont_1',
            name: 'Jane Doe',
            phone: '+1987654321',
            email: 'jane@acme.com',
            isPrimary: true,
            isSignatory: false,
            order: 0,
            typeKey: 'lead',
          } as EntityContact,
        ],
      };

      mockCollection.mockImplementation((col: string) => {
        if (col === 'call_campaigns') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => mockCampaignData,
              }),
            }),
          };
        }
        if (col === 'call_queue_items') {
          return {
            doc: vi.fn().mockReturnValue({
              id: 'generated_queue_id',
              set: mockSet,
            }),
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (col === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    empty: false,
                    docs: [{ data: () => mockEntityData }],
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await CallCentreService.enqueueAndLockSingleCall(
        'camp_1',
        'ent_1',
        'ws_1',
        'user_agent_1',
        undefined,
        'deal_123'
      );

      expect(result.success).toBe(true);
      expect(result.queueItem).toBeDefined();
      expect(result.queueItem?.dealId).toBe('deal_123');
      expect(result.queueItem?.isManualEnrolment).toBe(true);
      expect(result.queueItem?.status).toBe('in_progress');
      expect(result.queueItem?.assignedTo).toBe('user_agent_1');
      expect(result.queueItem?.contactId).toBe('cont_1');
      expect(result.queueItem?.contactName).toBe('Jane Doe');
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('enforces idempotency by reusing an existing active locked item', async () => {
      const mockExistingItem: CallQueueItem = {
        id: 'existing_queue_id',
        campaignId: 'camp_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        entityId: 'ent_1',
        entityType: 'person',
        entityName: 'Existing Acme',
        entityPhone: '+111111111',
        entityEmail: 'existing@acme.com',
        status: 'in_progress',
        assignedTo: 'user_agent_1',
        lockExpiresAt: new Date(Date.now() + 60000).toISOString(),
        callbackDate: null,
        attempts: 1,
        lastAttemptAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isManualEnrolment: true,
      };

      mockCollection.mockImplementation((col: string) => {
        if (col === 'call_campaigns') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ id: 'camp_1' }),
              }),
            }),
          };
        }
        if (col === 'call_queue_items') {
          return {
            doc: vi.fn().mockReturnValue({ id: 'some_new_id', set: mockSet }),
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        empty: false,
                        docs: [{ data: () => mockExistingItem }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await CallCentreService.enqueueAndLockSingleCall(
        'camp_1',
        'ent_1',
        'ws_1',
        'user_agent_1'
      );

      expect(result.success).toBe(true);
      expect(result.queueItem?.id).toBe('existing_queue_id');
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('releaseSingleCall', () => {
    it('cancels in-progress manual call and releases lock upon modal dismissal', async () => {
      const mockItemData: CallQueueItem = {
        id: 'queue_cancel_1',
        campaignId: 'camp_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        entityId: 'ent_1',
        entityType: 'person',
        entityName: 'Test Person',
        entityPhone: '+111111',
        entityEmail: 'test@person.com',
        status: 'in_progress',
        assignedTo: 'user_agent_1',
        lockExpiresAt: new Date(Date.now() + 60000).toISOString(),
        callbackDate: null,
        attempts: 1,
        lastAttemptAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isManualEnrolment: true,
      };

      mockCollection.mockImplementation((col: string) => {
        if (col === 'call_queue_items') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => mockItemData,
              }),
              update: mockUpdate,
            }),
          };
        }
        return {};
      });

      const result = await CallCentreService.releaseSingleCall('queue_cancel_1');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          assignedTo: null,
          lockExpiresAt: null,
        })
      );
    });
  });

  describe('submitOutcome Deal Timeline Cross-Posting', () => {
    it('cross-posts activity log with dealId when present on queue item', async () => {
      mockCollection.mockImplementation((col: string) => {
        if (col === 'call_queue_items') {
          return {
            doc: vi.fn().mockReturnValue({
              id: 'queue_100',
            }),
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                size: 0,
                forEach: vi.fn(),
              }),
            }),
          };
        }
        if (col === 'call_campaigns') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: 'camp_100',
                  scriptSnapshot: JSON.stringify({ nodes: [], edges: [] }),
                }),
              }),
              update: mockUpdate,
            }),
          };
        }
        return {};
      });

      const result = await CallCentreService.submitOutcome({
        queueItemId: 'queue_100',
        outcome: 'Interested',
        notes: 'Great conversation about enterprise tier',
        duration: 125,
        agentId: 'user_1',
        agentName: 'Agent Smith',
      });

      expect(result.success).toBe(true);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          dealId: 'deal_999',
          type: 'call_completed',
          metadata: expect.objectContaining({
            dealId: 'deal_999',
            outcome: 'Interested',
            duration: 125,
          }),
        })
      );
    });
  });

  describe('recalculateCampaignProgress metric isolation', () => {
    it('filters out manual enrolment items and cancelled items from batch campaign total', async () => {
      const mockItems: Partial<CallQueueItem>[] = [
        { id: '1', campaignId: 'c1', status: 'completed', isManualEnrolment: false },
        { id: '2', campaignId: 'c1', status: 'completed', isManualEnrolment: true }, // manual, should be excluded
        { id: '3', campaignId: 'c1', status: 'cancelled', isManualEnrolment: true }, // cancelled, should be excluded
        { id: '4', campaignId: 'c1', status: 'scheduled', isManualEnrolment: false }, // organic pending
      ];

      mockCollection.mockImplementation((col: string) => {
        if (col === 'call_queue_items') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                size: 4,
                forEach: (fn: (doc: any) => void) => {
                  mockItems.forEach(item => fn({ data: () => item }));
                },
              }),
            }),
          };
        }
        if (col === 'call_campaigns') {
          return {
            doc: vi.fn().mockReturnValue({
              update: mockUpdate,
            }),
          };
        }
        return {};
      });

      await CallCentreService.recalculateCampaignProgress('c1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: {
            total: 2, // Only the 2 organic items counted
            completed: 1,
            pending: 1,
            skipped: 0,
            callbacks: 0,
            deferred: 0,
          },
          status: 'running',
        })
      );
    });
  });
});
