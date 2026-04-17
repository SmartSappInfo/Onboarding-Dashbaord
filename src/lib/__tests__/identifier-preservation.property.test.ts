/**
 * Property-Based Tests: Identifier Preservation Invariant
 * 
 * **Property 3: Identifier Preservation Invariant**
 * **Validates: Requirements 3.2**
 * 
 * For any record update operation on tasks, invoices, or meetings, the entityId,
 * entityId, and entityType fields should remain unchanged unless explicitly being migrated.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { Task, EntityType } from '../types';

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

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'tasks') {
          return {
            doc: vi.fn((docId: string) => ({
              update: vi.fn().mockImplementation(async (data: any) => {
                const existingTask = tasks.get(docId);
                if (!existingTask) {
                  throw new Error(`Task ${docId} not found`);
                }
                // Merge updates with existing task
                const updatedTask = { ...existingTask, ...data };
                tasks.set(docId, updatedTask);
              }),
              get: vi.fn().mockImplementation(async () => {
                const task = tasks.get(docId);
                return {
                  exists: !!task,
                  data: () => task,
                  id: docId,
                };
              }),
            })),
          };
        }
        return {};
      }),
    },
  };
});

// Import after mocks
import { updateTaskAction } from '../task-server-actions';

// Test storage access
const __testStorage = {
  tasks,
  reset: () => {
    tasks.clear();
  },
};

// Fast-check arbitraries
const entityTypeArbitrary = fc.constantFrom<EntityType>('institution', 'family', 'person');

const taskArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }).map(s => `task_${s}`),
  workspaceId: fc.string({ minLength: 10, maxLength: 20 }),
  title: fc.string({ minLength: 5, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 500 }),
  priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
  status: fc.constantFrom('todo', 'in_progress', 'waiting', 'review', 'done'),
  category: fc.constantFrom('call', 'visit', 'document', 'training', 'general'),
  assignedTo: fc.string({ minLength: 10, maxLength: 20 }),
  dueDate: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2026-12-31').getTime() })
    .map(timestamp => new Date(timestamp).toISOString()),
  entityId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `entity_${s}`), { nil: null }),
  entityType: fc.option(entityTypeArbitrary, { nil: null }),
  createdAt: fc.constant(new Date('2024-01-01').toISOString()),
  updatedAt: fc.constant(new Date('2024-01-01').toISOString()),
});

const taskUpdatesArbitrary = fc.record({
  title: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
  priority: fc.option(fc.constantFrom('low', 'medium', 'high', 'urgent'), { nil: undefined }),
  status: fc.option(fc.constantFrom('todo', 'in_progress', 'waiting', 'review', 'done'), { nil: undefined }),
  category: fc.option(fc.constantFrom('call', 'visit', 'document', 'training', 'general'), { nil: undefined }),
  assignedTo: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
  dueDate: fc.option(
    fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2026-12-31').getTime() })
      .map(timestamp => new Date(timestamp).toISOString()),
    { nil: undefined }
  ),
}).filter(updates => {
  // Ensure at least one field is being updated
  return Object.values(updates).some(value => value !== undefined);
});

describe('Property 3: Identifier Preservation Invariant', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should preserve entityId, and entityType when updating other task fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary,
        taskUpdatesArbitrary,
        async (task, updates) => {
          // Setup: Create task in storage
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Update task with non-identifier fields
          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: Identifiers remain unchanged
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBe(originalSchoolId);
          expect(updatedTask.entityId).toBe(originalEntityId);
          expect(updatedTask.entityType).toBe(originalEntityType);

          // Verify: Other fields were updated
          if (updates.title !== undefined) {
            expect(updatedTask.title).toBe(updates.title);
          }
          if (updates.description !== undefined) {
            expect(updatedTask.description).toBe(updates.description);
          }
          if (updates.status !== undefined) {
            expect(updatedTask.status).toBe(updates.status);
          }
          if (updates.priority !== undefined) {
            expect(updatedTask.priority).toBe(updates.priority);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve identifiers across multiple sequential updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary,
        fc.array(taskUpdatesArbitrary, { minLength: 2, maxLength: 5 }),
        async (task, updateSequence) => {
          // Setup: Create task in storage
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Apply multiple updates sequentially
          for (const updates of updateSequence) {
            const result = await updateTaskAction(task.id, updates, 'test_user');
            expect(result.success).toBe(true);
          }

          // Verify: Identifiers remain unchanged after all updates
          const finalTask = __testStorage.tasks.get(task.id);
          expect(finalTask).toBeDefined();
          expect(finalTask.entityId).toBe(originalSchoolId);
          expect(finalTask.entityId).toBe(originalEntityId);
          expect(finalTask.entityType).toBe(originalEntityType);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve null identifiers when updating tasks without contact association', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary.map(task => ({ ...task, entityId: null, entityType: null })),
        taskUpdatesArbitrary,
        async (task, updates) => {
          // Setup: Create task with null identifiers
          __testStorage.tasks.set(task.id, task);

          // Execute: Update task
          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: Identifiers remain null
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBeNull();
          expect(updatedTask.entityId).toBeNull();
          expect(updatedTask.entityType).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve identifiers when updating task status to done', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary.filter(task => task.status !== 'done'),
        async (task) => {
          // Setup: Create task in storage
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Mark task as done
          const result = await updateTaskAction(task.id, {
            status: 'done',
            workspaceId: task.workspaceId,
            title: task.title,
          }, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: Identifiers remain unchanged
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBe(originalSchoolId);
          expect(updatedTask.entityId).toBe(originalEntityId);
          expect(updatedTask.entityType).toBe(originalEntityType);

          // Verify: Status was updated
          expect(updatedTask.status).toBe('done');
          expect(updatedTask.completedAt).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve identifiers for tasks with only entityId (legacy)', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary.map(task => ({
          ...task,
          entityId: null,
          entityType: null,
        })),
        taskUpdatesArbitrary,
        async (task, updates) => {
          // Setup: Create legacy task with only entityId
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;

          // Execute: Update task
          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: entityId preserved, entityId and entityType remain null
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBe(originalSchoolId);
          expect(updatedTask.entityId).toBeNull();
          expect(updatedTask.entityType).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve identifiers for tasks with only entityId (migrated)', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary.map(task => ({
          ...task,
          entityId: `entity_${Math.random().toString(36).substring(7)}`,
          entityType: 'institution' as EntityType,
        })),
        taskUpdatesArbitrary,
        async (task, updates) => {
          // Setup: Create migrated task with only entityId
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Update task
          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: entityId and entityType preserved, entityId remains null
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBeNull();
          expect(updatedTask.entityId).toBe(originalEntityId);
          expect(updatedTask.entityType).toBe(originalEntityType);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve identifiers for tasks with both entityId and entityId (dual-write)', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary.filter(task => task.entityId !== null && task.entityId !== null),
        taskUpdatesArbitrary,
        async (task, updates) => {
          // Setup: Create task with both identifiers
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Update task
          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: Both identifiers preserved
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBe(originalSchoolId);
          expect(updatedTask.entityId).toBe(originalEntityId);
          expect(updatedTask.entityType).toBe(originalEntityType);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve identifiers when updating all non-identifier fields simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArbitrary,
        async (task) => {
          // Setup: Create task in storage
          __testStorage.tasks.set(task.id, task);

          // Capture original identifier values
          const originalSchoolId = task.entityId;
          const originalEntityId = task.entityId;
          const originalEntityType = task.entityType;

          // Execute: Update all non-identifier fields
          const updates = {
            title: 'Updated Title',
            description: 'Updated Description',
            priority: 'high' as const,
            status: 'in_progress' as const,
            category: 'call' as const,
            assignedTo: 'user_updated',
            dueDate: new Date('2025-12-31').toISOString(),
          };

          const result = await updateTaskAction(task.id, updates, 'test_user');

          // Verify: Update succeeded
          expect(result.success).toBe(true);

          // Verify: Identifiers remain unchanged
          const updatedTask = __testStorage.tasks.get(task.id);
          expect(updatedTask).toBeDefined();
          expect(updatedTask.entityId).toBe(originalSchoolId);
          expect(updatedTask.entityId).toBe(originalEntityId);
          expect(updatedTask.entityType).toBe(originalEntityType);

          // Verify: All other fields were updated
          expect(updatedTask.title).toBe(updates.title);
          expect(updatedTask.description).toBe(updates.description);
          expect(updatedTask.priority).toBe(updates.priority);
          expect(updatedTask.status).toBe(updates.status);
          expect(updatedTask.category).toBe(updates.category);
          expect(updatedTask.assignedTo).toBe(updates.assignedTo);
          expect(updatedTask.dueDate).toBe(updates.dueDate);
        }
      ),
      { numRuns: 50 }
    );
  });
});
