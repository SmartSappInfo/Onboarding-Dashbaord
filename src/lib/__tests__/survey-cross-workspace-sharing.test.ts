import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/contacts/contact-projection-writer', () => ({
  syncContactProjectionForWE: vi.fn().mockResolvedValue(undefined),
  deleteContactProjectionForEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { ensureEntitySharedToWorkspace, linkEntityToWorkspaceAction } from '@/lib/workspace-entity-actions';
import { resolveOrMatchWorkspaceEntity } from '@/lib/survey-actions';

// Mock dependencies
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: 'act_123' });

const mockEntityDoc: Record<string, unknown> = {
  id: 'ent_accra_1',
  name: 'Accra Academy',
  slug: 'accra-academy',
  organizationId: 'org_main',
  entityType: 'institution',
  workspaceIds: ['ws_onboarding'],
  entityContacts: [
    {
      id: 'c1',
      name: 'Headmaster Mensah',
      email: 'mensah@accra-academy.edu',
      phone: '+233241112233',
      isPrimary: true,
      typeKey: 'administrator',
    },
  ],
};

const mockEntityCompetitor: Record<string, unknown> = {
  id: 'ent_competitor_1',
  name: 'Competitor Academy',
  slug: 'competitor-academy',
  organizationId: 'org_other',
  entityType: 'institution',
  workspaceIds: ['ws_competitor'],
  entityContacts: [
    {
      id: 'c2',
      name: 'Other User',
      email: 'user@competitor.com',
      isPrimary: true,
      typeKey: 'administrator',
    },
  ],
};

const mockWsFocusGroups: Record<string, unknown> = {
  id: 'ws_focus_groups',
  name: 'Focus Groups Workspace',
  organizationId: 'org_main',
  contactScope: 'institution',
};

const mockWsPersonScope: Record<string, unknown> = {
  id: 'ws_person_scope',
  name: 'Candidate Workspace',
  organizationId: 'org_main',
  contactScope: 'person',
};

const mockWsDifferentOrg: Record<string, unknown> = {
  id: 'ws_competitor',
  name: 'Competitor Workspace',
  organizationId: 'org_other',
  contactScope: 'institution',
};

let mockExistingWE: Record<string, unknown> | null = null;

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collName: string) => {
        if (collName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: id === 'ent_accra_1' || id === 'ent_competitor_1',
                id,
                data: () => (id === 'ent_competitor_1' ? mockEntityCompetitor : mockEntityDoc),
              }),
              update: mockUpdate,
            })),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ docs: [] }),
              }),
            }),
          };
        }

        if (collName === 'workspaces') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: id === 'ws_focus_groups' || id === 'ws_competitor' || id === 'ws_onboarding' || id === 'ws_person_scope',
                id,
                data: () => {
                  if (id === 'ws_focus_groups') return mockWsFocusGroups;
                  if (id === 'ws_competitor') return mockWsDifferentOrg;
                  if (id === 'ws_person_scope') return mockWsPersonScope;
                  return { id, organizationId: 'org_main', contactScope: 'institution' };
                },
              }),
              update: mockUpdate,
            })),
          };
        }

        if (collName === 'workspace_entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: mockExistingWE !== null && id === 'ws_focus_groups_ent_accra_1',
                id,
                data: () => mockExistingWE,
              }),
              set: mockSet,
              update: mockUpdate,
            })),
            where: vi.fn((_field: string, _op: string, _val: string) => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({
                    empty: mockExistingWE === null,
                    docs: mockExistingWE ? [{ id: 'ws_focus_groups_ent_accra_1', data: () => mockExistingWE }] : [],
                  }),
                })),
              })),
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({
                  empty: mockExistingWE === null,
                  docs: mockExistingWE ? [{ id: 'ws_focus_groups_ent_accra_1', data: () => mockExistingWE }] : [],
                }),
              })),
            })),
          };
        }

        if (collName === 'activities') {
          return {
            add: mockAdd,
          };
        }

        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: mockSet,
          })),
        };
      }),
    },
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
    arrayUnion: vi.fn((...args: unknown[]) => args),
  },
}));

