# Entity Architecture Documentation

## Overview

SmartSapp uses a unified entity architecture to manage contacts across multiple workspaces. This architecture replaces the legacy `schools` collection with a two-tier system: `entities` (identity layer) and `workspace_entities` (operational layer).

## Architecture Layers

### Identity Layer: Entities Collection

The `entities` collection stores the core identity information for all contacts, regardless of type (institution, family, or person). This data is shared across all workspaces within an organization.

```typescript
interface Entity {
  id: string; // Format: entity_<random_id>
  organizationId: string;
  entityType: 'institution' | 'family' | 'person';
  name: string;
  slug?: string; // For institutions
  contacts: FocalPerson[];
  globalTags: string[]; // Identity-level tags
  status?: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  
  // Type-specific data
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
  
  // Reserved for future relationships
  relatedEntityIds?: string[];
}
```

**Key Characteristics:**
- Globally unique across organization
- Immutable identity information (name, contacts, type)
- Shared across all workspaces
- No workspace-specific operational data

### Operational Layer: Workspace Entities Collection

The `workspace_entities` collection stores workspace-specific operational state for each entity.

```typescript
interface WorkspaceEntity {
  id: string; // Format: {workspaceId}_{entityId}
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  
  // Pipeline state
  pipelineId: string;
  stageId: string;
  currentStageName?: string;
  
  // Assignment
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  };
  
  // Status
  status: 'active' | 'archived';
  workspaceTags: string[]; // Workspace-scoped tags
  lastContactedAt?: string;
  
  // Denormalized fields for performance
  displayName: string;
  primaryEmail?: string;
  primaryPhone?: string;
  
  addedAt: string;
  updatedAt: string;
}
```

**Key Characteristics:**
- Workspace-scoped operational data
- Pipeline and stage tracking
- Assignment and status management
- Denormalized fields for query performance
- One record per entity per workspace

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Organization                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Entities Collection (Identity)            │    │
│  │                                                      │    │
│  │  entity_123: {                                      │    │
│  │    name: "Springfield Elementary",                  │    │
│  │    entityType: "institution",                       │    │
│  │    globalTags: ["public", "k-12"],                 │    │
│  │    contacts: [...],                                 │    │
│  │    institutionData: {...}                           │    │
│  │  }                                                   │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ Referenced by                    │
│                           ▼                                  │
│  ┌─────────────────────┬──────────────────────────────┐    │
│  │  Workspace A        │  Workspace B                  │    │
│  │                     │                               │    │
│  │  workspace_entities │  workspace_entities           │    │
│  │                     │                               │    │
│  │  workspaceA_entity_123: {                          │    │
│  │    entityId: "entity_123",                         │    │
│  │    pipelineId: "admissions",                       │    │
│  │    stageId: "applied",                             │    │
│  │    workspaceTags: ["priority"],                    │    │
│  │    assignedTo: {...}                               │    │
│  │  }                  │  workspaceB_entity_123: {    │    │
│  │                     │    entityId: "entity_123",   │    │
│  │                     │    pipelineId: "billing",    │    │
│  │                     │    stageId: "active",        │    │
│  │                     │    workspaceTags: ["vip"]    │    │
│  │                     │  }                           │    │
│  └─────────────────────┴──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Contact Adapter Pattern

The Contact Adapter provides a unified interface for resolving contact data, abstracting away the complexity of the dual-model system (legacy schools vs. new entities).

### Interface

```typescript
interface ContactAdapter {
  // Resolve contact by either schoolId or entityId
  resolveContact(
    identifier: { schoolId?: string; entityId?: string },
    workspaceId: string
  ): Promise<ResolvedContact | null>;
  
  // Query contacts for a workspace
  getWorkspaceContacts(
    workspaceId: string,
    filters?: ContactFilters
  ): Promise<ResolvedContact[]>;
  
  // Check if a contact exists
  contactExists(
    identifier: { schoolId?: string; entityId?: string }
  ): Promise<boolean>;
  
  // Search contacts
  searchContacts(
    workspaceId: string,
    searchTerm: string
  ): Promise<ResolvedContact[]>;
}
```

### Resolution Logic

