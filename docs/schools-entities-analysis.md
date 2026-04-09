# Schools vs Entities Data Flow Analysis

## Executive Summary

The codebase is currently in a **dual-model state** with an incomplete migration from `schools` collection to the unified `entities` + `workspace_entities` architecture.

### Current State

- **Schools Page**: Reads from `schools` collection (legacy model)
- **New School Creation**: Saves to `schools` collection only (no dual-write)
- **Migration Status**: Migration infrastructure exists but is NOT integrated into normal operations
- **Message Composer**: Uses `workspace_entities` collection (new model)

### Critical Finding

**There is a data consistency gap**: New schools are created in the `schools` collection but the message composer reads from `workspace_entities`, meaning newly created schools won't appear in the message composer until manually migrated.

---

## Detailed Analysis

### 1. Schools Page Data Source

**File**: `src/app/admin/schools/SchoolsClient.tsx`

**Query** (Line 145):
```typescript
const schoolsCol = useMemoFirebase(() => 
  firestore ? query(
    collection(firestore, 'schools'), 
    where('workspaceIds', 'array-contains', activeWorkspaceId)
  ) : null, 
[firestore, activeWorkspaceId]);
```

**Verdict**: ✅ Reads from `schools` collection (legacy model)

---

### 2. New School Creation

**File**: `src/lib/school-actions.ts`

**Function**: `createSchoolAction` (Line 56)

**Save Operation** (Line 95):
```typescript
const docRef = await adminDb.collection('schools').add(schoolData);
```

**Key Observations**:
- ❌ No `migrationStatus` field set
- ❌ No entity creation in `entities` collection
- ❌ No workspace_entity creation in `workspace_entities` collection
- ❌ No dual-write pattern implemented

**Verdict**: ✅ Saves to `schools` collection only (legacy model)

---

### 3. Migration Infrastructure

**File**: `src/lib/entity-migrations.ts`

**Available Functions**:
1. `migrateSchoolsToEntities()` - Batch migration from schools → entities + workspace_entities
2. `rollbackEntitiesMigration()` - Rollback migration
3. `verifyEntitiesMigration()` - Check migration status

**Migration Process**:
```typescript
// For each school:
1. Create backup in 'backup_entities_migration'
2. Create entity in 'entities' collection
3. Create workspace_entity for each workspaceId
4. Update school with migrationStatus: 'migrated'
```

**Key Observations**:
- ✅ Comprehensive migration logic exists
- ✅ Includes rollback capability
- ✅ Handles multi-workspace scenarios
- ❌ NOT integrated into `createSchoolAction`
- ❌ Must be run manually (client-side function)

**Verdict**: Migration infrastructure is complete but isolated from normal operations

---

### 4. Contact Adapter (Dual-Read Pattern)

**File**: `src/lib/contact-adapter.ts`

**Purpose**: Unified interface for reading from either legacy or new model

**Key Functions**:
- `resolveContact()` - Reads from entities OR schools based on migrationStatus
- `getWorkspaceContacts()` - Queries both collections
- `searchContacts()` - Searches both collections

**Logic Flow**:
```typescript
1. Check if entityId provided → read from entities + workspace_entities
2. Check if schoolId provided:
   a. Read school document
   b. Check migrationStatus field
   c. If 'migrated' → read from entities + workspace_entities
   d. If 'legacy' or undefined → read from schools
3. Return unified ResolvedContact object
```

**Verdict**: ✅ Adapter supports gradual migration but requires migrationStatus field

---

### 5. Message Composer (Uses New Model)

**File**: `src/app/admin/messaging/composer/components/EntitySelector.tsx`

**Query**:
```typescript
query(
  collection(firestore, 'workspace_entities'),
  where('workspaceId', '==', activeWorkspaceId),
  where('status', '==', 'active'),
  orderBy('displayName', 'asc')
)
```

**Verdict**: ✅ Reads from `workspace_entities` collection (new model)

**Critical Issue**: Newly created schools won't appear here until migrated!

---

## Data Consistency Gap

### Problem

1. User creates new school via `/admin/schools/new`
2. School is saved to `schools` collection
3. User goes to message composer
4. **School doesn't appear** because composer reads from `workspace_entities`

### Impact

- New schools are invisible to messaging features
- Manual migration required after each school creation
- Inconsistent user experience

---

## Migration Strategy Options

### Option 1: Dual-Write Pattern (Recommended)

**Modify `createSchoolAction` to write to both models**

**Pros**:
- New schools immediately available in all features
- Gradual migration of existing data
- No breaking changes
- Backward compatible

**Cons**:
- Temporary data duplication
- Requires maintaining both write paths

**Implementation**:
```typescript
// In createSchoolAction:
1. Create school in 'schools' collection (existing)
2. Create entity in 'entities' collection (new)
3. Create workspace_entity in 'workspace_entities' (new)
4. Set migrationStatus: 'migrated' on school
```

---

### Option 2: Full Migration + Switch to New Model

**Migrate all existing schools, then update all read operations**

**Pros**:
- Clean architecture
- Single source of truth
- No data duplication

