/**
 * @fileOverview API Integration Tests for EntityId Migration
 * Requirements: 26.2 - Test API accepts both entityId and entityId
 * 
 * Tests validate:
 * - API accepts both entityId and entityId parameters
 * - API returns both identifiers in responses
 * - API creates entities for new contacts (not legacy schools)
 * - Deprecation warnings are sent for entityId usage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getActivities, POST as postActivity } from '../activities/route';
import { GET as getTasks, POST as postTask } from '../tasks/route';
import { GET as getContact, PATCH as patchContact } from '../contacts/[entityId]/route';
import { POST as createContact } from '../contacts/route';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn()
      })),
      where: vi.fn(() => ({
        get: vi.fn()
      }))
    }))
  }
}));

// Mock server actions
vi.mock('@/lib/activity-actions', () => ({
  getActivitiesForContact: vi.fn()
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn()
}));

vi.mock('@/lib/task-server-actions', () => ({
  getTasksForContact: vi.fn(),
  createTaskAction: vi.fn()
}));

vi.mock('@/lib/entity-actions', () => ({
  updateEntityAction: vi.fn(),
  createEntityAction: vi.fn()
}));

vi.mock('@/lib/workspace-entity-actions', () => ({
  updateWorkspaceEntityAction: vi.fn(),
  linkEntityToWorkspaceAction: vi.fn()
}));

describe('API Integration Tests - Activities Endpoint', () => {
  describe('GET /api/activities', () => {
    it('should accept entityId parameter', async () => {
      const { getActivitiesForContact } = await import('@/lib/activity-actions');
      vi.mocked(getActivitiesForContact).mockResolvedValue([
        {
          id: 'activity1',
          organizationId: 'org1',
          workspaceId: 'workspace1',
          type: 'call',
          source: 'manual',
          description: 'Test activity',
          entityId: 'entity_123',
          entityType: 'institution',
          userId: 'user1',
          timestamp: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1&entityId=entity_123'
      );

      const response = await getActivities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activities).toHaveLength(1);
      expect(data.activities[0].entityId).toBe('entity_123');
      expect(getActivitiesForContact).toHaveBeenCalledWith(
        { entityId: 'entity_123' },
        'workspace1',
        50
      );
    });

    it('should accept entityId parameter (legacy)', async () => {
      const { getActivitiesForContact } = await import('@/lib/activity-actions');
      vi.mocked(getActivitiesForContact).mockResolvedValue([
        {
          id: 'activity1',
          organizationId: 'org1',
          workspaceId: 'workspace1',
          type: 'call',
          source: 'manual',
          description: 'Test activity',
          entityId: 'school_123',
          userId: 'user1',
          timestamp: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1&entityId=school_123'
      );

      const response = await getActivities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activities).toHaveLength(1);
      expect(data.activities[0].entityId).toBe('school_123');
      expect(getActivitiesForContact).toHaveBeenCalledWith(
        { entityId: 'school_123' },
        'workspace1',
        50
      );
    });

    it('should prefer entityId when both provided', async () => {
      const { getActivitiesForContact } = await import('@/lib/activity-actions');
      vi.mocked(getActivitiesForContact).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1&entityId=entity_123&entityId=school_123'
      );

      await getActivities(request);

      expect(getActivitiesForContact).toHaveBeenCalledWith(
        { entityId: 'entity_123' },
        'workspace1',
        50
      );
    });

    it('should return deprecation warning when using entityId', async () => {
      const { getActivitiesForContact } = await import('@/lib/activity-actions');
      vi.mocked(getActivitiesForContact).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1&entityId=school_123'
      );

      const response = await getActivities(request);

      expect(response.headers.get('Warning')).toContain('entityId parameter is deprecated');
    });

    it('should return both identifiers in response', async () => {
      const { getActivitiesForContact } = await import('@/lib/activity-actions');
      vi.mocked(getActivitiesForContact).mockResolvedValue([
        {
          id: 'activity1',
          organizationId: 'org1',
          workspaceId: 'workspace1',
          type: 'call',
          source: 'manual',
          description: 'Test activity',
          entityId: 'entity_123',
          entityType: 'institution',
          userId: 'user1',
          timestamp: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1&entityId=entity_123'
      );

      const response = await getActivities(request);
      const data = await response.json();

      expect(data.activities[0].entityId).toBe('entity_123');
    });

    it('should require workspaceId', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/activities?entityId=entity_123'
      );

      const response = await getActivities(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('workspaceId is required');
    });

    it('should require either entityId or entityId', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/activities?workspaceId=workspace1'
      );

      const response = await getActivities(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Either entityId or entityId must be provided');
    });
  });

  describe('POST /api/activities', () => {
    it('should create activity with entityId', async () => {
      const { logActivity } = await import('@/lib/activity-logger');
      vi.mocked(logActivity).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          type: 'call',
          description: 'Test activity',
          entityId: 'entity_123',
          entityType: 'institution',
          userId: 'user1'
        })
      });

      const response = await postActivity(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entityId).toBe('entity_123');
      expect(data.entityType).toBe('institution');
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123',
          entityType: 'institution'
        })
      );
    });

    it('should create activity with entityId (legacy)', async () => {
      const { logActivity } = await import('@/lib/activity-logger');
      vi.mocked(logActivity).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          type: 'call',
          description: 'Test activity',
          entityId: 'school_123',
          userId: 'user1'
        })
      });

      const response = await postActivity(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entityId).toBe('school_123');
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: null
        })
      );
    });

    it('should return both identifiers when both provided', async () => {
      const { logActivity } = await import('@/lib/activity-logger');
      vi.mocked(logActivity).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          type: 'call',
          description: 'Test activity',
          entityId: 'entity_123',
          entityType: 'institution',
          userId: 'user1'
        })
      });

      const response = await postActivity(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entityId).toBe('entity_123');
    });
  });
});

describe('API Integration Tests - Tasks Endpoint', () => {
  describe('GET /api/tasks', () => {
    it('should accept entityId parameter', async () => {
      const { getTasksForContact } = await import('@/lib/task-server-actions');
      vi.mocked(getTasksForContact).mockResolvedValue([
        {
          id: 'task1',
          workspaceId: 'workspace1',
          title: 'Test task',
          description: 'Test description',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          assignedTo: 'user1',
          entityId: 'entity_123',
          entityType: 'institution',
          dueDate: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          reminderSent: false,
          reminders: []
        }
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/tasks?workspaceId=workspace1&entityId=entity_123'
      );

      const response = await getTasks(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0].entityId).toBe('entity_123');
    });

    it('should accept entityId parameter (legacy)', async () => {
      const { getTasksForContact } = await import('@/lib/task-server-actions');
      vi.mocked(getTasksForContact).mockResolvedValue([
        {
          id: 'task1',
          workspaceId: 'workspace1',
          title: 'Test task',
          description: 'Test description',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          assignedTo: 'user1',
          entityId: 'school_123',
          dueDate: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          reminderSent: false,
          reminders: []
        }
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/tasks?workspaceId=workspace1&entityId=school_123'
      );

      const response = await getTasks(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks[0].entityId).toBe('school_123');
    });

    it('should return deprecation warning when using entityId', async () => {
      const { getTasksForContact } = await import('@/lib/task-server-actions');
      vi.mocked(getTasksForContact).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/tasks?workspaceId=workspace1&entityId=school_123'
      );

      const response = await getTasks(request);

      expect(response.headers.get('Warning')).toContain('entityId parameter is deprecated');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create task with entityId', async () => {
      const { createTaskAction } = await import('@/lib/task-server-actions');
      const { adminDb } = await import('@/lib/firebase-admin');
      
      vi.mocked(createTaskAction).mockResolvedValue({
        success: true,
        id: 'task1'
      });

      const mockTaskDoc = {
        id: 'task1',
        exists: true,
        data: () => ({
          workspaceId: 'workspace1',
          title: 'Test task',
          description: 'Test description',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          assignedTo: 'user1',
          entityId: 'entity_123',
          entityType: 'institution',
          dueDate: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          reminderSent: false,
          reminders: []
        })
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTaskDoc)
        }))
      } as any);

      const request = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          title: 'Test task',
          description: 'Test description',
          entityId: 'entity_123',
          entityType: 'institution'
        })
      });

      const response = await postTask(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entityId).toBe('entity_123');
      expect(data.entityType).toBe('institution');
    });

    it('should create task with both identifiers (dual-write)', async () => {
      const { createTaskAction } = await import('@/lib/task-server-actions');
      
      vi.mocked(createTaskAction).mockResolvedValue({
        success: true,
        id: 'task1'
      });

      const request = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          title: 'Test task',
          entityId: 'entity_123',
          entityType: 'institution'
        })
      });

      await postTask(request);

      expect(createTaskAction).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123'
        })
      );
    });
  });
});

describe('API Integration Tests - Contacts Endpoint', () => {
  describe('GET /api/contacts/[entityId]', () => {
    it('should return contact with both entity and workspace data', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');

      const mockEntityDoc = {
        id: 'entity_123',
        exists: true,
        data: () => ({
          organizationId: 'org1',
          entityType: 'institution',
          name: 'Test School',
          slug: 'test-school',
          contacts: [],
          globalTags: ['tag1'],
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })
      };

      const mockWorkspaceEntityDoc = {
        exists: true,
        data: () => ({
          workspaceId: 'workspace1',
          pipelineId: 'pipeline1',
          stageId: 'stage1',
          currentStageName: 'Lead',
          assignedTo: null,
          workspaceTags: ['workspace-tag1'],
          status: 'active'
        })
      };

      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockEntityDoc)
            }))
          } as any;
        } else if (collectionName === 'workspace_entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockWorkspaceEntityDoc)
            }))
          } as any;
        }
        return {} as any;
      });

      const request = new NextRequest(
        'http://localhost:3000/api/contacts/entity_123?workspaceId=workspace1'
      );

      const response = await getContact(request, {
        params: Promise.resolve({ entityId: 'entity_123' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('entity_123');
      expect(data.name).toBe('Test School');
      expect(data.workspaceData).toBeDefined();
      expect(data.workspaceData.pipelineId).toBe('pipeline1');
    });

    it('should return 404 when contact not found', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false })
        }))
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/contacts/nonexistent?workspaceId=workspace1'
      );

      const response = await getContact(request, {
        params: Promise.resolve({ entityId: 'nonexistent' })
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/contacts/[entityId]', () => {
    it('should update identity fields in entities collection', async () => {
      const { updateEntityAction } = await import('@/lib/entity-actions');
      const { adminDb } = await import('@/lib/firebase-admin');

      vi.mocked(updateEntityAction).mockResolvedValue({
        success: true
      });

      const mockEntityDoc = {
        id: 'entity_123',
        exists: true,
        data: () => ({
          name: 'Updated School',
          globalTags: ['tag1', 'tag2'],
          updatedAt: '2024-01-02T00:00:00Z'
        })
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockEntityDoc)
        }))
      } as any);

      const request = new NextRequest('http://localhost:3000/api/contacts/entity_123', {
        method: 'PATCH',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          name: 'Updated School',
          globalTags: ['tag1', 'tag2']
        })
      });

      const response = await patchContact(request, {
        params: Promise.resolve({ entityId: 'entity_123' })
      });

      expect(response.status).toBe(200);
      expect(updateEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123',
          name: 'Updated School'
        })
      );
    });

    it('should update operational fields in workspace_entities collection', async () => {
      const { updateWorkspaceEntityAction } = await import('@/lib/workspace-entity-actions');
      const { adminDb } = await import('@/lib/firebase-admin');

      vi.mocked(updateWorkspaceEntityAction).mockResolvedValue({
        success: true
      });

      const mockEntityDoc = {
        id: 'entity_123',
        exists: true,
        data: () => ({
          name: 'Test School'
        })
      };

      const mockWorkspaceEntityDoc = {
        exists: true,
        data: () => ({
          pipelineId: 'pipeline2',
          stageId: 'stage2',
          workspaceTags: ['new-tag']
        })
      };

      vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockEntityDoc)
            }))
          } as any;
        } else if (collectionName === 'workspace_entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockWorkspaceEntityDoc)
            }))
          } as any;
        }
        return {} as any;
      });

      const request = new NextRequest('http://localhost:3000/api/contacts/entity_123', {
        method: 'PATCH',
        body: JSON.stringify({
          workspaceId: 'workspace1',
          pipelineId: 'pipeline2',
          stageId: 'stage2',
          workspaceTags: ['new-tag']
        })
      });

      const response = await patchContact(request, {
        params: Promise.resolve({ entityId: 'entity_123' })
      });

      expect(response.status).toBe(200);
      expect(updateWorkspaceEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceEntityId: 'workspace1_entity_123',
          pipelineId: 'pipeline2',
          stageId: 'stage2'
        })
      );
    });
  });

  describe('POST /api/contacts', () => {
    it('should create entity and workspace_entity records', async () => {
      const { createEntityAction } = await import('@/lib/entity-actions');
      const { linkEntityToWorkspaceAction } = await import('@/lib/workspace-entity-actions');

      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_new123'
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'workspace1_entity_new123',
        scopeLocked: false
      });

      const request = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org1',
          workspaceId: 'workspace1',
          entityType: 'institution',
          name: 'New School',
          contacts: [],
          pipelineId: 'pipeline1',
          stageId: 'stage1'
        })
      });

      const response = await createContact(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entity).toBeDefined();
      expect(data.entity.id).toBe('entity_new123');
      expect(data.workspaceEntity).toBeDefined();
      expect(data.workspaceEntity.entityId).toBe('entity_new123');
      
      // Verify entity creation
      expect(createEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          entityType: 'institution',
          name: 'New School'
        })
      );

      // Verify workspace_entity creation
      expect(linkEntityToWorkspaceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace1',
          entityId: 'entity_new123',
          entityType: 'institution'
        })
      );
    });

    it('should not create legacy school records', async () => {
      const { createEntityAction } = await import('@/lib/entity-actions');
      const { linkEntityToWorkspaceAction } = await import('@/lib/workspace-entity-actions');
      const { adminDb } = await import('@/lib/firebase-admin');

      vi.mocked(createEntityAction).mockResolvedValue({
        success: true,
        id: 'entity_new123'
      });

      vi.mocked(linkEntityToWorkspaceAction).mockResolvedValue({
        success: true,
        workspaceEntityId: 'workspace1_entity_new123',
        scopeLocked: false
      });

      const request = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org1',
          workspaceId: 'workspace1',
          entityType: 'institution',
          name: 'New School'
        })
      });

      await createContact(request);

      // Verify schools collection was never accessed
      const schoolsCollectionCalls = vi.mocked(adminDb.collection).mock.calls
        .filter(call => call[0] === 'schools');
      
      expect(schoolsCollectionCalls).toHaveLength(0);
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org1',
          // Missing workspaceId, entityType, name
        })
      });

      const response = await createContact(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should validate entityType values', async () => {
      const request = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org1',
          workspaceId: 'workspace1',
          entityType: 'invalid_type',
          name: 'Test'
        })
      });

      const response = await createContact(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('entityType must be one of');
    });
  });
});
