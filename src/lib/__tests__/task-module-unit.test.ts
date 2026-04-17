/**
 * @fileOverview Task Module Unit Tests
 * 
 * Tests for Task 11.6: Write unit tests for task module
 * 
 * Validates:
 * - Task creation with entityId only
 * - Task creation with entityId only
 * - Task creation with both identifiers
 * - Task query by entityId
 * - Task query by entityId
 * - Contact Adapter integration in UI
 * 
 * Requirements: 26.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTaskAction, updateTaskAction, getTasksForContact } from '../task-server-actions';
import { resolveContact } from '../contact-adapter';
import type { Task, ResolvedContact } from '../types';

// Mock firebase-admin
const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: mockAdd,
      doc: vi.fn(() => ({
        update: mockUpdate,
        delete: mockDelete,
      })),
      where: mockWhere,
    })),
  },
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock contact adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

describe('Task Module Unit Tests (Task 11.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain for queries
    mockOrderBy.mockReturnValue({
      get: mockGet,
    });
    mockWhere.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
    });
    mockGet.mockResolvedValue({
      docs: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Creation with entityId only', () => {
    it('should create task with entityId and resolve entityId from adapter', async () => {
      mockAdd.mockResolvedValue({ id: 'task_123' });

      // Mock adapter to return contact with entityId
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'institution',
        schoolData: {
          id: 'school_789',
          name: 'Test Institution',
          slug: 'test-institution',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          tags: [],
        entityContacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up with entity',
        description: 'Check contract status',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_456',
        entityType: 'institution' as const,
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      expect(result.id).toBe('task_123');
      
      // Verify adapter was called with entityId
      expect(resolveContact).toHaveBeenCalledWith(
        'entity_456',
        'workspace_1'
      );

      // Verify task was created with both identifiers (dual-write)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          entityType: 'institution',
          entityName: 'Test Institution',
        })
      );
    });

    it('should create task with entityId when no entityId exists', async () => {
      mockAdd.mockResolvedValue({ id: 'task_124' });

      // Mock adapter to return contact without entityId (new entity)
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'New Family',
        slug: undefined,
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'family',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Contact family',
        description: 'Initial outreach',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_456',
        entityType: 'family' as const,
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      
      // Verify task was created with entityId but null entityId
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          entityType: 'family',
          entityName: 'New Family',
        })
      );
    });
  });

  describe('Task Creation with entityId only', () => {
    it('should create task with entityId and resolve entityId from adapter for migrated school', async () => {
      mockAdd.mockResolvedValue({ id: 'task_125' });

      // Mock adapter to return migrated contact with entityId
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_999',
        entityType: 'institution',
        schoolData: {
          id: 'school_789',
          name: 'Migrated School',
          slug: 'migrated-school',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          tags: [],
        entityContacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up with school',
        description: 'Check enrollment',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'school_789',
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      
      // Verify adapter was called with entityId
      expect(resolveContact).toHaveBeenCalledWith(
        'school_789',
        'workspace_1'
      );

      // Verify task was created with both identifiers (dual-write)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_789',
          entityName: 'Migrated School',
          entityType: 'institution',
        })
      );
    });

    it('should create task with entityId only for legacy school not yet migrated', async () => {
      mockAdd.mockResolvedValue({ id: 'task_126' });

      // Mock adapter to return legacy contact without entityId
      const mockContact: ResolvedContact = {
        id: 'school_888',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'legacy',
        schoolData: {
          id: 'school_888',
          name: 'Legacy School',
          slug: 'legacy-school',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          tags: [],
        entityContacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up with legacy school',
        description: 'Check status',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'school_888',
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      
      // Verify task was created with entityId but null entityId
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_888',
          entityName: 'Legacy School',
          entityType: null,
        })
      );
    });
  });

  describe('Task Creation with both identifiers', () => {
    it('should create task with both entityId and entityId when provided', async () => {
      mockAdd.mockResolvedValue({ id: 'task_127' });

      // Mock adapter to return contact
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'institution',
        schoolData: {
          id: 'school_789',
          name: 'Test Institution',
          slug: 'test-institution',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          tags: [],
        entityContacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up',
        description: 'Check status',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_456',
        entityType: 'institution' as const,
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      
      // Verify adapter was called with both identifiers
      expect(resolveContact).toHaveBeenCalledWith(
        'school_789',
        'workspace_1'
      );

      // Verify task was created with both identifiers preserved
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_789',
          entityName: 'Test Institution',
          entityType: 'institution',
        })
      );
    });

    it('should ensure entityType is set when both identifiers provided', async () => {
      mockAdd.mockResolvedValue({ id: 'task_128' });

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Person',
        slug: undefined,
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'person',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Contact person',
        description: 'Follow up',
        priority: 'low' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_456',
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(true);
      
      // Verify entityType was resolved from adapter
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'person',
        })
      );
    });
  });

  describe('Task Query by entityId', () => {
    it('should query tasks by entityId', async () => {
      const mockTasks = [
        {
          id: 'task_1',
          title: 'Task 1',
          entityId: 'entity_456',
          workspaceId: 'workspace_1',
        },
        {
          id: 'task_2',
          title: 'Task 2',
          entityId: 'entity_456',
          workspaceId: 'workspace_1',
        },
      ];

      mockGet.mockResolvedValue({
        docs: mockTasks.map(task => ({
          id: task.id,
          data: () => task,
        })),
      });

      const results = await getTasksForContact(
        'entity_456',
        'workspace_1'
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('task_1');
      expect(results[1].id).toBe('task_2');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_456');
      expect(mockOrderBy).toHaveBeenCalledWith('dueDate', 'asc');
    });

    it('should return empty array when no tasks found for entityId', async () => {
      mockGet.mockResolvedValue({
        docs: [],
      });

      const results = await getTasksForContact(
        'entity_nonexistent',
        'workspace_1'
      );

      expect(results).toHaveLength(0);
    });

    it('should filter tasks by workspaceId when querying by entityId', async () => {
      const mockTasks = [
        {
          id: 'task_1',
          title: 'Task 1',
          entityId: 'entity_456',
          workspaceId: 'workspace_1',
        },
      ];

      mockGet.mockResolvedValue({
        docs: mockTasks.map(task => ({
          id: task.id,
          data: () => task,
        })),
      });

      await getTasksForContact(
        'entity_456',
        'workspace_1'
      );

      // Verify workspace boundary enforcement
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
    });
  });

  describe('Task Query by entityId', () => {
    it('should query tasks by entityId for legacy records', async () => {
      const mockTasks = [
        {
          id: 'task_3',
          title: 'Task 3',
          entityId: 'school_789',
          workspaceId: 'workspace_1',
        },
        {
          id: 'task_4',
          title: 'Task 4',
          entityId: 'school_789',
          workspaceId: 'workspace_1',
        },
      ];

      mockGet.mockResolvedValue({
        docs: mockTasks.map(task => ({
          id: task.id,
          data: () => task,
        })),
      });

      const results = await getTasksForContact(
        'school_789',
        'workspace_1'
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('task_3');
      expect(results[1].id).toBe('task_4');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_789');
      expect(mockOrderBy).toHaveBeenCalledWith('dueDate', 'asc');
    });

    it('should return empty array when no tasks found for entityId', async () => {
      mockGet.mockResolvedValue({
        docs: [],
      });

      const results = await getTasksForContact(
        'school_nonexistent',
        'workspace_1'
      );

      expect(results).toHaveLength(0);
    });

    it('should prefer entityId over entityId when both provided', async () => {
      const mockTasks = [
        {
          id: 'task_5',
          title: 'Task 5',
          entityId: 'school_789',
          workspaceId: 'workspace_1',
        },
      ];

      mockGet.mockResolvedValue({
        docs: mockTasks.map(task => ({
          id: task.id,
          data: () => task,
        })),
      });

      await getTasksForContact(
        'school_789',
        'workspace_1'
      );

      // Verify query used entityId (preferred)
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_456');
      // Should NOT query by entityId when entityId is present
      expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_789');
    });
  });

  describe('Contact Adapter Integration', () => {
    it('should use Contact Adapter to resolve contact information during task creation', async () => {
      mockAdd.mockResolvedValue({ id: 'task_129' });

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Resolved Contact',
        slug: 'resolved-contact',
        contacts: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '123-456-7890',
            type: 'Principal',
            isSignatory: false,
          },
        ],
        tags: ['vip', 'active'],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'institution',
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        entityContacts: [],
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up',
        description: 'Check status',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_456',
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData, 'test_user');

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith(
        'entity_456',
        'workspace_1'
      );

      // Verify contact information was used
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityName: 'Resolved Contact',
          entityType: 'institution',
        })
      );
    });

    it('should handle adapter failure gracefully', async () => {
      mockAdd.mockResolvedValue({ id: 'task_130' });

      // Mock adapter to return null (contact not found)
      (resolveContact as any).mockResolvedValue(null);

      const taskData = {
        title: 'Follow up',
        description: 'Check status',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_nonexistent',
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      // Task creation should still succeed
      expect(result.success).toBe(true);
      
      // Verify task was created with provided identifiers
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: null,
          entityName: null,
          entityType: null,
        })
      );
    });

    it('should resolve contact for both migrated and legacy records', async () => {
      mockAdd.mockResolvedValue({ id: 'task_131' });

      // Test with legacy contact
      const legacyContact: ResolvedContact = {
        id: 'school_123',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        tags: [],
        migrationStatus: 'legacy',
        entityContacts: [],
        schoolData: {
          id: 'school_123',
          name: 'Legacy School',
          slug: 'legacy-school',
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          workspaceIds: ['workspace_1'],
          status: 'Active',
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          tags: [],
        entityContacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      (resolveContact as any).mockResolvedValue(legacyContact);

      const taskData = {
        title: 'Follow up with legacy',
        description: 'Check status',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'school_123',
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData, 'test_user');

      // Verify adapter resolved legacy contact
      expect(resolveContact).toHaveBeenCalledWith(
        'school_123',
        'workspace_1'
      );

      // Verify task created with legacy data
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123',
          entityName: 'Legacy School',
          entityType: null,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle task creation errors gracefully', async () => {
      mockAdd.mockRejectedValue(new Error('Firestore error'));

      const taskData = {
        title: 'Test task',
        description: 'Test',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'general' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData, 'test_user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });

    it('should handle query errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Query failed'));

      const results = await getTasksForContact(
        'entity_456',
        'workspace_1'
      );

      // Should return empty array on error
      expect(results).toHaveLength(0);
    });

    it('should return empty array when no identifier provided', async () => {
      const results = await getTasksForContact(
        '',
        'workspace_1'
      );

      expect(results).toHaveLength(0);
      // Should not attempt to query
      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  describe('Task Update', () => {
    it('should update task successfully', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        title: 'Updated title',
        status: 'in_progress' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      };

      const result = await updateTaskAction('task_123', updates, 'test_user');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated title',
          status: 'in_progress',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should set completedAt when marking task as done', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        status: 'done' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      };

      await updateTaskAction('task_123', updates, 'test_user');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'done',
          completedAt: expect.any(String),
        })
      );
    });

    it('should clear completedAt when changing status from done', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        status: 'in_progress' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      };

      await updateTaskAction('task_123', updates, 'test_user');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_progress',
          completedAt: null,
        })
      );
    });

    it('should handle update errors gracefully', async () => {
      mockUpdate.mockRejectedValue(new Error('Update failed'));

      const updates = {
        title: 'Updated title',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      };

      const result = await updateTaskAction('task_123', updates, 'test_user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
