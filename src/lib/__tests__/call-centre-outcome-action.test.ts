// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeOutcomeAutomationsAction } from '../call-centre-actions';
import { CallCentreService } from '../services/call-centre-service';
import { canUser } from '../workspace-permissions';
import { createTaskAction } from '../task-server-actions';
import { applyTagsAction, removeTagsAction } from '../tag-actions';
import { updateEntityAction } from '../entity-actions';

let lastCollection = '';
let lastDocId = '';

const mockDocGet = vi.fn().mockImplementation(async () => {
  if (lastCollection === 'message_templates') {
    return {
      exists: true,
      data: () => ({
        body: 'Hello {{FIRST_NAME}}',
        subject: 'Email Subject',
      }),
    };
  }
  if (lastCollection === 'entities') {
    return {
      exists: true,
      data: () => ({
        name: 'Test Entity',
        slug: 'test-entity',
        entityContacts: [
          { id: 'c_primary', name: 'Joe Primary', email: 'joe@primary.com', phone: '+1234567890', isPrimary: true }
        ],
      }),
    };
  }
  if (lastCollection === 'onboardingStages') {
    return {
      exists: true,
      data: () => ({
        name: 'Test Stage',
      }),
    };
  }
  if (lastCollection === 'users') {
    return {
      exists: true,
      data: () => ({
        displayName: 'Agent User',
      }),
    };
  }
  if (lastCollection === 'organizations') {
    return {
      exists: true,
      data: () => ({
        defaultCountryCode: 'GH',
      }),
    };
  }
  if (lastCollection === 'workspaces') {
    return {
      exists: true,
      data: () => ({
        id: 'ws_1',
        defaultSmsSenderId: 'SmartSapp',
      }),
    };
  }
  return {
    exists: true,
    data: () => ({ name: 'Test Entity', slug: 'test-entity', displayName: 'Agent User' }),
  };
});

const mockDocSet = vi.fn().mockResolvedValue({});
const mockAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' });

vi.mock('../firebase-admin', () => {
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });
  return {
    adminDb: {
      collection: vi.fn((colName) => {
        lastCollection = colName;
        return {
          doc: vi.fn((docId) => {
            lastDocId = docId;
            return {
              get: mockDocGet,
              set: mockDocSet,
            };
          }),
          add: mockAdd,
          where: mockWhere,
          limit: mockLimit,
          get: mockGet,
        };
      }),
    },
    FieldValue: {},
  };
});

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('../task-server-actions', () => ({
  createTaskAction: vi.fn().mockResolvedValue({ success: true, id: 't1' }),
}));
vi.mock('../tag-actions', () => ({
  applyTagsAction: vi.fn().mockResolvedValue({ success: true }),
  removeTagsAction: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../entity-actions', () => ({
  updateEntityAction: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../mnotify-service', () => ({ sendSms: vi.fn().mockResolvedValue({}) }));
vi.mock('../resend-service', () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));
vi.mock('../activity-logger', () => ({ logActivity: vi.fn() }));

describe('executeOutcomeAutomationsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canUser).mockResolvedValue({ granted: true });
  });

  it('denies execution when user lacks edit permissions', async () => {
    vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'no access' });
    
    const automations = [
      { type: 'CREATE_TASK', params: { taskTitle: 'Follow up' } }
    ];

    const res = await executeOutcomeAutomationsAction({
      automations,
      entityId: 'ent_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1'
    }, 'user_1');

    expect(res.success).toBe(false);
    expect(res.error).toBe('no access');
  });

  it('executes multiple automations in parallel and returns success results (mocked)', async () => {
    const spy = vi.spyOn(CallCentreService, 'executeScriptAction').mockResolvedValueOnce({ success: true });

    const automations = [
      { type: 'CREATE_TASK', params: { taskTitle: 'Follow up' } }
    ];

    const res = await executeOutcomeAutomationsAction({
      automations,
      entityId: 'ent_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1'
    }, 'user_1');

    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(1);
    expect(res.results?.[0]).toEqual({ type: 'CREATE_TASK', success: true, error: undefined });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  describe('Integration test of individual action triggers', () => {
    const ctx = { entityId: 'ent_1', workspaceId: 'ws_1', organizationId: 'org_1' };

    it('triggers CREATE_TASK correctly', async () => {
      const automations = [
        { type: 'CREATE_TASK', params: { taskTitle: 'Follow up', taskDescription: 'Call notes', taskPriority: 'high' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(createTaskAction).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Follow up',
          description: 'Call notes',
          priority: 'high',
          entityId: 'ent_1',
        }),
        expect.any(String)
      );
    });

    it('triggers ADD_TAG correctly', async () => {
      const automations = [
        { type: 'ADD_TAG', params: { tagId: 'tag_interested' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(applyTagsAction).toHaveBeenCalledWith('ent_1', 'entity', ['tag_interested'], expect.any(String));
    });

    it('triggers REMOVE_TAG correctly', async () => {
      const automations = [
        { type: 'REMOVE_TAG', params: { tagId: 'tag_cold' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(removeTagsAction).toHaveBeenCalledWith('ent_1', 'entity', ['tag_cold'], expect.any(String));
    });

    it('triggers CHANGE_STAGE correctly', async () => {
      const automations = [
        { type: 'CHANGE_STAGE', params: { stageId: 'stage_2', pipelineId: 'pl_1' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(updateEntityAction).toHaveBeenCalledWith(
        'ent_1',
        expect.objectContaining({
          stageId: 'stage_2',
          pipelineId: 'pl_1',
          currentStageName: 'Test Stage',
        }),
        expect.any(String),
        'ws_1',
        'org_1'
      );
    });

    it('triggers ADD_TO_PIPELINE correctly', async () => {
      const automations = [
        { type: 'ADD_TO_PIPELINE', params: { pipelineId: 'pl_1', stageId: 'stage_1' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(updateEntityAction).toHaveBeenCalledWith(
        'ent_1',
        expect.objectContaining({
          pipelineId: 'pl_1',
          stageId: 'stage_1',
          currentStageName: 'Test Stage',
        }),
        expect.any(String),
        'ws_1',
        'org_1'
      );
    });

    it('triggers SEND_SMS correctly', async () => {
      const { sendSms } = await import('../mnotify-service');
      const automations = [
        { type: 'SEND_SMS', params: { templateId: 'temp_sms_1' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(sendSms).toHaveBeenCalledWith({
        recipient: '+1234567890',
        message: 'Hello {{FIRST_NAME}}',
        sender: 'SmartSapp'
      });
    });

    it('triggers SEND_EMAIL correctly', async () => {
      const { sendEmail } = await import('../resend-service');
      const automations = [
        { type: 'SEND_EMAIL', params: { templateId: 'temp_email_1' } }
      ];

      const res = await executeOutcomeAutomationsAction({
        automations,
        ...ctx
      }, 'user_1');

      expect(res.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'joe@primary.com',
        subject: 'Email Subject',
        html: 'Hello {{FIRST_NAME}}'
      });
    });
  });
});