describe('Cross-Workspace Entity Sharing & Survey Tracking Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingWE = null;
  });

  describe('ensureEntitySharedToWorkspace', () => {
    it('creates deterministic doc ID `${workspaceId}_${entityId}` and merges successfully', async () => {
      const result = await ensureEntitySharedToWorkspace({
        entityId: 'ent_accra_1',
        targetWorkspaceId: 'ws_focus_groups',
        reason: 'survey_tracking_resolution',
        actor: { userId: 'usr_test', displayName: 'Test Runner' },
      });

      expect(result.success).toBe(true);
      expect(result.workspaceEntityId).toBe('ws_focus_groups_ent_accra_1');
      expect(result.alreadyShared).toBe(false);

      // Verify deterministic document key was used with set({ merge: true })
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ws_focus_groups_ent_accra_1',
          workspaceId: 'ws_focus_groups',
          entityId: 'ent_accra_1',
          status: 'active',
        }),
        { merge: true }
      );

      // Verify entity.workspaceIds was updated
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns alreadyShared: true when link already exists', async () => {
      mockExistingWE = {
        id: 'ws_focus_groups_ent_accra_1',
        workspaceId: 'ws_focus_groups',
        entityId: 'ent_accra_1',
        status: 'active',
      };

      const result = await ensureEntitySharedToWorkspace({
        entityId: 'ent_accra_1',
        targetWorkspaceId: 'ws_focus_groups',
        reason: 'survey_tracking_resolution',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyShared).toBe(true);
      expect(result.workspaceEntityId).toBe('ws_focus_groups_ent_accra_1');
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('rejects cross-organization sharing with a security error', async () => {
      const result = await ensureEntitySharedToWorkspace({
        entityId: 'ent_accra_1',
        targetWorkspaceId: 'ws_competitor', // belongs to org_other
        reason: 'survey_tracking_resolution',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Tenant boundary violation/);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('rejects sharing when ScopeGuard detects incompatible contact scope', async () => {
      const result = await ensureEntitySharedToWorkspace({
        entityId: 'ent_accra_1', // institution entity
        targetWorkspaceId: 'ws_person_scope', // person workspace
        reason: 'survey_tracking_resolution',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Scope mismatch/);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('linkEntityToWorkspaceAction multi-tenant isolation & data quality', () => {
    it('rejects cross-organization linking with tenant boundary error', async () => {
      const result = await linkEntityToWorkspaceAction({
        workspaceId: 'ws_focus_groups', // org_main
        entityId: 'ent_competitor_1', // org_other
        userId: 'admin_user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Tenant boundary violation/);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('stamps human primaryContactName correctly from entity contacts', async () => {
      const result = await linkEntityToWorkspaceAction({
        workspaceId: 'ws_focus_groups',
        entityId: 'ent_accra_1',
        userId: 'admin_user',
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryContactName: 'Headmaster Mensah',
          primaryEmail: 'mensah@accra-academy.edu',
        }),
        { merge: true }
      );
    });
  });

  describe('resolveOrMatchWorkspaceEntity cross-workspace Layer 1 resolution', () => {
    it('auto-shares and resolves entity when respondent tracked ID is from same org but different workspace', async () => {
      const match = await resolveOrMatchWorkspaceEntity('ws_focus_groups', {
        preTrackedEntityId: 'ent_accra_1',
      });

      expect(match).not.toBeNull();
      expect(match?.entityId).toBe('ent_accra_1');
      expect(match?.entityName).toBe('Accra Academy');
      expect(match?.matchedBy).toBe('tracked_id');

      // Verify ensureEntitySharedToWorkspace was called
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ws_focus_groups_ent_accra_1',
          workspaceId: 'ws_focus_groups',
          entityId: 'ent_accra_1',
        }),
        { merge: true }
      );
    });

    it('rejects tracked entity belonging to a different organization (fail-closed)', async () => {
      const match = await resolveOrMatchWorkspaceEntity('ws_focus_groups', {
        preTrackedEntityId: 'ent_competitor_1', // belongs to org_other
      });

      expect(match).toBeNull();
    });
  });
});
