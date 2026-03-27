# SmartSapp Contacts Expansion - Developer Guide

**Version**: 1.0  
**Last Updated**: January 2025  
**Audience**: SmartSapp Developers, Technical Architects

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Model](#data-model)
3. [ScopeGuard Validation](#scopeguard-validation)
4. [Adapter Layer](#adapter-layer)
5. [Server Actions](#server-actions)
6. [Property-Based Tests](#property-based-tests)
7. [Migration Script](#migration-script)
8. [Security Rules](#security-rules)
9. [Performance Optimizations](#performance-optimizations)
10. [Integration Points](#integration-points)

---

## Architecture Overview

### Core Principles

The contacts expansion architecture is built on three foundational principles:

1. **Unified Entity Identity**: All contacts (institutions, families, people) are stored in a single `entities` collection
2. **Workspace-Specific Operational State**: Each workspace-entity relationship is stored in `workspace_entities` with independent pipeline state, tags, and assignee
3. **Scope Enforcement**: The `ScopeGuard` validation rule ensures `entity.entityType === workspace.contactScope` at all write paths

### Collections

```
entities/                    # Unified contact identity
  {entityId}/
    - id: string
    - organizationId: string
    - entityType: 'institution' | 'family' | 'person'
    - name: string
    - contacts: FocalPerson[]
    - globalTags: string[]
    - institutionData?: {...}
    - familyData?: {...}
    - personData?: {...}
    - createdAt: string
    - updatedAt: string

workspace_entities/          # Workspace-specific operational state
  {workspaceEntityId}/
    - id: string
    - organizationId: string
    - workspaceId: string
    - entityId: string
    - entityType: 'institution' | 'family' | 'person'
    - pipelineId: string
    - stageId: string
    - assignedTo: string
    - status: 'active' | 'archived'
    - workspaceTags: string[]
    - displayName: string       # Denormalized
    - primaryEmail: string      # Denormalized
    - primaryPhone: string      # Denormalized
    - currentStageName: string  # Denormalized
    - lastContactedAt: string
    - addedAt: string
    - updatedAt: string
```

### Data Flow

```
User Action
    ↓
Server Action (ScopeGuard validation)
    ↓
Firestore Write (entities + workspace_entities)
    ↓
Denormalization Sync (update workspace_entities)
    ↓
Activity Logger (log with workspaceId + entityId)
    ↓
Automation Engine (trigger with workspace context)
```

---


## Data Model

### Entity Interface

```typescript
interface Entity {
  id: string;
  organizationId: string;
  entityType: 'institution' | 'family' | 'person';
  name: string;
  contacts: FocalPerson[];
  globalTags: string[];
  relatedEntityIds?: string[]; // Reserved for future use
  createdAt: string;
  updatedAt: string;
  
  // Scope-specific data
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
}
```

### InstitutionData

```typescript
interface InstitutionData {
  slug: string;                    // URL-safe identifier for public pages
  nominalRoll?: number;            // Student count
  subscriptionPackageId?: string;
  subscriptionRate?: number;
  billingAddress?: string;
  currency?: string;
  modules?: string[];              // Enabled modules
  implementationDate?: string;     // ISO 8601
  referee?: string;
}
```

### FamilyData

```typescript
interface FamilyData {
  guardians: Guardian[];
  children: Child[];
  admissionsData?: {
    applicationDate?: string;
    interviewDate?: string;
    decisionDate?: string;
    enrollmentDate?: string;
  };
}

interface Guardian {
  name: string;
  phone: string;
  email: string;
  relationship: 'Father' | 'Mother' | 'Legal Guardian' | 'Other';
  isPrimary: boolean;
}

interface Child {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gradeLevel?: string;
  enrollmentStatus?: 'Prospective' | 'Enrolled' | 'Graduated' | 'Withdrawn';
}
```

### PersonData

```typescript
interface PersonData {
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
  leadSource?: string;
}
```

### WorkspaceEntity Interface

```typescript
interface WorkspaceEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  pipelineId: string;
  stageId: string;
  assignedTo: string;
  status: 'active' | 'archived';
  workspaceTags: string[];
  
  // Denormalized fields for query performance
  displayName: string;
  primaryEmail: string;
  primaryPhone: string;
  currentStageName: string;
  
  lastContactedAt?: string;
  addedAt: string;
  updatedAt: string;
}
```

### FocalPerson Interface

```typescript
interface FocalPerson {
  name: string;
  phone: string;
  email: string;
  type: 'Principal' | 'Accountant' | 'Administrator' | 'School Owner' | 'Champion' | 'Other';
  isSignatory?: boolean;
}
```

---


## ScopeGuard Validation

### What is ScopeGuard?

ScopeGuard is the validation rule that enforces the architectural invariant:

```
entity.entityType === workspace.contactScope
```

This rule is enforced at **every write path**:
- Entity creation
- Workspace linking
- CSV import
- API writes
- Firestore security rules

### Implementation

```typescript
// src/lib/scope-guard.ts

export interface ScopeValidationResult {
  valid: boolean;
  error?: {
    code: 'SCOPE_MISMATCH';
    message: string;
  };
}

export function validateScopeMatch(
  entityType: EntityType,
  workspaceContactScope: ContactScope
): ScopeValidationResult {
  if (entityType !== workspaceContactScope) {
    return {
      valid: false,
      error: {
        code: 'SCOPE_MISMATCH',
        message: `Entity type "${entityType}" cannot be added to a workspace with scope "${workspaceContactScope}".`
      }
    };
  }
  
  return { valid: true };
}
```

### Usage in Server Actions

```typescript
// Example: linkEntityToWorkspaceAction

export async function linkEntityToWorkspaceAction(
  entityId: string,
  workspaceId: string
) {
  // 1. Fetch entity and workspace
  const entity = await getEntity(entityId);
  const workspace = await getWorkspace(workspaceId);
  
  // 2. Validate scope match
  const validation = validateScopeMatch(
    entity.entityType,
    workspace.contactScope
  );
  
  if (!validation.valid) {
    // 3. Log scope violation
    await logActivity({
      type: 'scope_violation',
      entityId,
      workspaceId,
      error: validation.error
    });
    
    // 4. Return structured error
    return {
      success: false,
      error: validation.error
    };
  }
  
  // 5. Proceed with link creation
  await createWorkspaceEntity({
    entityId,
    workspaceId,
    entityType: entity.entityType,
    // ...
  });
  
  return { success: true };
}
```

### Enforcement in Security Rules

```javascript
// firestore.rules

match /workspace_entities/{workspaceEntityId} {
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') &&
     request.resource.data.workspaceId in getUserData().workspaceIds &&
     // ScopeGuard: entityType must match workspace contactScope
     request.resource.data.entityType == get(/databases/$(database)/documents/workspaces/$(request.resource.data.workspaceId)).data.contactScope)
  );
}
```

---


## Adapter Layer

### Purpose

The adapter layer provides backward compatibility with the legacy `schools` collection during and after migration. It allows existing features (activities, tasks, messaging, automations) to work with both legacy and new records without modification.

### Core Function: resolveContact

```typescript
// src/lib/adapter/resolve-contact.ts

export interface ResolvedContact {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string;
  contacts: FocalPerson[];
  
  // Workspace-specific state
  pipelineId: string;
  stageId: string;
  assignedTo: string;
  workspaceTags: string[];
  
  // Scope-specific data
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
  
  // Metadata
  migrationStatus: 'legacy' | 'migrated' | 'dual-write';
}

export async function resolveContact(
  schoolId: string,
  workspaceId: string
): Promise<ResolvedContact | null> {
  // 1. Check if school has been migrated
  const school = await db.collection('schools').doc(schoolId).get();
  
  if (!school.exists) {
    return null;
  }
  
  const schoolData = school.data();
  const migrationStatus = schoolData.migrationStatus || 'legacy';
  
  // 2. If migrated, read from entities + workspace_entities
  if (migrationStatus === 'migrated') {
    const entityId = schoolData.entityId;
    
    const [entity, workspaceEntity] = await Promise.all([
      db.collection('entities').doc(entityId).get(),
      db.collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get()
    ]);
    
    if (!entity.exists || workspaceEntity.empty) {
      return null;
    }
    
    const entityData = entity.data() as Entity;
    const workspaceEntityData = workspaceEntity.docs[0].data() as WorkspaceEntity;
    
    return {
      id: entityData.id,
      organizationId: entityData.organizationId,
      entityType: entityData.entityType,
      name: entityData.name,
      contacts: entityData.contacts,
      pipelineId: workspaceEntityData.pipelineId,
      stageId: workspaceEntityData.stageId,
      assignedTo: workspaceEntityData.assignedTo,
      workspaceTags: workspaceEntityData.workspaceTags,
      institutionData: entityData.institutionData,
      familyData: entityData.familyData,
      personData: entityData.personData,
      migrationStatus: 'migrated'
    };
  }
  
  // 3. If not migrated, read from schools collection
  return {
    id: schoolData.id,
    organizationId: schoolData.organizationId,
    entityType: 'institution', // Legacy schools are always institutions
    name: schoolData.name,
    contacts: schoolData.contacts || [],
    pipelineId: schoolData.pipelineId || '',
    stageId: schoolData.stage || '',
    assignedTo: schoolData.assignedTo || '',
    workspaceTags: schoolData.tags || [],
    institutionData: {
      slug: schoolData.slug,
      nominalRoll: schoolData.nominalRoll,
      subscriptionPackageId: schoolData.subscriptionPackageId,
      subscriptionRate: schoolData.subscriptionRate,
      billingAddress: schoolData.billingAddress,
      currency: schoolData.currency,
      modules: schoolData.modules,
      implementationDate: schoolData.implementationDate,
      referee: schoolData.referee
    },
    migrationStatus: 'legacy'
  };
}
```

### Usage in Existing Features

#### Activity Logger

```typescript
// Before
await logActivity({
  type: 'stage_changed',
  schoolId: school.id,
  schoolName: school.name,
  // ...
});

// After (with adapter)
const contact = await resolveContact(schoolId, workspaceId);

await logActivity({
  type: 'stage_changed',
  schoolId: schoolId,           // Legacy field (retained)
  entityId: contact.id,          // New field
  entityType: contact.entityType,
  displayName: contact.name,
  workspaceId: workspaceId,
  // ...
});
```

#### Messaging Engine

```typescript
// Before
const school = await db.collection('schools').doc(schoolId).get();
const variables = resolveVariables(school.data());

// After (with adapter)
const contact = await resolveContact(schoolId, workspaceId);
const variables = resolveVariables(contact);
```

---


## Server Actions

### Entity Actions

#### createEntityAction

```typescript
export async function createEntityAction(
  organizationId: string,
  entityType: EntityType,
  data: CreateEntityData
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  // 1. Validate entityType
  if (!['institution', 'family', 'person'].includes(entityType)) {
    return { success: false, error: 'Invalid entity type' };
  }
  
  // 2. Validate scope-specific data
  if (entityType === 'institution' && !data.institutionData) {
    return { success: false, error: 'Institution data required' };
  }
  
  // 3. Generate slug for institutions
  let slug: string | undefined;
  if (entityType === 'institution') {
    slug = generateSlug(data.name, organizationId);
  }
  
  // 4. Create entity document
  const entityRef = db.collection('entities').doc();
  const entity: Entity = {
    id: entityRef.id,
    organizationId,
    entityType,
    name: data.name,
    contacts: data.contacts || [],
    globalTags: [],
    institutionData: entityType === 'institution' ? { ...data.institutionData, slug } : undefined,
    familyData: entityType === 'family' ? data.familyData : undefined,
    personData: entityType === 'person' ? data.personData : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await entityRef.set(entity);
  
  // 5. Log activity
  await logActivity({
    type: 'entity_created',
    entityId: entity.id,
    entityType: entity.entityType,
    displayName: entity.name,
    organizationId
  });
  
  return { success: true, entityId: entity.id };
}
```

#### updateEntityAction

```typescript
export async function updateEntityAction(
  entityId: string,
  updates: Partial<Entity>
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch entity
  const entityRef = db.collection('entities').doc(entityId);
  const entity = await entityRef.get();
  
  if (!entity.exists) {
    return { success: false, error: 'Entity not found' };
  }
  
  // 2. Update entity
  await entityRef.update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
  
  // 3. Trigger denormalization sync if identity fields changed
  if (updates.name || updates.contacts) {
    await syncDenormalizedFields(entityId);
  }
  
  // 4. Log activity
  await logActivity({
    type: 'entity_updated',
    entityId,
    entityType: entity.data()!.entityType,
    displayName: updates.name || entity.data()!.name
  });
  
  return { success: true };
}
```

### Workspace-Entity Actions

#### linkEntityToWorkspaceAction

```typescript
export async function linkEntityToWorkspaceAction(
  entityId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: any }> {
  // 1. Fetch entity and workspace
  const [entity, workspace] = await Promise.all([
    db.collection('entities').doc(entityId).get(),
    db.collection('workspaces').doc(workspaceId).get()
  ]);
  
  if (!entity.exists || !workspace.exists) {
    return { success: false, error: 'Entity or workspace not found' };
  }
  
  const entityData = entity.data() as Entity;
  const workspaceData = workspace.data() as Workspace;
  
  // 2. Validate scope match (ScopeGuard)
  const validation = validateScopeMatch(
    entityData.entityType,
    workspaceData.contactScope
  );
  
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  // 3. Create workspace_entities document
  const workspaceEntityRef = db.collection('workspace_entities').doc();
  const workspaceEntity: WorkspaceEntity = {
    id: workspaceEntityRef.id,
    organizationId: entityData.organizationId,
    workspaceId,
    entityId,
    entityType: entityData.entityType,
    pipelineId: workspaceData.defaultPipelineId || '',
    stageId: '',
    assignedTo: '',
    status: 'active',
    workspaceTags: [],
    displayName: entityData.name,
    primaryEmail: entityData.contacts[0]?.email || '',
    primaryPhone: entityData.contacts[0]?.phone || '',
    currentStageName: '',
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await workspaceEntityRef.set(workspaceEntity);
  
  // 4. Lock workspace scope if this is first entity
  const existingEntities = await db.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (existingEntities.size === 1) { // This is the first entity
    await db.collection('workspaces').doc(workspaceId).update({
      scopeLocked: true
    });
    
    await logActivity({
      type: 'workspace_scope_locked',
      workspaceId,
      organizationId: workspaceData.organizationId
    });
  }
  
  // 5. Log activity
  await logActivity({
    type: 'entity_linked_to_workspace',
    entityId,
    workspaceId,
    entityType: entityData.entityType,
    displayName: entityData.name
  });
  
  return { success: true };
}
```

---


## Property-Based Tests

### Overview

Property-based tests validate universal correctness properties that must hold across all inputs. SmartSapp uses **fast-check** for property-based testing.

### Property 1: ScopeGuard Invariant

**Validates**: Requirements 4

```typescript
// src/lib/__tests__/scope-guard.property.test.ts

import fc from 'fast-check';
import { validateScopeMatch } from '../scope-guard';

describe('Property 1: ScopeGuard Invariant', () => {
  it('should reject all mismatched (entityType, contactScope) pairs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('institution', 'family', 'person'),
        fc.constantFrom('institution', 'family', 'person'),
        (entityType, contactScope) => {
          const result = validateScopeMatch(entityType, contactScope);
          
          if (entityType === contactScope) {
            // Matching pairs should be valid
            expect(result.valid).toBe(true);
          } else {
            // Mismatched pairs should be rejected
            expect(result.valid).toBe(false);
            expect(result.error?.code).toBe('SCOPE_MISMATCH');
          }
        }
      )
    );
  });
});
```

### Property 2: Pipeline State Isolation

**Validates**: Requirements 5

```typescript
// src/lib/__tests__/pipeline-state-isolation.property.test.ts

import fc from 'fast-check';

describe('Property 2: Pipeline State Isolation', () => {
  it('should maintain independent pipeline state per workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // entityId
        fc.string(), // workspace1Id
        fc.string(), // workspace2Id
        fc.string(), // stage1Id
        fc.string(), // stage2Id
        async (entityId, workspace1Id, workspace2Id, stage1Id, stage2Id) => {
          // Assume entity is linked to both workspaces
          
          // Update stage in workspace 1
          await updateWorkspaceEntityAction(workspace1Id, entityId, {
            stageId: stage1Id
          });
          
          // Update stage in workspace 2
          await updateWorkspaceEntityAction(workspace2Id, entityId, {
            stageId: stage2Id
          });
          
          // Fetch both workspace_entities records
          const we1 = await getWorkspaceEntity(workspace1Id, entityId);
          const we2 = await getWorkspaceEntity(workspace2Id, entityId);
          
          // Assert independent state
          expect(we1.stageId).toBe(stage1Id);
          expect(we2.stageId).toBe(stage2Id);
        }
      )
    );
  });
});
```

### Property 3: Scope Immutability After Activation

**Validates**: Requirements 6

```typescript
// src/lib/__tests__/scope-immutability.property.test.ts

import fc from 'fast-check';

describe('Property 3: Scope Immutability After Activation', () => {
  it('should reject scope changes when workspace has active entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Number of linked entities
        fc.constantFrom('institution', 'family', 'person'), // New scope
        async (entityCount, newScope) => {
          const workspace = await createTestWorkspace('institution');
          
          // Link N entities to workspace
          for (let i = 0; i < entityCount; i++) {
            const entity = await createTestEntity('institution');
            await linkEntityToWorkspaceAction(entity.id, workspace.id);
          }
          
          // Attempt to change scope
          const result = await updateWorkspaceAction(workspace.id, {
            contactScope: newScope
          });
          
          if (entityCount === 0) {
            // Should allow scope change when no entities
            expect(result.success).toBe(true);
          } else {
            // Should reject scope change when entities exist
            expect(result.success).toBe(false);
            expect(result.error).toContain('Scope cannot be changed after activation');
          }
        }
      )
    );
  });
});
```

### Property 4: Tag Partition Invariant

**Validates**: Requirements 7

```typescript
// src/lib/__tests__/tag-partition.property.test.ts

import fc from 'fast-check';

describe('Property 4: Tag Partition Invariant', () => {
  it('should maintain independent global and workspace tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string()), // Global tags
        fc.array(fc.string()), // Workspace tags
        async (globalTags, workspaceTags) => {
          const entity = await createTestEntity('institution');
          const workspace = await createTestWorkspace('institution');
          await linkEntityToWorkspaceAction(entity.id, workspace.id);
          
          // Apply global tags
          for (const tag of globalTags) {
            await applyGlobalTagAction(entity.id, tag);
          }
          
          // Apply workspace tags
          for (const tag of workspaceTags) {
            await applyWorkspaceTagAction(workspace.id, entity.id, tag);
          }
          
          // Fetch entity and workspace_entity
          const updatedEntity = await getEntity(entity.id);
          const workspaceEntity = await getWorkspaceEntity(workspace.id, entity.id);
          
          // Assert tags are partitioned
          expect(updatedEntity.globalTags).toEqual(globalTags);
          expect(workspaceEntity.workspaceTags).toEqual(workspaceTags);
          
          // Remove a global tag
          if (globalTags.length > 0) {
            await removeGlobalTagAction(entity.id, globalTags[0]);
            const afterRemove = await getEntity(entity.id);
            
            // Workspace tags should be unaffected
            const weAfterRemove = await getWorkspaceEntity(workspace.id, entity.id);
            expect(weAfterRemove.workspaceTags).toEqual(workspaceTags);
          }
        }
      )
    );
  });
});
```

### Property 5: Denormalization Consistency

**Validates**: Requirements 22

```typescript
// src/lib/__tests__/denormalization-consistency.property.test.ts

import fc from 'fast-check';

describe('Property 5: Denormalization Consistency', () => {
  it('should sync denormalized fields across all workspace_entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // New name
        fc.integer({ min: 1, max: 5 }), // Number of workspaces
        async (newName, workspaceCount) => {
          const entity = await createTestEntity('institution');
          
          // Link entity to N workspaces
          const workspaceIds: string[] = [];
          for (let i = 0; i < workspaceCount; i++) {
            const workspace = await createTestWorkspace('institution');
            await linkEntityToWorkspaceAction(entity.id, workspace.id);
            workspaceIds.push(workspace.id);
          }
          
          // Update entity name
          await updateEntityAction(entity.id, { name: newName });
          
          // Fetch all workspace_entities
          const workspaceEntities = await Promise.all(
            workspaceIds.map(wid => getWorkspaceEntity(wid, entity.id))
          );
          
          // Assert all have updated displayName
          for (const we of workspaceEntities) {
            expect(we.displayName).toBe(newName);
          }
        }
      )
    );
  });
});
```

### Running Property Tests

```bash
# Run all property tests
npm test -- --testPathPattern=property.test.ts

# Run specific property test
npm test -- scope-guard.property.test.ts

# Run with verbose output
npm test -- --testPathPattern=property.test.ts --verbose
```

---


## Migration Script

### Overview

The migration script backfills existing `schools` documents into the new `entities` + `workspace_entities` model. It is **idempotent** and can be run multiple times safely.

### Script Location

```
src/scripts/migrate-schools-to-entities.ts
```

### Core Logic

```typescript
// src/scripts/migrate-schools-to-entities.ts

interface MigrationStats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ schoolId: string; error: string }>;
}

export async function migrateSchoolsToEntities(
  dryRun: boolean = false
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  // 1. Fetch all schools
  const schoolsSnapshot = await db.collection('schools').get();
  stats.total = schoolsSnapshot.size;
  
  console.log(`Found ${stats.total} schools to migrate`);
  
  // 2. Process each school
  for (const schoolDoc of schoolsSnapshot.docs) {
    const schoolId = schoolDoc.id;
    const schoolData = schoolDoc.data();
    
    try {
      // 3. Check if already migrated
      if (schoolData.migrationStatus === 'migrated') {
        console.log(`Skipping ${schoolId} - already migrated`);
        stats.skipped++;
        continue;
      }
      
      // 4. Create entity document
      const entityId = `entity_${schoolId}`;
      const entity: Entity = {
        id: entityId,
        organizationId: schoolData.organizationId,
        entityType: 'institution',
        name: schoolData.name,
        contacts: schoolData.contacts || [],
        globalTags: [],
        institutionData: {
          slug: schoolData.slug,
          nominalRoll: schoolData.nominalRoll,
          subscriptionPackageId: schoolData.subscriptionPackageId,
          subscriptionRate: schoolData.subscriptionRate,
          billingAddress: schoolData.billingAddress,
          currency: schoolData.currency,
          modules: schoolData.modules,
          implementationDate: schoolData.implementationDate,
          referee: schoolData.referee
        },
        createdAt: schoolData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (!dryRun) {
        // Check if entity already exists
        const existingEntity = await db.collection('entities').doc(entityId).get();
        if (!existingEntity.exists) {
          await db.collection('entities').doc(entityId).set(entity);
        }
      }
      
      // 5. Create workspace_entities documents
      const workspaceIds = schoolData.workspaceIds || [];
      
      for (const workspaceId of workspaceIds) {
        const workspaceEntityId = `we_${workspaceId}_${entityId}`;
        const workspaceEntity: WorkspaceEntity = {
          id: workspaceEntityId,
          organizationId: schoolData.organizationId,
          workspaceId,
          entityId,
          entityType: 'institution',
          pipelineId: schoolData.pipelineId || '',
          stageId: schoolData.stage || '',
          assignedTo: schoolData.assignedTo || '',
          status: schoolData.status || 'active',
          workspaceTags: schoolData.tags || [],
          displayName: schoolData.name,
          primaryEmail: schoolData.contacts?.[0]?.email || '',
          primaryPhone: schoolData.contacts?.[0]?.phone || '',
          currentStageName: '',
          lastContactedAt: schoolData.lastContactedAt,
          addedAt: schoolData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        if (!dryRun) {
          // Check if workspace_entity already exists
          const existingWE = await db.collection('workspace_entities').doc(workspaceEntityId).get();
          if (!existingWE.exists) {
            await db.collection('workspace_entities').doc(workspaceEntityId).set(workspaceEntity);
          }
        }
      }
      
      // 6. Mark school as migrated
      if (!dryRun) {
        await db.collection('schools').doc(schoolId).update({
          migrationStatus: 'migrated',
          entityId: entityId
        });
      }
      
      stats.succeeded++;
      console.log(`✓ Migrated ${schoolId} → ${entityId}`);
      
    } catch (error) {
      stats.failed++;
      stats.errors.push({
        schoolId,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`✗ Failed to migrate ${schoolId}:`, error);
    }
  }
  
  // 7. Print summary
  console.log('\n=== Migration Summary ===');
  console.log(`Total schools: ${stats.total}`);
  console.log(`Succeeded: ${stats.succeeded}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
  
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(({ schoolId, error }) => {
      console.log(`  ${schoolId}: ${error}`);
    });
  }
  
  return stats;
}
```

### Running the Migration

```bash
# Dry run (no writes)
npm run migrate:schools -- --dry-run

# Live migration
npm run migrate:schools

# With custom Firestore project
FIRESTORE_PROJECT_ID=my-project npm run migrate:schools
```

### Idempotency Guarantees

1. **Entity Creation**: Checks if entity already exists before creating
2. **Workspace_Entity Creation**: Checks if workspace_entity already exists before creating
3. **Migration Status**: Only processes schools with `migrationStatus !== 'migrated'`
4. **Error Handling**: Continues processing remaining schools if one fails

### Post-Migration Verification

```typescript
// Verify migration completeness
export async function verifyMigration(): Promise<{
  totalSchools: number;
  migratedSchools: number;
  unmigrated: string[];
}> {
  const schools = await db.collection('schools').get();
  const migratedSchools = schools.docs.filter(
    doc => doc.data().migrationStatus === 'migrated'
  );
  const unmigrated = schools.docs
    .filter(doc => doc.data().migrationStatus !== 'migrated')
    .map(doc => doc.id);
  
  return {
    totalSchools: schools.size,
    migratedSchools: migratedSchools.length,
    unmigrated
  };
}
```

---


## Security Rules

### Entities Collection

```javascript
// firestore.rules

match /entities/{entityId} {
  // Allow read if user has workspace access to any workspace containing this entity
  // Organization-level access enforced here; workspace membership validated at app level
  allow read: if isAuthorized() && (
    isSystemAdmin() ||
    isOrgMatch(resource.data.organizationId)
  );
  
  // Allow create if user has schools_edit permission
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') && isOrgMatch(request.resource.data.organizationId))
  );
  
  // Allow update if user has schools_edit permission
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') && isOrgMatch(resource.data.organizationId))
  );
  
  // Allow delete if user has system_admin permission
  allow delete: if isAuthorized() && isSystemAdmin();
}
```

### Workspace_Entities Collection

```javascript
// firestore.rules

match /workspace_entities/{workspaceEntityId} {
  // Allow read if user has access to the specific workspaceId
  allow read: if isAuthorized() && (
    isSystemAdmin() ||
    resource.data.workspaceId in getUserData().workspaceIds
  );
  
  // Allow create if user has schools_edit permission AND workspace access
  // Enforce ScopeGuard: entityType must match workspace contactScope
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') &&
     request.resource.data.workspaceId in getUserData().workspaceIds &&
     // ScopeGuard validation
     request.resource.data.entityType == get(/databases/$(database)/documents/workspaces/$(request.resource.data.workspaceId)).data.contactScope)
  );
  
  // Allow update if user has schools_edit permission AND workspace access
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') &&
     resource.data.workspaceId in getUserData().workspaceIds &&
     // Ensure workspace access is not changed to unauthorized workspace
     request.resource.data.workspaceId == resource.data.workspaceId)
  );
  
  // Allow delete if user has schools_edit permission AND workspace access
  allow delete: if isAuthorized() && (
    isSystemAdmin() ||
    (hasPermission('schools_edit') &&
     resource.data.workspaceId in getUserData().workspaceIds)
  );
}
```

### Permission Levels

1. **Organization Level**: User belongs to organization (`isOrgMatch`)
2. **Workspace Level**: User has access to specific workspace (`workspaceId in getUserData().workspaceIds`)
3. **Feature Level**: User has specific permission (`hasPermission('schools_edit')`)
4. **System Admin**: Bypass all checks (`isSystemAdmin()`)

### Critical Security Notes

**User.workspaceIds Denormalization**:
The `user.workspaceIds` array MUST be kept in sync with role-based access. When a user is removed from a role OR a workspace is removed from a role's workspaceIds, the user.workspaceIds array MUST be updated immediately.

This denormalization is necessary because Firestore security rules cannot perform complex queries to check role membership dynamically.

**Workspace Access Revocation**:
When a user's workspace access is revoked, the security rules immediately deny reads and writes to all `workspace_entities` records for that workspace. No permission leakage occurs.

---


## Performance Optimizations

### Denormalization Strategy

To minimize Firestore reads, `workspace_entities` includes denormalized fields:

```typescript
interface WorkspaceEntity {
  // ... other fields
  
  // Denormalized from entity
  displayName: string;       // From entity.name
  primaryEmail: string;      // From entity.contacts[0].email
  primaryPhone: string;      // From entity.contacts[0].phone
  currentStageName: string;  // From pipeline.stages[stageId].name
}
```

### Denormalization Sync

```typescript
// src/lib/denormalization-sync.ts

export async function syncDenormalizedFields(entityId: string): Promise<void> {
  // 1. Fetch entity
  const entity = await db.collection('entities').doc(entityId).get();
  if (!entity.exists) return;
  
  const entityData = entity.data() as Entity;
  
  // 2. Fetch all workspace_entities for this entity
  const workspaceEntities = await db.collection('workspace_entities')
    .where('entityId', '==', entityId)
    .get();
  
  // 3. Prepare batch update
  const batch = db.batch();
  
  for (const weDoc of workspaceEntities.docs) {
    batch.update(weDoc.ref, {
      displayName: entityData.name,
      primaryEmail: entityData.contacts[0]?.email || '',
      primaryPhone: entityData.contacts[0]?.phone || '',
      updatedAt: new Date().toISOString()
    });
  }
  
  // 4. Commit batch (max 500 per batch)
  await batch.commit();
}
```

### Query Optimization

**Workspace List Query** (Max 2 Firestore Reads):

```typescript
// 1. Query workspace_entities (single read)
const workspaceEntities = await db.collection('workspace_entities')
  .where('workspaceId', '==', workspaceId)
  .where('status', '==', 'active')
  .orderBy('displayName')
  .limit(50)
  .get();

// 2. Hydrate entity data only if needed (single read with `in` query)
const entityIds = workspaceEntities.docs.map(doc => doc.data().entityId);
const entities = await db.collection('entities')
  .where('id', 'in', entityIds)
  .get();

// 3. Combine results
const contacts = workspaceEntities.docs.map(weDoc => {
  const we = weDoc.data();
  const entity = entities.docs.find(e => e.id === we.entityId)?.data();
  
  return {
    ...we,
    ...entity
  };
});
```

### Firestore Indexes

Required composite indexes (defined in `firestore.indexes.json`):

```json
{
  "indexes": [
    {
      "collectionGroup": "workspace_entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workspace_entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "stageId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workspace_entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "assignedTo", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workspace_entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "workspaceTags", "arrayConfig": "CONTAINS" }
      ]
    },
    {
      "collectionGroup": "entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "entityType", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "globalTags", "arrayConfig": "CONTAINS" }
      ]
    }
  ]
}
```

### Deploying Indexes

```bash
# Deploy all indexes
firebase deploy --only firestore:indexes

