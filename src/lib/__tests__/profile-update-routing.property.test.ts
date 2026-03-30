/**
 * Property-Based Tests: Profile Update Routing
 * 
 * **Property 7: Profile Update Routing**
 * **Validates: Requirements 11.4, 11.5**
 * 
 * For any profile edit operation, updates to identity fields (name, contacts, globalTags)
 * should modify the entities collection using entityId, while updates to operational fields
 * (pipelineId, stageId, assignedTo, workspaceTags) should modify the workspace_entities collection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { FocalPerson, EntityType } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// In-memory storage for testing
const entities = new Map<string, any>();
const workspaceEntities = new Map<string, any>();
const schools = new Map<string, any>();

// Track which collections were updated
const updateLog: Array<{ collection: string; id: string; fields: string[] }> = [];

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn((docId: string) => ({
              update: vi.fn().mockImplementation(async (data: any) => {
                const existingEntity = entities.get(docId);
                if (!existingEntity) {
                  throw new Error(`Entity ${docId} not found`);
                }
                // Merge updates with existing entity
                const updatedEntity = { ...existingEntity, ...data };
                entities.set(docId, updatedEntity);
                
                // Log the update
                updateLog.push({
                  collection: 'entities',
                  id: docId,
                  fields: Object.keys(data).filter(k => k !== 'updatedAt')
                });
              }),
              get: vi.fn().mockImplementation(async () => {
                const entity = entities.get(docId);
                return {
                  exists: !!entity,
                  data: () => entity,
                  id: docId,
                };
              }),
            })),
          };
        }
        
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn((field: string, op: string, value: any) => {
              const filters: Array<{ field: string; value: any }> = [{ field, value }];
              const chainable = {
                where: vi.fn((field: string, op: string, value: any) => {
                  filters.push({ field, value });
                  return chainable;
                }),
                limit: vi.fn(() => ({
                  get: vi.fn().mockImplementation(async () => {
                    let results = Array.from(workspaceEntities.values());
                    
                    // Apply filters
                    for (const filter of filters) {
                      results = results.filter((we: any) => we[filter.field] === filter.value);
                    }
                    
                    if (results.length === 0) {
                      return { empty: true, docs: [] };
                    }
                    
                    return {
                      empty: false,
                      docs: results.map((data: any) => ({
                        id: data.id,
                        data: () => data,
                        ref: {
                          update: vi.fn().mockImplementation(async (updateData: any) => {
                            const updatedWE = { ...data, ...updateData };
                            workspaceEntities.set(data.id, updatedWE);
                            
                            // Log the update
                            updateLog.push({
                              collection: 'workspace_entities',
                              id: data.id,
                              fields: Object.keys(updateData).filter(k => k !== 'updatedAt')
                            });
                          }),
                        },
                      })),
                    };
                  }),
                })),
              };
              return chainable;
            }),
          };
        }
        
        if (collectionName === 'schools') {
          return {
            doc: vi.fn((docId: string) => ({
              update: vi.fn().mockImplementation(async (data: any) => {
                const existingSchool = schools.get(docId);
                if (!existingSchool) {
                  throw new Error(`School ${docId} not found`);
                }
                // Merge updates with existing school
                const updatedSchool = { ...existingSchool, ...data };
                schools.set(docId, updatedSchool);
                
                // Log the update (for backward compatibility tracking)
                updateLog.push({
                  collection: 'schools',
                  id: docId,
                  fields: Object.keys(data).filter(k => k !== 'updatedAt')
                });
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
import { updateProfile, updateEntityIdentity, updateWorkspaceEntityOperations } from '../profile-actions';

// Test storage access
const __testStorage = {
  entities,
  workspaceEntities,
  schools,
  updateLog,
  reset: () => {
    entities.clear();
    workspaceEntities.clear();
    schools.clear();
    updateLog.length = 0;
  },
};

// Fast-check arbitraries
const entityTypeArbitrary = fc.constantFrom<EntityType>('institution', 'family', 'person');

const focalPersonArbitrary = fc.record({
  name: fc.string({ minLength: 5, maxLength: 50 }),
  email: fc.emailAddress(),
  phone: fc.string({ minLength: 10, maxLength: 15 }),
  type: fc.constantFrom('School Owner', 'Principal', 'Administrator', 'Contact Person'),
  isSignatory: fc.boolean(),
});

const entityArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }).map(s => `entity_${s}`),
  organizationId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `org_${s}`),
  name: fc.string({ minLength: 5, maxLength: 100 }),
  slug: fc.string({ minLength: 5, maxLength: 50 }),
  entityType: entityTypeArbitrary,
  contacts: fc.array(focalPersonArbitrary, { minLength: 0, maxLength: 3 }),
  globalTags: fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  status: fc.constant('active'),
  createdAt: fc.constant(new Date('2024-01-01').toISOString()),
  updatedAt: fc.constant(new Date('2024-01-01').toISOString()),
});

const workspaceEntityArbitrary = (entityId: string, workspaceId: string) => fc.record({
  id: fc.constant(`${workspaceId}_${entityId}`),
  organizationId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `org_${s}`),
  workspaceId: fc.constant(workspaceId),
  entityId: fc.constant(entityId),
  entityType: entityTypeArbitrary,
  pipelineId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`),
  stageId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `stage_${s}`),
  status: fc.constant('active'),
  workspaceTags: fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  displayName: fc.string({ minLength: 5, maxLength: 100 }),
  addedAt: fc.constant(new Date('2024-01-01').toISOString()),
  updatedAt: fc.constant(new Date('2024-01-01').toISOString()),
});

const schoolArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }).map(s => `school_${s}`),
  name: fc.string({ minLength: 5, maxLength: 100 }),
  slug: fc.string({ minLength: 5, maxLength: 50 }),
  migrationStatus: fc.constant('migrated'),
  entityId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `entity_${s}`), { nil: undefined }),
  updatedAt: fc.constant(new Date('2024-01-01').toISOString()),
});

// Arbitraries for different types of updates
const identityUpdatesArbitrary = fc.record({
  name: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  contacts: fc.option(fc.array(focalPersonArbitrary, { minLength: 1, maxLength: 3 }), { nil: undefined }),
  globalTags: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
}).filter(updates => {
  // Ensure at least one identity field is being updated
  return updates.name !== undefined || updates.contacts !== undefined || updates.globalTags !== undefined;
});

const operationalUpdatesArbitrary = fc.record({
  pipelineId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`), { nil: undefined }),
  stageId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `stage_${s}`), { nil: undefined }),
  assignedTo: fc.option(
    fc.record({
      userId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`), { nil: null }),
      name: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
      email: fc.option(fc.emailAddress(), { nil: null }),
    }),
    { nil: undefined }
  ),
  workspaceTags: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
}).filter(updates => {
  // Ensure at least one operational field is being updated
  return updates.pipelineId !== undefined || updates.stageId !== undefined || 
         updates.assignedTo !== undefined || updates.workspaceTags !== undefined;
});

const mixedUpdatesArbitrary = fc.record({
  // Identity fields
  name: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  contacts: fc.option(fc.array(focalPersonArbitrary, { minLength: 1, maxLength: 3 }), { nil: undefined }),
  globalTags: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  // Operational fields
  pipelineId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`), { nil: undefined }),
  stageId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `stage_${s}`), { nil: undefined }),
  workspaceTags: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
}).filter(updates => {
  // Ensure at least one field from each category is being updated
  const hasIdentity = updates.name !== undefined || updates.contacts !== undefined || updates.globalTags !== undefined;
  const hasOperational = updates.pipelineId !== undefined || updates.stageId !== undefined || updates.workspaceTags !== undefined;
  return hasIdentity && hasOperational;
});

describe('Property 7: Profile Update Routing', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  describe('Identity Field Updates → Entities Collection', () => {
    it('should route identity field updates to entities collection for any profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          identityUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, updates, workspaceId) => {
            // Setup: Create entity and school
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            // Create workspace_entity
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            // Clear update log
            __testStorage.updateLog.length = 0;

            // Execute: Update profile with identity fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates,
            });

            // Assert: Update succeeded
            expect(result.success).toBe(true);

            // Property 7.1: Identity fields were routed to entities collection
            const entityUpdates = __testStorage.updateLog.filter(log => log.collection === 'entities');
            expect(entityUpdates.length).toBeGreaterThan(0);
            
            const entityUpdate = entityUpdates.find(log => log.id === entity.id);
            expect(entityUpdate).toBeDefined();

            // Verify correct fields were updated in entities
            if (updates.name !== undefined) {
              expect(entityUpdate!.fields).toContain('name');
              const updatedEntity = __testStorage.entities.get(entity.id);
              expect(updatedEntity.name).toBe(updates.name);
            }
            
            if (updates.contacts !== undefined) {
              expect(entityUpdate!.fields).toContain('contacts');
              const updatedEntity = __testStorage.entities.get(entity.id);
              expect(updatedEntity.contacts).toEqual(updates.contacts);
            }
            
            if (updates.globalTags !== undefined) {
              expect(entityUpdate!.fields).toContain('globalTags');
              const updatedEntity = __testStorage.entities.get(entity.id);
              expect(updatedEntity.globalTags).toEqual(updates.globalTags);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update entities collection when only name is changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.string({ minLength: 5, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newName, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { name: newName },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            expect(entityUpdates[0].fields).toContain('name');
            
            const updatedEntity = __testStorage.entities.get(entity.id);
            expect(updatedEntity.name).toBe(newName);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update entities collection when only contacts are changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.array(focalPersonArbitrary, { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newContacts, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { contacts: newContacts },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            expect(entityUpdates[0].fields).toContain('contacts');
            
            const updatedEntity = __testStorage.entities.get(entity.id);
            expect(updatedEntity.contacts).toEqual(newContacts);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update entities collection when only globalTags are changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newTags, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { globalTags: newTags },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            expect(entityUpdates[0].fields).toContain('globalTags');
            
            const updatedEntity = __testStorage.entities.get(entity.id);
            expect(updatedEntity.globalTags).toEqual(newTags);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Operational Field Updates → Workspace_Entities Collection', () => {
    it('should route operational field updates to workspace_entities collection for any profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          operationalUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, updates, workspaceId) => {
            // Setup: Create entity and school
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            // Create workspace_entity
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            // Clear update log
            __testStorage.updateLog.length = 0;

            // Execute: Update profile with operational fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates,
            });

            // Assert: Update succeeded
            expect(result.success).toBe(true);

            // Property 7.2: Operational fields were routed to workspace_entities collection
            const weUpdates = __testStorage.updateLog.filter(log => log.collection === 'workspace_entities');
            expect(weUpdates.length).toBeGreaterThan(0);
            
            const weUpdate = weUpdates.find(log => log.id === `${workspaceId}_${entity.id}`);
            expect(weUpdate).toBeDefined();

            // Verify correct fields were updated in workspace_entities
            if (updates.pipelineId !== undefined) {
              expect(weUpdate!.fields).toContain('pipelineId');
              const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
              expect(updatedWE.pipelineId).toBe(updates.pipelineId);
            }
            
            if (updates.stageId !== undefined) {
              expect(weUpdate!.fields).toContain('stageId');
              const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
              expect(updatedWE.stageId).toBe(updates.stageId);
            }
            
            if (updates.assignedTo !== undefined) {
              expect(weUpdate!.fields).toContain('assignedTo');
              const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
              expect(updatedWE.assignedTo).toEqual(updates.assignedTo);
            }
            
            if (updates.workspaceTags !== undefined) {
              expect(weUpdate!.fields).toContain('workspaceTags');
              const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
              expect(updatedWE.workspaceTags).toEqual(updates.workspaceTags);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update workspace_entities collection when only pipelineId is changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newPipelineId, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { pipelineId: newPipelineId },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBeGreaterThan(0);
            expect(weUpdates[0].fields).toContain('pipelineId');
            
            const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
            expect(updatedWE.pipelineId).toBe(newPipelineId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update workspace_entities collection when only workspaceTags are changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newTags, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { workspaceTags: newTags },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBeGreaterThan(0);
            expect(weUpdates[0].fields).toContain('workspaceTags');
            
            const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
            expect(updatedWE.workspaceTags).toEqual(newTags);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update workspace_entities collection when assignedTo is changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.record({
            userId: fc.option(fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`), { nil: null }),
            name: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
            email: fc.option(fc.emailAddress(), { nil: null }),
          }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newAssignedTo, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: { assignedTo: newAssignedTo },
            });

            // Assert
            expect(result.success).toBe(true);
            
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBeGreaterThan(0);
            expect(weUpdates[0].fields).toContain('assignedTo');
            
            const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
            expect(updatedWE.assignedTo).toEqual(newAssignedTo);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Mixed Updates → Both Collections', () => {
    it('should route mixed updates to both entities and workspace_entities collections', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          mixedUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, updates, workspaceId) => {
            // Setup: Create entity and school
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            // Create workspace_entity
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            // Clear update log
            __testStorage.updateLog.length = 0;

            // Execute: Update profile with mixed fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates,
            });

            // Assert: Update succeeded
            expect(result.success).toBe(true);

            // Property 7: Both collections were updated
            const entityUpdates = __testStorage.updateLog.filter(log => log.collection === 'entities');
            const weUpdates = __testStorage.updateLog.filter(log => log.collection === 'workspace_entities');
            
            // Check if identity fields were provided
            const hasIdentityFields = updates.name !== undefined || 
                                     updates.contacts !== undefined || 
                                     updates.globalTags !== undefined;
            
            // Check if operational fields were provided
            const hasOperationalFields = updates.pipelineId !== undefined || 
                                        updates.stageId !== undefined || 
                                        updates.workspaceTags !== undefined;

            if (hasIdentityFields) {
              expect(entityUpdates.length).toBeGreaterThan(0);
              const entityUpdate = entityUpdates.find(log => log.id === entity.id);
              expect(entityUpdate).toBeDefined();
              
              // Verify identity fields were updated in entities
              if (updates.name !== undefined) {
                expect(entityUpdate!.fields).toContain('name');
              }
              if (updates.contacts !== undefined) {
                expect(entityUpdate!.fields).toContain('contacts');
              }
              if (updates.globalTags !== undefined) {
                expect(entityUpdate!.fields).toContain('globalTags');
              }
            }

            if (hasOperationalFields) {
              expect(weUpdates.length).toBeGreaterThan(0);
              const weUpdate = weUpdates.find(log => log.id === `${workspaceId}_${entity.id}`);
              expect(weUpdate).toBeDefined();
              
              // Verify operational fields were updated in workspace_entities
              if (updates.pipelineId !== undefined) {
                expect(weUpdate!.fields).toContain('pipelineId');
              }
              if (updates.stageId !== undefined) {
                expect(weUpdate!.fields).toContain('stageId');
              }
              if (updates.workspaceTags !== undefined) {
                expect(weUpdate!.fields).toContain('workspaceTags');
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly separate and route identity vs operational fields in any mixed update', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.string({ minLength: 5, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`),
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, newName, newPipelineId, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute: Update both identity and operational fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: {
                name: newName,
                pipelineId: newPipelineId,
              },
            });

            // Assert
            expect(result.success).toBe(true);
            
            // Verify name went to entities
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            expect(entityUpdates[0].fields).toContain('name');
            expect(entityUpdates[0].fields).not.toContain('pipelineId');
            
            const updatedEntity = __testStorage.entities.get(entity.id);
            expect(updatedEntity.name).toBe(newName);
            
            // Verify pipelineId went to workspace_entities
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBeGreaterThan(0);
            expect(weUpdates[0].fields).toContain('pipelineId');
            expect(weUpdates[0].fields).not.toContain('name');
            
            const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
            expect(updatedWE.pipelineId).toBe(newPipelineId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Direct Update Functions', () => {
    it('should route identity updates through updateEntityIdentity to entities collection', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          identityUpdatesArbitrary,
          async (entity, updates) => {
            // Setup
            __testStorage.entities.set(entity.id, entity);
            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateEntityIdentity(entity.id, updates);

            // Assert
            expect(result.success).toBe(true);
            
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            
            // Verify only identity fields were updated
            const updatedFields = entityUpdates[0].fields;
            if (updates.name !== undefined) {
              expect(updatedFields).toContain('name');
            }
            if (updates.contacts !== undefined) {
              expect(updatedFields).toContain('contacts');
            }
            if (updates.globalTags !== undefined) {
              expect(updatedFields).toContain('globalTags');
            }
            
            // Verify no operational fields were updated
            expect(updatedFields).not.toContain('pipelineId');
            expect(updatedFields).not.toContain('stageId');
            expect(updatedFields).not.toContain('workspaceTags');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should route operational updates through updateWorkspaceEntityOperations to workspace_entities collection', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          operationalUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, updates, workspaceId) => {
            // Setup
            __testStorage.entities.set(entity.id, entity);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);
            __testStorage.updateLog.length = 0;

            // Execute
            const result = await updateWorkspaceEntityOperations(entity.id, workspaceId, updates);

            // Assert
            expect(result.success).toBe(true);
            
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBeGreaterThan(0);
            
            // Verify only operational fields were updated
            const updatedFields = weUpdates[0].fields;
            if (updates.pipelineId !== undefined) {
              expect(updatedFields).toContain('pipelineId');
            }
            if (updates.stageId !== undefined) {
              expect(updatedFields).toContain('stageId');
            }
            if (updates.assignedTo !== undefined) {
              expect(updatedFields).toContain('assignedTo');
            }
            if (updates.workspaceTags !== undefined) {
              expect(updatedFields).toContain('workspaceTags');
            }
            
            // Verify no identity fields were updated
            expect(updatedFields).not.toContain('name');
            expect(updatedFields).not.toContain('contacts');
            expect(updatedFields).not.toContain('globalTags');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should not update entities collection when no identity fields are provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          operationalUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, updates, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute: Update with only operational fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates,
            });

            // Assert
            expect(result.success).toBe(true);
            
            // Verify entities collection was NOT updated
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBe(0);
            
            // Verify workspace_entities WAS updated
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities'
            );
            expect(weUpdates.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not update workspace_entities collection when no operational fields are provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          identityUpdatesArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, updates, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute: Update with only identity fields
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates,
            });

            // Assert
            expect(result.success).toBe(true);
            
            // Verify entities collection WAS updated
            const entityUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'entities' && log.id === entity.id
            );
            expect(entityUpdates.length).toBeGreaterThan(0);
            
            // Verify workspace_entities was NOT updated
            const weUpdates = __testStorage.updateLog.filter(
              log => log.collection === 'workspace_entities' && log.id === `${workspaceId}_${entity.id}`
            );
            expect(weUpdates.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle updates with empty field values correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          entityArbitrary,
          schoolArbitrary,
          fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
          async (entity, school, workspaceId) => {
            // Setup
            const migratedSchool = { ...school, entityId: entity.id };
            __testStorage.entities.set(entity.id, entity);
            __testStorage.schools.set(school.id, migratedSchool);
            
            const workspaceEntity = {
              id: `${workspaceId}_${entity.id}`,
              workspaceId,
              entityId: entity.id,
              entityType: entity.entityType,
              pipelineId: 'pipeline_default',
              stageId: 'stage_default',
              status: 'active',
              workspaceTags: [],
              displayName: entity.name,
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            __testStorage.workspaceEntities.set(workspaceEntity.id, workspaceEntity);

            __testStorage.updateLog.length = 0;

            // Execute: Update with empty arrays
            const result = await updateProfile({
              schoolId: school.id,
              entityId: entity.id,
              workspaceId,
              updates: {
                globalTags: [],
                workspaceTags: [],
              },
            });

            // Assert
            expect(result.success).toBe(true);
            
            // Verify both collections were updated with empty arrays
            const updatedEntity = __testStorage.entities.get(entity.id);
            expect(updatedEntity.globalTags).toEqual([]);
            
            const updatedWE = __testStorage.workspaceEntities.get(`${workspaceId}_${entity.id}`);
            expect(updatedWE.workspaceTags).toEqual([]);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
