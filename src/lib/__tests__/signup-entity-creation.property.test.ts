/**
 * Property-Based Tests: Signup Entity Creation
 * 
 * **Property 4: Entity Creation Completeness**
 * **Validates: Requirements 10.1, 10.2, 10.4**
 * 
 * For any new contact signup, the system should create both an entities record
 * with a unique entityId in the format entity_<random_id> and a corresponding
 * workspace_entities record linking the entity to the workspace.
 * 
 * **Property 5: No Legacy School Creation**
 * **Validates: Requirements 10.3**
 * 
 * For any new contact signup after migration, the system should not create a
 * record in the schools collection.
 * 
 * **Property 6: Signup Activity Logging**
 * **Validates: Requirements 10.5**
 * 
 * For any completed signup, the system should create an activity record that
 * references the new entity using entityId rather than entityId.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { EntityType } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// In-memory storage for testing
const entities = new Map<string, any>();
const workspaceEntities = new Map<string, any>();
const schools = new Map<string, any>();
const activities = new Map<string, any>();

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activityData: any) => {
    const id = `activity_${Date.now()}_${Math.random()}`;
    activities.set(id, { ...activityData, id, timestamp: new Date().toISOString() });
    return { success: true, id };
  })
}));

// Mock entity actions
vi.mock('../entity-actions', () => ({
  createEntityAction: vi.fn().mockImplementation(async (input: any) => {
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const entity = {
      id: entityId,
      organizationId: input.organizationId,
      entityType: input.entityType,
      name: input.name,
      slug: input.slug,
      contacts: input.contacts || [],
      globalTags: input.globalTags || [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      institutionData: input.institutionData ? {
        ...input.institutionData,
        focalPersons: input.contacts || [], // Add focalPersons from contacts
      } : undefined,
    };
    
    entities.set(entityId, entity);
    
    return {
      success: true,
      entityId,
      entity,
    };
  })
}));

// Mock workspace entity actions
vi.mock('../workspace-entity-actions', () => ({
  linkEntityToWorkspaceAction: vi.fn().mockImplementation(async (input: any) => {
    const workspaceEntityId = `${input.workspaceId}_${input.entityId}`;
    
    // Get the entity to extract displayName
    const entity = entities.get(input.entityId);
    const displayName = entity?.name || 'Unknown';
    
    const workspaceEntity = {
      id: workspaceEntityId,
      organizationId: input.organizationId || 'org_default',
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: input.entityType || entity?.entityType || 'institution',
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      status: 'active',
      workspaceTags: input.workspaceTags || [],
      displayName,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    workspaceEntities.set(workspaceEntityId, workspaceEntity);
    
    return {
      success: true,
      workspaceEntityId,
      workspaceEntity,
    };
  })
}));

// Mock Firestore - track if schools collection is accessed
const mockSchoolsAdd = vi.fn();
const mockSchoolsDoc = vi.fn();

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            add: mockSchoolsAdd,
            doc: mockSchoolsDoc,
          };
        }
        return {
          add: vi.fn(),
          doc: vi.fn(() => ({
            id: `${collectionName}_${Date.now()}_${Math.random()}`,
          })),
        };
      }),
    },
  };
});

// Import after mocks
import { handleSignupAction } from '../signup-actions';
import { logActivity } from '../activity-logger';
import { createEntityAction } from '../entity-actions';
import { linkEntityToWorkspaceAction } from '../workspace-entity-actions';

// Get mocked functions
const mockLogActivity = vi.mocked(logActivity);
const mockCreateEntityAction = vi.mocked(createEntityAction);
const mockLinkEntityToWorkspaceAction = vi.mocked(linkEntityToWorkspaceAction);

// Test storage access
const __testStorage = {
  entities,
  workspaceEntities,
  schools,
  activities,
  reset: () => {
    entities.clear();
    workspaceEntities.clear();
    schools.clear();
    activities.clear();
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

const signupInputArbitrary = fc.record({
  organizationId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `org_${s}`),
  workspaceId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `workspace_${s}`),
  name: fc.string({ minLength: 5, maxLength: 100 }),
  location: fc.string({ minLength: 5, maxLength: 100 }),
  focalPersons: fc.array(focalPersonArbitrary, { minLength: 1, maxLength: 3 }),
  nominalRoll: fc.integer({ min: 10, max: 5000 }),
  pipelineId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `pipeline_${s}`),
  stageId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `stage_${s}`),
  userId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`),
  implementationDate: fc.option(
    fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2026-12-31').getTime() })
      .map(timestamp => new Date(timestamp).toISOString().split('T')[0]),
    { nil: undefined }
  ),
  referee: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
});

describe('Property 4: Entity Creation Completeness', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
    
    // Reset mock call counts
    mockLogActivity.mockClear();
    mockCreateEntityAction.mockClear();
    mockLinkEntityToWorkspaceAction.mockClear();
    mockSchoolsAdd.mockClear();
    mockSchoolsDoc.mockClear();
  });

  it('should create both entity and workspace_entity records for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Signup succeeded
          expect(result.success).toBe(true);
          expect(result.entityId).toBeDefined();

          // Property 4.1: Entity record was created
          const entity = __testStorage.entities.get(result.entityId!);
          expect(entity).toBeDefined();
          expect(entity.id).toBe(result.entityId);
          expect(entity.organizationId).toBe(signupInput.organizationId);
          expect(entity.name).toBe(signupInput.name);
          expect(entity.entityType).toBe('institution');
          expect(entity.contacts).toEqual(signupInput.focalPersons);

          // Property 4.2: Workspace_entity record was created
          const workspaceEntityId = `${signupInput.workspaceId}_${result.entityId}`;
          const workspaceEntity = __testStorage.workspaceEntities.get(workspaceEntityId);
          expect(workspaceEntity).toBeDefined();
          expect(workspaceEntity.entityId).toBe(result.entityId);
          expect(workspaceEntity.workspaceId).toBe(signupInput.workspaceId);
          expect(workspaceEntity.pipelineId).toBe(signupInput.pipelineId);
          expect(workspaceEntity.stageId).toBe(signupInput.stageId);

          // Property 4.3: EntityId follows format entity_<random_id>
          expect(result.entityId).toMatch(/^entity_/);
          expect(result.entityId!.length).toBeGreaterThan(7); // 'entity_' + at least 1 char
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should create entity with correct institution data for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Entity has correct institution data
          expect(result.success).toBe(true);
          
          const entity = __testStorage.entities.get(result.entityId!);
          expect(entity).toBeDefined();
          expect(entity.entityType).toBe('institution');
          
          // Verify institution-specific data is populated
          if (entity.institutionData) {
            expect(entity.institutionData.nominalRoll).toBe(signupInput.nominalRoll);
            expect(entity.institutionData.focalPersons).toEqual(signupInput.focalPersons);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should link entity to workspace with correct operational state', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Workspace entity has correct operational state
          expect(result.success).toBe(true);
          
          const workspaceEntityId = `${signupInput.workspaceId}_${result.entityId}`;
          const workspaceEntity = __testStorage.workspaceEntities.get(workspaceEntityId);
          
          expect(workspaceEntity).toBeDefined();
          expect(workspaceEntity.status).toBe('active');
          expect(workspaceEntity.pipelineId).toBe(signupInput.pipelineId);
          expect(workspaceEntity.stageId).toBe(signupInput.stageId);
          expect(workspaceEntity.displayName).toBe(signupInput.name);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should generate unique entityIds for different signups', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(signupInputArbitrary, { minLength: 2, maxLength: 10 }),
        async (signupInputs) => {
          // Act: Handle multiple signups
          const results = await Promise.all(
            signupInputs.map(input => handleSignupAction(input))
          );

          // Assert: All entityIds are unique
          const entityIds = results
            .filter(r => r.success)
            .map(r => r.entityId!);
          
          const uniqueEntityIds = new Set(entityIds);
          expect(uniqueEntityIds.size).toBe(entityIds.length);

          // Assert: All entityIds follow the format
          entityIds.forEach(id => {
            expect(id).toMatch(/^entity_/);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Property 5: No Legacy School Creation', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
    
    // Reset mock call counts
    mockLogActivity.mockClear();
    mockCreateEntityAction.mockClear();
    mockLinkEntityToWorkspaceAction.mockClear();
    mockSchoolsAdd.mockClear();
    mockSchoolsDoc.mockClear();
  });

  it('should NOT create records in schools collection for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Signup succeeded
          expect(result.success).toBe(true);

          // Property 5: No school record was created
          expect(__testStorage.schools.size).toBe(0);
          expect(mockSchoolsAdd).not.toHaveBeenCalled();
          expect(mockSchoolsDoc).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should only create entity and workspace_entity records, never school records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(signupInputArbitrary, { minLength: 1, maxLength: 5 }),
        async (signupInputs) => {
          // Reset storage for this property test iteration
          __testStorage.reset();
          mockLogActivity.mockClear();
          mockCreateEntityAction.mockClear();
          mockLinkEntityToWorkspaceAction.mockClear();
          mockSchoolsAdd.mockClear();
          mockSchoolsDoc.mockClear();
          
          // Act: Handle multiple signups
          const results = await Promise.all(
            signupInputs.map(input => handleSignupAction(input))
          );

          // Assert: All signups succeeded
          const successfulSignups = results.filter(r => r.success);
          expect(successfulSignups.length).toBe(signupInputs.length);

          // Property 5: No school records created, only entities and workspace_entities
          expect(__testStorage.schools.size).toBe(0);
          expect(__testStorage.entities.size).toBe(successfulSignups.length);
          expect(__testStorage.workspaceEntities.size).toBe(successfulSignups.length);
          
          // Verify schools collection methods were never called
          expect(mockSchoolsAdd).not.toHaveBeenCalled();
          expect(mockSchoolsDoc).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Property 6: Signup Activity Logging', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
    
    // Reset mock call counts
    mockLogActivity.mockClear();
    mockCreateEntityAction.mockClear();
    mockLinkEntityToWorkspaceAction.mockClear();
    mockSchoolsAdd.mockClear();
    mockSchoolsDoc.mockClear();
  });

  it('should log activity with entityId (not entityId) for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Signup succeeded
          expect(result.success).toBe(true);

          // Property 6.1: Activity was logged
          expect(mockLogActivity).toHaveBeenCalled();
          
          const activityCall = mockLogActivity.mock.calls[mockLogActivity.mock.calls.length - 1][0];
          
          // Property 6.2: Activity uses entityId, not entityId
          expect(activityCall.entityId).toBe(result.entityId);
          expect(activityCall.entityId).toBeUndefined();
          
          // Property 6.3: Activity has correct metadata
          expect(activityCall.organizationId).toBe(signupInput.organizationId);
          expect(activityCall.workspaceId).toBe(signupInput.workspaceId);
          expect(activityCall.entityType).toBe('institution');
          expect(activityCall.displayName).toBe(signupInput.name);
          expect(activityCall.userId).toBe(signupInput.userId);
          expect(activityCall.type).toBe('signup_completed');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should log activity with correct metadata for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Activity metadata is complete
          expect(result.success).toBe(true);
          
          const activityCall = mockLogActivity.mock.calls[mockLogActivity.mock.calls.length - 1][0];
          
          // Verify metadata includes signup details
          expect(activityCall.metadata).toBeDefined();
          expect(activityCall.metadata.nominalRoll).toBe(signupInput.nominalRoll);
          expect(activityCall.metadata.location).toBe(signupInput.location);
          expect(activityCall.metadata.pipelineId).toBe(signupInput.pipelineId);
          expect(activityCall.metadata.stageId).toBe(signupInput.stageId);
          
          if (signupInput.implementationDate) {
            expect(activityCall.metadata.implementationDate).toBe(signupInput.implementationDate);
          }
          
          if (signupInput.referee) {
            expect(activityCall.metadata.referee).toBe(signupInput.referee);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should never log activities with entityId for new signups', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(signupInputArbitrary, { minLength: 1, maxLength: 5 }),
        async (signupInputs) => {
          // Act: Handle multiple signups
          await Promise.all(
            signupInputs.map(input => handleSignupAction(input))
          );

          // Assert: All activity logs use entityId, never entityId
          const allActivityCalls = mockLogActivity.mock.calls;
          
          allActivityCalls.forEach(call => {
            const activityData = call[0];
            expect(activityData.entityId).toBeDefined();
            expect(activityData.entityId).toMatch(/^entity_/);
            expect(activityData.entityId).toBeUndefined();
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should log activity with source field set to signup_form', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Activity has correct source
          expect(result.success).toBe(true);
          
          const activityCall = mockLogActivity.mock.calls[mockLogActivity.mock.calls.length - 1][0];
          expect(activityCall.source).toBe('signup_form');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property Integration: Complete Signup Flow', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
    
    // Reset mock call counts
    mockLogActivity.mockClear();
    mockCreateEntityAction.mockClear();
    mockLinkEntityToWorkspaceAction.mockClear();
    mockSchoolsAdd.mockClear();
    mockSchoolsDoc.mockClear();
  });

  it('should satisfy all three properties (4, 5, 6) for any signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        signupInputArbitrary,
        async (signupInput) => {
          // Act: Handle signup
          const result = await handleSignupAction(signupInput);

          // Assert: Signup succeeded
          expect(result.success).toBe(true);

          // Property 4: Entity and workspace_entity created
          const entity = __testStorage.entities.get(result.entityId!);
          const workspaceEntityId = `${signupInput.workspaceId}_${result.entityId}`;
          const workspaceEntity = __testStorage.workspaceEntities.get(workspaceEntityId);
          
          expect(entity).toBeDefined();
          expect(workspaceEntity).toBeDefined();
          expect(result.entityId).toMatch(/^entity_/);

          // Property 5: No school record created
          expect(__testStorage.schools.size).toBe(0);
          expect(mockSchoolsAdd).not.toHaveBeenCalled();

          // Property 6: Activity logged with entityId
          expect(mockLogActivity).toHaveBeenCalled();
          const activityCall = mockLogActivity.mock.calls[mockLogActivity.mock.calls.length - 1][0];
          expect(activityCall.entityId).toBe(result.entityId);
          expect(activityCall.entityId).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});
