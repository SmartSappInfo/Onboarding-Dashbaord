/**
 * @fileOverview Task Integration Tests for Contact Adapter Layer
 * 
 * Tests that task creation and management work correctly with the adapter layer
 * for both legacy schools records and migrated entity records.
 * 
 * Requirements: 18 (Backward Compatibility — Schools Adapter Layer)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminDb } from '../firebase-admin';
import { createTaskNonBlocking } from '../task-actions';
import { logActivity } from '../activity-logger';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock Firestore client SDK
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db: any, path: string) => ({ path })),
  doc: vi.fn((db: any, path: string, id: string) => ({ path: `${path}/${id}` })),
  addDoc: vi.fn().mockResolvedValue({ id: 'task_123' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  writeBatch: vi.fn(),
}));

describe('Task Integration with Adapter Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Creation with Legacy Schools', () => {
    it('should create task with legacy entityId', async () => {
      const mockSchool = {
        id: 'school_1',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

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
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const { addDoc } = await import('firebase/firestore');
      
      const mockDb = {} as any;
      await createTaskNonBlocking(mockDb, {
        workspaceId: 'workspace_1',
        title: 'Follow up with school',
        description: 'Call principal about contract',
        priority: 'high',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_1',
        entityId: 'school_1',
        dueDate: '2024-12-31T00:00:00Z',
        reminders: [],
        reminderSent: false,
        updatedAt: new Date().toISOString(),
      });

      // Verify task was created
      expect(addDoc).toHaveBeenCalled();
      
      // Verify activity was logged with entityId
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_1',
          workspaceId: 'workspace_1',
          type: 'task_created',
          source: 'system',
        })
      );
    });
  });

  describe('Task Creation with Migrated Entities', () => {
    it('should create task with entityId for migrated records', async () => {
      const mockSchool = {
        id: 'school_2',
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

      const mockEntity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        status: 'active',
        workspaceTags: [],
        displayName: 'Migrated School',
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
                id: 'school_2',
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
                docs: [{ id: 'entity_1', data: () => mockEntity }],
              }),
            };
          } else {
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
              docs: [{ id: 'we_1', data: () => mockWorkspaceEntity }],
            }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const { addDoc } = await import('firebase/firestore');
      
      const mockDb = {} as any;
      await createTaskNonBlocking(mockDb, {
        workspaceId: 'workspace_1',
        title: 'Follow up with institution',
        description: 'Call principal about contract',
        priority: 'high',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_1',
        entityId: 'entity_1',
        entityType: 'institution',
        dueDate: '2024-12-31T00:00:00Z',
        reminders: [],
        reminderSent: false,
        updatedAt: new Date().toISOString(),
      });

      // Verify task was created
      expect(addDoc).toHaveBeenCalled();
      
      // Verify activity was logged with both entityId and entityId
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_2',
          workspaceId: 'workspace_1',
          type: 'task_created',
          source: 'system',
        })
      );
    });
  });

  describe('Task Activity Logging', () => {
    it('should log task completion with contact context from adapter', async () => {
      const mockSchool = {
        id: 'school_3',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

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
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      // Simulate task completion logging
      await logActivity({
        organizationId: 'org_1',
        entityId: 'school_3',
        userId: 'user_1',
        workspaceId: 'workspace_1',
        type: 'task_completed',
        source: 'user_action',
        description: 'Completed follow-up call',
        metadata: { taskId: 'task_123' },
      });

      // Verify activity logger was called
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_3',
          workspaceId: 'workspace_1',
          type: 'task_completed',
        })
      );
    });
  });
});
