// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeScriptActionAction } from '../call-centre-actions';
import { createTaskAction } from '../task-server-actions';
import { applyTagsAction, removeTagsAction } from '../tag-actions';
import { updateEntityAction } from '../entity-actions';
import { canUser } from '../workspace-permissions';

import { CallCentreService } from '../services/call-centre-service';

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

vi.mock('../whatsapp/whatsapp-send', () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../phone-utils', () => ({
  normalizePhoneNumber: vi.fn((phone: string) => {
    if (phone.startsWith('+')) {
      return { e164: phone, countryCode: 'GH', callingCode: '233' };
    }
    return { e164: '+233' + phone.substring(1), countryCode: 'GH', callingCode: '233' };
  }),
}));

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
vi.mock('../messaging-actions', () => ({
  previewCampaignAudience: vi.fn(),
  resolveRecipientContacts: vi.fn(),
}));
vi.mock('../activity-logger', () => ({ logActivity: vi.fn() }));

const ctx = { entityId: 'ent_1', workspaceId: 'ws_1', organizationId: 'org_1' };

describe('executeScriptActionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canUser).mockResolvedValue({ granted: true });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  });

  it('denies execution without edit permission', async () => {
    vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'no access' });
    const res = await executeScriptActionAction({ actionType: 'CREATE_TASK', actionConfig: { taskTitle: 'X' }, ...ctx }, 'user_1');
    expect(res.success).toBe(false);
    expect(createTaskAction).not.toHaveBeenCalled();
  });

  it('executes CREATE_TASK against the contact', async () => {
    const res = await executeScriptActionAction({ actionType: 'CREATE_TASK', actionConfig: { taskTitle: 'Follow up' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(createTaskAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Follow up', entityId: 'ent_1', workspaceId: 'ws_1' }),
      expect.any(String)
    );
  });

  it('executes ADD_TAG against the contact', async () => {
    const res = await executeScriptActionAction({ actionType: 'ADD_TAG', actionConfig: { tagId: 'tag_9' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(applyTagsAction).toHaveBeenCalledWith('ent_1', 'entity', ['tag_9'], expect.any(String));
  });

  it('executes a WEBHOOK action', async () => {
    const res = await executeScriptActionAction({ actionType: 'WEBHOOK', actionConfig: { webhookUrl: 'https://hooks.example.com/x' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://hooks.example.com/x', expect.objectContaining({ method: 'POST' }));
  });

  it('handles an unsupported action type gracefully (no throw)', async () => {
    const res = await executeScriptActionAction({ actionType: 'TRANSFER_CALL', actionConfig: {}, ...ctx }, 'user_1');
    expect(res.success).toBe(false);
    expect(createTaskAction).not.toHaveBeenCalled();
  });

  it('executes REMOVE_TAG against the contact', async () => {
    const res = await executeScriptActionAction({ actionType: 'REMOVE_TAG', actionConfig: { tagId: 'tag_9' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(removeTagsAction).toHaveBeenCalledWith('ent_1', 'entity', ['tag_9'], expect.any(String));
  });

  it('executes LOG_NOTE against the contact', async () => {
    const res = await executeScriptActionAction({ actionType: 'LOG_NOTE', actionConfig: { noteContent: 'Spoke with prospect' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Spoke with prospect',
      entityId: 'ent_1',
    }));
  });

  it('executes SCHEDULE_MEETING create mode against the contact (legacy: meetingTypeId only)', async () => {
    const res = await executeScriptActionAction({ actionType: 'SCHEDULE_MEETING', actionConfig: { meetingTypeId: 'kickoff' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Kickoff'),
      entityId: 'ent_1',
      status: 'scheduled',
    }));
  });

  it('executes SCHEDULE_MEETING guest-list mode (adds contact to an existing meeting)', async () => {
    const res = await executeScriptActionAction(
      { actionType: 'SCHEDULE_MEETING', actionConfig: { meetingMode: 'guest_list', meetingId: 'mtg_1' }, ...ctx },
      'user_1'
    );
    expect(res.success).toBe(true);
    // Registrant written into the meeting's subcollection keyed by entityId.
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'ent_1', source: 'call_campaign' }),
      { merge: true }
    );
  });

  it('SCHEDULE_MEETING guest-list mode requires a selected meeting', async () => {
    const res = await executeScriptActionAction(
      { actionType: 'SCHEDULE_MEETING', actionConfig: { meetingMode: 'guest_list' }, ...ctx },
      'user_1'
    );
    expect(res.success).toBe(false);
  });

  it('executes ADD_TO_PIPELINE with pipeline + stage', async () => {
    const res = await executeScriptActionAction(
      { actionType: 'ADD_TO_PIPELINE', actionConfig: { pipelineId: 'pl_1', stageId: 'st_1' }, ...ctx },
      'user_1'
    );
    expect(res.success).toBe(true);
    expect(updateEntityAction).toHaveBeenCalledWith(
      'ent_1',
      expect.objectContaining({ pipelineId: 'pl_1', stageId: 'st_1' }),
      expect.any(String), 'ws_1', 'org_1'
    );
  });

  it('ADD_TO_PIPELINE fails without a pipeline or stage', async () => {
    const res = await executeScriptActionAction(
      { actionType: 'ADD_TO_PIPELINE', actionConfig: { pipelineId: 'pl_1' }, ...ctx },
      'user_1'
    );
    expect(res.success).toBe(false);
    expect(updateEntityAction).not.toHaveBeenCalled();
  });

  it('WEBHOOK applies parsed JSON headers from the headers string', async () => {
    await executeScriptActionAction(
      { actionType: 'WEBHOOK', actionConfig: { webhookUrl: 'https://hooks.example.com/x', webhookHeaders: '{"Authorization":"Bearer k"}' }, ...ctx },
      'user_1'
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.example.com/x',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer k' }) })
    );
  });

  it('executes CHANGE_STAGE against the contact', async () => {
    const res = await executeScriptActionAction({
      actionType: 'CHANGE_STAGE',
      actionConfig: { stageId: 'stage_123', pipelineId: 'pl_123' },
      ...ctx
    }, 'user_1');
    expect(res.success).toBe(true);
    expect(updateEntityAction).toHaveBeenCalledWith(
      'ent_1',
      expect.objectContaining({ stageId: 'stage_123', currentStageName: 'Test Stage', pipelineId: 'pl_123' }),
      expect.any(String),
      'ws_1',
      'org_1'
    );
  });

  it('executes SEND_SMS against the contact', async () => {
    const { sendSms } = await import('../mnotify-service');
    const res = await executeScriptActionAction({
      actionType: 'SEND_SMS',
      actionConfig: { templateId: 'temp_1' },
      ...ctx
    }, 'user_1');
    expect(res.success).toBe(true);
    expect(sendSms).toHaveBeenCalledWith({
      recipient: '+1234567890',
      message: 'Hello {{FIRST_NAME}}',
      sender: 'SmartSapp'
    });
  });

  it('executes SEND_EMAIL against the contact', async () => {
    const { sendEmail } = await import('../resend-service');
    const res = await executeScriptActionAction({
      actionType: 'SEND_EMAIL',
      actionConfig: { templateId: 'temp_1' },
      ...ctx
    }, 'user_1');
    expect(res.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'joe@primary.com',
      subject: 'Email Subject',
      html: 'Hello {{FIRST_NAME}}'
    });
  });

  it('executes SEND_WHATSAPP against the contact', async () => {
    const { sendWhatsApp } = await import('../whatsapp/whatsapp-send');
    const res = await executeScriptActionAction({
      actionType: 'SEND_WHATSAPP',
      actionConfig: { templateId: 'temp_1' },
      ...ctx
    }, 'user_1');
    expect(res.success).toBe(true);
    expect(sendWhatsApp).toHaveBeenCalledWith({
      recipient: '+1234567890',
      template: expect.objectContaining({ body: 'Hello {{FIRST_NAME}}' }),
      resolvedBody: 'Hello {{FIRST_NAME}}',
      variables: {},
      organizationId: 'org_1'
    });
  });

  it('executes ADD_TO_CALL_CAMPAIGN against the contact', async () => {
    const spy = vi.spyOn(CallCentreService, 'addContactsToCampaign').mockResolvedValueOnce({ success: true, count: 1 });
    const res = await executeScriptActionAction({
      actionType: 'ADD_TO_CALL_CAMPAIGN',
      actionConfig: { campaignId: 'camp_123', contactScope: 'primary' },
      ...ctx
    }, 'user_1');
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith('camp_123', ['ent_1'], 'ws_1', 'user_1', undefined, 'primary');
  });

  it('executes UPDATE_CONTACT in new mode against the contact', async () => {
    mockDocGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ name: 'Test Entity', slug: 'test-entity', entityContacts: [] }),
    }));

    const res = await executeScriptActionAction({
      actionType: 'UPDATE_CONTACT',
      actionConfig: { contactName: 'New Contact', contactPhone: '0241112222', updateMode: 'new' },
      ...ctx
    }, 'user_1');
    
    expect(res.success).toBe(true);
    expect(updateEntityAction).toHaveBeenCalledWith(
      'ent_1',
      expect.objectContaining({
        entityContacts: [
          expect.objectContaining({
            name: 'New Contact',
            phone: '+233241112222',
            isPrimary: true
          })
        ]
      }),
      expect.any(String),
      'ws_1',
      'org_1'
    );
  });

  it('executes UPDATE_CONTACT in update mode against the contact', async () => {
    const res = await executeScriptActionAction({
      actionType: 'UPDATE_CONTACT',
      actionConfig: { contactName: 'Updated Name', contactEmail: 'updated@example.com', updateMode: 'update', contactId: 'c_primary' },
      ...ctx
    }, 'user_1');

    expect(res.success).toBe(true);
    expect(updateEntityAction).toHaveBeenCalledWith(
      'ent_1',
      expect.objectContaining({
        entityContacts: [
          expect.objectContaining({
            id: 'c_primary',
            name: 'Updated Name',
            email: 'updated@example.com',
            phone: '+1234567890'
          })
        ]
      }),
      expect.any(String),
      'ws_1',
      'org_1'
    );
  });
});
