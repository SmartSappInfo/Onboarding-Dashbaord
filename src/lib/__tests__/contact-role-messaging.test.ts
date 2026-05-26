// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { previewCampaignAudience, resolveRecipientContacts } from '../messaging-actions';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../mnotify-actions', () => ({
  fetchSmsStatusAction: vi.fn(),
}));

vi.mock('../resend-actions', () => ({
  fetchEmailStatusAction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Contact Role Messaging Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('previewCampaignAudience with contactRoles filter', () => {
    it('filters workspace_entities based on contactRoles correctly', async () => {
      const mockWorkspaceEntities = [
        {
          id: 'we_1',
          entityId: 'ent_1',
          workspaceId: 'ws_1',
          displayName: 'Entity 1',
          workspaceTags: [],
          entityContacts: [
            { id: 'c1', name: 'Primary Cont', email: 'c1@test.com', isPrimary: true, isSignatory: false, typeKey: 'primary' },
            { id: 'c2', name: 'Signatory Cont', email: 'c2@test.com', isPrimary: false, isSignatory: true, typeKey: 'signatory' },
          ]
        },
        {
          id: 'we_2',
          entityId: 'ent_2',
          workspaceId: 'ws_1',
          displayName: 'Entity 2',
          workspaceTags: [],
          entityContacts: [
            { id: 'c3', name: 'Administrator', email: 'c3@test.com', isPrimary: false, isSignatory: false, typeKey: 'admin' },
          ]
        }
      ];

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: mockWorkspaceEntities.map(we => ({
                id: we.id,
                data: () => we
              }))
            })
          };
        }
        if (collectionName === 'tags') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: []
            })
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // 1. Filter for primary contact roles
      const resPrimary = await previewCampaignAudience({
        workspaceId: 'ws_1',
        filters: [{ id: 'f1', field: 'contactRoles', operator: 'any_of', value: ['primary'] }],
        contactScope: 'all',
      });

      expect(resPrimary.success).toBe(true);
      expect(resPrimary.count).toBe(1); // Only Entity 1 matches
      expect(resPrimary.contactCount).toBe(1); // 1 contact (c1)

      // 2. Filter for signatories contact roles
      const resSignatory = await previewCampaignAudience({
        workspaceId: 'ws_1',
        filters: [{ id: 'f1', field: 'contactRoles', operator: 'any_of', value: ['signatories'] }],
        contactScope: 'all',
      });

      expect(resSignatory.success).toBe(true);
      expect(resSignatory.count).toBe(1); // Only Entity 1 matches
      expect(resSignatory.contactCount).toBe(1); // 1 contact (c2)

      // 3. Filter for admin roles
      const resAdmin = await previewCampaignAudience({
        workspaceId: 'ws_1',
        filters: [{ id: 'f1', field: 'contactRoles', operator: 'any_of', value: ['admin'] }],
        contactScope: 'all',
      });

      expect(resAdmin.success).toBe(true);
      expect(resAdmin.count).toBe(1); // Only Entity 2 matches
      expect(resAdmin.contactCount).toBe(1); // 1 contact (c3)
    });
  });

  describe('resolveRecipientContacts with contactRoles list', () => {
    it('resolves only contact matching the specified contactRoles', async () => {
      const mockEntity = {
        id: 'ent_1',
        name: 'Entity 1',
        entityType: 'institution',
        entityContacts: [
          { id: 'c1', name: 'Primary Cont', email: 'c1@test.com', phone: '111', isPrimary: true, isSignatory: false, typeKey: 'primary' },
          { id: 'c2', name: 'Signatory Cont', email: 'c2@test.com', phone: '222', isPrimary: false, isSignatory: true, typeKey: 'signatory' },
          { id: 'c3', name: 'Admin Cont', email: 'c3@test.com', phone: '333', isPrimary: false, isSignatory: false, typeKey: 'admin' },
        ]
      };

      const mockWorkspaceEntity = {
        id: 'we_1',
        entityId: 'ent_1',
        displayName: 'Entity 1',
        entityContacts: mockEntity.entityContacts
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'ent_1',
                data: () => mockEntity
              })
            })
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'we_1', data: () => mockWorkspaceEntity }]
            })
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // 1. Resolve for 'primary' and 'admin' contactRoles
      const resolved = await resolveRecipientContacts({
        entityId: 'ent_1',
        workspaceId: 'ws_1',
        contactScope: 'all',
        channel: 'email',
        contactRoles: ['primary', 'admin']
      });

      expect(resolved).toHaveLength(2);
      expect(resolved[0].contact).toBe('c1@test.com');
      expect(resolved[0].contactName).toBe('Primary Cont');
      expect(resolved[1].contact).toBe('c3@test.com');
      expect(resolved[1].contactName).toBe('Admin Cont');
    });
  });
});
