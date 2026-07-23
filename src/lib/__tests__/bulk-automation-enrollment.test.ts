import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrollContactsInAutomation } from '../automations/service';

const mockGetAll = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'automations') {
        return {
          doc: (id: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              id,
              data: () => ({
                id,
                name: 'Test Automation',
                workspaceIds: ['ws-123'],
                isActive: true,
                triggers: [],
                nodes: [{ id: 'trigger-1', type: 'triggerNode' }],
                edges: [],
              }),
            }),
          }),
        };
      }
      if (colName === 'workspaces') {
        return {
          doc: (id: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              id,
              data: () => ({ organizationId: 'org-123' }),
            }),
          }),
        };
      }
      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      };
    },
    getAll: (...refs: any[]) => mockGetAll(...refs),
  },
}));

vi.mock('../gcp-tasks-client', () => ({
  scheduleBulkTriggerTask: vi.fn().mockResolvedValue({ taskId: 'task-123' }),
}));

vi.mock('../automation-permissions', () => ({
  assertAutomationUserId: vi.fn(),
  assertAutomationManagePermission: vi.fn().mockResolvedValue(undefined),
}));

describe('Bulk Automation Enrollment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockImplementation(async (...refs: any[]) => {
      return refs.map((ref: any) => ({
        exists: true,
        id: 'ent-1',
        data: () => ({
          displayName: 'School ent-1',
          entityType: 'institution',
          primaryContactEmail: 'school_ent-1@test.com',
          primaryContactPhone: '+123456789',
          entityContacts: [
            { id: 'c1_ent-1', name: 'Alice Smith', email: 'alice@test.com', isPrimary: true },
            { id: 'c2_ent-1', name: 'Bob Jones', email: 'bob@test.com', isSignatory: true },
          ],
        }),
      }));
    });
  });

  it('successfully enrolls primary contacts for bulk entities', async () => {
    const res = await enrollContactsInAutomation(
      ['ent-1', 'ent-2'],
      'auto-123',
      'ws-123',
      'user-123',
      { contactScope: 'primary' }
    );

    expect(res.success).toBe(true);
    expect(res.enrolledCount).toBe(2);
  });

  it('successfully enrolls all contacts for bulk entities', async () => {
    const res = await enrollContactsInAutomation(
      ['ent-1'],
      'auto-123',
      'ws-123',
      'user-123',
      { contactScope: 'all' }
    );

    expect(res.success).toBe(true);
    expect(res.enrolledCount).toBe(2);
  });

  it('synthesizes primary contact fallback when entityContacts is missing', async () => {
    mockGetAll.mockResolvedValueOnce([
      {
        exists: true,
        id: 'ent-no-contacts',
        data: () => ({
          displayName: 'No Contact School',
          entityType: 'institution',
          primaryContactEmail: 'nocontact@school.com',
          entityContacts: [],
        }),
      },
    ]);

    const res = await enrollContactsInAutomation(
      ['ent-no-contacts'],
      'auto-123',
      'ws-123',
      'user-123',
      { contactScope: 'primary' }
    );

    expect(res.success).toBe(true);
    expect(res.enrolledCount).toBe(1);
  });
});
