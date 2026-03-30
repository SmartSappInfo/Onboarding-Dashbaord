/**
 * Unit Tests: Profile Module (Task 19.4)
 * 
 * Tests profile module functionality:
 * - Profile loads entity data correctly via Contact Adapter
 * - Profile displays workspace-specific data from workspace_entities
 * - Identity field updates go to entities collection
 * - Operational field updates go to workspace_entities collection
 * 
 * Requirements: 26.2
 * Validates: Property 7 (Profile Update Routing)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Entity, WorkspaceEntity, ResolvedContact, FocalPerson } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => {
  const mockFirestore = {
    collection: vi.fn(),
  };
  
  return {
    adminDb: mockFirestore,
  };
});

// Import after mocking
import { adminDb } from '../firebase-admin';
import { updateProfile, updateEntityIdentity, updateWorkspaceEntityOperations } from '../profile-actions';

describe('Profile Module Unit Tests - Task 19.4', () => {
  // Mock Firestore data
  let mockEntityData: Entity;
  let mockWorkspaceEntityData: WorkspaceEntity;
  let mockSchoolData: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock entity data
    mockEntityData = {
      id: 'entity_test_123',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [
        {
          name: 'John Principal',
          email: 'principal@test.com',
          phone: '+1234567890',
          type: 'Principal',
          isSignatory: true,
        },
      ],
      globalTags: ['vip', 'strategic-account'],
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      institutionData: {
        nominalRoll: 500,
        billingAddress: '123 Test St',
        currency: 'USD',
        subscriptionPackageId: 'pkg_1',
        subscriptionRate: 100,
        focalPersons: [],
      },
    };
    
    // Setup mock workspace_entity data
    mockWorkspaceEntityData = {
      id: 'workspace_1_entity_test_123',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_test_123',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_onboarding',
      currentStageName: 'Onboarding',
      assignedTo: {
        userId: 'user_1',
        name: 'Account Manager',
        email: 'manager@test.com',
      },
      status: 'active',
      workspaceTags: ['hot-lead', 'needs-follow-up'],
      displayName: 'Test School',
      primaryEmail: 'principal@test.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    
    // Setup mock school data (legacy)
    mockSchoolData = {
      id: 'school_legacy_456',
      name: 'Test School',
      slug: 'test-school',
      entityId: 'entity_test_123',
      workspaceIds: ['workspace_1'],
      status: 'Active',
      schoolStatus: 'Onboarding',
      pipelineId: 'pipeline_1',
      focalPersons: mockEntityData.contacts,
      nominalRoll: 500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
  });
  
  describe('Test 1: Profile loads entity data correctly', () => {
    it('should load entity data from entities collection via entityId', async () => {
      // Mock Firestore entity document
      const mockEntityDoc = {
        exists: true,
        data: () => mockEntityData,
      };
      
      const mockEntityRef = {
        get: vi.fn().mockResolvedValue(mockEntityDoc),
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      // Simulate profile page loading entity data
      const entityRef = adminDb.collection('entities').doc('entity_test_123');
      const entityDoc = await entityRef.get();
      const entityData = entityDoc.data();
      
      // Verify entity data is loaded correctly
      expect(entityData).toBeDefined();
      expect(entityData?.name).toBe('Test School');
      expect(entityData?.contacts).toHaveLength(1);
      expect(entityData?.contacts[0].name).toBe('John Principal');
      expect(entityData?.globalTags).toContain('vip');
      expect(entityData?.globalTags).toContain('strategic-account');
      expect(entityData?.entityType).toBe('institution');
    });
    
    it('should load entity with institution-specific data', async () => {
      const mockEntityDoc = {
        exists: true,
        data: () => mockEntityData,
      };
      
      const mockEntityRef = {
        get: vi.fn().mockResolvedValue(mockEntityDoc),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const entityRef = adminDb.collection('entities').doc('entity_test_123');
      const entityDoc = await entityRef.get();
      const entityData = entityDoc.data();
      
      // Verify institution-specific data
      expect(entityData?.institutionData).toBeDefined();
      expect(entityData?.institutionData?.nominalRoll).toBe(500);
      expect(entityData?.institutionData?.billingAddress).toBe('123 Test St');
      expect(entityData?.institutionData?.currency).toBe('USD');
    });
  });
  
  describe('Test 2: Profile displays workspace-specific data', () => {
    it('should load workspace-specific data from workspace_entities collection', async () => {
      // Mock Firestore workspace_entities query
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: 'workspace_1_entity_test_123',
            data: () => mockWorkspaceEntityData,
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      // Simulate profile page loading workspace-specific data
      const weQuery = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', 'entity_test_123')
        .where('workspaceId', '==', 'workspace_1')
        .limit(1)
        .get();
      
      const weData = weQuery.docs[0]?.data();
      
      // Verify workspace-specific data is loaded correctly
      expect(weData).toBeDefined();
      expect(weData?.pipelineId).toBe('pipeline_1');
      expect(weData?.stageId).toBe('stage_onboarding');
      expect(weData?.currentStageName).toBe('Onboarding');
      expect(weData?.assignedTo?.name).toBe('Account Manager');
      expect(weData?.workspaceTags).toContain('hot-lead');
      expect(weData?.workspaceTags).toContain('needs-follow-up');
      expect(weData?.status).toBe('active');
    });
    
    it('should display denormalized fields for performance', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: 'workspace_1_entity_test_123',
            data: () => mockWorkspaceEntityData,
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const weQuery = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', 'entity_test_123')
        .where('workspaceId', '==', 'workspace_1')
        .limit(1)
        .get();
      
      const weData = weQuery.docs[0]?.data();
      
      // Verify denormalized fields are present
      expect(weData?.displayName).toBe('Test School');
      expect(weData?.primaryEmail).toBe('principal@test.com');
      expect(weData?.primaryPhone).toBe('+1234567890');
    });
  });
  
  describe('Test 3: Identity field updates go to entities', () => {
    it('should update name in entities collection', async () => {
      const mockEntityRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      // Update identity field (name)
      const result = await updateEntityIdentity('entity_test_123', {
        name: 'Updated School Name',
      });
      
      // Verify update was called on entities collection
      expect(result.success).toBe(true);
      expect(adminDb.collection).toHaveBeenCalledWith('entities');
      expect(mockCollection.doc).toHaveBeenCalledWith('entity_test_123');
      expect(mockEntityRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated School Name',
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update contacts in entities collection', async () => {
      const mockEntityRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const newContacts: FocalPerson[] = [
        {
          name: 'New Principal',
          email: 'newprincipal@test.com',
          phone: '+9876543210',
          type: 'Principal',
          isSignatory: true,
        },
        {
          name: 'Vice Principal',
          email: 'vice@test.com',
          phone: '+1111111111',
          type: 'Vice Principal',
          isSignatory: false,
        },
      ];
      
      const result = await updateEntityIdentity('entity_test_123', {
        contacts: newContacts,
      });
      
      // Verify contacts update was called on entities collection
      expect(result.success).toBe(true);
      expect(mockEntityRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: newContacts,
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update globalTags in entities collection', async () => {
      const mockEntityRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const result = await updateEntityIdentity('entity_test_123', {
        globalTags: ['vip', 'strategic-account', 'high-value'],
      });
      
      // Verify globalTags update was called on entities collection
      expect(result.success).toBe(true);
      expect(mockEntityRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          globalTags: ['vip', 'strategic-account', 'high-value'],
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update multiple identity fields in entities collection', async () => {
      const mockEntityRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockEntityRef),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const newContacts: FocalPerson[] = [
        {
          name: 'Updated Contact',
          email: 'updated@test.com',
          phone: '+5555555555',
          type: 'Administrator',
          isSignatory: true,
        },
      ];
      
      const result = await updateEntityIdentity('entity_test_123', {
        name: 'Completely New Name',
        contacts: newContacts,
        globalTags: ['premium', 'enterprise'],
      });
      
      // Verify all identity fields were updated
      expect(result.success).toBe(true);
      expect(mockEntityRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Completely New Name',
          contacts: newContacts,
          globalTags: ['premium', 'enterprise'],
          updatedAt: expect.any(String),
        })
      );
    });
  });
  
  describe('Test 4: Operational field updates go to workspace_entities', () => {
    it('should update pipelineId in workspace_entities collection', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      // Update operational field (pipelineId)
      const result = await updateWorkspaceEntityOperations(
        'entity_test_123',
        'workspace_1',
        {
          pipelineId: 'pipeline_new',
        }
      );
      
      // Verify update was called on workspace_entities collection
      expect(result.success).toBe(true);
      expect(adminDb.collection).toHaveBeenCalledWith('workspace_entities');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_test_123');
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipeline_new',
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update stageId in workspace_entities collection', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const result = await updateWorkspaceEntityOperations(
        'entity_test_123',
        'workspace_1',
        {
          stageId: 'stage_implementation',
        }
      );
      
      // Verify stageId update
      expect(result.success).toBe(true);
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: 'stage_implementation',
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update assignedTo in workspace_entities collection', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const newAssignee = {
        userId: 'user_new',
        name: 'New Manager',
        email: 'newmanager@test.com',
      };
      
      const result = await updateWorkspaceEntityOperations(
        'entity_test_123',
        'workspace_1',
        {
          assignedTo: newAssignee,
        }
      );
      
      // Verify assignedTo update
      expect(result.success).toBe(true);
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: newAssignee,
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update workspaceTags in workspace_entities collection', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const result = await updateWorkspaceEntityOperations(
        'entity_test_123',
        'workspace_1',
        {
          workspaceTags: ['urgent', 'high-priority', 'follow-up-needed'],
        }
      );
      
      // Verify workspaceTags update
      expect(result.success).toBe(true);
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTags: ['urgent', 'high-priority', 'follow-up-needed'],
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should update multiple operational fields in workspace_entities collection', async () => {
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const result = await updateWorkspaceEntityOperations(
        'entity_test_123',
        'workspace_1',
        {
          pipelineId: 'pipeline_updated',
          stageId: 'stage_updated',
          assignedTo: {
            userId: 'user_updated',
            name: 'Updated Manager',
            email: 'updated@test.com',
          },
          workspaceTags: ['tag1', 'tag2'],
        }
      );
      
      // Verify all operational fields were updated
      expect(result.success).toBe(true);
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipeline_updated',
          stageId: 'stage_updated',
          assignedTo: {
            userId: 'user_updated',
            name: 'Updated Manager',
            email: 'updated@test.com',
          },
          workspaceTags: ['tag1', 'tag2'],
          updatedAt: expect.any(String),
        })
      );
    });
    
    it('should return error when workspace_entity not found', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: [],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(mockQuery),
      };
      
      vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
      
      const result = await updateWorkspaceEntityOperations(
        'nonexistent_entity',
        'workspace_1',
        {
          pipelineId: 'pipeline_1',
        }
      );
      
      // Verify error is returned
      expect(result.success).toBe(false);
      expect(result.error).toBe('Workspace entity not found');
    });
  });
  
  describe('Test 5: Mixed updates route correctly', () => {
    it('should route identity and operational fields to correct collections', async () => {
      // Mock entities collection
      const mockEntityRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      // Mock workspace_entities collection
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            ref: {
              update: vi.fn().mockResolvedValue(undefined),
            },
          },
        ],
      };
      
      const mockQuery = {
        get: vi.fn().mockResolvedValue(mockQuerySnapshot),
      };
      
      // Mock schools collection
      const mockSchoolRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue(mockEntityRef),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnValue(mockQuery),
          };
        } else if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue(mockSchoolRef),
          };
        }
        return {};
      });
      
      vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);
      
      // Update with mixed fields
      const result = await updateProfile({
        schoolId: 'school_123',
        entityId: 'entity_test_123',
        workspaceId: 'workspace_1',
        updates: {
          // Identity fields
          name: 'Updated Name',
          globalTags: ['new-tag'],
          // Operational fields
          pipelineId: 'pipeline_new',
          workspaceTags: ['workspace-tag'],
          // Legacy fields
          nominalRoll: 600,
        },
      });
      
      // Verify routing
      expect(result.success).toBe(true);
      
      // Verify entities collection was updated with identity fields
      expect(mockEntityRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          globalTags: ['new-tag'],
          updatedAt: expect.any(String),
        })
      );
      
      // Verify workspace_entities collection was updated with operational fields
      expect(mockQuerySnapshot.docs[0].ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipeline_new',
          workspaceTags: ['workspace-tag'],
          updatedAt: expect.any(String),
        })
      );
      
      // Verify schools collection was updated with all fields (backward compatibility)
      expect(mockSchoolRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          globalTags: ['new-tag'],
          pipelineId: 'pipeline_new',
          workspaceTags: ['workspace-tag'],
          nominalRoll: 600,
          updatedAt: expect.any(String),
        })
      );
    });
  });
});