```typescript
async function resolveContact(
  identifier: { schoolId?: string; entityId?: string },
  workspaceId: string
): Promise<ResolvedContact | null> {
  // 1. Try entity + workspace_entity (migrated contacts)
  if (identifier.entityId) {
    const entity = await getDoc(doc(firestore, 'entities', identifier.entityId));
    if (entity.exists()) {
      const workspaceEntity = await getDoc(
        doc(firestore, 'workspace_entities', `${workspaceId}_${identifier.entityId}`)
      );
      
      return {
        ...entity.data(),
        ...workspaceEntity.data(),
        migrationStatus: 'migrated'
      };
    }
  }
  
  // 2. Fallback to legacy school
  if (identifier.schoolId) {
    const school = await getDoc(doc(firestore, 'schools', identifier.schoolId));
    if (school.exists()) {
      return {
        ...school.data(),
        migrationStatus: 'legacy',
        schoolData: school.data()
      };
    }
  }
  
  return null;
}
```

### Caching Strategy

The adapter implements a 5-minute TTL cache to reduce database reads:

```typescript
const contactCache = new Map<string, { data: ResolvedContact; expiresAt: number }>();

function getCacheKey(identifier: ContactIdentifier, workspaceId: string): string {
  return `${workspaceId}_${identifier.entityId || identifier.schoolId}`;
}

async function resolveContactWithCache(
  identifier: ContactIdentifier,
  workspaceId: string
): Promise<ResolvedContact | null> {
  const cacheKey = getCacheKey(identifier, workspaceId);
  const cached = contactCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  
  const contact = await resolveContact(identifier, workspaceId);
  
  if (contact) {
    contactCache.set(cacheKey, {
      data: contact,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });
  }
  
  return contact;
}
```

## Dual-Write Pattern

During the migration period, all feature modules write to both legacy (`schoolId`) and new (`entityId`) fields to maintain backward compatibility.

### Implementation

```typescript
async function createTask(input: CreateTaskInput): Promise<Task> {
  const task: Task = {
    id: generateId(),
    workspaceId: input.workspaceId,
    title: input.title,
    
    // Dual-write: populate both identifiers
    schoolId: input.schoolId || null,
    entityId: input.entityId || null,
    entityType: input.entityType || null,
    
    // ... other fields
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestore, 'tasks', task.id), task);
  return task;
}
```

### Resolution During Dual-Write

When only one identifier is provided, attempt to resolve the other:

```typescript
async function createTaskWithResolution(input: CreateTaskInput): Promise<Task> {
  let schoolId = input.schoolId;
  let entityId = input.entityId;
  let entityType = input.entityType;
  
  // If only entityId provided, try to resolve schoolId
  if (entityId && !schoolId) {
    const contact = await contactAdapter.resolveContact({ entityId }, input.workspaceId);
    schoolId = contact?.schoolData?.id || null;
  }
  
  // If only schoolId provided, try to resolve entityId
  if (schoolId && !entityId) {
    const school = await getDoc(doc(firestore, 'schools', schoolId));
    if (school.exists() && school.data().migrationStatus === 'migrated') {
      entityId = school.data().entityId;
      entityType = 'institution';
    }
  }
  
  return createTask({
    ...input,
    schoolId,
    entityId,
    entityType
  });
}
```

## Query Patterns

### Pattern 1: Query by EntityId with SchoolId Fallback

```typescript
async function getTasksForContact(
  identifier: { entityId?: string; schoolId?: string },
  workspaceId: string
): Promise<Task[]> {
  let q = query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId)
  );
  
  // Prefer entityId
  if (identifier.entityId) {
    q = query(q, where('entityId', '==', identifier.entityId));
  } else if (identifier.schoolId) {
    q = query(q, where('schoolId', '==', identifier.schoolId));
  } else {
    throw new Error('No contact identifier provided');
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Task);
}
```

### Pattern 2: Workspace-Scoped Entity Query

```typescript
async function getWorkspaceContacts(
  workspaceId: string,
  filters?: {
    entityType?: 'institution' | 'family' | 'person';
    pipelineId?: string;
    stageId?: string;
    status?: 'active' | 'archived';
  }
): Promise<WorkspaceEntity[]> {
  let q = query(
    collection(firestore, 'workspace_entities'),
    where('workspaceId', '==', workspaceId)
  );
  
  if (filters?.entityType) {
    q = query(q, where('entityType', '==', filters.entityType));
  }
  
  if (filters?.pipelineId) {
    q = query(q, where('pipelineId', '==', filters.pipelineId));
  }
  
  if (filters?.stageId) {
    q = query(q, where('stageId', '==', filters.stageId));
  }
  
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as WorkspaceEntity);
}
```

