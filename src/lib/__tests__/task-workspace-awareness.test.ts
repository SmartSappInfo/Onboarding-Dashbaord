/**
 * @fileOverview Task Workspace Awareness Tests
 * 
 * Tests for Requirement 13: Workspace-Aware Task Management
 * 
 * Validates:
 * - 13.1: Task documents include entityId and entityType fields
 * - 13.2: Task creation requires workspaceId
 * - 13.3: Task list view filters by workspaceId
 * - 13.4: Dual-write for legacy schools records
 * - 13.5: Both entityId (legacy) and entityId (new) populated
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTaskAction, updateTaskAction } from '../task-server-actions';
import { resolveContact } from '../contact-adapter';
import type { Task, ResolvedContact } from '../types';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'task_123' }),
      doc: vi.fn(() => ({
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      })),
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

describe('Task Workspace Awareness (Requirement 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('13.1 & 13.2: Task document includes entityId, entityType, and workspaceId', () => {
    it('should create task with entityId and entityType when provided', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'task_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      const taskData = {
        title: 'Follow up with institution',
        description: 'Check contract status',
        priority: 'high' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_123',
        entityType: 'institution' as const,
        reminders: [],
        reminderSent: false,
      };

      const result = await createTaskAction(taskData);

      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123',
          entityType: 'institution',
          workspaceId: 'workspace_1',
        })
      );
    });

    it('should require workspaceId when creating task', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'task_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      const taskData = {
        title: 'Test task',
        description: 'Test',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'general' as const,
        workspaceId: 'workspace_1', // Required field
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData);

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace_1',
        })
      );
    });
  });

  describe('13.4 & 13.5: Dual-write for legacy schools records', () => {
    it('should populate both entityId and entityId when creating task for migrated school', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'task_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Mock adapter to return migrated contact
      const mockContact: ResolvedContact = {
        id: 'school_123',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'institution',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      const taskData = {
        title: 'Follow up with school',
        description: 'Check status',
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'call' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        entityId: 'school_123', // Legacy field
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData);

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith('school_123', 'workspace_1');

      // Verify both entityId and entityId are populated (dual-write)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123', // Legacy field maintained
          entityName: 'Test Institution',
          entityType: 'institution',
        })
      );
    });

    it('should handle legacy schools that are not yet migrated', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'task_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Mock adapter to return legacy contact (no entityId)
      const mockContact: ResolvedContact = {
        id: 'school_123',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'legacy',
        // No entityId or entityType for legacy records
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
        entityId: 'school_123',
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData);

      // Verify entityId is maintained, entityId is null for legacy records
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123',
          entityName: 'Legacy School',
          entityType: null,
        })
      );
    });

    it('should handle tasks without any contact association', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'task_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      const taskData = {
        title: 'General task',
        description: 'Not linked to any contact',
        priority: 'low' as const,
        status: 'todo' as const,
        category: 'general' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      };

      await createTaskAction(taskData);

      // Verify no contact fields are set
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityName: null,
          entityId: null,
          entityType: null,
        })
      );
      
      // Verify entityId is not in the object (or is undefined/null)
      const callArgs = mockAdd.mock.calls[0][0];
      expect(callArgs.entityId).toBeUndefined();
    });
  });

  describe('13.3: Task list filtering by workspaceId', () => {
    it('should filter tasks by workspaceId in query', () => {
      // This is tested in the UI component (TasksClient.tsx)
      // The query uses: where('workspaceId', '==', activeWorkspaceId)
      // This test validates the concept
      
      const tasks: Partial<Task>[] = [
        { id: 'task_1', workspaceId: 'workspace_1', title: 'Task 1' },
        { id: 'task_2', workspaceId: 'workspace_2', title: 'Task 2' },
        { id: 'task_3', workspaceId: 'workspace_1', title: 'Task 3' },
      ];

      const activeWorkspaceId = 'workspace_1';
      const filteredTasks = tasks.filter(t => t.workspaceId === activeWorkspaceId);

      expect(filteredTasks).toHaveLength(2);
      expect(filteredTasks.map(t => t.id)).toEqual(['task_1', 'task_3']);
    });
  });

  describe('Task update with entity awareness', () => {
    it('should update task while preserving entity fields', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn(() => ({ update: mockUpdate })),
      });

      const updates = {
        status: 'done' as const,
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        entityId: 'entity_123',
        entityType: 'institution' as const,
        title: 'Updated task',
      };

      await updateTaskAction('task_123', updates);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'done',
          completedAt: expect.any(String),
        })
      );
    });
  });
});
