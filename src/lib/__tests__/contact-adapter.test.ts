import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveContact, clearContactCache, getWorkspaceContacts } from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { Entity, WorkspaceEntity } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Contact Adapter Core Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearContactCache();
  });

  describe('resolveContact', () => {
    it('should correctly map entityContacts and ignore legacy focalPerson fields', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        name: 'Test Entity',
        entityType: 'institution',
        entityContacts: [
          {
            id: 'c1',
            name: 'Primary Contact',
            email: 'primary@test.com',
            phone: '111',
            isPrimary: true,
            isSignatory: false,
            typeKey: 'primary',
            order: 0,
          },
          {
            id: 'c2',
            name: 'Signatory Contact',
            email: 'signatory@test.com',
            phone: '222',
            isPrimary: false,
            isSignatory: true,
            typeKey: 'signatory',
            order: 1,
          }
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      } as any;

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        status: 'active',
        entityType: 'institution',
        workspaceTags: [],
        displayName: 'Test Entity',
        entityContacts: [],
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_1',
                data: () => mockEntity,
              }),
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  id: 'we_1',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact('entity_1', 'workspace_1');

      expect(result).not.toBeNull();
      // Ensure canonical contacts list matches entityContacts
      expect(result?.contacts).toHaveLength(2);
      expect(result?.entityContacts).toHaveLength(2);
      
      // Ensure primary and signatory are correctly resolved from entityContacts
      expect(result?.primaryContactName).toBe('Primary Contact');
      expect(result?.primaryContactEmail).toBe('primary@test.com');
      
      expect(result?.signatoryName).toBe('Signatory Contact');
      expect(result?.signatoryEmail).toBe('signatory@test.com');
    });
  });

  describe('getWorkspaceContacts', () => {
    it('should retrieve and filter workspace contacts based on tags', async () => {
      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        status: 'active',
        entityType: 'person',
        workspaceTags: ['important'],
        displayName: 'Person Entity',
        entityContacts: [],
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        name: 'Person Entity',
        entityType: 'person',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  id: 'we_1',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
            limit: vi.fn().mockReturnThis(),
          };
        } else if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_1',
                data: () => mockEntity,
              }),
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // Filter by tag that matches
      const contactsHit = await getWorkspaceContacts('workspace_1', { tags: ['important'] });
      expect(contactsHit).toHaveLength(1);
      expect(contactsHit[0].name).toBe('Person Entity');

      // Filter by tag that doesn't match
      const contactsMiss = await getWorkspaceContacts('workspace_1', { tags: ['other'] });
      expect(contactsMiss).toHaveLength(0);
    });
  });
});