### Pattern 3: Cross-Workspace Entity Query (Admin Only)

```typescript
async function getOrganizationEntities(
  organizationId: string,
  filters?: {
    entityType?: 'institution' | 'family' | 'person';
    globalTags?: string[];
  }
): Promise<Entity[]> {
  let q = query(
    collection(firestore, 'entities'),
    where('organizationId', '==', organizationId)
  );
  
  if (filters?.entityType) {
    q = query(q, where('entityType', '==', filters.entityType));
  }
  
  if (filters?.globalTags && filters.globalTags.length > 0) {
    q = query(q, where('globalTags', 'array-contains-any', filters.globalTags));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Entity);
}
```

## Migration Strategy

### Phase 1: Dual-Write Implementation

All feature modules are updated to write both `schoolId` and `entityId` fields:

1. Update TypeScript interfaces to include optional `entityId` and `entityType` fields
2. Update create/update functions to populate both fields
3. Update query functions to accept either identifier
4. Update UI components to use Contact Adapter

### Phase 2: Data Migration

Existing records are migrated using the Fetch-Enrich-Restore protocol:

1. **Fetch**: Identify records with `schoolId` but no `entityId`
2. **Enrich**: Resolve `entityId` from `schoolId` via schools collection
3. **Restore**: Update records with `entityId` while preserving `schoolId`

### Phase 3: EntityId-First

After migration completes, new code prioritizes `entityId`:

1. Query by `entityId` first, fallback to `schoolId` only for legacy data
2. Display entity information from `entities` + `workspace_entities`
3. Create new contacts as entities (no legacy schools)

### Phase 4: SchoolId Deprecation (Future)

Eventually, `schoolId` fields can be removed:

1. Verify all records have `entityId`
2. Remove `schoolId` from TypeScript interfaces
3. Remove `schoolId` query logic
4. Remove `schoolId` fields from database (optional)

## Firestore Indexes

Required composite indexes for optimal query performance:

```javascript
// Tasks by entityId
{
  collection: 'tasks',
  fields: [
    { field: 'workspaceId', order: 'ASCENDING' },
    { field: 'entityId', order: 'ASCENDING' },
    { field: 'dueDate', order: 'ASCENDING' }
  ]
}

// Activities by entityId
{
  collection: 'activities',
  fields: [
    { field: 'workspaceId', order: 'ASCENDING' },
    { field: 'entityId', order: 'ASCENDING' },
    { field: 'timestamp', order: 'DESCENDING' }
  ]
}

// Workspace entities by workspace and type
{
  collection: 'workspace_entities',
  fields: [
    { field: 'workspaceId', order: 'ASCENDING' },
    { field: 'entityType', order: 'ASCENDING' },
    { field: 'status', order: 'ASCENDING' }
  ]
}

// Workspace entities by pipeline
{
  collection: 'workspace_entities',
  fields: [
    { field: 'workspaceId', order: 'ASCENDING' },
    { field: 'pipelineId', order: 'ASCENDING' },
    { field: 'stageId', order: 'ASCENDING' }
  ]
}
```

## Security Rules

Firestore security rules enforce workspace boundaries and permissions:

```javascript
// Entities: Read by organization members
match /entities/{entityId} {
  allow read: if request.auth != null && 
    resource.data.organizationId in request.auth.token.organizationIds;
  
  allow write: if request.auth != null && 
    resource.data.organizationId in request.auth.token.organizationIds &&
    hasRole(request.auth.token, 'admin');
}

// Workspace Entities: Read/write by workspace members
match /workspace_entities/{workspaceEntityId} {
  allow read: if request.auth != null && 
    resource.data.workspaceId in request.auth.token.workspaceIds;
  
  allow write: if request.auth != null && 
    resource.data.workspaceId in request.auth.token.workspaceIds &&
    hasWorkspacePermission(request.auth.token, resource.data.workspaceId, 'write');
}

// Feature collections: Enforce workspace boundaries
match /tasks/{taskId} {
  allow read: if request.auth != null && 
    resource.data.workspaceId in request.auth.token.workspaceIds;
  
  allow write: if request.auth != null && 
    request.resource.data.workspaceId in request.auth.token.workspaceIds;
}
```

## Best Practices

### 1. Always Use Contact Adapter