# Check index status
firebase firestore:indexes
```

---


## Integration Points

### Activity Logger

**Changes**:
- Add `workspaceId`, `entityId`, `entityType` to all activity documents
- Denormalize `displayName` and `entitySlug` at time of logging
- Support dual-write: populate both `schoolId` (legacy) and `entityId` (new)

**Example**:
```typescript
await logActivity({
  type: 'stage_changed',
  workspaceId: 'workspace_123',
  entityId: 'entity_456',
  entityType: 'institution',
  displayName: 'Greenwood Academy',
  entitySlug: 'greenwood-academy',
  schoolId: 'school_789', // Legacy field
  // ... other fields
});
```

### Task Management

**Changes**:
- Add `entityId`, `entityType`, `workspaceId` to Task model
- Filter task list by `workspaceId`
- Display entity type badge on task cards
- Support dual-write: populate both `schoolId` (legacy) and `entityId` (new)

**Example**:
```typescript
await createTask({
  title: 'Follow up with principal',
  workspaceId: 'workspace_123',
  entityId: 'entity_456',
  entityType: 'institution',
  schoolId: 'school_789', // Legacy field
  // ... other fields
});
```

### Messaging Engine

**Changes**:
- Add `workspaceId` to `sendMessage` function (mandatory parameter)
- Record `workspaceId` on all `message_logs` documents
- Resolve template variables using entity data + workspace_entities for active workspace
- Resolve `contact_tags` from `workspaceTags` on workspace_entities

**Example**:
```typescript
await sendMessage({
  workspaceId: 'workspace_123',
  entityId: 'entity_456',
  templateId: 'template_789',
  // ... other fields
});
```

### Automation Engine

**Changes**:
- Add `workspaceId` to all automation event payloads
- Filter automation rules by `workspaceIds` array matching triggering `workspaceId`
- Resolve `workspaceTags` from workspace_entities for tag conditions
- Set `workspaceId` on created tasks from `CREATE_TASK` actions

**Example**:
```typescript
// Automation event payload
{
  organizationId: 'org_123',
  workspaceId: 'workspace_456',
  entityId: 'entity_789',
  entityType: 'institution',
  action: 'TAG_ADDED',
  actorId: 'user_101',
  timestamp: '2025-01-25T10:00:00Z'
}
```

### PDF Forms

**Changes**:
- Add `entityId` field to PDFForm model
- Support both `schoolId` (legacy) and `entityId` (new)
- Adapter layer populates both fields during migration

### Surveys

**Changes**:
- Add `entityId` field to Survey model
- Support both `schoolId` (legacy) and `entityId` (new)

### Meetings

**Changes**:
- Continue using `schoolSlug` for public URL routing
- Resolve `schoolSlug` from `entity.slug` field via adapter
- No breaking changes to public-facing pages

---

## Troubleshooting

### Common Issues

#### Issue: Scope mismatch error when linking entity to workspace

**Cause**: Entity type doesn't match workspace contactScope

**Solution**: Verify the entity's `entityType` matches the workspace's `contactScope`. Create a new workspace with the correct scope if needed.

#### Issue: Denormalized fields not syncing

**Cause**: `syncDenormalizedFields` not triggered after entity update

**Solution**: Ensure `updateEntityAction` calls `syncDenormalizedFields` when identity fields change.

#### Issue: Migration script creates duplicate entities

**Cause**: Idempotency checks not working

**Solution**: Verify entity IDs are generated consistently (`entity_${schoolId}`). Check if entity already exists before creating.

#### Issue: Security rules deny access to workspace_entities

**Cause**: User's `workspaceIds` array not updated after role change

**Solution**: Ensure user.workspaceIds is denormalized and kept in sync with role-based access.

---

## Best Practices

1. **Always use ScopeGuard**: Validate scope match at every write path
2. **Use Adapter Layer**: Don't access `schools` collection directly; use `resolveContact`
3. **Denormalize Intentionally**: Only denormalize fields that are frequently queried
4. **Batch Writes**: Use Firestore batch writes for denormalization sync (max 500 per batch)
5. **Log Activities**: Include `workspaceId`, `entityId`, `entityType` in all activity logs
6. **Test Properties**: Write property-based tests for architectural invariants
7. **Index Carefully**: Only create indexes for actual query patterns
8. **Dual-Write During Migration**: Populate both legacy and new fields during transition period

---

## Additional Resources

- **Requirements Document**: `.kiro/specs/contacts-expansion/requirements.md`
- **Architecture Notes**: `.kiro/specs/contacts-expansion/architecture-notes.md`
- **Tasks Document**: `.kiro/specs/contacts-expansion/tasks.md`
- **Deployment Readiness Report**: `src/lib/__tests__/task-42-deployment-readiness-report.md`
- **Property Test Examples**: `src/lib/__tests/*.property.test.ts`

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: March 2025
