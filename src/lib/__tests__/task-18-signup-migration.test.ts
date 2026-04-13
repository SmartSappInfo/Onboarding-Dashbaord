/**
 * Task 18: Migrate Signups Module
 * 
 * Tests for Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * This test suite verifies that the signup flow:
 * - Creates entity records with unique entityId (Requirement 10.1)
 * - Creates workspace_entity records linking entity to workspace (Requirement 10.2)
 * - Does NOT create legacy school records (Requirement 10.3)
 * - Uses format entity_<random_id> for entityId (Requirement 10.4)
 * - Logs activity with entityId reference (Requirement 10.5)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleSignupAction } from '../signup-actions';
import { adminDb } from '../firebase-admin';
import { logActivity } from '../activity-logger';
import { createEntityAction } from '../entity-actions';
import { linkEntityToWorkspaceAction } from '../workspace-entity-actions';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: 'mock_random_id_123',
      })),
      add: vi.fn(),
    })),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../entity-actions', () => ({
  createEntityAction: vi.fn(),
}));

vi.mock('../workspace-entity-actions', () => ({
  linkEntityToWorkspaceAction: vi.fn(),
}));

describe('Task 18: Signup Module Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 10.1: Create entity record with entityId', () => {
    it('should create an entity record when a new contact signs up', async () => {
      // Arrange
      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      const result = await handleSignupAction(signupInput);

      // Assert
      expect(result.success).toBe(true);
      expect(createEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_1',
          entityType: 'institution',
          name: 'Test School',
          contacts: signupInput.focalPersons,
          userId: 'user_123',
          workspaceId: 'workspace_onboarding',
        })
      );
    });
  });

  describe('Requirement 10.2: Create workspace_entity record', () => {
    it('should create a workspace_entity record linking entity to workspace', async () => {
      // Arrange
      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      const result = await handleSignupAction(signupInput);

      // Assert
      expect(result.success).toBe(true);
      expect(linkEntityToWorkspaceAction).toHaveBeenCalledWith({
        entityId: 'entity_mock_random_id_123',
        workspaceId: 'workspace_onboarding',
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      });
    });
  });

  describe('Requirement 10.3: Do not create legacy school records', () => {
    it('should NOT call addDoc on schools collection', async () => {
      // Arrange
      const mockAddDoc = vi.fn();
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          id: 'mock_random_id_123',
        })),
        add: mockAddDoc,
      } as any);

      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      await handleSignupAction(signupInput);

      // Assert
      // The signup action should NOT create any documents in the schools collection
      // It should only call createEntityAction and linkEntityToWorkspaceAction
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 10.4: Use format entity_<random_id> for entityId', () => {
    it('should generate entityId with format entity_<random_id>', async () => {
      // Arrange
      const mockDocId = 'abc123xyz789';
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          id: mockDocId,
        })),
        add: vi.fn(),
      } as any);

      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: `entity_${mockDocId}`,
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      const result = await handleSignupAction(signupInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.entityId).toMatch(/^entity_/);
      expect(result.entityId).toBe(`entity_${mockDocId}`);
    });
  });

  describe('Requirement 10.5: Log activity with entityId reference', () => {
    it('should log signup_completed activity with entityId', async () => {
      // Arrange
      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        implementationDate: '2024-01-01',
        referee: 'Jane Smith',
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      await handleSignupAction(signupInput);

      // Assert
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_1',
          workspaceId: 'workspace_onboarding',
          entityId: 'entity_mock_random_id_123',
          entityType: 'institution',
          displayName: 'Test School',
          userId: 'user_123',
          type: 'signup_completed',
          source: 'signup_form',
          description: 'New institution "Test School" signed up',
          metadata: expect.objectContaining({
            nominalRoll: 100,
            location: 'Test Location',
            implementationDate: '2024-01-01',
            referee: 'Jane Smith',
            pipelineId: 'pipeline_1',
            stageId: 'stage_welcome',
          }),
        })
      );
    });

    it('should NOT log activity with entityId', async () => {
      // Arrange
      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'we_123',
        scopeLocked: false,
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      await handleSignupAction(signupInput);

      // Assert
      const activityCall = vi.mocked(logActivity).mock.calls[0][0];
      expect(activityCall.entityId).toBeUndefined();
      expect(activityCall.entityId).toBe('entity_mock_random_id_123');
    });
  });

  describe('Error handling and rollback', () => {
    it('should rollback entity creation if workspace linking fails', async () => {
      // Arrange
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn((id?: string) => ({
          id: id || 'mock_random_id_123',
          delete: mockDelete,
        })),
        add: vi.fn(),
      } as any);

      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_mock_random_id_123',
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: false,
        error: 'Failed to link entity to workspace',
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      const result = await handleSignupAction(signupInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to link entity to workspace');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return error if entity creation fails', async () => {
      // Arrange
      vi.mocked(createEntityAction).mockResolvedValue({
        success: false,
        error: 'Failed to create entity',
      });

      const signupInput = {
        organizationId: 'org_1',
        workspaceId: 'workspace_onboarding',
        name: 'Test School',
        location: 'Test Location',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'School Owner',
            isSignatory: true,
          },
        ],
        nominalRoll: 100,
        pipelineId: 'pipeline_1',
        stageId: 'stage_welcome',
        userId: 'user_123',
      };

      // Act
      const result = await handleSignupAction(signupInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create entity');
      expect(linkEntityToWorkspaceAction).not.toHaveBeenCalled();
    });
  });
});
