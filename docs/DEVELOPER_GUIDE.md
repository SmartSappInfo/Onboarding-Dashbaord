# Developer Guide: Working with Entities

## Overview

This guide provides practical examples and best practices for developers working with the unified entity architecture in SmartSapp. Whether you're building new features or maintaining existing code, this guide will help you work effectively with entities.

## Quick Start

### 1. Understanding the Entity Model

SmartSapp uses a two-tier entity system:

- **Entities**: Global identity data (name, contacts, type)
- **Workspace Entities**: Workspace-specific operational data (pipeline, stage, tags)

```typescript
// Identity data (shared across workspaces)
const entity = {
  id: 'entity_abc123',
  name: 'Springfield Elementary',
  entityType: 'institution',
  globalTags: ['public', 'k-12']
};

// Operational data (workspace-specific)
const workspaceEntity = {
  id: 'workspace_123_entity_abc123',
  entityId: 'entity_abc123',
  workspaceId: 'workspace_123',
  pipelineId: 'admissions',
  stageId: 'active',
  workspaceTags: ['priority']
};
```

### 2. Using the Contact Adapter

Always use the Contact Adapter to resolve contact data:

```typescript
import { contactAdapter } from '@/lib/contact-adapter';

// Resolve contact by entityId
const contact = await contactAdapter.resolveContact(
  { entityId: 'entity_abc123' },
  'workspace_123'
);

console.log(contact.name); // 'Springfield Elementary'
console.log(contact.pipelineId); // 'admissions'
console.log(contact.stageId); // 'active'
```

### 3. Creating Records with EntityId

When creating feature records, use `entityId` as the primary identifier:

```typescript
import { createTask } from '@/lib/task-actions';

const task = await createTask({
  workspaceId: 'workspace_123',
  title: 'Follow up call',
  entityId: 'entity_abc123',
  entityType: 'institution',
  dueDate: '2026-04-15T10:00:00Z',
  assignedTo: 'user_456'
});
```

## Common Patterns

### Pattern 1: Creating a New Feature Module

When building a new feature that references contacts, follow this pattern:

#### Step 1: Define TypeScript Interface

```typescript
// src/lib/types.ts

interface MyFeature {
  id: string;
  organizationId?: string;
  workspaceId: string;
  title: string;
  description: string;
  
  // Contact identifiers
  entityId: string; // Required for new features
  entityType: 'institution' | 'family' | 'person';
  
  // Other fields
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

#### Step 2: Create Server Action

```typescript
// src/lib/my-feature-actions.ts

'use server';

import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { contactAdapter } from '@/lib/contact-adapter';
import type { MyFeature } from '@/lib/types';

