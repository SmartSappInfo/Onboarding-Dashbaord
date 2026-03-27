/**
 * @fileOverview Tests for Contact Adapter Layer
 * 
 * Tests the backward compatibility adapter that resolves contacts from either:
 * - Legacy schools collection
 * - New entities + workspace_entities model
 * 
 * Requirements: 18
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveContact } from '../contact-adapter';
import { getContactEmail, getContactPhone, getContactSignatory } from '../migration-status-utils';
import { adminDb } from '../firebase-admin';
import type { School, Entity, WorkspaceEntity } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Contact Adapter Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveContact - Legacy Mode', () => {
    it('should resolve contact from legacy schools collection when migrationStatus is undefined', async () => {
      const mockSchool: School = {
        id: 'school_1',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        stage: {
          id: 'stage_1',
          name: 'Onboarding',
          order: 1,
        },
        focalPersons: [
          {
            name: 'John Doe',
            phone: '+1234567890',
            email: 'john@test.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['tag_1', 'tag_2'],
        assignedTo: {
          userId: 'user_1',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
      };

      // Mock Firestore calls
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'school_1',
        data: () => mockSchool,
      });

      const mockDoc = vi.fn().mockReturnValue({
        get: mockGet,
      });

      (adminDb.collection as any).mockReturnValue({
        doc: mockDoc,
      });

      const result = await resolveContact('school_1', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('school_1');
      expect(result?.name).toBe('Test School');
      expect(result?.slug).toBe('test-school');
      expect(result?.pipelineId).toBe('pipeline_1');
      expect(result?.stageId).toBe('stage_1');
      expect(result?.stageName).toBe('Onboarding');
      expect(result?.tags).toEqual(['tag_1', 'tag_2']);
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.contacts).toHaveLength(1);
      expect(result?.contacts[0].name).toBe('John Doe');
    });

    it('should resolve contact from legacy schools collection when migrationStatus is "legacy"', async () => {
      const mockSchool: School = {
        id: 'school_2',
        name: 'Legacy School',
        slug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'legacy',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'school_2',
        data: () => mockSchool,
      });

      const mockDoc = vi.fn().mockReturnValue({
        get: mockGet,
      });

      (adminDb.collection as any).mockReturnValue({
        doc: mockDoc,
      });

      const result = await resolveContact('school_2', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.schoolData).toBeDefined();
    });
  });

  describe('resolveContact - Migrated Mode', () => {
    it('should resolve contact from entities + workspace_entities when migrationStatus is "migrated"', async () => {
      const mockSchool: School = {
        id: 'school_3',
        name: 'Migrated School',
        slug: 'migrated-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'migrated',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [
          {
            name: 'Alice Johnson',
            phone: '+9876543210',
            email: 'alice@migrated.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        globalTags: ['global_tag_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        currentStageName: 'Active',
        assignedTo: {
          userId: 'user_2',
          name: 'Bob Manager',
          email: 'bob@example.com',
        },
        status: 'active',
        workspaceTags: ['workspace_tag_1', 'workspace_tag_2'],
        displayName: 'Migrated School',
        primaryEmail: 'alice@migrated.com',
        primaryPhone: '+9876543210',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock Firestore calls
      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_3',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
          callCount++;
          if (callCount === 1) {
            // First call: search for entity by name
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [
                  {
                    id: 'entity_1',
                    data: () => mockEntity,
                  },
                ],
              }),
            };
          } else {
            // Second call: get entity by ID
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

      const result = await resolveContact('school_3', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entity_1');
      expect(result?.name).toBe('Migrated School');
      expect(result?.entityType).toBe('institution');
      expect(result?.entityId).toBe('entity_1');
      expect(result?.workspaceEntityId).toBe('we_1');
      expect(result?.pipelineId).toBe('pipeline_2');
      expect(result?.stageId).toBe('stage_2');
      expect(result?.stageName).toBe('Active');
      expect(result?.tags).toEqual(['workspace_tag_1', 'workspace_tag_2']);
      expect(result?.globalTags).toEqual(['global_tag_1']);
      expect(result?.migrationStatus).toBe('migrated');
      expect(result?.contacts).toHaveLength(1);
      expect(result?.contacts[0].name).toBe('Alice Johnson');
    });

    it('should fallback to legacy mode if entity not found for migrated school', async () => {
      const mockSchool: School = {
        id: 'school_4',
        name: 'Orphaned School',
        slug: 'orphaned-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'migrated',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_4',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
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

      const result = await resolveContact('school_4', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.schoolData).toBeDefined();
    });
  });

  describe('resolveContact - Dual-Write Mode', () => {
    it('should resolve contact from legacy schools collection when migrationStatus is "dual-write"', async () => {
      const mockSchool: School = {
        id: 'school_5',
        name: 'Dual Write School',
        slug: 'dual-write-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        stage: {
          id: 'stage_1',
          name: 'Onboarding',
          order: 1,
        },
        focalPersons: [
          {
            name: 'Charlie Brown',
            phone: '+1111111111',
            email: 'charlie@test.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['tag_1'],
        migrationStatus: 'dual-write',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        id: 'school_5',
        data: () => mockSchool,
      });

      const mockDoc = vi.fn().mockReturnValue({
        get: mockGet,
      });

      (adminDb.collection as any).mockReturnValue({
        doc: mockDoc,
      });

      const result = await resolveContact('school_5', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('school_5');
      expect(result?.name).toBe('Dual Write School');
      expect(result?.migrationStatus).toBe('dual-write');
      expect(result?.schoolData).toBeDefined();
    });
  });

  describe('resolveContact - Missing Workspace Context', () => {
    it('should handle migrated entity without workspace_entities record', async () => {
      const mockSchool: School = {
        id: 'school_6',
        name: 'No Workspace Entity School',
        slug: 'no-workspace-entity',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'migrated',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'No Workspace Entity School',
        slug: 'no-workspace-entity',
        contacts: [
          {
            name: 'David Lee',
            phone: '+2222222222',
            email: 'david@test.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        globalTags: ['global_tag_2'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_6',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
          callCount++;
          if (callCount === 1) {
            // First call: search for entity by name
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [
                  {
                    id: 'entity_2',
                    data: () => mockEntity,
                  },
                ],
              }),
            };
          } else {
            // Second call: get entity by ID
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  id: 'entity_2',
                  data: () => mockEntity,
                }),
              }),
            };
          }
        } else if (collectionName === 'workspace_entities') {
          // No workspace_entities record found
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

      const result = await resolveContact('school_6', 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entity_2');
      expect(result?.name).toBe('No Workspace Entity School');
      expect(result?.entityType).toBe('institution');
      expect(result?.migrationStatus).toBe('migrated');
      // Workspace-specific fields should be undefined
      expect(result?.pipelineId).toBeUndefined();
      expect(result?.stageId).toBeUndefined();
      expect(result?.stageName).toBeUndefined();
      expect(result?.assignedTo).toBeUndefined();
      expect(result?.tags).toEqual([]);
      // Global tags should still be present
      expect(result?.globalTags).toEqual(['global_tag_2']);
    });
  });

  describe('resolveContact - Error Handling', () => {
    it('should return null when Firestore throws an error', async () => {
      const mockCollection = vi.fn(() => {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error('Firestore connection error')),
          }),
        };
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact('error_school', 'workspace_1');

      expect(result).toBeNull();
    });
  });

  describe('resolveContact - Not Found', () => {
    it('should return null if school does not exist and entity does not exist', async () => {
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
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

      const result = await resolveContact('nonexistent', 'workspace_1');

      expect(result).toBeNull();
    });
  });

  describe('Helper Functions', () => {
    it('should extract primary contact email', () => {
      const contact: any = {
        id: 'test',
        name: 'Test',
        contacts: [
          { name: 'John', email: 'john@test.com', phone: '123', type: 'Principal', isSignatory: true },
          { name: 'Jane', email: 'jane@test.com', phone: '456', type: 'Admin', isSignatory: false },
        ],
        tags: [],
        migrationStatus: 'legacy',
      };

      expect(getContactEmail(contact)).toBe('john@test.com');
    });

    it('should extract primary contact phone', () => {
      const contact: any = {
        id: 'test',
        name: 'Test',
        contacts: [
          { name: 'John', email: 'john@test.com', phone: '+1234567890', type: 'Principal', isSignatory: true },
        ],
        tags: [],
        migrationStatus: 'legacy',
      };

      expect(getContactPhone(contact)).toBe('+1234567890');
    });

    it('should extract signatory contact', () => {
      const contact: any = {
        id: 'test',
        name: 'Test',
        contacts: [
          { name: 'John', email: 'john@test.com', phone: '123', type: 'Principal', isSignatory: false },
          { name: 'Jane', email: 'jane@test.com', phone: '456', type: 'Admin', isSignatory: true },
        ],
        tags: [],
        migrationStatus: 'legacy',
      };

      const signatory = getContactSignatory(contact);
      expect(signatory?.name).toBe('Jane');
      expect(signatory?.isSignatory).toBe(true);
    });

    it('should return first contact if no signatory found', () => {
      const contact: any = {
        id: 'test',
        name: 'Test',
        contacts: [
          { name: 'John', email: 'john@test.com', phone: '123', type: 'Principal', isSignatory: false },
          { name: 'Jane', email: 'jane@test.com', phone: '456', type: 'Admin', isSignatory: false },
        ],
        tags: [],
        migrationStatus: 'legacy',
      };

      const signatory = getContactSignatory(contact);
      expect(signatory?.name).toBe('John');
    });

    it('should return null if no contacts', () => {
      const contact: any = {
        id: 'test',
        name: 'Test',
        contacts: [],
        tags: [],
        migrationStatus: 'legacy',
      };

      expect(getContactEmail(contact)).toBeUndefined();
      expect(getContactPhone(contact)).toBeUndefined();
      expect(getContactSignatory(contact)).toBeNull();
    });
  });
});
