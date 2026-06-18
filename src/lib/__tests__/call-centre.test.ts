// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createCallScriptAction, 
  createCallCampaignAction,
  deleteCallCampaignAction,
  lockQueueItemAction,
  submitCallOutcomeAction,
  cloneCallCampaignAction,
  addContactsToCallCampaignAction,
  archiveCallCampaignAction,
  endCallCampaignAction
} from '../call-centre-actions';
import { CallCentreService } from '../services/call-centre-service';

// Mock firebase-admin
const mockAdd = vi.fn().mockResolvedValue({ id: 'doc_123' });
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    id: 'campaign_123',
    workspaceId: 'workspace_1',
    outcomes: ['Interested', 'No Answer'],
    automationRules: {},
  }),
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: mockAdd,
      doc: vi.fn(() => ({
        get: mockGet,
        update: mockUpdate,
        delete: mockDelete,
      })),
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            docs: []
          })
        })),
        get: vi.fn().mockResolvedValue({
          size: 0,
          forEach: vi.fn(),
        })
      }))
    })),
    runTransaction: vi.fn((fn) => fn({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'item_123',
          campaignId: 'campaign_123',
          workspaceId: 'workspace_1',
          status: 'scheduled',
          attempts: 0,
        }),
      }),
      update: vi.fn(),
    })),
  },
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
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock messaging actions
vi.mock('../messaging-actions', () => ({
  previewCampaignAudience: vi.fn().mockResolvedValue({ success: true, preview: [], count: 0 }),
  resolveRecipientContacts: vi.fn().mockResolvedValue([]),
}));

describe('Call Centre Campaign Engine tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Call Script Management', () => {
    it('creates scripts successfully when permission is granted', async () => {
      const result = await createCallScriptAction({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        name: 'Follow up Call',
        description: 'Call script description',
        content: 'Hello {{FIRST_NAME}}',
        variables: ['FIRST_NAME'],
      }, 'user_123');

      expect(result.success).toBe(true);
      expect(result.id).toBe('doc_123');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Follow up Call',
          variables: ['FIRST_NAME'],
        })
      );
    });
  });

  describe('Call Campaigns Management', () => {
    it('creates campaigns successfully when permission is granted', async () => {
      const result = await createCallCampaignAction({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        name: 'Lead Calling Campaign',
        description: 'Calling warm leads',
        scriptId: 'script_123',
        scriptSnapshot: 'Hello parent',
        audienceDefinition: { mode: 'manual', tagIds: [] },
        outcomes: ['Interested', 'No Answer'],
        automationRules: {},
        status: 'draft',
      }, 'user_123');

      expect(result.success).toBe(true);
      expect(result.id).toBe('doc_123');
    });

    it('deletes campaigns successfully when permission is granted', async () => {
      // Mock CallCentreService.deleteCampaign
      const spy = vi.spyOn(CallCentreService, 'deleteCampaign').mockResolvedValue(undefined);
      
      const result = await deleteCallCampaignAction('campaign_123', 'workspace_123', 'user_123');
      expect(result.success).toBe(true);
      expect(spy).toHaveBeenCalledWith('campaign_123');
    });
  });

  describe('Queue locks and locking transactions', () => {
    it('locks queue items successfully', async () => {
      const result = await lockQueueItemAction('item_123', 'workspace_1', 'user_123');
      expect(result.success).toBe(true);
    });
  });

  describe('Outcome Logging', () => {
    it('saves completed call outcome stats', async () => {
      const result = await submitCallOutcomeAction({
        queueItemId: 'item_123',
        outcome: 'Interested',
        notes: 'Followed up, wants pricing details.',
        duration: 45,
        agentName: 'Kwame',
        workspaceId: 'workspace_1',
        userId: 'user_123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Campaign Enhancements Actions', () => {
    it('clones a campaign successfully', async () => {
      const spy = vi.spyOn(CallCentreService, 'cloneCampaign').mockResolvedValue('new_campaign_id');
      const result = await cloneCallCampaignAction('campaign_123', 'workspace_1', 'user_123');
      expect(result.success).toBe(true);
      expect(result.id).toBe('new_campaign_id');
      expect(spy).toHaveBeenCalledWith('campaign_123', 'user_123');
    });

    it('archives a campaign successfully', async () => {
      const spy = vi.spyOn(CallCentreService, 'archiveCampaign').mockResolvedValue(undefined);
      const result = await archiveCallCampaignAction('campaign_123', 'workspace_1', 'user_123');
      expect(result.success).toBe(true);
      expect(spy).toHaveBeenCalledWith('campaign_123');
    });

    it('ends a campaign successfully', async () => {
      const spy = vi.spyOn(CallCentreService, 'endCampaign').mockResolvedValue(undefined);
      const result = await endCallCampaignAction('campaign_123', 'workspace_1', 'user_123');
      expect(result.success).toBe(true);
      expect(spy).toHaveBeenCalledWith('campaign_123');
    });

    it('adds contacts to a campaign successfully', async () => {
      const spy = vi.spyOn(CallCentreService, 'addContactsToCampaign').mockResolvedValue({ success: true, count: 2 });
      const result = await addContactsToCallCampaignAction('campaign_123', ['contact_1', 'contact_2'], 'workspace_1', 'user_123');
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(spy).toHaveBeenCalledWith('campaign_123', ['contact_1', 'contact_2'], 'workspace_1', undefined);
    });
  });
});