export async function createMyFeature(
  input: {
    workspaceId: string;
    title: string;
    description: string;
    entityId: string;
    entityType: 'institution' | 'family' | 'person';
  }
): Promise<MyFeature> {
  const id = `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const feature: MyFeature = {
    id,
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    entityId: input.entityId,
    entityType: input.entityType,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestore, 'my_features', id), feature);
  
  return feature;
}

export async function getMyFeaturesForContact(
  entityId: string,
  workspaceId: string
): Promise<MyFeature[]> {
  const q = query(
    collection(firestore, 'my_features'),
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as MyFeature);
}

export async function getMyFeatureWithContact(
  featureId: string,
  workspaceId: string
): Promise<MyFeature & { contact: ResolvedContact | null }> {
  const featureDoc = await getDoc(doc(firestore, 'my_features', featureId));
  
  if (!featureDoc.exists()) {
    throw new Error('Feature not found');
  }
  
  const feature = featureDoc.data() as MyFeature;
  
  // Resolve contact via adapter
  const contact = await contactAdapter.resolveContact(
    { entityId: feature.entityId },
    workspaceId
  );
  
  return {
    ...feature,
    contact
  };
}
```

#### Step 3: Create UI Component

```typescript
// src/components/my-feature/MyFeatureCard.tsx

'use client';

import { useEffect, useState } from 'react';
import { contactAdapter } from '@/lib/contact-adapter';
import type { MyFeature, ResolvedContact } from '@/lib/types';

interface MyFeatureCardProps {
  feature: MyFeature;
  workspaceId: string;
}

export function MyFeatureCard({ feature, workspaceId }: MyFeatureCardProps) {
  const [contact, setContact] = useState<ResolvedContact | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadContact() {
      try {
        const resolved = await contactAdapter.resolveContact(
          { entityId: feature.entityId },
          workspaceId
        );
        setContact(resolved);
      } catch (error) {
        console.error('Failed to resolve contact:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadContact();
  }, [feature.entityId, workspaceId]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{feature.title}</h3>
      <p className="text-sm text-gray-600">{feature.description}</p>
      
      {contact && (
        <div className="mt-2 text-sm">
          <p><strong>Contact:</strong> {contact.name}</p>
          <p><strong>Type:</strong> {contact.entityType}</p>
          <p><strong>Stage:</strong> {contact.stageName}</p>
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Create Firestore Index

Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "my_features",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Pattern 2: Migrating Existing Feature Module

If you're updating an existing feature that uses `schoolId`, follow this pattern:

#### Step 1: Update TypeScript Interface

```typescript
// Before
interface Task {
  id: string;
  schoolId: string;
  schoolName: string;
  // ...
}

// After (dual-write period)
interface Task {
  id: string;
  schoolId?: string | null; // Optional for backward compatibility
  schoolName?: string | null;
  entityId?: string | null; // New field
  entityType?: 'institution' | 'family' | 'person'; // New field
  // ...
}
```

#### Step 2: Update Create Function (Dual-Write)

```typescript
// src/lib/task-actions.ts

export async function createTask(
  input: {
    workspaceId: string;
    title: string;
    entityId?: string;
    entityType?: 'institution' | 'family' | 'person';
    schoolId?: string; // Legacy support
  }
): Promise<Task> {
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Resolve both identifiers when possible
  let entityId = input.entityId;
  let entityType = input.entityType;
  let schoolId = input.schoolId;
  
  if (entityId && !schoolId) {
    // Try to resolve schoolId for backward compatibility
    const contact = await contactAdapter.resolveContact(
      { entityId },
      input.workspaceId
    );
    schoolId = contact?.schoolData?.id || null;
  } else if (schoolId && !entityId) {
    // Try to resolve entityId from migrated school
    const schoolDoc = await getDoc(doc(firestore, 'schools', schoolId));
    if (schoolDoc.exists() && schoolDoc.data().migrationStatus === 'migrated') {
      entityId = schoolDoc.data().entityId;
      entityType = 'institution';
    }
  }
  
  const task: Task = {
    id,
    workspaceId: input.workspaceId,
    title: input.title,
    // Dual-write: populate both when available
    schoolId: schoolId || null,
    entityId: entityId || null,
    entityType: entityType || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestore, 'tasks', id), task);
  
  return task;
}
```

#### Step 3: Update Query Functions (Fallback)

```typescript
export async function getTasksForContact(
  identifier: { entityId?: string; schoolId?: string },
  workspaceId: string
): Promise<Task[]> {
  if (!identifier.entityId && !identifier.schoolId) {
    throw new Error('Either entityId or schoolId must be provided');
  }
  
  let q = query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId)
  );
  
  // Prefer entityId
  if (identifier.entityId) {
    q = query(q, where('entityId', '==', identifier.entityId));
  } else if (identifier.schoolId) {
    q = query(q, where('schoolId', '==', identifier.schoolId));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Task);
}
```

#### Step 4: Update UI Components

```typescript
// Before
const tasks = await getTasksForContact({ schoolId: school.id }, workspaceId);

// After
const tasks = await getTasksForContact({ entityId: entity.id }, workspaceId);
```

### Pattern 3: Working with Workspace Entities

When you need workspace-specific operational data:

```typescript
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