**Cons**:
- High risk (all-or-nothing)
- Requires updating all queries
- Potential downtime
- Complex rollback

**Not Recommended**: Too risky for production system

---

### Option 3: Keep Legacy Model (Status Quo)

**Continue using schools collection, abandon entities model**

**Pros**:
- No changes needed
- Zero risk

**Cons**:
- Message composer already uses new model
- Inconsistent architecture
- Technical debt accumulates

**Not Recommended**: Already have inconsistency

---

## Recommended Implementation Plan

### Phase 1: Implement Dual-Write (Immediate)

1. **Update `createSchoolAction`**:
   - Add entity creation logic
   - Add workspace_entity creation logic
   - Set `migrationStatus: 'migrated'`

2. **Update `convertToOnboardingAction`**:
   - Check migrationStatus
   - Update both models if migrated

3. **Test thoroughly**:
   - Create new school
   - Verify appears in schools page
   - Verify appears in message composer
   - Verify all features work

### Phase 2: Migrate Existing Data (Scheduled)

1. **Run migration script**:
   ```typescript
   await migrateSchoolsToEntities(firestore);
   ```

2. **Verify migration**:
   ```typescript
   await verifyEntitiesMigration(firestore);
   ```

3. **Monitor for issues**

### Phase 3: Update Read Operations (Future)

1. **Gradually update queries** to use entities model
2. **Keep adapter layer** for backward compatibility
3. **Deprecate schools collection** (don't delete yet)

### Phase 4: Cleanup (Long-term)

1. **Archive schools collection**
2. **Remove adapter layer**
3. **Simplify codebase**

---

## Code Changes Required

### 1. Update `createSchoolAction`

**File**: `src/lib/school-actions.ts`

**Add after line 95** (after creating school):

```typescript
// Create entity and workspace_entity for new unified model
const entityId = `entity_${docRef.id}`;
const timestamp = new Date().toISOString();

// Create entity
await adminDb.collection('entities').doc(entityId).set({
  id: entityId,
  entityType: 'institution',
  organizationId: data.organizationId || 'smartsapp-hq',
  name: data.name,
  slug: slug,
  globalTags: data.tags || [],
  institutionData: {
    nominalRoll: data.nominalRoll || 0,
    billingAddress: data.billingAddress || '',
    currency: data.currency || 'GHS',
    subscriptionPackageId: data.subscriptionPackageId || '',
    subscriptionRate: data.subscriptionRate || 0,
    focalPersons: data.focalPersons || []
  },
  createdAt: timestamp,
  updatedAt: timestamp
});

// Create workspace_entities for each workspace
const workspaceIds = data.workspaceIds || ['onboarding'];
for (const workspaceId of workspaceIds) {
  const workspaceEntityId = `${workspaceId}_${entityId}`;
  await adminDb.collection('workspace_entities').doc(workspaceEntityId).set({
    id: workspaceEntityId,
    workspaceId: workspaceId,
    entityId: entityId,
    organizationId: data.organizationId || 'smartsapp-hq',
    displayName: data.name,
    primaryEmail: '',
    primaryPhone: '',
    pipelineId: initialPipelineId,
    stageId: defaultStage.id,
    currentStageName: defaultStage.name,
    status: data.status || 'active',
    assignedTo: data.assignedTo || '',
    workspaceTags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

// Update school with migration status
await adminDb.collection('schools').doc(docRef.id).update({
  migrationStatus: 'migrated',
  entityId: entityId,
  migratedAt: timestamp
});
```

### 2. Add Required Firestore Indexes

**File**: `firestore.indexes.json`

Ensure these indexes exist:
- `workspace_entities`: workspaceId + status + displayName
- `entities`: organizationId + name + entityType

---

## Testing Checklist

- [ ] Create new school via UI
- [ ] Verify school appears in schools page
- [ ] Verify school appears in message composer entity selector
- [ ] Verify school has migrationStatus: 'migrated'
- [ ] Verify entity created in entities collection
- [ ] Verify workspace_entity created for each workspace
- [ ] Test school editing
- [ ] Test school deletion (should delete from all collections)
- [ ] Test pipeline stage changes
- [ ] Test user assignment
- [ ] Test tagging functionality
- [ ] Run migration script on test data
- [ ] Verify rollback functionality

---

## Risks & Mitigation

### Risk 1: Data Duplication

**Mitigation**: This is temporary and intentional during migration period

### Risk 2: Write Failures

**Mitigation**: Wrap in transaction or implement compensating actions

### Risk 3: Performance Impact

**Mitigation**: Batch operations, use Firebase Admin SDK efficiently

### Risk 4: Inconsistent State

**Mitigation**: Always set migrationStatus field, use adapter layer for reads

---

## Conclusion

The codebase has a well-designed migration infrastructure but it's not integrated into normal operations. The immediate priority is implementing dual-write in `createSchoolAction` to ensure new schools are available across all features, especially the message composer.

The recommended approach is gradual migration with dual-write, maintaining backward compatibility while moving toward the unified entity model.
