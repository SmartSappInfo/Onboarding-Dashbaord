/**
 * @fileOverview Tests for New Contact Adapter Methods
 * 
 * Tests the new methods added to the contact adapter:
 * - ContactIdentifier support in resolveContact
 * - contactExists
 * - Cache functionality
 * 
 * Requirements: 11.1, 23.1, 25.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveContact,
  contactExists,
  clearContactCache,
} from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { Entity, WorkspaceEntity } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Contact Adapter New Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearContactCache();
  });

  describe('resolveContact with ContactIdentifier', () => {
    it('should resolve contact using entityId when provided', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test Entity',
        slug: 'test-entity',
        contacts: [
          {
            name: 'John Doe',
            phone: '+1234567890',
            email: 'john@test.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        globalTags: ['tag1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'Active',
        status: 'active',
        workspaceTags: ['workspace_tag'],
        displayName: 'Test Entity',
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
      expect(result?.id).toBe('entity_1');
      expect(result?.name).toBe('Test Entity');
      expect(result?.entityType).toBe('institution');
      expect(result?.migrationStatus).toBe('migrated');
    });

    it('should resolve contact from legacy ID', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Entity Name',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
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
              empty: true,
              docs: [],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact('school_1', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entity_1');
      expect(result?.name).toBe('Entity Name');
    });
  });

  describe('contactExists', () => {
    it('should return true when entity exists', async () => {
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
              }),
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await contactExists('entity_1');

      expect(result).toBe(true);
    });

    it('should return true when school exists', async () => {
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
              }),
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await contactExists('school_1');

      expect(result).toBe(true);
    });

    it('should return false when contact does not exist', async () => {
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          };
        } else if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await contactExists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Cache functionality', () => {
    it('should cache resolved contacts', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Cached Entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve({
                  exists: true,
                  id: 'entity_1',
                  data: () => mockEntity,
                });
              }),
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: true,
              docs: [],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // First call - should hit database
      const result1 = await resolveContact('entity_1', 'workspace_1');
      expect(result1?.name).toBe('Cached Entity');
      expect(callCount).toBe(1);

      // Second call - should use cache
      const result2 = await resolveContact('entity_1', 'workspace_1');
      expect(result1?.name).toBe('Cached Entity');
      expect(callCount).toBe(1); // Should not increment

      // Verify both results are the same
      expect(result1).toEqual(result2);
    });

    it('should clear cache when clearContactCache is called', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Cached Entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve({
                  exists: true,
                  id: 'entity_1',
                  data: () => mockEntity,
                });
              }),
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: true,
              docs: [],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // First call
      await resolveContact('entity_1', 'workspace_1');
      expect(callCount).toBe(1);

      // Clear cache
      clearContactCache();

      // Second call - should hit database again
      await resolveContact('entity_1', 'workspace_1');
      expect(callCount).toBe(2);
    });
  });
});
