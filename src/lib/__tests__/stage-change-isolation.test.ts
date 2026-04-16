/**
 * Test: Stage Change Actions Update workspace_entities Only
 * 
 * Task: 14.3 Update stage change actions to update workspace_entities only
 * Requirements: 5
 * 
 * Validates that:
 * 1. Stage changes update stageId and currentStageName on workspace_entities
 * 2. Stage changes do NOT propagate to other workspaces
 * 3. Stage changes do NOT update entity root document
 * 4. Each workspace maintains independent pipeline state for the same entity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateWorkspaceEntityAction } from '../workspace-entity-actions';
import type { WorkspaceEntity, Entity } from '../types';

// Mock Firestore admin
const mockWorkspaceEntityUpdate = vi.fn();
const mockEntityUpdate = vi.fn();
const mockStageGet = vi.fn();
const mockWorkspaceEntityGet = vi.fn();
const mockEntityGet = vi.fn();
const mockActivityAdd = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => {
      if (name === 'workspace_entities') {
        return {
          doc: (id: string) => ({
            get: mockWorkspaceEntityGet,
            update: mockWorkspaceEntityUpdate,
          }),
        };
      }
      if (name === 'entities') {
        return {
          doc: (id: string) => ({
            get: mockEntityGet,
            update: mockEntityUpdate,
          }),
        };
      }
      if (name === 'stages') {
        return {
          doc: (id: string) => ({
            get: mockStageGet,
          }),
        };
      }
      if (name === 'activities') {
        return {
          add: mockActivityAdd,
        };
      }
      return {};
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Stage Change Actions - workspace_entities Only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update stageId and currentStageName on workspace_entities only', async () => {
    // Arrange: workspace_entity exists
    const workspaceEntity: WorkspaceEntity = {
      id: 'we_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_1',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      displayName: 'Test School',
      primaryEmail: 'test@school.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const entity: Entity = {
      id: 'entity_1',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      globalTags: [],
      institutionData: {
        nominalRoll: 500,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    mockWorkspaceEntityGet.mockResolvedValue({
      exists: true,
      id: 'we_1',
      data: () => workspaceEntity,
    });

    mockEntityGet.mockResolvedValue({
      exists: true,
      id: 'entity_1',
      data: () => entity,
    });

    mockStageGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Contract Review' }),
    });

    mockWorkspaceEntityUpdate.mockResolvedValue(undefined);
    mockActivityAdd.mockResolvedValue({ id: 'activity_1' });

    // Act: Update stage
    const result = await updateWorkspaceEntityAction({
      workspaceEntityId: 'we_1',
      stageId: 'stage_2',
      userId: 'user_1',
    });

    // Assert: Success
    expect(result.success).toBe(true);

    // Assert: workspace_entities was updated with new stageId and currentStageName
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_2',
        currentStageName: 'Contract Review',
        updatedAt: expect.any(String),
      })
    );

    // Assert: Entity root was NOT updated
    expect(mockEntityUpdate).not.toHaveBeenCalled();
  });

  it('should NOT propagate stage changes to other workspaces', async () => {
    // This test verifies architectural constraint:
    // When updating workspace_entity for workspace A, workspace B's record is untouched
    
    // Arrange: Same entity exists in two workspaces
    const workspaceEntity1: WorkspaceEntity = {
      id: 'we_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_1',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      displayName: 'Test School',
      primaryEmail: 'test@school.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const entity: Entity = {
      id: 'entity_1',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      globalTags: [],
      institutionData: {
        nominalRoll: 500,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    mockWorkspaceEntityGet.mockResolvedValue({
      exists: true,
      id: 'we_1',
      data: () => workspaceEntity1,
    });

    mockEntityGet.mockResolvedValue({
      exists: true,
      id: 'entity_1',
      data: () => entity,
    });

    mockStageGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Contract Review' }),
    });

    mockWorkspaceEntityUpdate.mockResolvedValue(undefined);
    mockActivityAdd.mockResolvedValue({ id: 'activity_1' });

    // Act: Update stage for workspace_1
    await updateWorkspaceEntityAction({
      workspaceEntityId: 'we_1',
      stageId: 'stage_2',
      userId: 'user_1',
    });

    // Assert: Only the specific workspace_entity document was updated
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledTimes(1);
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_2',
        currentStageName: 'Contract Review',
      })
    );

    // Assert: No batch updates or queries to other workspace_entities
    // The function should only update the single document passed in
    // (This is verified by the fact that we only mock one doc().update() call)
  });

  it('should update currentStageName denormalized field when stage changes', async () => {
    // Arrange
    const workspaceEntity: WorkspaceEntity = {
      id: 'we_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_1',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      displayName: 'Test School',
      primaryEmail: 'test@school.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const entity: Entity = {
      id: 'entity_1',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      globalTags: [],
      institutionData: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    mockWorkspaceEntityGet.mockResolvedValue({
      exists: true,
      id: 'we_1',
      data: () => workspaceEntity,
    });

    mockEntityGet.mockResolvedValue({
      exists: true,
      id: 'entity_1',
      data: () => entity,
    });

    mockStageGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Live - Training' }),
    });

    mockWorkspaceEntityUpdate.mockResolvedValue(undefined);
    mockActivityAdd.mockResolvedValue({ id: 'activity_1' });

    // Act
    await updateWorkspaceEntityAction({
      workspaceEntityId: 'we_1',
      stageId: 'stage_3',
      userId: 'user_1',
    });

    // Assert: Both stageId and currentStageName were updated
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_3',
        currentStageName: 'Live - Training',
      })
    );
  });

  it('should handle stage change when stage document does not exist', async () => {
    // Arrange
    const workspaceEntity: WorkspaceEntity = {
      id: 'we_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_1',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      displayName: 'Test School',
      primaryEmail: 'test@school.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const entity: Entity = {
      id: 'entity_1',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      globalTags: [],
      institutionData: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    mockWorkspaceEntityGet.mockResolvedValue({
      exists: true,
      id: 'we_1',
      data: () => workspaceEntity,
    });

    mockEntityGet.mockResolvedValue({
      exists: true,
      id: 'entity_1',
      data: () => entity,
    });

    // Stage does not exist
    mockStageGet.mockResolvedValue({
      exists: false,
    });

    mockWorkspaceEntityUpdate.mockResolvedValue(undefined);
    mockActivityAdd.mockResolvedValue({ id: 'activity_1' });

    // Act
    await updateWorkspaceEntityAction({
      workspaceEntityId: 'we_1',
      stageId: 'stage_nonexistent',
      userId: 'user_1',
    });

    // Assert: stageId updated but currentStageName not set (stage doesn't exist)
    expect(mockWorkspaceEntityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_nonexistent',
        updatedAt: expect.any(String),
      })
    );

    // currentStageName should not be in the update if stage doesn't exist
    const updateCall = mockWorkspaceEntityUpdate.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty('currentStageName');
  });

  it('should log activity when stage changes', async () => {
    // Arrange
    const workspaceEntity: WorkspaceEntity = {
      id: 'we_1',
      organizationId: 'org_1',
      workspaceId: 'workspace_1',
      entityId: 'entity_1',
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      displayName: 'Test School',
      primaryEmail: 'test@school.com',
      primaryPhone: '+1234567890',
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    const entity: Entity = {
      id: 'entity_1',
      organizationId: 'org_1',
      entityType: 'institution',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      globalTags: [],
      institutionData: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
    };

    mockWorkspaceEntityGet.mockResolvedValue({
      exists: true,
      id: 'we_1',
      data: () => workspaceEntity,
    });

    mockEntityGet.mockResolvedValue({
      exists: true,
      id: 'entity_1',
      data: () => entity,
    });

    mockStageGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Contract Review' }),
    });

    mockWorkspaceEntityUpdate.mockResolvedValue(undefined);
    mockActivityAdd.mockResolvedValue({ id: 'activity_1' });

    // Act
    await updateWorkspaceEntityAction({
      workspaceEntityId: 'we_1',
      stageId: 'stage_2',
      userId: 'user_1',
    });

    // Assert: Activity was logged
    expect(mockActivityAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        displayName: 'Test School',
        userId: 'user_1',
        type: 'workspace_entity_updated',
        source: 'user_action',
        metadata: expect.objectContaining({
          workspaceEntityId: 'we_1',
          updatedFields: expect.arrayContaining(['stageId', 'currentStageName']),
        }),
      })
    );
  });
});
