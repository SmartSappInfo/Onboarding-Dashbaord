/**
 * Unit Tests: Dual-Write Edge Cases
 * 
 * Task 26.5: Write unit tests for dual-write edge cases
 * 
 * Tests record creation with various identifier combinations:
 * - entityId only
 * - entityId only
 * - both identifiers
 * - neither identifier (error case)
 * 
 * Requirements: 26.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task, Activity, MessageLog, EntityType } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

// In-memory storage for testing
const tasks = new Map<string, any>();
const activities = new Map<string, any>();
const messageLogs = new Map<string, any>();
const entities = new Map<string, any>();
const schools = new Map<string, any>();
const workspaceEntities = new Map<string, any>();

// Mock contact adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockImplementation(async (
    identifier: { entityId?: string },
    workspaceId: string
  ) => {
    // Try to resolve by entityId first
    if (identifier.entityId) {
      const entity = entities.get(identifier.entityId);
      if (entity) {
        const weKey = `${workspaceId}_${identifier.entityId}`;
        const workspaceEntity = workspaceEntities.get(weKey);
        
        return {
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          contacts: entity.contacts || [],
          entityType: entity.entityType,
          entityId: entity.id,
          migrationStatus: 'migrated',
          schoolData: identifier.entityId ? schools.get(identifier.entityId) : undefined,
          tags: workspaceEntity?.workspaceTags || [],
        };
      }
    }
    
    // Fallback to entityId
    if (identifier.entityId) {
      const school = schools.get(identifier.entityId);
      if (school) {
        // Check if school is migrated
        if (school.migrationStatus === 'migrated' && school.entityId) {
          const entity = entities.get(school.entityId);
          if (entity) {
            const weKey = `${workspaceId}_${school.entityId}`;
            const workspaceEntity = workspaceEntities.get(weKey);
            
            return {
              id: entity.id,
              name: entity.name,
              slug: entity.slug,
              contacts: entity.contacts || [],
              entityType: entity.entityType,
              entityId: entity.id,
              migrationStatus: 'migrated',
              schoolData: school,
              tags: workspaceEntity?.workspaceTags || [],
            };
          }
        }
        
        // Legacy school (not migrated)
        return {
          id: school.id,
          name: school.name,
          slug: school.slug,
          contacts: school.focalPersons || [],
          migrationStatus: 'legacy',
          schoolData: school,
          tags: school.tags || [],
        };
      }
    }
    
    return null;
  })
}));

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        const storage = collectionName === 'tasks' ? tasks :
                       collectionName === 'activities' ? activities :
                       collectionName === 'message_logs' ? messageLogs :
                       new Map();
        
        return {
          add: vi.fn().mockImplementation(async (data: any) => {
            const id = `${collectionName}_${Date.now()}_${Math.random()}`;
            storage.set(id, { ...data, id });
            return { id };
          }),
          doc: vi.fn((docId: string) => ({
            set: vi.fn().mockImplementation(async (data: any) => {
              storage.set(docId, { ...data, id: docId });
            }),
          })),
        };
      }),
    },
  };
});

// Import after mocks
import { createTaskAction } from '../task-server-actions';

// Test storage access
const __testStorage = {
  tasks,
  activities,
  messageLogs,
  entities,
  schools,
  workspaceEntities,
  reset: () => {
    tasks.clear();
    activities.clear();
    messageLogs.clear();
    entities.clear();
    schools.clear();
    workspaceEntities.clear();
  },
};

describe('Dual-Write Edge Cases - Task Creation', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  describe('Edge Case 1: Record creation with entityId only', () => {
    it('should create task with entityId and populate entityType', async () => {
      // Setup: Create entity
      const entity = {
        id: 'entity_test_123',
        name: 'Test Institution',
        slug: 'test-institution',
        entityType: 'institution' as EntityType,
        contacts: [
          { name: 'John Doe', email: 'john@test.com', phone: '1234567890' }
        ],
      };
      
      const workspaceId = 'workspace_test_123';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with only entityId
      const result = await createTaskAction({
        workspaceId,
        title: 'Test Task',
        description: 'Test Description',
        priority: 'medium',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_123',
        dueDate: '2024-06-01T00:00:00.000Z',
        entityId: entity.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      // Verify task was created with entityId and entityType
      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('institution');
      expect(createdTask.entityId).toBeNull();
      // entityName may be populated from entity name during resolution
      expect(createdTask.entityName).toBeDefined();
    });

    it('should create task with entityId for family entity type', async () => {
      // Setup: Create family entity
      const entity = {
        id: 'entity_family_456',
        name: 'Smith Family',
        slug: 'smith-family',
        entityType: 'family' as EntityType,
        contacts: [
          { name: 'Jane Smith', email: 'jane@smith.com', phone: '9876543210' }
        ],
      };
      
      const workspaceId = 'workspace_test_456';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with only entityId
      const result = await createTaskAction({
        workspaceId,
        title: 'Family Follow-up',
        description: 'Follow up with family',
        priority: 'high',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_456',
        dueDate: '2024-07-01T00:00:00.000Z',
        entityId: entity.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('family');
      expect(createdTask.entityId).toBeNull();
    });

    it('should create task with entityId for person entity type', async () => {
      // Setup: Create person entity
      const entity = {
        id: 'entity_person_789',
        name: 'Bob Johnson',
        slug: 'bob-johnson',
        entityType: 'person' as EntityType,
        contacts: [
          { name: 'Bob Johnson', email: 'bob@example.com', phone: '5551234567' }
        ],
      };
      
      const workspaceId = 'workspace_test_789';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with only entityId
      const result = await createTaskAction({
        workspaceId,
        title: 'Person Contact',
        description: 'Contact person',
        priority: 'low',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_789',
        dueDate: '2024-08-01T00:00:00.000Z',
        entityId: entity.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('person');
      expect(createdTask.entityId).toBeNull();
    });
  });

  describe('Edge Case 2: Record creation with entityId only', () => {
    it('should create task with entityId only for legacy (non-migrated) school', async () => {
      // Setup: Create legacy school (not migrated)
      const school = {
        id: 'school_legacy_123',
        name: 'Legacy School',
        slug: 'legacy-school',
        migrationStatus: 'not_started',
        focalPersons: [
          { name: 'Principal Smith', email: 'principal@legacy.com', phone: '1112223333' }
        ],
        tags: [],
        entityContacts: [],
      };
      
      const workspaceId = 'workspace_legacy_123';
      
      __testStorage.schools.set(school.id, school);

      // Create task with only entityId
      const result = await createTaskAction({
        workspaceId,
        title: 'Legacy Task',
        description: 'Task for legacy school',
        priority: 'medium',
        status: 'todo',
        category: 'visit',
        assignedTo: 'user_legacy',
        dueDate: '2024-09-01T00:00:00.000Z',
        entityId: school.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      // Verify task was created with entityId but no entityId
      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(school.id);
      expect(createdTask.entityName).toBe(school.name);
      expect(createdTask.entityId).toBeNull();
      // entityType should be null (not undefined) when no entity
      expect(createdTask.entityType).toBeNull();
    });

    it('should create task with both identifiers when entityId is for migrated school', async () => {
      // Setup: Create migrated school with entity
      const entity = {
        id: 'entity_migrated_456',
        name: 'Migrated School',
        slug: 'migrated-school',
        entityType: 'institution' as EntityType,
        contacts: [],
      };
      
      const school = {
        id: 'school_migrated_456',
        name: 'Migrated School',
        slug: 'migrated-school',
        migrationStatus: 'migrated',
        entityId: entity.id,
        focalPersons: [],
        tags: [],
        entityContacts: [],
      };
      
      const workspaceId = 'workspace_migrated_456';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.schools.set(school.id, school);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with only entityId (but school is migrated)
      const result = await createTaskAction({
        workspaceId,
        title: 'Migrated School Task',
        description: 'Task for migrated school',
        priority: 'high',
        status: 'todo',
        category: 'document',
        assignedTo: 'user_migrated',
        dueDate: '2024-10-01T00:00:00.000Z',
        entityId: school.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      // Verify task was created with both identifiers (dual-write)
      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(school.id);
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('institution');
    });
  });

  describe('Edge Case 3: Record creation with both identifiers', () => {
    it('should create task with both entityId and entityId when both provided', async () => {
      // Setup: Create entity and school
      const entity = {
        id: 'entity_both_789',
        name: 'Both Identifiers School',
        slug: 'both-identifiers',
        entityType: 'institution' as EntityType,
        contacts: [],
      };
      
      const school = {
        id: 'school_both_789',
        name: 'Both Identifiers School',
        slug: 'both-identifiers',
        migrationStatus: 'migrated',
        entityId: entity.id,
        focalPersons: [],
        tags: [],
        entityContacts: [],
      };
      
      const workspaceId = 'workspace_both_789';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.schools.set(school.id, school);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with both identifiers
      const result = await createTaskAction({
        workspaceId,
        title: 'Both Identifiers Task',
        description: 'Task with both identifiers',
        priority: 'urgent',
        status: 'todo',
        category: 'training',
        assignedTo: 'user_both',
        dueDate: '2024-11-01T00:00:00.000Z',
        entityId: entity.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      // Verify task was created with both identifiers preserved
      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(school.id);
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('institution');
      expect(createdTask.entityName).toBe(entity.name);
    });

    it('should handle mismatched identifiers gracefully', async () => {
      // Setup: Create entity and unrelated school
      const entity = {
        id: 'entity_mismatch_111',
        name: 'Entity A',
        slug: 'entity-a',
        entityType: 'institution' as EntityType,
        contacts: [],
      };
      
      const school = {
        id: 'school_mismatch_222',
        name: 'School B',
        slug: 'school-b',
        migrationStatus: 'not_started',
        focalPersons: [],
        tags: [],
        entityContacts: [],
      };
      
      const workspaceId = 'workspace_mismatch_111';
      
      __testStorage.entities.set(entity.id, entity);
      __testStorage.schools.set(school.id, school);
      __testStorage.workspaceEntities.set(
        `${workspaceId}_${entity.id}`,
        {
          id: `${workspaceId}_${entity.id}`,
          workspaceId,
          entityId: entity.id,
          workspaceTags: [],
        }
      );

      // Create task with mismatched identifiers (entityId takes precedence)
      const result = await createTaskAction({
        workspaceId,
        title: 'Mismatched Identifiers Task',
        description: 'Task with mismatched identifiers',
        priority: 'medium',
        status: 'todo',
        category: 'general',
        assignedTo: 'user_mismatch',
        dueDate: '2024-12-01T00:00:00.000Z',
        entityId: entity.id,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      // Verify task uses entityId as primary (entityId takes precedence)
      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe(entity.id);
      expect(createdTask.entityType).toBe('institution');
      // entityId should still be preserved even if mismatched
      expect(createdTask.entityId).toBe(school.id);
    });
  });

  describe('Edge Case 4: Record creation with neither identifier (error case)', () => {
    it('should handle task creation without any contact identifier', async () => {
      // Create task without entityId or entityId
      const result = await createTaskAction({
        workspaceId: 'workspace_no_contact',
        title: 'No Contact Task',
        description: 'Task without contact',
        priority: 'low',
        status: 'todo',
        category: 'general',
        assignedTo: 'user_no_contact',
        dueDate: '2025-01-01T00:00:00.000Z',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      // Task creation should succeed but with null identifiers
      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBeNull();
      expect(createdTask.entityId).toBeNull();
      // entityType should be null (not undefined) when no identifiers
      expect(createdTask.entityType).toBeNull();
    });

    it('should handle task creation with invalid entityId', async () => {
      // Create task with non-existent entityId
      const result = await createTaskAction({
        workspaceId: 'workspace_invalid',
        title: 'Invalid Entity Task',
        description: 'Task with invalid entityId',
        priority: 'medium',
        status: 'todo',
        category: 'call',
        assignedTo: 'user_invalid',
        dueDate: '2025-02-01T00:00:00.000Z',
        entityId: 'entity_nonexistent_999',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      // Task creation should still succeed (graceful degradation)
      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe('entity_nonexistent_999');
      expect(createdTask.entityId).toBeNull();
    });

    it('should handle task creation with invalid entityId', async () => {
      // Create task with non-existent entityId
      const result = await createTaskAction({
        workspaceId: 'workspace_invalid_school',
        title: 'Invalid School Task',
        description: 'Task with invalid entityId',
        priority: 'high',
        status: 'todo',
        category: 'visit',
        assignedTo: 'user_invalid_school',
        dueDate: '2025-03-01T00:00:00.000Z',
        entityId: 'school_nonexistent_888',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      // Task creation should still succeed (graceful degradation)
      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBe('school_nonexistent_888');
      expect(createdTask.entityId).toBeNull();
    });
  });

  describe('Edge Case 5: Null vs undefined handling', () => {
    it('should handle explicit null values for identifiers', async () => {
      const result = await createTaskAction({
        workspaceId: 'workspace_null_test',
        title: 'Null Identifiers Task',
        description: 'Task with explicit null identifiers',
        priority: 'low',
        status: 'todo',
        category: 'general',
        assignedTo: 'user_null',
        dueDate: '2025-04-01T00:00:00.000Z',
        entityId: null,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.entityId).toBeNull();
      expect(createdTask.entityId).toBeNull();
    });

    it('should handle undefined values for identifiers', async () => {
      const result = await createTaskAction({
        workspaceId: 'workspace_undefined_test',
        title: 'Undefined Identifiers Task',
        description: 'Task with undefined identifiers',
        priority: 'medium',
        status: 'todo',
        category: 'document',
        assignedTo: 'user_undefined',
        dueDate: '2025-05-01T00:00:00.000Z',
        entityId: undefined,
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      // Undefined should be converted to null in storage
      expect(createdTask.entityId).toBeNull();
      expect(createdTask.entityId).toBeNull();
    });
  });

  describe('Edge Case 6: Empty string handling', () => {
    it('should handle empty string identifiers', async () => {
      const result = await createTaskAction({
        workspaceId: 'workspace_empty_test',
        title: 'Empty String Identifiers Task',
        description: 'Task with empty string identifiers',
        priority: 'low',
        status: 'todo',
        category: 'general',
        assignedTo: 'user_empty',
        dueDate: '2025-06-01T00:00:00.000Z',
        entityId: '',
        reminders: [],
        reminderSent: false,
      }, 'test_user');

      expect(result.success).toBe(true);

      const createdTask = Array.from(__testStorage.tasks.values()).find(
        (t: any) => t.id === result.id
      );

      expect(createdTask).toBeDefined();
      // Empty strings should be treated as null or invalid
      expect(createdTask.entityId === '' || createdTask.entityId === null).toBe(true);
      expect(createdTask.entityId === '' || createdTask.entityId === null).toBe(true);
    });
  });
});

describe('Dual-Write Edge Cases - Activity Logging', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should log activity with entityId only', () => {
    const activity = {
      id: 'activity_entity_only',
      workspaceId: 'workspace_123',
      type: 'note' as const,
      description: 'Test activity',
      entityId: 'entity_123',
      entityType: 'institution' as EntityType,
      userId: 'user_123',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    __testStorage.activities.set(activity.id, activity);

    const stored = __testStorage.activities.get(activity.id);
    expect(stored.entityId).toBe('entity_123');
    expect(stored.entityType).toBe('institution');
    expect(stored.entityId).toBeNull();
  });

  it('should log activity with entityId only', () => {
    const activity = {
      id: 'activity_school_only',
      workspaceId: 'workspace_456',
      type: 'call' as const,
      description: 'Test call',
      entityId: 'school_456',
      entityName: 'Test School',
      userId: 'user_456',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    __testStorage.activities.set(activity.id, activity);

    const stored = __testStorage.activities.get(activity.id);
    expect(stored.entityId).toBe('school_456');
    expect(stored.entityName).toBe('Test School');
    expect(stored.entityId).toBeNull();
  });

  it('should log activity with both identifiers', () => {
    const activity = {
      id: 'activity_both',
      workspaceId: 'workspace_789',
      type: 'meeting' as const,
      description: 'Test meeting',
      entityId: 'school_789',
      entityName: 'Test School',
      entityType: 'institution' as EntityType,
      userId: 'user_789',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    __testStorage.activities.set(activity.id, activity);

    const stored = __testStorage.activities.get(activity.id);
    expect(stored.entityId).toBe('school_789');
    expect(stored.entityId).toBe('entity_789');
    expect(stored.entityType).toBe('institution');
  });

  it('should log activity with neither identifier', () => {
    const activity = {
      id: 'activity_neither',
      workspaceId: 'workspace_000',
      type: 'note' as const,
      description: 'General note',
      entityId: null,
      userId: 'user_000',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    __testStorage.activities.set(activity.id, activity);

    const stored = __testStorage.activities.get(activity.id);
    expect(stored.entityId).toBeNull();
    expect(stored.entityId).toBeNull();
  });
});

describe('Dual-Write Edge Cases - Message Logs', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should create message log with entityId only', () => {
    const messageLog = {
      id: 'msg_entity_only',
      workspaceId: 'workspace_msg_123',
      messageType: 'email' as const,
      recipient: 'test@example.com',
      subject: 'Test Email',
      body: 'Test body',
      status: 'sent' as const,
      entityId: 'entity_msg_123',
      entityType: 'institution' as EntityType,
      createdAt: new Date().toISOString(),
    };

    __testStorage.messageLogs.set(messageLog.id, messageLog);

    const stored = __testStorage.messageLogs.get(messageLog.id);
    expect(stored.entityId).toBe('entity_msg_123');
    expect(stored.entityType).toBe('institution');
    expect(stored.entityId).toBeNull();
  });

  it('should create message log with entityId only', () => {
    const messageLog = {
      id: 'msg_school_only',
      workspaceId: 'workspace_msg_456',
      messageType: 'sms' as const,
      recipient: '+1234567890',
      body: 'Test SMS',
      status: 'sent' as const,
      entityId: null,
      createdAt: new Date().toISOString(),
    };

    __testStorage.messageLogs.set(messageLog.id, messageLog);

    const stored = __testStorage.messageLogs.get(messageLog.id);
    expect(stored.entityId).toBe('school_msg_456');
    expect(stored.entityId).toBeNull();
  });

  it('should create message log with both identifiers', () => {
    const messageLog = {
      id: 'msg_both',
      workspaceId: 'workspace_msg_789',
      messageType: 'whatsapp' as const,
      recipient: '+9876543210',
      body: 'Test WhatsApp',
      status: 'delivered' as const,
      entityId: 'entity_msg_789',
      entityType: 'family' as EntityType,
      createdAt: new Date().toISOString(),
    };

    __testStorage.messageLogs.set(messageLog.id, messageLog);

    const stored = __testStorage.messageLogs.get(messageLog.id);
    expect(stored.entityId).toBe('school_msg_789');
    expect(stored.entityId).toBe('entity_msg_789');
    expect(stored.entityType).toBe('family');
  });

  it('should create message log with neither identifier', () => {
    const messageLog = {
      id: 'msg_neither',
      workspaceId: 'workspace_msg_000',
      messageType: 'email' as const,
      recipient: 'general@example.com',
      subject: 'General Email',
      body: 'General body',
      status: 'pending' as const,
      entityId: null,
      createdAt: new Date().toISOString(),
    };

    __testStorage.messageLogs.set(messageLog.id, messageLog);

    const stored = __testStorage.messageLogs.get(messageLog.id);
    expect(stored.entityId).toBeNull();
    expect(stored.entityId).toBeNull();
  });
});

describe('Dual-Write Edge Cases - Type Safety', () => {
  it('should enforce correct entityType values', () => {
    const validTypes: EntityType[] = ['institution', 'family', 'person'];
    
    validTypes.forEach(type => {
      const task = {
        id: `task_type_${type}`,
        workspaceId: 'workspace_type_test',
        title: 'Type Test',
        description: 'Testing entity type',
        priority: 'low' as const,
        status: 'todo' as const,
        category: 'general' as const,
        assignedTo: 'user_type',
        dueDate: '2025-07-01T00:00:00.000Z',
        entityId: `entity_${type}`,
        entityType: type,
        reminders: [],
        reminderSent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      __testStorage.tasks.set(task.id, task);
      const stored = __testStorage.tasks.get(task.id);
      expect(stored.entityType).toBe(type);
    });
  });

  it('should handle missing entityType when entityId is present', () => {
    const task = {
      id: 'task_missing_type',
      workspaceId: 'workspace_missing_type',
      title: 'Missing Type Test',
      description: 'Testing missing entity type',
      priority: 'medium' as const,
      status: 'todo' as const,
      category: 'call' as const,
      assignedTo: 'user_missing',
      dueDate: '2025-08-01T00:00:00.000Z',
      entityId: 'entity_missing_type',
      // entityType is missing
      reminders: [],
      reminderSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    __testStorage.tasks.set(task.id, task);
    const stored = __testStorage.tasks.get(task.id);
    expect(stored.entityId).toBe('entity_missing_type');
    expect(stored.entityType).toBeUndefined();
  });
});
