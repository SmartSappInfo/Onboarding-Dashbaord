import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrollContactsInAutomation } from '../automations/service';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: 'mock_run_123' });
  const mockGet = vi.fn().mockImplementation(function (this: unknown) {
    return Promise.resolve({
      exists: true,
      id: 'auto_123',
      data: () => ({
        id: 'auto_123',
        name: 'Welcome Automation',
        isActive: true,
        isArchived: false,
        workspaceIds: ['ws_test'],
        organizationId: 'org_test',
        nodes: [
          { id: 'n_trig', type: 'triggerNode', data: { label: 'Start' } },
          { id: 'n_act', type: 'actionNode', data: { actionType: 'send_email', label: 'Send Welcome Email' } },
        ],
        edges: [{ id: 'e1', source: 'n_trig', target: 'n_act' }],
      }),
    });
  });

  return {
    adminDb: {
      collection: vi.fn((colName: string) => {
        if (colName === 'automations') {
          return { doc: () => ({ get: mockGet }) };
        }
        if (colName === 'entities') {
          return {
            doc: (entityId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: entityId,
                data: () => ({
                  name: 'Acme Corp',
                  workspaceId: 'ws_test',
                  entityContacts: [
                    { id: 'c_1', name: 'John Doe', email: 'john@acme.com', isPrimary: true },
                  ],
                }),
              }),
            }),
          };
        }
        if (colName === 'automation_runs') {
          return {
            add: mockAdd,
            doc: () => ({ update: vi.fn().mockResolvedValue(undefined) }),
          };
        }
        return {
          add: mockAdd,
          doc: () => ({ get: mockGet, update: vi.fn().mockResolvedValue(undefined) }),
          where: () => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) }),
        };
      }),
      getAll: vi.fn().mockImplementation((...refs: unknown[]) =>
        Promise.all(
          refs.map((r) =>
            Promise.resolve({
              exists: true,
              id: 'ent_123',
              data: () => ({
                name: 'Acme Corp',
                workspaceId: 'ws_test',
                entityContacts: [{ id: 'c_1', name: 'John Doe', email: 'john@acme.com', isPrimary: true }],
              }),
            })
          )
        )
      ),
    },
  };
});

vi.mock('../automation-permissions', () => ({
  assertAutomationUserId: vi.fn(),
  assertAutomationManagePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../automations/workspace-resolver', () => ({
  resolveWorkspaceGuid: vi.fn().mockResolvedValue({ workspaceId: 'ws_test', organizationId: 'org_test' }),
}));

describe('enrollContactsInAutomation (Direct In-Memory Execution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('directly executes small manual contact enrollments (<= 50 targets)', async () => {
    const result = await enrollContactsInAutomation(
      ['ent_123'],
      'auto_123',
      'ws_test',
      'user_123',
      { contactScope: 'primary' }
    );

    expect(result.success).toBe(true);
    expect(result.enrolledCount).toBe(1);
    expect(adminDb.collection).toHaveBeenCalledWith('automation_runs');
  });
});
