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
                if (docId === 'wLraN52eC3zBaYuGQfKH' || docId === 'ws-canonical-123') {
                  return {
                    exists: true,
                    data: () => ({
                      organizationId: 'org-enterprise',
                      displayName: 'Production Workspace',
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

describe('Workspace GUID Alignment Suite - Extended Audit Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes raw track strings "prospect" to canonical workspace GUIDs from automation blueprint', async () => {
    const mockAutomation: Automation = {
      id: 'auto-deal-001',
      name: 'Deal Automation Protocol',
      isActive: true,
      workspaceIds: ['ws-canonical-123'],
      nodes: [],
      triggers: [],
      triggerTypes: [],
      edges: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'user-123',
    };

    const resolved = await resolveWorkspaceGuid('prospect', mockAutomation);
    expect(resolved.workspaceId).toBe('ws-canonical-123');
    expect(resolved.organizationId).toBe('org-enterprise');
  });

  it('enforces organization tenant isolation when automation org matches workspace org', async () => {
    const mockAutomation: Automation = {
      id: 'auto-deal-002',
      name: 'Tenant Guarded Automation',
      isActive: true,
      workspaceIds: ['wLraN52eC3zBaYuGQfKH'],
      organizationId: 'org-enterprise',
      nodes: [],
      triggers: [],
      triggerTypes: [],
      edges: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'user-123',
    } as unknown as Automation;

    const resolved = await resolveWorkspaceGuid('wLraN52eC3zBaYuGQfKH', mockAutomation);
    expect(resolved.workspaceId).toBe('wLraN52eC3zBaYuGQfKH');
    expect(resolved.organizationId).toBe('org-enterprise');
  });

  it('falls back to default org and primary workspace GUID when workspace document does not exist', async () => {
    const mockAutomation: Automation = {
      id: 'auto-fallback-003',
      name: 'Fallback Blueprint',
      isActive: true,
      workspaceIds: ['ws-canonical-123'],
      nodes: [],
      triggers: [],
      triggerTypes: [],
      edges: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'user-123',
    };

    const resolved = await resolveWorkspaceGuid('non-existent-guid', mockAutomation);
    expect(resolved.workspaceId).toBe('ws-canonical-123');
    expect(resolved.organizationId).toBe('org-enterprise');
  });
});
