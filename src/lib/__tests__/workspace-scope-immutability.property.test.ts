/**
 * Property-Based Test: Scope Immutability After Activation
 * 
 * **Property 3: Scope Immutability After Activation**
 * **Validates: Requirements 6**
 * 
 * For any workspace W with at least one active workspace_entities record:
 * - update(W, { contactScope: newScope }) → REJECTED
 * 
 * This test generates workspaces with varying numbers of linked entities (0, 1, N)
 * and asserts that scope changes are accepted only when the count is 0.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { updateWorkspaceScopeAction } from '../workspace-actions';
import type { ContactScope } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

// Mock Firestore
vi.mock('../firebase-admin', () => {
  // In-memory storage for testing
  const workspaces = new Map<string, any>();
  const workspaceEntities = new Map<string, any>();

  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'workspaces') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaces.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = workspaces.get(id) || {};
                workspaces.set(id, { ...existing, ...updates });
              }),
            })),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn((field: string, op: string, value: any) => {
              const filters: Array<{ field: string; op: string; value: any }> = [{ field, op, value }];
              return {
                where: vi.fn((field2: string, op2: string, value2: any) => {
                  filters.push({ field: field2, op: op2, value: value2 });
                  return {
                    limit: vi.fn(() => ({
                      get: vi.fn().mockImplementation(async () => {
                        let results = Array.from(workspaceEntities.values());
                        
                        // Apply filters
                        for (const filter of filters) {
                          results = results.filter((we: any) => {
                            if (filter.op === '==') {
                              return we[filter.field] === filter.value;
                            }
                            return true;
                          });
                        }
                        
                        return {
                          empty: results.length === 0,
                          size: results.length,
                          docs: results.map((data: any) => ({
                            id: data.id,
                            data: () => data,
                          })),
                        };
                      }),
                    })),
                  };
                }),
              };
            }),
          };
        }
        return {};
      }),
    },
    // Expose storage for test setup
    __testStorage: {
      workspaces,
      workspaceEntities,
      reset: () => {
        workspaces.clear();
        workspaceEntities.clear();
      },
    },
  };
});

describe('Property 3: Scope Immutability After Activation', () => {
  let testStorage: {
    workspaces: Map<string, any>;
    workspaceEntities: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should reject scope changes when workspace has active entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // currentScope
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // newScope
        fc.integer({ min: 1, max: 10 }), // activeEntityCount (at least 1)
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (workspaceId, currentScope, newScope, activeEntityCount, userId) => {
          // Setup: Create workspace with current scope
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId: 'org_1',
            name: 'Test Workspace',
            contactScope: currentScope,
            status: 'active',
            scopeLocked: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create N active workspace_entities
          for (let i = 0; i < activeEntityCount; i++) {
            const weId = `we_${workspaceId}_${i}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              workspaceId,
              entityId: `entity_${i}`,
              entityType: currentScope,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Act: Attempt to update scope
          const result = await updateWorkspaceScopeAction(workspaceId, newScope, userId);

          // Assert: Should be rejected
          expect(result.success).toBe(false);
          expect(result.error).toContain('Scope cannot be changed after activation');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow scope changes when workspace has zero active entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // currentScope
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // newScope
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (workspaceId, currentScope, newScope, userId) => {
          // Setup: Create workspace with current scope
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId: 'org_1',
            name: 'Test Workspace',
            contactScope: currentScope,
            status: 'active',
            scopeLocked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: No active workspace_entities (count = 0)
          // Don't add any entities

          // Act: Attempt to update scope
          const result = await updateWorkspaceScopeAction(workspaceId, newScope, userId);

          // Assert: Should be accepted
          expect(result.success).toBe(true);

          // Verify workspace was updated
          const updatedWorkspace = testStorage.workspaces.get(workspaceId);
          expect(updatedWorkspace.contactScope).toBe(newScope);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow scope changes when workspace has inactive entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // currentScope
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // newScope
        fc.integer({ min: 1, max: 10 }), // inactiveEntityCount
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (workspaceId, currentScope, newScope, inactiveEntityCount, userId) => {
          // Setup: Create workspace with current scope
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId: 'org_1',
            name: 'Test Workspace',
            contactScope: currentScope,
            status: 'active',
            scopeLocked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create N inactive workspace_entities (archived/deleted)
          for (let i = 0; i < inactiveEntityCount; i++) {
            const weId = `we_${workspaceId}_${i}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              workspaceId,
              entityId: `entity_${i}`,
              entityType: currentScope,
              status: 'archived', // Not active
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Act: Attempt to update scope
          const result = await updateWorkspaceScopeAction(workspaceId, newScope, userId);

          // Assert: Should be accepted (only active entities block scope changes)
          expect(result.success).toBe(true);

          // Verify workspace was updated
          const updatedWorkspace = testStorage.workspaces.get(workspaceId);
          expect(updatedWorkspace.contactScope).toBe(newScope);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle edge case: workspace with mix of active and inactive entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // currentScope
        fc.constantFrom<ContactScope>('institution', 'family', 'person'), // newScope
        fc.integer({ min: 1, max: 5 }), // activeEntityCount
        fc.integer({ min: 1, max: 5 }), // inactiveEntityCount
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (workspaceId, currentScope, newScope, activeEntityCount, inactiveEntityCount, userId) => {
          // Setup: Create workspace with current scope
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId: 'org_1',
            name: 'Test Workspace',
            contactScope: currentScope,
            status: 'active',
            scopeLocked: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create active entities
          for (let i = 0; i < activeEntityCount; i++) {
            const weId = `we_active_${workspaceId}_${i}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              workspaceId,
              entityId: `entity_active_${i}`,
              entityType: currentScope,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Setup: Create inactive entities
          for (let i = 0; i < inactiveEntityCount; i++) {
            const weId = `we_inactive_${workspaceId}_${i}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              workspaceId,
              entityId: `entity_inactive_${i}`,
              entityType: currentScope,
              status: 'archived',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Act: Attempt to update scope
          const result = await updateWorkspaceScopeAction(workspaceId, newScope, userId);

          // Assert: Should be rejected (has at least one active entity)
          expect(result.success).toBe(false);
          expect(result.error).toContain('Scope cannot be changed after activation');
        }
      ),
      { numRuns: 50 }
    );
  });
});