// Get workspace entity
export async function getWorkspaceEntity(
  entityId: string,
  workspaceId: string
): Promise<WorkspaceEntity | null> {
  const docRef = doc(firestore, 'workspace_entities', `${workspaceId}_${entityId}`);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as WorkspaceEntity;
}

// Update workspace-specific fields
export async function updateWorkspaceEntity(
  entityId: string,
  workspaceId: string,
  updates: {
    stageId?: string;
    assignedTo?: { userId: string; name: string; email: string };
    workspaceTags?: string[];
  }
): Promise<void> {
  const docRef = doc(firestore, 'workspace_entities', `${workspaceId}_${entityId}`);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

// Update identity fields (goes to entities collection)
export async function updateEntity(
  entityId: string,
  updates: {
    name?: string;
    contacts?: FocalPerson[];
    globalTags?: string[];
  }
): Promise<void> {
  const docRef = doc(firestore, 'entities', entityId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}
```

### Pattern 4: Creating New Contacts

When creating a new contact (e.g., signup flow):

```typescript
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export async function createContact(
  input: {
    organizationId: string;
    workspaceId: string;
    entityType: 'institution' | 'family' | 'person';
    name: string;
    contacts: FocalPerson[];
    pipelineId: string;
    stageId: string;
    institutionData?: InstitutionData;
    familyData?: FamilyData;
    personData?: PersonData;
  }
): Promise<{ entity: Entity; workspaceEntity: WorkspaceEntity }> {
  // Generate unique entityId
  const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create entity (identity layer)
  const entity: Entity = {
    id: entityId,
    organizationId: input.organizationId,
    entityType: input.entityType,
    name: input.name,
    slug: input.name.toLowerCase().replace(/\s+/g, '-'),
    contacts: input.contacts,
    globalTags: [],
    status: 'active',
    institutionData: input.institutionData,
    familyData: input.familyData,
    personData: input.personData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestore, 'entities', entityId), entity);
  
  // Create workspace entity (operational layer)
  const workspaceEntityId = `${input.workspaceId}_${entityId}`;
  const workspaceEntity: WorkspaceEntity = {
    id: workspaceEntityId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    entityId: entityId,
    entityType: input.entityType,
    pipelineId: input.pipelineId,
    stageId: input.stageId,
    status: 'active',
    workspaceTags: [],
    displayName: input.name,
    primaryEmail: input.contacts[0]?.email,
    primaryPhone: input.contacts[0]?.phone,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestore, 'workspace_entities', workspaceEntityId), workspaceEntity);
  
  return { entity, workspaceEntity };
}
```

## Testing Patterns

### Unit Testing with Entities

```typescript
// src/lib/__tests__/my-feature-actions.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createMyFeature, getMyFeaturesForContact } from '../my-feature-actions';

describe('MyFeature Actions', () => {
  const mockWorkspaceId = 'workspace_test';
  const mockEntityId = 'entity_test123';
  
  beforeEach(async () => {
    // Setup: Create test entity
    await createTestEntity(mockEntityId, mockWorkspaceId);
  });
  
  it('should create feature with entityId', async () => {
    const feature = await createMyFeature({
      workspaceId: mockWorkspaceId,
      title: 'Test Feature',
      description: 'Test description',
      entityId: mockEntityId,
      entityType: 'institution'
    });
    
    expect(feature.entityId).toBe(mockEntityId);
    expect(feature.entityType).toBe('institution');
    expect(feature.title).toBe('Test Feature');
  });
  
  it('should query features by entityId', async () => {
    // Create test feature
    await createMyFeature({
      workspaceId: mockWorkspaceId,
      title: 'Test Feature',
      description: 'Test description',
      entityId: mockEntityId,
      entityType: 'institution'
    });
    
    // Query by entityId
    const features = await getMyFeaturesForContact(mockEntityId, mockWorkspaceId);
    
    expect(features.length).toBeGreaterThan(0);
    expect(features[0].entityId).toBe(mockEntityId);
  });
  
  it('should resolve contact via adapter', async () => {
    const feature = await createMyFeature({
      workspaceId: mockWorkspaceId,
      title: 'Test Feature',
      description: 'Test description',
      entityId: mockEntityId,
      entityType: 'institution'
    });
    
    const featureWithContact = await getMyFeatureWithContact(
      feature.id,
      mockWorkspaceId
    );
    
    expect(featureWithContact.contact).toBeDefined();
    expect(featureWithContact.contact?.entityId).toBe(mockEntityId);
  });
});
```

### Property-Based Testing

```typescript
// src/lib/__tests__/my-feature.property.test.ts

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { createMyFeature, getMyFeaturesForContact } from '../my-feature-actions';

