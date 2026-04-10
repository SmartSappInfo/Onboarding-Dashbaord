/**
 * @fileOverview Comprehensive Unit Tests for Contact Adapter
 * 
 * Tests all key functions of the Contact Adapter:
 * - resolveContact: Resolution of migrated entities, legacy schools, fallback behavior
 * - getWorkspaceContacts: Workspace boundary enforcement
 * - contactExists: Existence checking
 * - searchContacts: Contact search functionality
 * - clearContactCache: Cache management
 * 
 * Requirements: 26.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  resolveContact,
  getWorkspaceContacts,
  contactExists,
  searchContacts,
  clearContactCache,
} from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { School, Entity, WorkspaceEntity } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Contact Adapter - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearContactCache();
  });

  afterEach(() => {
    clearContactCache();
  });

  describe('1. Resolution of Migrated Entities', () => {
    it('should resolve contact by entityId directly', async () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        globalTags: ['global_tag_1', 'global_tag_2'],
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
        currentStageName: 'Onboarding',
        assignedTo: {
          userId: 'user_1',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        status: 'active',
        workspaceTags: ['workspace_tag_1', 'workspace_tag_2'],
        displayName: 'Test Institution',
        primaryEmail: 'john@test.com',
        primaryPhone: '+1234567890',
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

      const result = await resolveContact({ entityId: 'entity_1' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entity_1');
      expect(result?.name).toBe('Test Institution');
      expect(result?.entityId).toBe('entity_1');
      expect(result?.entityType).toBe('institution');
      expect(result?.migrationStatus).toBe('migrated');
    });

    it('should resolve migrated school that has entityId', async () => {
      const mockSchool: School = {
        id: 'school_1',
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
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [
          {
            name: 'Alice Johnson',
            email: 'alice@migrated.com',
            phone: '+9876543210',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        globalTags: ['global_tag_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_2',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_2',
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
        workspaceTags: ['workspace_tag_1'],
        displayName: 'Migrated School',
        primaryEmail: 'alice@migrated.com',
        primaryPhone: '+9876543210',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_1',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
          callCount++;
          if (callCount === 1) {
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
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  id: 'we_2',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'school_1' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('entity_2');
      expect(result?.name).toBe('Migrated School');
      expect(result?.entityId).toBe('entity_2');
      expect(result?.migrationStatus).toBe('migrated');
    });

    it('should properly merge workspace_entities data', async () => {
      const mockEntity: Entity = {
        id: 'entity_3',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test Entity',
        slug: 'test-entity',
        contacts: [],
        globalTags: ['global_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_3',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_3',
        entityType: 'institution',
        pipelineId: 'pipeline_3',
        stageId: 'stage_3',
        currentStageName: 'Qualified',
        assignedTo: {
          userId: 'user_3',
          name: 'Charlie Admin',
          email: 'charlie@example.com',
        },
        status: 'active',
        workspaceTags: ['ws_tag_1', 'ws_tag_2'],
        displayName: 'Test Entity',
        primaryEmail: 'test@entity.com',
        primaryPhone: '+1111111111',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_3',
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
                  id: 'we_3',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'entity_3' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.pipelineId).toBe('pipeline_3');
      expect(result?.stageId).toBe('stage_3');
      expect(result?.stageName).toBe('Qualified');
      expect(result?.assignedTo?.userId).toBe('user_3');
      expect(result?.status).toBe('active');
      expect(result?.workspaceEntityId).toBe('we_3');
    });

    it('should include both global tags and workspace tags', async () => {
      const mockEntity: Entity = {
        id: 'entity_4',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Tagged Entity',
        slug: 'tagged-entity',
        contacts: [],
        globalTags: ['global_a', 'global_b', 'global_c'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_4',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_4',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'New',
        status: 'active',
        workspaceTags: ['ws_a', 'ws_b'],
        displayName: 'Tagged Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_4',
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
                  id: 'we_4',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'entity_4' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.tags).toEqual(['ws_a', 'ws_b']);
      expect(result?.globalTags).toEqual(['global_a', 'global_b', 'global_c']);
    });
  });

  describe('2. Resolution of Legacy Schools', () => {
    it('should resolve legacy school with migrationStatus undefined', async () => {
      const mockSchool: School = {
        id: 'school_legacy_1',
        name: 'Legacy School',
        slug: 'legacy-school',
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
            name: 'David Lee',
            email: 'david@legacy.com',
            phone: '+2222222222',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['legacy_tag_1', 'legacy_tag_2'],
        assignedTo: {
          userId: 'user_4',
          name: 'Diana Manager',
          email: 'diana@example.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'school_legacy_1',
            data: () => mockSchool,
          }),
        }),
      }));

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'school_legacy_1' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('school_legacy_1');
      expect(result?.name).toBe('Legacy School');
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.entityId).toBeUndefined();
      expect(result?.schoolData).toBeDefined();
    });

    it('should resolve legacy school with migrationStatus "legacy"', async () => {
      const mockSchool: School = {
        id: 'school_legacy_2',
        name: 'Explicitly Legacy School',
        slug: 'explicitly-legacy',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_2',
        focalPersons: [],
        migrationStatus: 'legacy',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'school_legacy_2',
            data: () => mockSchool,
          }),
        }),
      }));

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'school_legacy_2' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.entityId).toBeUndefined();
    });

    it('should properly map school data to ResolvedContact', async () => {
      const mockSchool: School = {
        id: 'school_legacy_3',
        name: 'Complete Legacy School',
        slug: 'complete-legacy',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_3',
        stage: {
          id: 'stage_3',
          name: 'Qualified',
          order: 3,
        },
        focalPersons: [
          {
            name: 'Eve Principal',
            email: 'eve@complete.com',
            phone: '+3333333333',
            type: 'Principal',
            isSignatory: true,
          },
          {
            name: 'Frank Admin',
            email: 'frank@complete.com',
            phone: '+4444444444',
            type: 'Admin',
            isSignatory: false,
          },
        ],
        tags: ['tag_a', 'tag_b', 'tag_c'],
        assignedTo: {
          userId: 'user_5',
          name: 'George Manager',
          email: 'george@example.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'school_legacy_3',
            data: () => mockSchool,
          }),
        }),
      }));

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'school_legacy_3' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('school_legacy_3');
      expect(result?.name).toBe('Complete Legacy School');
      expect(result?.slug).toBe('complete-legacy');
      expect(result?.pipelineId).toBe('pipeline_3');
      expect(result?.stageId).toBe('stage_3');
      expect(result?.stageName).toBe('Qualified');
      expect(result?.assignedTo?.userId).toBe('user_5');
      expect(result?.status).toBe('Active');
      expect(result?.tags).toEqual(['tag_a', 'tag_b', 'tag_c']);
      expect(result?.contacts).toHaveLength(2);
      expect(result?.contacts[0].name).toBe('Eve Principal');
      expect(result?.contacts[1].name).toBe('Frank Admin');
    });

    it('should not have entityId or globalTags for legacy schools', async () => {
      const mockSchool: School = {
        id: 'school_legacy_4',
        name: 'Pure Legacy School',
        slug: 'pure-legacy',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'school_legacy_4',
            data: () => mockSchool,
          }),
        }),
      }));

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'school_legacy_4' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.entityId).toBeUndefined();
      expect(result?.globalTags).toBeUndefined();
      expect(result?.migrationStatus).toBe('legacy');
    });
  });

  describe('3. Fallback Behavior When Entity Not Found', () => {
    it('should fallback to legacy mode if migrated school entity not found', async () => {
      const mockSchool: School = {
        id: 'school_orphaned',
        name: 'Orphaned School',
        slug: 'orphaned-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [
          {
            name: 'Helen Orphan',
            email: 'helen@orphaned.com',
            phone: '+5555555555',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        migrationStatus: 'migrated',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_orphaned',
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

      const result = await resolveContact({ entityId: 'school_orphaned' }, 'workspace_1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('school_orphaned');
      expect(result?.migrationStatus).toBe('legacy');
      expect(result?.schoolData).toBeDefined();
    });

    it('should return null for non-existent contacts', async () => {
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

      const result = await resolveContact({ entityId: 'nonexistent' }, 'workspace_1');

      expect(result).toBeNull();
    });

    it('should return null gracefully on error', async () => {
      const mockCollection = vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error('Firestore connection error')),
        }),
      }));

      (adminDb.collection as any) = mockCollection;

      const result = await resolveContact({ entityId: 'error_school' }, 'workspace_1');

      expect(result).toBeNull();
    });
  });

  describe('4. Workspace Boundary Enforcement', () => {
    it('should only return contacts for specified workspace in getWorkspaceContacts', async () => {
      const mockEntity1: Entity = {
        id: 'entity_ws1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Workspace 1 Entity',
        slug: 'ws1-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity1: WorkspaceEntity = {
        id: 'we_ws1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_ws1',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'New',
        status: 'active',
        workspaceTags: [],
        displayName: 'Workspace 1 Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSchool1: School = {
        id: 'school_ws1',
        name: 'Workspace 1 School',
        slug: 'ws1-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'legacy',
        createdAt: '2024-01-01T00:00:00Z',
      };

      let entityCallCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          const whereMock = vi.fn().mockReturnThis();
          const limitMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            limit: limitMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const workspaceCall = calls.find((call: any) => call[0] === 'workspaceId');
              if (workspaceCall && workspaceCall[2] === 'workspace_1') {
                return Promise.resolve({
                  docs: [
                    {
                      id: 'we_ws1',
                      data: () => mockWorkspaceEntity1,
                    },
                  ],
                });
              }
              return Promise.resolve({ docs: [] });
            }),
          };
        } else if (collectionName === 'entities') {
          entityCallCount++;
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_ws1',
                data: () => mockEntity1,
              }),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  id: 'entity_ws1',
                  data: () => mockEntity1,
                },
              ],
            }),
          };
        } else if (collectionName === 'schools') {
          const whereMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const workspaceCall = calls.find((call: any) => call[0] === 'workspaceIds');
              if (workspaceCall && workspaceCall[2] === 'workspace_1') {
                return Promise.resolve({
                  docs: [
                    {
                      id: 'school_ws1',
                      data: () => mockSchool1,
                    },
                  ],
                });
              }
              return Promise.resolve({ docs: [] });
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const contacts = await getWorkspaceContacts('workspace_1');

      expect(contacts).toHaveLength(2);
      expect(contacts.some((c) => c.id === 'entity_ws1')).toBe(true);
      expect(contacts.some((c) => c.id === 'school_ws1')).toBe(true);
    });

    it('should respect workspace context in resolveContact', async () => {
      const mockEntity: Entity = {
        id: 'entity_multi_ws',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Multi Workspace Entity',
        slug: 'multi-ws-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity1: WorkspaceEntity = {
        id: 'we_multi_ws1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_multi_ws',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'Stage 1',
        status: 'active',
        workspaceTags: ['ws1_tag'],
        displayName: 'Multi Workspace Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity2: WorkspaceEntity = {
        id: 'we_multi_ws2',
        organizationId: 'org_1',
        workspaceId: 'workspace_2',
        entityId: 'entity_multi_ws',
        entityType: 'institution',
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        currentStageName: 'Stage 2',
        status: 'active',
        workspaceTags: ['ws2_tag'],
        displayName: 'Multi Workspace Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_multi_ws',
                data: () => mockEntity,
              }),
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          const whereMock = vi.fn().mockReturnThis();
          const limitMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            limit: limitMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const workspaceCall = calls.find((call: any) => call[0] === 'workspaceId');
              if (workspaceCall && workspaceCall[2] === 'workspace_1') {
                return Promise.resolve({
                  empty: false,
                  docs: [
                    {
                      id: 'we_multi_ws1',
                      data: () => mockWorkspaceEntity1,
                    },
                  ],
                });
              } else if (workspaceCall && workspaceCall[2] === 'workspace_2') {
                return Promise.resolve({
                  empty: false,
                  docs: [
                    {
                      id: 'we_multi_ws2',
                      data: () => mockWorkspaceEntity2,
                    },
                  ],
                });
              }
              return Promise.resolve({ empty: true, docs: [] });
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result1 = await resolveContact({ entityId: 'entity_multi_ws' }, 'workspace_1');
      expect(result1?.workspaceEntityId).toBe('we_multi_ws1');
      expect(result1?.tags).toEqual(['ws1_tag']);
      expect(result1?.stageName).toBe('Stage 1');

      clearContactCache();

      const result2 = await resolveContact({ entityId: 'entity_multi_ws' }, 'workspace_2');
      expect(result2?.workspaceEntityId).toBe('we_multi_ws2');
      expect(result2?.tags).toEqual(['ws2_tag']);
      expect(result2?.stageName).toBe('Stage 2');
    });

    it('should filter workspace_entities correctly', async () => {
      const mockEntity: Entity = {
        id: 'entity_filtered',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Filtered Entity',
        slug: 'filtered-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_filtered',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_filtered',
        entityType: 'institution',
        pipelineId: 'pipeline_specific',
        stageId: 'stage_specific',
        currentStageName: 'Specific Stage',
        status: 'active',
        workspaceTags: ['specific_tag'],
        displayName: 'Filtered Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          const whereMock = vi.fn().mockReturnThis();
          const limitMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            limit: limitMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const pipelineCall = calls.find((call: any) => call[0] === 'pipelineId');
              const entityIdCall = calls.find((call: any) => call[0] === 'entityId');
              const workspaceIdCall = calls.find((call: any) => call[0] === 'workspaceId');
              
              // For resolveFromEntity calls (entityId + workspaceId)
              if (entityIdCall && workspaceIdCall) {
                return Promise.resolve({
                  empty: false,
                  docs: [
                    {
                      id: 'we_filtered',
                      data: () => mockWorkspaceEntity,
                    },
                  ],
                });
              }
              
              // For getWorkspaceContacts calls (pipelineId filter)
              if (pipelineCall && pipelineCall[2] === 'pipeline_specific') {
                return Promise.resolve({
                  docs: [
                    {
                      id: 'we_filtered',
                      data: () => mockWorkspaceEntity,
                    },
                  ],
                });
              }
              return Promise.resolve({ docs: [] });
            }),
          };
        } else if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'entity_filtered',
                data: () => mockEntity,
              }),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  id: 'entity_filtered',
                  data: () => mockEntity,
                },
              ],
            }),
          };
        } else if (collectionName === 'schools') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const contacts = await getWorkspaceContacts('workspace_1', {
        pipelineId: 'pipeline_specific',
      });

      expect(contacts).toHaveLength(1);
      expect(contacts[0].id).toBe('entity_filtered');
      expect(contacts[0].pipelineId).toBe('pipeline_specific');
    });

    it('should filter legacy schools by workspaceIds array', async () => {
      const mockSchool: School = {
        id: 'school_filtered',
        name: 'Filtered School',
        slug: 'filtered-school',
        workspaceIds: ['workspace_1', 'workspace_2'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'legacy',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          };
        } else if (collectionName === 'schools') {
          const whereMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const workspaceCall = calls.find((call: any) => call[0] === 'workspaceIds');
              if (workspaceCall && workspaceCall[2] === 'workspace_1') {
                return Promise.resolve({
                  docs: [
                    {
                      id: 'school_filtered',
                      data: () => mockSchool,
                    },
                  ],
                });
              }
              return Promise.resolve({ docs: [] });
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const contacts = await getWorkspaceContacts('workspace_1');

      expect(contacts).toHaveLength(1);
      expect(contacts[0].id).toBe('school_filtered');
    });
  });

  describe('5. Caching Behavior', () => {
    it('should use cache for repeated calls', async () => {
      const mockEntity: Entity = {
        id: 'entity_cached',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Cached Entity',
        slug: 'cached-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_cached',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_cached',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'New',
        status: 'active',
        workspaceTags: [],
        displayName: 'Cached Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let firestoreCallCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => {
                firestoreCallCount++;
                return Promise.resolve({
                  exists: true,
                  id: 'entity_cached',
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
              empty: false,
              docs: [
                {
                  id: 'we_cached',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // First call - should hit Firestore
      const result1 = await resolveContact({ entityId: 'entity_cached' }, 'workspace_1');
      expect(result1).not.toBeNull();
      expect(firestoreCallCount).toBe(1);

      // Second call - should use cache
      const result2 = await resolveContact({ entityId: 'entity_cached' }, 'workspace_1');
      expect(result2).not.toBeNull();
      expect(firestoreCallCount).toBe(1); // No additional Firestore call

      // Third call - should still use cache
      const result3 = await resolveContact({ entityId: 'entity_cached' }, 'workspace_1');
      expect(result3).not.toBeNull();
      expect(firestoreCallCount).toBe(1); // No additional Firestore call
    });

    it('should invalidate cache after clearContactCache', async () => {
      const mockEntity: Entity = {
        id: 'entity_clear_cache',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Clear Cache Entity',
        slug: 'clear-cache-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_clear_cache',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_clear_cache',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'New',
        status: 'active',
        workspaceTags: [],
        displayName: 'Clear Cache Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let firestoreCallCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => {
                firestoreCallCount++;
                return Promise.resolve({
                  exists: true,
                  id: 'entity_clear_cache',
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
              empty: false,
              docs: [
                {
                  id: 'we_clear_cache',
                  data: () => mockWorkspaceEntity,
                },
              ],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // First call
      await resolveContact({ entityId: 'entity_clear_cache' }, 'workspace_1');
      expect(firestoreCallCount).toBe(1);

      // Second call - uses cache
      await resolveContact({ entityId: 'entity_clear_cache' }, 'workspace_1');
      expect(firestoreCallCount).toBe(1);

      // Clear cache
      clearContactCache();

      // Third call - should hit Firestore again
      await resolveContact({ entityId: 'entity_clear_cache' }, 'workspace_1');
      expect(firestoreCallCount).toBe(2);
    });

    it('should have separate cache entries for different workspaces', async () => {
      const mockEntity: Entity = {
        id: 'entity_multi_cache',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Multi Cache Entity',
        slug: 'multi-cache-entity',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity1: WorkspaceEntity = {
        id: 'we_cache_ws1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_multi_cache',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'Stage 1',
        status: 'active',
        workspaceTags: ['ws1'],
        displayName: 'Multi Cache Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity2: WorkspaceEntity = {
        id: 'we_cache_ws2',
        organizationId: 'org_1',
        workspaceId: 'workspace_2',
        entityId: 'entity_multi_cache',
        entityType: 'institution',
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        currentStageName: 'Stage 2',
        status: 'active',
        workspaceTags: ['ws2'],
        displayName: 'Multi Cache Entity',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let firestoreCallCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => {
                firestoreCallCount++;
                return Promise.resolve({
                  exists: true,
                  id: 'entity_multi_cache',
                  data: () => mockEntity,
                });
              }),
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          const whereMock = vi.fn().mockReturnThis();
          const limitMock = vi.fn().mockReturnThis();
          return {
            where: whereMock,
            limit: limitMock,
            get: vi.fn().mockImplementation(() => {
              const calls = whereMock.mock.calls;
              const workspaceCall = calls.find((call: any) => call[0] === 'workspaceId');
              if (workspaceCall && workspaceCall[2] === 'workspace_1') {
                return Promise.resolve({
                  empty: false,
                  docs: [
                    {
                      id: 'we_cache_ws1',
                      data: () => mockWorkspaceEntity1,
                    },
                  ],
                });
              } else if (workspaceCall && workspaceCall[2] === 'workspace_2') {
                return Promise.resolve({
                  empty: false,
                  docs: [
                    {
                      id: 'we_cache_ws2',
                      data: () => mockWorkspaceEntity2,
                    },
                  ],
                });
              }
              return Promise.resolve({ empty: true, docs: [] });
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // Call for workspace_1
      const result1 = await resolveContact({ entityId: 'entity_multi_cache' }, 'workspace_1');
      expect(result1?.tags).toEqual(['ws1']);
      expect(firestoreCallCount).toBe(1);

      // Call for workspace_2 - should hit Firestore (different cache key)
      const result2 = await resolveContact({ entityId: 'entity_multi_cache' }, 'workspace_2');
      expect(result2?.tags).toEqual(['ws2']);
      expect(firestoreCallCount).toBe(2);

      // Call for workspace_1 again - should use cache
      const result3 = await resolveContact({ entityId: 'entity_multi_cache' }, 'workspace_1');
      expect(result3?.tags).toEqual(['ws1']);
      expect(firestoreCallCount).toBe(2);

      // Call for workspace_2 again - should use cache
      const result4 = await resolveContact({ entityId: 'entity_multi_cache' }, 'workspace_2');
      expect(result4?.tags).toEqual(['ws2']);
      expect(firestoreCallCount).toBe(2);
    });
  });

  describe('Additional Functions', () => {
    describe('contactExists', () => {
      it('should return true if entity exists', async () => {
        const mockCollection = vi.fn(() => ({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
            }),
          }),
        }));

        (adminDb.collection as any) = mockCollection;

        const exists = await contactExists({ entityId: 'entity_exists' });

        expect(exists).toBe(true);
      });

      it('should return true if school exists', async () => {
        const mockCollection = vi.fn(() => ({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
            }),
          }),
        }));

        (adminDb.collection as any) = mockCollection;

        const exists = await contactExists({ entityId: 'school_exists' });

        expect(exists).toBe(true);
      });

      it('should return false if neither entity nor school exists', async () => {
        const mockCollection = vi.fn(() => ({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: false,
            }),
          }),
        }));

        (adminDb.collection as any) = mockCollection;

        const exists = await contactExists({ entityId: 'nonexistent' });

        expect(exists).toBe(false);
      });

      it('should return false on error', async () => {
        const mockCollection = vi.fn(() => ({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error('Firestore error')),
          }),
        }));

        (adminDb.collection as any) = mockCollection;

        const exists = await contactExists({ entityId: 'error_entity' });

        expect(exists).toBe(false);
      });
    });

    describe('searchContacts', () => {
      it('should search contacts by name in workspace_entities', async () => {
        const mockEntity: Entity = {
          id: 'entity_search',
          organizationId: 'org_1',
          entityType: 'institution',
          name: 'Searchable Entity',
          slug: 'searchable-entity',
          contacts: [],
          globalTags: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const mockWorkspaceEntity: WorkspaceEntity = {
          id: 'we_search',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          entityId: 'entity_search',
          entityType: 'institution',
          pipelineId: 'pipeline_1',
          stageId: 'stage_1',
          currentStageName: 'New',
          status: 'active',
          workspaceTags: [],
          displayName: 'Searchable Entity',
          addedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const mockCollection = vi.fn((collectionName: string) => {
          if (collectionName === 'workspace_entities') {
            const whereMock = vi.fn().mockReturnThis();
            const limitMock = vi.fn().mockReturnThis();
            return {
              where: whereMock,
              limit: limitMock,
              get: vi.fn().mockImplementation(() => {
                const calls = whereMock.mock.calls;
                const entityIdCall = calls.find((call: any) => call[0] === 'entityId');
                const workspaceIdCall = calls.find((call: any) => call[0] === 'workspaceId');
                
                // For resolveFromEntity calls (entityId + workspaceId)
                if (entityIdCall && workspaceIdCall) {
                  return Promise.resolve({
                    empty: false,
                    docs: [
                      {
                        id: 'we_search',
                        data: () => mockWorkspaceEntity,
                      },
                    ],
                  });
                }
                
                // For searchContacts calls (just workspaceId)
                return Promise.resolve({
                  docs: [
                    {
                      id: 'we_search',
                      data: () => mockWorkspaceEntity,
                    },
                  ],
                });
              }),
            };
          } else if (collectionName === 'entities') {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  id: 'entity_search',
                  data: () => mockEntity,
                }),
              }),
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [
                  {
                    id: 'entity_search',
                    data: () => mockEntity,
                  },
                ],
              }),
            };
          } else if (collectionName === 'schools') {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({ docs: [] }),
            };
          }
          return {};
        });

        (adminDb.collection as any) = mockCollection;

        const results = await searchContacts('workspace_1', 'Searchable');

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('entity_search');
        expect(results[0].name).toBe('Searchable Entity');
      });

      it('should search contacts by name in legacy schools', async () => {
        const mockSchool: School = {
          id: 'school_search',
          name: 'Searchable School',
          slug: 'searchable-school',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline_1',
          focalPersons: [],
          migrationStatus: 'legacy',
          createdAt: '2024-01-01T00:00:00Z',
        };

        const mockCollection = vi.fn((collectionName: string) => {
          if (collectionName === 'workspace_entities') {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({ docs: [] }),
            };
          } else if (collectionName === 'schools') {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    id: 'school_search',
                    data: () => mockSchool,
                  },
                ],
              }),
            };
          }
          return {};
        });

        (adminDb.collection as any) = mockCollection;

        const results = await searchContacts('workspace_1', 'Searchable');

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('school_search');
        expect(results[0].name).toBe('Searchable School');
      });

      it('should skip migrated schools in search', async () => {
        const mockSchool: School = {
          id: 'school_migrated_search',
          name: 'Migrated Searchable School',
          slug: 'migrated-searchable-school',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline_1',
          focalPersons: [],
          migrationStatus: 'migrated',
          createdAt: '2024-01-01T00:00:00Z',
        };

        const mockCollection = vi.fn((collectionName: string) => {
          if (collectionName === 'workspace_entities') {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({ docs: [] }),
            };
          } else if (collectionName === 'schools') {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    id: 'school_migrated_search',
                    data: () => mockSchool,
                  },
                ],
              }),
            };
          }
          return {};
        });

        (adminDb.collection as any) = mockCollection;

        const results = await searchContacts('workspace_1', 'Migrated');

        expect(results).toHaveLength(0);
      });

      it('should return empty array on error', async () => {
        const mockCollection = vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockRejectedValue(new Error('Firestore error')),
        }));

        (adminDb.collection as any) = mockCollection;

        const results = await searchContacts('workspace_1', 'error');

        expect(results).toEqual([]);
      });
    });
  });
});
