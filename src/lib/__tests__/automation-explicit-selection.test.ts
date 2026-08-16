import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrollContactsInAutomation } from '../automations/service';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: 'mock_run_999' });
  const mockGet = vi.fn().mockImplementation(function (this: unknown) {
    return Promise.resolve({
      exists: true,
      id: 'auto_999',
      data: () => ({
        id: 'auto_999',
        name: 'Multi Entity Flow',
        isActive: true,
        isArchived: false,
        workspaceIds: ['ws_test'],
        organizationId: 'org_test',
        nodes: [
          { id: 'n_trig', type: 'triggerNode', data: { label: 'Start' } },
        ],
        edges: [],
      }),
    });
  });

  return {
    adminDb: {
      collection: vi.fn((colName: string) => {
        if (colName === 'automations') {
          return { doc: () => ({ get: mockGet }) };
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
        Promise.resolve(
          refs.map((_, idx) => ({
            exists: true,
            id: `ent_${idx + 1}`,
            data: () => ({
              name: `School ${idx + 1}`,
              workspaceId: 'ws_test',
              entityContacts: [{ id: `c_${idx + 1}`, name: `Contact ${idx + 1}`, email: `c${idx + 1}@school.com`, isPrimary: true }],
            }),
          }))
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

describe('enrollContactsInAutomation (Explicit Selection Support)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enrolls multiple explicitly selected entities (3 entities)', async () => {
    const selectedEntityIds = ['ent_1', 'ent_2', 'ent_3'];
    const result = await enrollContactsInAutomation(
      selectedEntityIds,
      'auto_999',
      'ws_test',
      'user_999',
      { contactScope: 'all' }
    );

    expect(result.success).toBe(true);
    expect(result.enrolledCount).toBe(3);
    expect(adminDb.collection).toHaveBeenCalledWith('automation_runs');
  });
});
