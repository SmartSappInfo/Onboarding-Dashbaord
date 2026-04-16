/**
 * Unit Tests for Workspace-Entity Actions
 * 
 * Tests the three core server actions for managing workspace-entity relationships:
 * 1. linkEntityToWorkspaceAction - Creates workspace-entity links with scope validation
 * 2. unlinkEntityFromWorkspaceAction - Removes workspace-entity links
 * 3. updateWorkspaceEntityAction - Updates workspace-specific fields
 * 
 * Key test scenarios:
 * - ScopeGuard enforcement (entity.entityType === workspace.contactScope)
 * - Workspace scope locking after first entity
 * - Denormalized field synchronization
 * - Activity logging
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminDb } from '../firebase-admin';
import { logActivity } from '../activity-logger';
import {
  linkEntityToWorkspaceAction,
  unlinkEntityFromWorkspaceAction,
  updateWorkspaceEntityAction,
} from '../workspace-entity-actions';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('linkEntityToWorkspaceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully link an entity to a workspace with matching scope', async () => {
    const mockEntity = {
      id: 'entity_123',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [
        { name: 'John Doe', email: 'john@test.com', phone: '+1234567890', type: 'Principal', isSignatory: true },
      ],
      globalTags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockWorkspace = {
      id: 'workspace_1',
      organizationId: 'org_1',
      name: 'Onboarding',
      contactScope: 'institution',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockStage = {
      id: 'stage_1',
      name: 'Initial Contact',
    };

    // Mock Firestore operations
    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockWorkspaceGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'workspace_1',
      data: () => mockWorkspace,
    });

    const mockExistingLinkQuery = vi.fn().mockResolvedValue({
      empty: true,
    });

    const mockWorkspaceEntitiesQuery = vi.fn().mockResolvedValue({
      empty: true, // First entity in workspace
    });

    const mockStageGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => mockStage,
    });

    const mockWorkspaceEntityAdd = vi.fn().mockResolvedValue({
      id: 'workspace_entity_1',
    });

    const mockWorkspaceUpdate = vi.fn().mockResolvedValue({});

    // Setup mock chain
    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      if (collectionName === 'workspaces') {
        return {
          doc: () => ({
            get: mockWorkspaceGet,
            update: mockWorkspaceUpdate,
          }),
        };
      }
      if (collectionName === 'workspace_entities') {
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: mockExistingLinkQuery,
              }),
            }),
            limit: () => ({
              get: mockWorkspaceEntitiesQuery,
            }),
          }),
          add: mockWorkspaceEntityAdd,
        };
      }
      if (collectionName === 'stages') {
        return {
          doc: () => ({
            get: mockStageGet,
          }),
        };
      }
      return {};
    });

    const result = await linkEntityToWorkspaceAction({
      entityId: 'entity_123',
      workspaceId: 'workspace_1',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      userId: 'user_1',
    });

    expect(result.success).toBe(true);
    expect(result.workspaceEntityId).toBe('workspace_entity_1');
    expect(result.scopeLocked).toBe(true);

    // Verify workspace was locked
    expect(mockWorkspaceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeLocked: true,
      })
    );

    // Verify activity was logged
    expect(logActivity).toHaveBeenCalledTimes(2); // scope_locked + entity_linked
  });

  it('should reject linking when entity type does not match workspace scope', async () => {
    const mockEntity = {
      id: 'entity_123',
      organizationId: 'org_1',
      entityType: 'family',
      name: 'Test Family',
      contacts: [],
      globalTags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockWorkspace = {
      id: 'workspace_1',
      organizationId: 'org_1',
      name: 'Onboarding',
      contactScope: 'institution',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockWorkspaceGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'workspace_1',
      data: () => mockWorkspace,
    });

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      if (collectionName === 'workspaces') {
        return {
          doc: () => ({
            get: mockWorkspaceGet,
          }),
        };
      }
      return {};
    });

    const result = await linkEntityToWorkspaceAction({
      entityId: 'entity_123',
      workspaceId: 'workspace_1',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('family');
    expect(result.error).toContain('institution');
    expect(result.code).toBe('SCOPE_MISMATCH');

    // Verify scope violation was logged
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scope_violation',
      })
    );
  });

  it('should return error if entity does not exist', async () => {
    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: false,
    });

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      return {};
    });

    const result = await linkEntityToWorkspaceAction({
      entityId: 'nonexistent',
      workspaceId: 'workspace_1',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Entity not found');
  });

  it('should return error if workspace does not exist', async () => {
    const mockEntity = {
      id: 'entity_123',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      contacts: [],
      globalTags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockWorkspaceGet = vi.fn().mockResolvedValue({
      exists: false,
    });

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      if (collectionName === 'workspaces') {
        return {
          doc: () => ({
            get: mockWorkspaceGet,
          }),
        };
      }
      return {};
    });

    const result = await linkEntityToWorkspaceAction({
      entityId: 'entity_123',
      workspaceId: 'nonexistent',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workspace not found');
  });
});

describe('unlinkEntityFromWorkspaceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully unlink an entity from a workspace', async () => {
    const mockWorkspaceEntity = {
      id: 'workspace_entity_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_123',
      entityType: 'institution',
      displayName: 'Test School',
      status: 'active',
      workspaceTags: [],
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockEntity = {
      id: 'entity_123',
      slug: 'test-school',
    };

    const mockWorkspaceEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'workspace_entity_1',
      data: () => mockWorkspaceEntity,
    });

    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockWorkspaceEntityDelete = vi.fn().mockResolvedValue({});

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return {
          doc: () => ({
            get: mockWorkspaceEntityGet,
            delete: mockWorkspaceEntityDelete,
          }),
        };
      }
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      return {};
    });

    const result = await unlinkEntityFromWorkspaceAction({
      workspaceEntityId: 'workspace_entity_1',
      userId: 'user_1',
    });

    expect(result.success).toBe(true);

    // Verify workspace_entities document was deleted
    expect(mockWorkspaceEntityDelete).toHaveBeenCalled();

    // Verify activity was logged
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'entity_unlinked_from_workspace',
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
      })
    );
  });

  it('should return error if workspace_entities record does not exist', async () => {
    const mockWorkspaceEntityGet = vi.fn().mockResolvedValue({
      exists: false,
    });

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return {
          doc: () => ({
            get: mockWorkspaceEntityGet,
          }),
        };
      }
      return {};
    });

    const result = await unlinkEntityFromWorkspaceAction({
      workspaceEntityId: 'nonexistent',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workspace-entity relationship not found');
  });
});

describe('updateWorkspaceEntityAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully update workspace-specific fields', async () => {
    const mockWorkspaceEntity = {
      id: 'workspace_entity_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_123',
      entityType: 'institution',
      displayName: 'Test School',
      status: 'active',
      workspaceTags: [],
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockEntity = {
      id: 'entity_123',
      slug: 'test-school',
    };

    const mockStage = {
      id: 'stage_2',
      name: 'Contract Review',
    };

    const mockWorkspaceEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'workspace_entity_1',
      data: () => mockWorkspaceEntity,
    });

    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockStageGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => mockStage,
    });

    const mockWorkspaceEntityUpdate = vi.fn().mockResolvedValue({});

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return {
          doc: () => ({
            get: mockWorkspaceEntityGet,
            update: mockWorkspaceEntityUpdate,
          }),
        };
      }
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      if (collectionName === 'stages') {
        return {
          doc: () => ({
            get: mockStageGet,
          }),
        };
      }
      return {};
    });

    const result = await updateWorkspaceEntityAction({
      workspaceEntityId: 'workspace_entity_1',
      stageId: 'stage_2',
      workspaceTags: ['tag_1', 'tag_2'],
      userId: 'user_1',
    });

    expect(result.success).toBe(true);

    // Verify workspace_entities document was updated
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_2',
        currentStageName: 'Contract Review',
        workspaceTags: ['tag_1', 'tag_2'],
      })
    );

    // Verify activity was logged
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace_entity_updated',
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
      })
    );
  });

  it('should return error if workspace_entities record does not exist', async () => {
    const mockWorkspaceEntityGet = vi.fn().mockResolvedValue({
      exists: false,
    });

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return {
          doc: () => ({
            get: mockWorkspaceEntityGet,
          }),
        };
      }
      return {};
    });

    const result = await updateWorkspaceEntityAction({
      workspaceEntityId: 'nonexistent',
      stageId: 'stage_2',
      userId: 'user_1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workspace-entity relationship not found');
  });

  it('should update only provided fields', async () => {
    const mockWorkspaceEntity = {
      id: 'workspace_entity_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_123',
      entityType: 'institution',
      displayName: 'Test School',
      status: 'active',
      workspaceTags: ['tag_1'],
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const mockEntity = {
      id: 'entity_123',
      slug: 'test-school',
    };

    const mockWorkspaceEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'workspace_entity_1',
      data: () => mockWorkspaceEntity,
    });

    const mockEntityGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'entity_123',
      data: () => mockEntity,
    });

    const mockWorkspaceEntityUpdate = vi.fn().mockResolvedValue({});

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return {
          doc: () => ({
            get: mockWorkspaceEntityGet,
            update: mockWorkspaceEntityUpdate,
          }),
        };
      }
      if (collectionName === 'entities') {
        return {
          doc: () => ({
            get: mockEntityGet,
          }),
        };
      }
      return {};
    });

    const result = await updateWorkspaceEntityAction({
      workspaceEntityId: 'workspace_entity_1',
      status: 'archived',
      userId: 'user_1',
    });

    expect(result.success).toBe(true);

    // Verify only status and updatedAt were updated
    const updateCall = mockWorkspaceEntityUpdate.mock.calls[0][0];
    expect(updateCall).toHaveProperty('status', 'archived');
    expect(updateCall).toHaveProperty('updatedAt');
    expect(updateCall).not.toHaveProperty('stageId');
    expect(updateCall).not.toHaveProperty('pipelineId');
    expect(updateCall).not.toHaveProperty('workspaceTags');
  });
});