describe('MyFeature Property Tests', () => {
  it('should always include entityId in created features', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          workspaceId: fc.string(),
          title: fc.string(),
          description: fc.string(),
          entityId: fc.string(),
          entityType: fc.constantFrom('institution', 'family', 'person')
        }),
        async (input) => {
          const feature = await createMyFeature(input);
          
          expect(feature.entityId).toBe(input.entityId);
          expect(feature.entityType).toBe(input.entityType);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should query features by entityId successfully', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          workspaceId: fc.string(),
          entityId: fc.string()
        }),
        async ({ workspaceId, entityId }) => {
          const features = await getMyFeaturesForContact(entityId, workspaceId);
          
          // All returned features should match the entityId
          features.forEach(feature => {
            expect(feature.entityId).toBe(entityId);
            expect(feature.workspaceId).toBe(workspaceId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Best Practices

### 1. Always Use EntityId for New Features

```typescript
// ✅ Good: Use entityId
interface NewFeature {
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
}

// ❌ Bad: Use schoolId
interface NewFeature {
  schoolId: string;
}
```

### 2. Use Contact Adapter for Resolution

```typescript
// ✅ Good: Use adapter
const contact = await contactAdapter.resolveContact({ entityId }, workspaceId);

// ❌ Bad: Direct database access
const entity = await getDoc(doc(firestore, 'entities', entityId));
const workspaceEntity = await getDoc(doc(firestore, 'workspace_entities', `${workspaceId}_${entityId}`));
```

### 3. Route Updates Correctly

```typescript
// ✅ Good: Route to correct collection
if (updates.name || updates.globalTags) {
  await updateEntity(entityId, updates);
}
if (updates.stageId || updates.workspaceTags) {
  await updateWorkspaceEntity(entityId, workspaceId, updates);
}

// ❌ Bad: Update wrong collection
await updateEntity(entityId, { stageId: 'new_stage' }); // Wrong!
```

### 4. Handle Missing Contacts Gracefully

```typescript
// ✅ Good: Handle null
const contact = await contactAdapter.resolveContact({ entityId }, workspaceId);
if (!contact) {
  return <div>Contact not found</div>;
}

// ❌ Bad: Assume contact exists
const contact = await contactAdapter.resolveContact({ entityId }, workspaceId);
console.log(contact.name); // May throw error
```

### 5. Use Denormalized Fields

```typescript
// ✅ Good: Use denormalized fields
const workspaceEntity = await getWorkspaceEntity(entityId, workspaceId);
console.log(workspaceEntity.displayName); // Fast

// ❌ Bad: Additional lookup
const workspaceEntity = await getWorkspaceEntity(entityId, workspaceId);
const entity = await getDoc(doc(firestore, 'entities', entityId));
console.log(entity.data().name); // Slow
```

### 6. Create Proper Indexes

Always create composite indexes for queries:

```json
{
  "collectionGroup": "my_features",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "workspaceId", "order": "ASCENDING" },
    { "fieldPath": "entityId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 7. Validate EntityId Format

```typescript
function isValidEntityId(entityId: string): boolean {
  return /^entity_[a-z0-9]+$/.test(entityId);
}

// Use in validation
if (!isValidEntityId(input.entityId)) {
  throw new Error('Invalid entityId format');
}
```

### 8. Cache Contact Resolutions

The Contact Adapter includes caching, but you can add component-level caching:

```typescript
const [contactCache, setContactCache] = useState<Map<string, ResolvedContact>>(new Map());

async function getContactCached(entityId: string, workspaceId: string) {
  const cacheKey = `${workspaceId}_${entityId}`;
  
  if (contactCache.has(cacheKey)) {
    return contactCache.get(cacheKey);
  }
  
  const contact = await contactAdapter.resolveContact({ entityId }, workspaceId);
  
  if (contact) {
    setContactCache(prev => new Map(prev).set(cacheKey, contact));
  }
  
  return contact;
}
```

## Common Pitfalls

### Pitfall 1: Mixing Identity and Operational Data

```typescript
// ❌ Bad: Putting operational data in entities
await updateDoc(doc(firestore, 'entities', entityId), {
  pipelineId: 'new_pipeline' // Wrong collection!
});

// ✅ Good: Route to workspace_entities
await updateDoc(
  doc(firestore, 'workspace_entities', `${workspaceId}_${entityId}`),
  { pipelineId: 'new_pipeline' }
);
```

### Pitfall 2: Not Handling Legacy Data

```typescript
// ❌ Bad: Assume entityId always exists
const tasks = await getDocs(
  query(collection(firestore, 'tasks'), where('entityId', '==', entityId))
);

// ✅ Good: Handle both identifiers
async function getTasksForContact(identifier: ContactIdentifier) {
  if (identifier.entityId) {
    return await queryByEntityId(identifier.entityId);
  } else if (identifier.schoolId) {
    return await queryBySchoolId(identifier.schoolId);
  }
  throw new Error('No identifier provided');
}
```

### Pitfall 3: Forgetting Workspace Boundaries

```typescript
// ❌ Bad: Query without workspace filter
const entities = await getDocs(
  query(collection(firestore, 'workspace_entities'), where('entityId', '==', entityId))
);

// ✅ Good: Always filter by workspace
const entities = await getDocs(
  query(
    collection(firestore, 'workspace_entities'),
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId)
  )
);
```

### Pitfall 4: Not Creating Indexes

```typescript
// ❌ Bad: Complex query without index
const tasks = await getDocs(
  query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('dueDate', 'asc')
  )
); // Will fail without composite index

// ✅ Good: Create index first (see firestore.indexes.json)
```

## Debugging Tips

### Enable Contact Adapter Logging

```typescript
// Add to contact-adapter.ts
const DEBUG = process.env.NODE_ENV === 'development';

async function resolveContact(identifier, workspaceId) {
  if (DEBUG) {
    console.log('Resolving contact:', { identifier, workspaceId });
  }
  
  // ... resolution logic
  
  if (DEBUG) {
    console.log('Resolved contact:', contact);
  }
  
  return contact;
}
```

### Check Migration Status

```typescript
// Check if a record has been migrated
const task = await getDoc(doc(firestore, 'tasks', taskId));
console.log('Has entityId:', !!task.data().entityId);
console.log('Has schoolId:', !!task.data().schoolId);
```

### Verify Indexes

Check Firestore console for index creation status:
1. Go to Firebase Console → Firestore → Indexes
2. Look for indexes with status "Building" or "Enabled"
3. If missing, create via `firestore.indexes.json`

## Resources

- [Entity Architecture Documentation](./ENTITY_ARCHITECTURE.md)
- [Migration Runbook](./MIGRATION_RUNBOOK.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)
- [TypeScript Types Reference](../src/lib/types.ts)
- [Contact Adapter Source](../src/lib/contact-adapter.ts)

## Getting Help

- **Internal Slack**: #dev-entity-migration
- **Documentation**: https://docs.smartsapp.com/entities
- **Code Reviews**: Tag @entity-migration-team
- **Questions**: Open a GitHub Discussion

## Changelog

### March 2026

- Added entity architecture support
- Introduced Contact Adapter pattern
- Implemented dual-write for backward compatibility
- Created comprehensive developer documentation
