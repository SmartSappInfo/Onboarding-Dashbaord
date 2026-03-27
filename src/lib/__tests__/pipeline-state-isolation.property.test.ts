/**
 * Property-Based Test: Pipeline State Isolation Invariant
 * 
 * **Property 2: Pipeline State Isolation Invariant**
 * **Validates: Requirements 5**
 * 
 * For any entity E linked to workspaces W1 and W2:
 * - update(workspace_entities[W1, E], { stageId: S1 }) → workspace_entities[W2, E].stageId remains unchanged
 * 
 * This test simulates concurrent stage updates from two workspaces on the same entity
 * and asserts that each workspace_entities record retains independent stageId.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { updateWorkspaceEntityAction } from '../workspace-entity-actions';

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
  const workspaceEntities = new Map<string, any>();
  const entities = new Map<string, any>();

  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaceEntities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = workspaceEntities.get(id) || {};
                workspaceEntities.set(id, { ...existing, ...updates });
              }),
            })),
          };
        } else if (collectionName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = entities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
          };
        } else if (collectionName === 'stages') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                // Mock stage data
                return {
                  exists: true,
                  id,
                  data: () => ({ name: `Stage ${id}`, order: 1 }),
                };
              }),
            })),
          };
        }
        return {};
      }),
    },
    // Expose storage for test setup
    __testStorage: {
      workspaceEntities,
      entities,
      reset: () => {
        workspaceEntities.clear();
        entities.clear();
      },
    },
  };
});

describe('Property 2: Pipeline State Isolation Invariant', () => {
  let testStorage: {
    workspaceEntities: Map<string, any>;
    entities: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should maintain independent stageId when updating one workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.string({ minLength: 1, maxLength: 20 }), // pipelineId
        fc.string({ minLength: 1, maxLength: 20 }), // initialStageId
        fc.string({ minLength: 1, maxLength: 20 }), // newStageId
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspace1Id, workspace2Id, pipelineId, initialStageId, newStageId, userId) => {
          // Ensure workspaces are different
          if (workspace1Id === workspace2Id) return;
          // Ensure stages are different
          if (initialStageId === newStageId) return;

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org_1',
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities record for workspace 1
          const we1Id = `we_${workspace1Id}_${entityId}`;
          testStorage.workspaceEntities.set(we1Id, {
            id: we1Id,
            organizationId: 'org_1',
            workspaceId: workspace1Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: initialStageId,
            currentStageName: `Stage ${initialStageId}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Setup: Create workspace_entities record for workspace 2
          const we2Id = `we_${workspace2Id}_${entityId}`;
          testStorage.workspaceEntities.set(we2Id, {
            id: we2Id,
            organizationId: 'org_1',
            workspaceId: workspace2Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: initialStageId,
            currentStageName: `Stage ${initialStageId}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Action: Update stageId for workspace 1 only
          const result = await updateWorkspaceEntityAction({
            workspaceEntityId: we1Id,
            stageId: newStageId,
            userId,
          });

          // Property: Update should succeed
          expect(result.success).toBe(true);

          // Property: Workspace 1 should have new stageId
          const we1After = testStorage.workspaceEntities.get(we1Id);
          expect(we1After).toBeDefined();
          expect(we1After.stageId).toBe(newStageId);
          expect(we1After.currentStageName).toBe(`Stage ${newStageId}`);

          // Property: Workspace 2 should retain original stageId (isolation)
          const we2After = testStorage.workspaceEntities.get(we2Id);
          expect(we2After).toBeDefined();
          expect(we2After.stageId).toBe(initialStageId);
          expect(we2After.currentStageName).toBe(`Stage ${initialStageId}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow same entity to be at different stages in different workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.string({ minLength: 1, maxLength: 20 }), // pipelineId
        fc.string({ minLength: 1, maxLength: 20 }), // stage1Id
        fc.string({ minLength: 1, maxLength: 20 }), // stage2Id
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspace1Id, workspace2Id, pipelineId, stage1Id, stage2Id, userId) => {
          // Ensure workspaces are different
          if (workspace1Id === workspace2Id) return;

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org_1',
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities record for workspace 1 with stage1
          const we1Id = `we_${workspace1Id}_${entityId}`;
          testStorage.workspaceEntities.set(we1Id, {
            id: we1Id,
            organizationId: 'org_1',
            workspaceId: workspace1Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: stage1Id,
            currentStageName: `Stage ${stage1Id}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Setup: Create workspace_entities record for workspace 2 with stage2
          const we2Id = `we_${workspace2Id}_${entityId}`;
          testStorage.workspaceEntities.set(we2Id, {
            id: we2Id,
            organizationId: 'org_1',
            workspaceId: workspace2Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: stage2Id,
            currentStageName: `Stage ${stage2Id}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Property: Both workspace_entities records should exist with different stages
          const we1 = testStorage.workspaceEntities.get(we1Id);
          const we2 = testStorage.workspaceEntities.get(we2Id);

          expect(we1).toBeDefined();
          expect(we2).toBeDefined();
          expect(we1.entityId).toBe(entityId);
          expect(we2.entityId).toBe(entityId);
          expect(we1.stageId).toBe(stage1Id);
          expect(we2.stageId).toBe(stage2Id);
          expect(we1.workspaceId).toBe(workspace1Id);
          expect(we2.workspaceId).toBe(workspace2Id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle concurrent stage updates to different workspaces independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.string({ minLength: 1, maxLength: 20 }), // pipelineId
        fc.string({ minLength: 1, maxLength: 20 }), // initialStageId
        fc.string({ minLength: 1, maxLength: 20 }), // newStage1Id
        fc.string({ minLength: 1, maxLength: 20 }), // newStage2Id
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspace1Id, workspace2Id, pipelineId, initialStageId, newStage1Id, newStage2Id, userId) => {
          // Ensure workspaces are different
          if (workspace1Id === workspace2Id) return;
          // Ensure stages are different from initial
          if (initialStageId === newStage1Id || initialStageId === newStage2Id) return;

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org_1',
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities records with same initial stage
          const we1Id = `we_${workspace1Id}_${entityId}`;
          testStorage.workspaceEntities.set(we1Id, {
            id: we1Id,
            organizationId: 'org_1',
            workspaceId: workspace1Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: initialStageId,
            currentStageName: `Stage ${initialStageId}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          const we2Id = `we_${workspace2Id}_${entityId}`;
          testStorage.workspaceEntities.set(we2Id, {
            id: we2Id,
            organizationId: 'org_1',
            workspaceId: workspace2Id,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: initialStageId,
            currentStageName: `Stage ${initialStageId}`,
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Action: Simulate concurrent updates to both workspaces
          const [result1, result2] = await Promise.all([
            updateWorkspaceEntityAction({
              workspaceEntityId: we1Id,
              stageId: newStage1Id,
              userId,
            }),
            updateWorkspaceEntityAction({
              workspaceEntityId: we2Id,
              stageId: newStage2Id,
              userId,
            }),
          ]);

          // Property: Both updates should succeed
          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);

          // Property: Each workspace should have its own independent stage
          const we1After = testStorage.workspaceEntities.get(we1Id);
          const we2After = testStorage.workspaceEntities.get(we2Id);

          expect(we1After).toBeDefined();
          expect(we2After).toBeDefined();
          expect(we1After.stageId).toBe(newStage1Id);
          expect(we2After.stageId).toBe(newStage2Id);
          expect(we1After.currentStageName).toBe(`Stage ${newStage1Id}`);
          expect(we2After.currentStageName).toBe(`Stage ${newStage2Id}`);

          // Property: Updates should not interfere with each other
          expect(we1After.stageId).not.toBe(we2After.stageId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve other workspace_entity fields when updating stage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // pipelineId
        fc.string({ minLength: 1, maxLength: 20 }), // initialStageId
        fc.string({ minLength: 1, maxLength: 20 }), // newStageId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }), // workspaceTags
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspaceId, pipelineId, initialStageId, newStageId, workspaceTags, userId) => {
          // Ensure stages are different
          if (initialStageId === newStageId) return;

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org_1',
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities record with tags and assignee
          const weId = `we_${workspaceId}_${entityId}`;
          const assignedTo = {
            userId: 'user_123',
            name: 'Test User',
            email: 'test@example.com',
          };

          testStorage.workspaceEntities.set(weId, {
            id: weId,
            organizationId: 'org_1',
            workspaceId,
            entityId,
            entityType: 'institution',
            pipelineId,
            stageId: initialStageId,
            currentStageName: `Stage ${initialStageId}`,
            assignedTo,
            status: 'active',
            workspaceTags,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: 'Test Entity',
          });

          // Action: Update only stageId
          const result = await updateWorkspaceEntityAction({
            workspaceEntityId: weId,
            stageId: newStageId,
            userId,
          });

          // Property: Update should succeed
          expect(result.success).toBe(true);

          // Property: Stage should be updated
          const weAfter = testStorage.workspaceEntities.get(weId);
          expect(weAfter).toBeDefined();
          expect(weAfter.stageId).toBe(newStageId);
          expect(weAfter.currentStageName).toBe(`Stage ${newStageId}`);

          // Property: Other fields should remain unchanged
          expect(weAfter.workspaceTags).toEqual(workspaceTags);
          expect(weAfter.assignedTo).toEqual(assignedTo);
          expect(weAfter.pipelineId).toBe(pipelineId);
          expect(weAfter.status).toBe('active');
          expect(weAfter.entityId).toBe(entityId);
          expect(weAfter.workspaceId).toBe(workspaceId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
