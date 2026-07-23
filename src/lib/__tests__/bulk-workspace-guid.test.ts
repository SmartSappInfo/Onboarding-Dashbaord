import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveWorkspaceGuid } from '../automations/workspace-resolver';
import type { Automation } from '../types';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: (docId: string) => ({
              get: async () => {
                if (docId === 'wLraN52eC3zBaYuGQfKH' || docId === 'ws-valid-guid') {
                  return {
                    exists: true,
                    data: () => ({
                      organizationId: 'org-123',
                      displayName: 'Prospect Workspace',
                    }),
                  };
                }
                return { exists: false };
              },
            }),
          };
        }
        return {};
      },
    },
  };
});

describe('Workspace GUID Resolver Single Source of Truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves valid workspace GUID directly when document exists', async () => {
    const result = await resolveWorkspaceGuid('wLraN52eC3zBaYuGQfKH');
    expect(result.workspaceId).toBe('wLraN52eC3zBaYuGQfKH');
    expect(result.organizationId).toBe('org-123');
  });

  it('falls back to automation primary workspace GUID when track string "prospect" is passed', async () => {
    const mockAutomation: Automation = {
      id: 'auto-123',
      name: 'Test Automation',
      isActive: true,
      workspaceIds: ['ws-valid-guid'],
      nodes: [],
      triggers: [],
      triggerTypes: [],
      edges: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'user-123',
    };

    const result = await resolveWorkspaceGuid('prospect', mockAutomation);
    expect(result.workspaceId).toBe('ws-valid-guid');
    expect(result.organizationId).toBe('org-123');
  });

  it('falls back gracefully when requested workspace ID is empty or undefined', async () => {
    const mockAutomation: Automation = {
      id: 'auto-456',
      name: 'Fallback Automation',
      isActive: true,
      workspaceIds: ['ws-valid-guid'],
      nodes: [],
      triggers: [],
      triggerTypes: [],
      edges: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'user-123',
    };

    const result = await resolveWorkspaceGuid(undefined, mockAutomation);
    expect(result.workspaceId).toBe('ws-valid-guid');
  });
});
