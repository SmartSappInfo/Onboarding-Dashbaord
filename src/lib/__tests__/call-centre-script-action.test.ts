// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeScriptActionAction } from '../call-centre-actions';
import { createTaskAction } from '../task-server-actions';
import { applyTagsAction, removeTagsAction } from '../tag-actions';
import { canUser } from '../workspace-permissions';

const mockDocGet = vi.fn().mockResolvedValue({
  exists: true,
  data: () => ({ name: 'Test Entity', slug: 'test-entity', displayName: 'Agent User' }),
});
const mockAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' });

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockDocGet,
      })),
      add: mockAdd,
    })),
  },
  FieldValue: {},
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

  it('executes SCHEDULE_MEETING against the contact', async () => {
    const res = await executeScriptActionAction({ actionType: 'SCHEDULE_MEETING', actionConfig: { meetingTypeId: 'kickoff' }, ...ctx }, 'user_1');
    expect(res.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Kickoff'),
      entityId: 'ent_1',
      status: 'scheduled',
    }));
  });
});
