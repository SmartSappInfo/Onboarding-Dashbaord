// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeOutcomeAutomationsAction } from '../call-centre-actions';
import { CallCentreService } from '../services/call-centre-service';
import { canUser } from '../workspace-permissions';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
      })),
      add: vi.fn(),
    })),
  },
  FieldValue: {},
}));

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

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

  it('executes multiple automations in parallel and returns success results', async () => {
    const spy = vi.spyOn(CallCentreService, 'executeScriptAction').mockResolvedValue({ success: true });

    const automations = [
      { type: 'CREATE_TASK', params: { taskTitle: 'Follow up' } },
      { type: 'ADD_TAG', params: { tagId: 'tag_1' } }
    ];

    const res = await executeOutcomeAutomationsAction({
      automations,
      entityId: 'ent_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1'
    }, 'user_1');

    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(2);
    expect(res.results?.[0]).toEqual({ type: 'CREATE_TASK', success: true, error: undefined });
    expect(res.results?.[1]).toEqual({ type: 'ADD_TAG', success: true, error: undefined });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      actionType: 'CREATE_TASK',
      actionConfig: { taskTitle: 'Follow up' },
      entityId: 'ent_1'
    }));
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      actionType: 'ADD_TAG',
      actionConfig: { tagId: 'tag_1' },
      entityId: 'ent_1'
    }));
  });

  it('handles partial automation failures gracefully without throwing', async () => {
    const spy = vi.spyOn(CallCentreService, 'executeScriptAction')
      .mockResolvedValueOnce({ success: false, error: 'Database Timeout' })
      .mockResolvedValueOnce({ success: true });

    const automations = [
      { type: 'CREATE_TASK', params: { taskTitle: 'Follow up' } },
      { type: 'ADD_TAG', params: { tagId: 'tag_1' } }
    ];

    const res = await executeOutcomeAutomationsAction({
      automations,
      entityId: 'ent_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1'
    }, 'user_1');

    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(2);
    expect(res.results?.[0]).toEqual({ type: 'CREATE_TASK', success: false, error: 'Database Timeout' });
    expect(res.results?.[1]).toEqual({ type: 'ADD_TAG', success: true, error: undefined });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('isolates thrown errors in single automation executions', async () => {
    const spy = vi.spyOn(CallCentreService, 'executeScriptAction')
      .mockRejectedValueOnce(new Error('Unexpected Exception'))
      .mockResolvedValueOnce({ success: true });

    const automations = [
      { type: 'CREATE_TASK', params: { taskTitle: 'Follow up' } },
      { type: 'ADD_TAG', params: { tagId: 'tag_1' } }
    ];

    const res = await executeOutcomeAutomationsAction({
      automations,
      entityId: 'ent_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1'
    }, 'user_1');

    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(2);
    expect(res.results?.[0]).toEqual({ type: 'CREATE_TASK', success: false, error: 'Unexpected Exception' });
    expect(res.results?.[1]).toEqual({ type: 'ADD_TAG', success: true, error: undefined });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