```typescript
// ✅ Good: Use adapter for resolution
const contact = await contactAdapter.resolveContact(
  { entityId: task.entityId },
  task.workspaceId
);

// ❌ Bad: Direct database access
const entity = await getDoc(doc(firestore, 'entities', task.entityId));
```

### 2. Prefer EntityId in New Code

```typescript
// ✅ Good: Use entityId as primary identifier
async function createTask(input: { entityId: string; ... }) {
  // ...
}

// ❌ Bad: Use schoolId as primary identifier
async function createTask(input: { schoolId: string; ... }) {
  // ...
}
```

### 3. Handle Both Identifiers Gracefully

```typescript
// ✅ Good: Accept either identifier
async function getTasksForContact(
  identifier: { entityId?: string; schoolId?: string }
) {
  if (!identifier.entityId && !identifier.schoolId) {
    throw new Error('No contact identifier provided');
  }
  // ...
}

// ❌ Bad: Require specific identifier
async function getTasksForContact(entityId: string) {
  // Breaks backward compatibility
}
```

### 4. Update Identity in Entities, Operations in Workspace Entities

```typescript
// ✅ Good: Route updates correctly
async function updateContact(entityId: string, updates: ContactUpdates) {
  if (updates.name || updates.contacts || updates.globalTags) {
    // Identity updates go to entities
    await updateDoc(doc(firestore, 'entities', entityId), updates);
  }
  
  if (updates.pipelineId || updates.stageId || updates.workspaceTags) {
    // Operational updates go to workspace_entities
    await updateDoc(
      doc(firestore, 'workspace_entities', `${workspaceId}_${entityId}`),
      updates
    );
  }
}

// ❌ Bad: Update wrong collection
async function updateContact(entityId: string, updates: ContactUpdates) {
  // Don't put operational data in entities
  await updateDoc(doc(firestore, 'entities', entityId), {
    pipelineId: updates.pipelineId // Wrong!
  });
}
```

### 5. Use Denormalized Fields for Performance

```typescript
// ✅ Good: Use denormalized fields from workspace_entities
const contacts = await getWorkspaceContacts(workspaceId);
contacts.forEach(contact => {
  console.log(contact.displayName); // No additional lookup needed
});

// ❌ Bad: Additional lookup for each contact
const contacts = await getWorkspaceContacts(workspaceId);
for (const contact of contacts) {
  const entity = await getDoc(doc(firestore, 'entities', contact.entityId));
  console.log(entity.data().name); // Expensive!
}
```

## Troubleshooting

### Contact Not Found

**Symptom**: `contactAdapter.resolveContact()` returns `null`

**Causes**:
1. Entity doesn't exist in `entities` collection
2. Workspace entity doesn't exist for the workspace
3. Legacy school doesn't exist in `schools` collection
4. Wrong workspace ID provided

**Solution**:
```typescript
const contact = await contactAdapter.resolveContact(identifier, workspaceId);
if (!contact) {
  // Check if entity exists
  const entity = await getDoc(doc(firestore, 'entities', identifier.entityId));
  console.log('Entity exists:', entity.exists());
  
  // Check if workspace entity exists
  const we = await getDoc(
    doc(firestore, 'workspace_entities', `${workspaceId}_${identifier.entityId}`)
  );
  console.log('Workspace entity exists:', we.exists());
}
```

### Query Returns No Results

**Symptom**: Query by `entityId` returns empty array

**Causes**:
1. Records not yet migrated (still using `schoolId` only)
2. Wrong workspace ID
3. Missing Firestore index

**Solution**:
```typescript
// Check if records are migrated
const tasks = await getDocs(
  query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', null)
  )
);
console.log('Unmigrated tasks:', tasks.size);

// Check Firestore console for index creation status
```

### Slow Query Performance

**Symptom**: Queries take > 1000ms

**Causes**:
1. Missing composite index
2. Not using denormalized fields
3. Cache not being used

**Solution**:
1. Create required composite indexes (see Firestore Indexes section)
2. Use denormalized fields from `workspace_entities`
3. Verify Contact Adapter cache is enabled

## Related Documentation

- [Migration Runbook](./MIGRATION_RUNBOOK.md) - Step-by-step migration process
- [API Documentation](./API_DOCUMENTATION.md) - API endpoints with entityId support
- [Developer Guide](./DEVELOPER_GUIDE.md) - Working with entities in new features
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common issues and solutions
