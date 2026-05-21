/**
 * Entity Test Factories
 * 
 * Factory functions for creating test entities
 */

import type { Entity, WorkspaceEntity, EntityType } from '@/lib/types';

let entityCounter = 0;
let workspaceEntityCounter = 0;

/**
 * Reset counters (call in beforeEach)
 */
export function resetEntityCounters() {
  entityCounter = 0;
  workspaceEntityCounter = 0;
}

/**
 * Create a test institution entity
 */
export function createTestInstitution(overrides: Partial<Entity> = {}): Entity {
  const id = overrides.id || `institution-${++entityCounter}`;
  
  return {
    id,
    entityType: 'institution' as EntityType,
    name: `Test Institution ${entityCounter}`,
    email: `institution${entityCounter}@test.com`,
    phone: `+1234567${String(entityCounter).padStart(4, '0')}`,
    organizationId: 'test-org-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user-id',
    updatedBy: 'test-user-id',
    ...overrides,
  };
}

/**
 * Create a test family entity
 */
export function createTestFamily(overrides: Partial<Entity> = {}): Entity {
  const id = overrides.id || `family-${++entityCounter}`;
  
  return {
    id,
    entityType: 'family' as EntityType,
    name: `Test Family ${entityCounter}`,
    email: `family${entityCounter}@test.com`,
    phone: `+1234567${String(entityCounter).padStart(4, '0')}`,
    organizationId: 'test-org-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user-id',
    updatedBy: 'test-user-id',
    ...overrides,
  };
}

/**
 * Create a test person entity
 */
export function createTestPerson(overrides: Partial<Entity> = {}): Entity {
  const id = overrides.id || `person-${++entityCounter}`;
  
  return {
    id,
    entityType: 'person' as EntityType,
    name: `Test Person ${entityCounter}`,
    email: `person${entityCounter}@test.com`,
    phone: `+1234567${String(entityCounter).padStart(4, '0')}`,
    organizationId: 'test-org-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user-id',
    updatedBy: 'test-user-id',
    ...overrides,
  };
}

/**
 * Create a test workspace entity
 */
export function createTestWorkspaceEntity(
  entityId: string,
  workspaceId: string,
  overrides: Partial<WorkspaceEntity> = {}
): WorkspaceEntity {
  const id = `${workspaceId}_${entityId}`;
  
  return {
    id,
    entityId,
    workspaceId,
    organizationId: 'test-org-id',
    status: 'Active',
    pipelineId: null,
    stageId: null,
    tags: [],
    assignedTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user-id',
    updatedBy: 'test-user-id',
    ...overrides,
  };
}

/**
 * Create multiple test institutions
 */
export function createTestInstitutions(count: number, overrides: Partial<Entity> = {}): Entity[] {
  return Array.from({ length: count }, () => createTestInstitution(overrides));
}

/**
 * Create multiple test families
 */
export function createTestFamilies(count: number, overrides: Partial<Entity> = {}): Entity[] {
  return Array.from({ length: count }, () => createTestFamily(overrides));
}

/**
 * Create multiple test persons
 */
export function createTestPersons(count: number, overrides: Partial<Entity> = {}): Entity[] {
  return Array.from({ length: count }, () => createTestPerson(overrides));
}

/**
 * Create a complete entity with workspace association
 */
export function createTestEntityWithWorkspace(
  entityType: EntityType,
  workspaceId: string,
  entityOverrides: Partial<Entity> = {},
  workspaceEntityOverrides: Partial<WorkspaceEntity> = {}
): { entity: Entity; workspaceEntity: WorkspaceEntity } {
  let entity: Entity;
  
  switch (entityType) {
    case 'institution':
      entity = createTestInstitution(entityOverrides);
      break;
    case 'family':
      entity = createTestFamily(entityOverrides);
      break;
    case 'person':
      entity = createTestPerson(entityOverrides);
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  const workspaceEntity = createTestWorkspaceEntity(
    entity.id,
    workspaceId,
    workspaceEntityOverrides
  );
  
  return { entity, workspaceEntity };
}

/**
 * Create legacy school document (for migration tests)
 */
export function createLegacySchool(overrides: any = {}): any {
  const id = overrides.id || `school-${++entityCounter}`;
  
  return {
    id,
    name: `Legacy School ${entityCounter}`,
    email: `school${entityCounter}@test.com`,
    phone: `+1234567${String(entityCounter).padStart(4, '0')}`,
    organizationId: 'test-org-id',
    workspaceIds: ['test-workspace-id'],
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user-id',
    updatedBy: 'test-user-id',
    migrationStatus: 'pending',
    ...overrides,
  };
}
