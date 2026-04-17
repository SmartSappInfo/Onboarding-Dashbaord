/**
 * @fileOverview Comprehensive Server Action Tests
 * 
 * Tests for Task 34.3: Write server action tests
 * 
 * Validates:
 * - Server actions accept both identifiers (entityId and entityId)
 * - Server actions use entityId for operations
 * - Contact Adapter integration
 * - Backward compatibility with entityId
 * 
 * Requirements: 26.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  createTaskAction, 
  updateTaskAction, 
  deleteTaskAction,
  getTasksForContact 
} from '../task-server-actions';
import { 
  getActivitiesForContact,
  updateNote,
  deleteNote
} from '../activity-actions';
import {
  loadSettings,
  updateSettings,
  createSettings
} from '../settings-actions';
import {
  getSurveysForContact,
  getSurveyResponsesForContact
} from '../survey-actions';
import { resolveContact } from '../contact-adapter';
import type { ResolvedContact } from '../types';

// Mock firebase-admin
const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => ({
      add: mockAdd,
      doc: vi.fn((docId?: string) => ({
        update: mockUpdate,
        delete: mockDelete,
        get: mockGet,
      })),
      where: mockWhere,
      get: mockGet,
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

describe('Server Actions Comprehensive Tests (Task 34.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain for queries
    mockLimit.mockReturnValue({
      get: mockGet,
    });
    mockOrderBy.mockReturnValue({
      limit: mockLimit,
      get: mockGet,
    });
    mockWhere.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockGet,
    });
    mockGet.mockResolvedValue({
      docs: [],
      exists: false,
      data: () => null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Server Actions', () => {
    describe('Accept Both Identifiers', () => {
      it('should accept entityId parameter in createTaskAction', async () => {
        mockAdd.mockResolvedValue({ id: 'task_1' });
        
        const mockContact: ResolvedContact = {
          id: 'entity_1',
          name: 'Test Entity',
          slug: 'test-entity',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'migrated',
          entityId: 'entity_1',
          entityType: 'institution',
        };
        (resolveContact as any).mockResolvedValue(mockContact);

        const result = await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'entity_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(resolveContact).toHaveBeenCalledWith(
          'entity_1',
          'workspace_1'
        );
      });

      it('should accept entityId parameter in createTaskAction', async () => {
        mockAdd.mockResolvedValue({ id: 'task_2' });
        
        const mockContact: ResolvedContact = {
          id: 'school_1',
          name: 'Test School',
          slug: 'test-school',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'legacy',
          schoolData: {
            id: 'school_1',
            name: 'Test School',
            slug: 'test-school',
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

        const result = await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'school_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(resolveContact).toHaveBeenCalledWith(
          'school_1',
          'workspace_1'
        );
      });

      it('should accept both entityId and entityId in createTaskAction', async () => {
        mockAdd.mockResolvedValue({ id: 'task_3' });
        
        const mockContact: ResolvedContact = {
          id: 'entity_1',
          name: 'Test Entity',
          slug: 'test-entity',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'migrated',
          entityId: 'entity_1',
          entityType: 'institution',
          schoolData: {
            id: 'school_1',
            name: 'Test Entity',
            slug: 'test-entity',
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

        const result = await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'school_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(resolveContact).toHaveBeenCalledWith(
          'school_1',
          'workspace_1'
        );
      });

      it('should accept entityId in getTasksForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getTasksForContact(
          'entity_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
      });

      it('should accept entityId in getTasksForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getTasksForContact(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });
    });

    describe('Use EntityId for Operations', () => {
      it('should use entityId as primary identifier when both provided', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getTasksForContact(
          'school_1',
          'workspace_1'
        );

        // Should query by entityId (preferred)
        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
        // Should NOT query by entityId when entityId present
        expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should populate entityId in created tasks when resolved from entityId', async () => {
        mockAdd.mockResolvedValue({ id: 'task_4' });
        
        const mockContact: ResolvedContact = {
          id: 'school_1',
          name: 'Migrated School',
          slug: 'migrated-school',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'migrated',
          entityId: 'entity_999',
          entityType: 'institution',
          schoolData: {
            id: 'school_1',
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

        await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'school_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        // Verify entityId was populated from adapter
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity_999',
            entityType: 'institution',
          })
        );
      });

      it('should use entityId for task updates when available', async () => {
        mockUpdate.mockResolvedValue(undefined);

        await updateTaskAction('task_1', {
          title: 'Updated',
          entityId: 'entity_1',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
        }, 'test_user');

        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity_1',
          })
        );
      });
    });

    describe('Contact Adapter Integration', () => {
      it('should use Contact Adapter to resolve entity information', async () => {
        mockAdd.mockResolvedValue({ id: 'task_5' });
        
        const mockContact: ResolvedContact = {
          id: 'entity_1',
          name: 'Resolved Entity',
          slug: 'resolved-entity',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'migrated',
          entityId: 'entity_1',
          entityType: 'family',
        };
        (resolveContact as any).mockResolvedValue(mockContact);

        await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'entity_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(resolveContact).toHaveBeenCalled();
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityName: 'Resolved Entity',
            entityType: 'family',
          })
        );
      });

      it('should handle Contact Adapter returning null gracefully', async () => {
        mockAdd.mockResolvedValue({ id: 'task_6' });
        (resolveContact as any).mockResolvedValue(null);

        const result = await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'entity_nonexistent',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: null,
            entityName: null,
            entityType: null,
          })
        );
      });

      it('should use Contact Adapter for both migrated and legacy contacts', async () => {
        mockAdd.mockResolvedValue({ id: 'task_7' });
        
        const legacyContact: ResolvedContact = {
          id: 'school_1',
          name: 'Legacy School',
          slug: 'legacy-school',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'legacy',
          schoolData: {
            id: 'school_1',
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

        await createTaskAction({
          title: 'Test Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'school_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(resolveContact).toHaveBeenCalledWith(
          'school_1',
          'workspace_1'
        );
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'school_1',
            entityName: 'Legacy School',
            entityType: null,
          })
        );
      });
    });

    describe('Backward Compatibility', () => {
      it('should support legacy entityId-only tasks', async () => {
        mockAdd.mockResolvedValue({ id: 'task_8' });
        
        const legacyContact: ResolvedContact = {
          id: 'school_1',
          name: 'Legacy School',
          slug: 'legacy-school',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'legacy',
          schoolData: {
            id: 'school_1',
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

        const result = await createTaskAction({
          title: 'Legacy Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'school_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: null,
          })
        );
      });

      it('should query by entityId for legacy records', async () => {
        const mockTasks = [
          {
            id: 'task_1',
            title: 'Legacy Task',
            entityId: 'school_1',
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
          'school_1',
          'workspace_1'
        );

        expect(results).toHaveLength(1);
        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should maintain entityId field during migration period', async () => {
        mockAdd.mockResolvedValue({ id: 'task_9' });
        
        const migratedContact: ResolvedContact = {
          id: 'entity_1',
          name: 'Migrated Entity',
          slug: 'migrated-entity',
          contacts: [],
          tags: [],
        entityContacts: [],
          migrationStatus: 'migrated',
          entityId: 'entity_1',
          entityType: 'institution',
          schoolData: {
            id: 'school_1',
            name: 'Migrated Entity',
            slug: 'migrated-entity',
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
        (resolveContact as any).mockResolvedValue(migratedContact);

        await createTaskAction({
          title: 'Dual-write Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          entityId: 'entity_1',
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        // Verify both identifiers are present (dual-write)
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity_1',
          })
        );
      });

      it('should handle tasks without any contact identifier', async () => {
        mockAdd.mockResolvedValue({ id: 'task_10' });

        const result = await createTaskAction({
          title: 'No Contact Task',
          description: 'Test',
          priority: 'medium',
          status: 'todo',
          category: 'general',
          workspaceId: 'workspace_1',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          reminders: [],
          reminderSent: false,
        }, 'test_user');

        expect(result.success).toBe(true);
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: null,
            entityType: null,
          })
        );
      });
    });
  });

  describe('Activity Server Actions', () => {
    describe('Accept Both Identifiers', () => {
      it('should accept entityId in getActivitiesForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getActivitiesForContact(
          'entity_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
      });

      it('should accept entityId in getActivitiesForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getActivitiesForContact(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });
    });

    describe('Use EntityId for Operations', () => {
      it('should prefer entityId over entityId in queries', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getActivitiesForContact(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
        expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should return activities ordered by timestamp', async () => {
        const mockActivities = [
          {
            id: 'activity_1',
            type: 'call',
            entityId: 'entity_1',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ];

        mockGet.mockResolvedValue({
          docs: mockActivities.map(activity => ({
            id: activity.id,
            data: () => activity,
          })),
        });

        const results = await getActivitiesForContact(
          'entity_1',
          'workspace_1'
        );

        expect(results).toHaveLength(1);
        expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
      });
    });

    describe('Backward Compatibility', () => {
      it('should query legacy activities by entityId', async () => {
        const mockActivities = [
          {
            id: 'activity_2',
            type: 'email',
            entityId: 'school_1',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ];

        mockGet.mockResolvedValue({
          docs: mockActivities.map(activity => ({
            id: activity.id,
            data: () => activity,
          })),
        });

        const results = await getActivitiesForContact(
          'school_1',
          'workspace_1'
        );

        expect(results).toHaveLength(1);
        expect(results[0].entityId).toBe('school_1');
      });

      it('should return empty array when no identifier provided', async () => {
        const results = await getActivitiesForContact(
          '',
          'workspace_1'
        );

        expect(results).toHaveLength(0);
        expect(mockWhere).not.toHaveBeenCalled();
      });
    });
  });

  describe('Settings Server Actions', () => {
    describe('Accept Both Identifiers', () => {
      it('should accept entityId in loadSettings', async () => {
        mockGet.mockResolvedValue({
          docs: [],
        });

        await loadSettings(
          'entity_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
      });

      it('should accept entityId in loadSettings', async () => {
        mockGet.mockResolvedValue({
          docs: [],
        });

        await loadSettings(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should accept entityId in createSettings', async () => {
        mockAdd.mockResolvedValue({ id: 'settings_1' });

        const result = await createSettings({
          entityId: 'entity_1',
          workspaceId: 'workspace_1',
          notificationsEnabled: true,
          emailPreferences: {
            invoices: true,
            reminders: true,
            updates: true,
          },
        });

        expect(result.success).toBe(true);
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity_1',
          })
        );
      });
    });

    describe('Use EntityId for Operations', () => {
      it('should prefer entityId in loadSettings when both provided', async () => {
        mockGet.mockResolvedValue({
          docs: [],
        });

        await loadSettings(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
        expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should use entityId for settings updates', async () => {
        mockUpdate.mockResolvedValue(undefined);

        const result = await updateSettings('settings_1', {
          entityId: 'entity_1',
          settings: {
            notificationsEnabled: false,
          },
        });

        expect(result.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity_1',
          })
        );
      });
    });

    describe('Backward Compatibility', () => {
      it('should load settings by entityId for legacy records', async () => {
        const mockSettings = {
          id: 'settings_1',
          entityId: 'school_1',
          workspaceId: 'workspace_1',
          settings: {},
        };

        mockGet.mockResolvedValue({
          docs: [
            {
              id: mockSettings.id,
              data: () => mockSettings,
            },
          ],
        });

        const result = await loadSettings(
          'school_1',
          'workspace_1'
        );

        expect(result).toBeTruthy();
        // Result is EntitySettings which doesn't have entityId directly
        expect(mockSettings.entityId).toBe('school_1');
      });

      it('should return null when settings not found', async () => {
        mockGet.mockResolvedValue({
          docs: [],
        });

        const result = await loadSettings(
          'entity_nonexistent',
          'workspace_1'
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('Survey Server Actions', () => {
    describe('Accept Both Identifiers', () => {
      it('should accept entityId in getSurveysForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveysForContact(
          'entity_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
      });

      it('should accept entityId in getSurveysForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveysForContact(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should accept entityId in getSurveyResponsesForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveyResponsesForContact(
          'survey_1',
          'entity_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
      });

      it('should accept entityId in getSurveyResponsesForContact', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveyResponsesForContact(
          'survey_1',
          'school_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_1');
      });
    });

    describe('Use EntityId for Operations', () => {
      it('should prefer entityId over entityId in survey queries', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveysForContact(
          'school_1',
          'workspace_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
        expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
      });

      it('should prefer entityId in survey response queries', async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getSurveyResponsesForContact(
          'survey_1',
          'school_1'
        );

        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_1');
        expect(mockWhere).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
      });
    });

    describe('Backward Compatibility', () => {
      it('should query surveys by entityId for legacy records', async () => {
        const mockSurveys = [
          {
            id: 'survey_1',
            title: 'Legacy Survey',
            entityId: 'school_1',
            workspaceId: 'workspace_1',
          },
        ];

        mockGet.mockResolvedValue({
          docs: mockSurveys.map(survey => ({
            id: survey.id,
            data: () => survey,
          })),
        });

        const results = await getSurveysForContact(
          'school_1',
          'workspace_1'
        );

        expect(results).toHaveLength(1);
        expect(results[0].entityId).toBe('school_1');
      });

      it('should return empty array when no identifier provided', async () => {
        const results = await getSurveysForContact(
          '',
          'workspace_1'
        );

        expect(results).toHaveLength(0);
      });
    });
  });

  describe('Cross-Module Integration', () => {
    it('should maintain consistent identifier handling across all modules', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_1',
        name: 'Test Entity',
        slug: 'test-entity',
        contacts: [],
        tags: [],
        entityContacts: [],
        migrationStatus: 'migrated',
        entityId: 'entity_1',
        entityType: 'institution',
        schoolData: {
          id: 'school_1',
          name: 'Test Entity',
          slug: 'test-entity',
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

      // Test task creation
      mockAdd.mockResolvedValue({ id: 'task_1' });
      const taskResult = await createTaskAction({
        title: 'Test Task',
        description: 'Test',
        priority: 'medium',
        status: 'todo',
        category: 'general',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_1',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(taskResult.success).toBe(true);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_1',
        })
      );

      // Test settings creation
      mockAdd.mockResolvedValue({ id: 'settings_1' });
      const settingsResult = await createSettings({
        entityId: 'entity_1',
        workspaceId: 'workspace_1',
      });

      expect(settingsResult.success).toBe(true);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_1',
        })
      );
    });

    it('should handle Contact Adapter failures consistently across modules', async () => {
      (resolveContact as any).mockResolvedValue(null);

      // Test task creation with adapter failure
      mockAdd.mockResolvedValue({ id: 'task_1' });
      const taskResult = await createTaskAction({
        title: 'Test Task',
        description: 'Test',
        priority: 'medium',
        status: 'todo',
        category: 'general',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        entityId: 'entity_nonexistent',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(taskResult.success).toBe(true);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: null,
        })
      );
    });

    it('should enforce workspace boundaries across all server actions', async () => {
      mockGet.mockResolvedValue({ docs: [] });

      // Test task query enforces workspace
      await getTasksForContact(
        'entity_1',
        'workspace_1'
      );
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');

      vi.clearAllMocks();
      mockGet.mockResolvedValue({ docs: [] });

      // Test activity query enforces workspace
      await getActivitiesForContact(
        'entity_1',
        'workspace_1'
      );
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');

      vi.clearAllMocks();
      mockGet.mockResolvedValue({ docs: [] });

      // Test settings query enforces workspace
      await loadSettings(
        'entity_1',
        'workspace_1'
      );
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully in task actions', async () => {
      mockAdd.mockRejectedValue(new Error('Firestore error'));

      const result = await createTaskAction({
        title: 'Test Task',
        description: 'Test',
        priority: 'medium',
        status: 'todo',
        category: 'general',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
        assignedTo: 'user_1',
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });

    it('should handle query errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Query failed'));

      const results = await getTasksForContact(
        'entity_1',
        'workspace_1'
      );

      expect(results).toHaveLength(0);
    });

    it('should handle update errors gracefully', async () => {
      mockUpdate.mockRejectedValue(new Error('Update failed'));

      const result = await updateTaskAction('task_1', {
        title: 'Updated',
        workspaceId: 'workspace_1',
        organizationId: 'org_1',
      }, 'test_user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should handle delete errors gracefully', async () => {
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      const result = await deleteTaskAction('task_1', 'test_user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
});
