# Seed Page Migration Guide: Fetch, Enrich, and Restore

## Overview

The seed page currently implements a **fetch → enrich → restore** pattern for migrating legacy data to the new multi-workspace architecture. However, it **does NOT yet include** the migration to the new `entities` + `workspace_entities` schema required for the contacts expansion feature.

## Current Implementation Status

### ✅ What's Implemented (Current Seed Page)

The seed page at `/seeds` (or `/admin/seeds`) currently handles:

1. **Operational Data Enrichment** - Migrates single `workspaceId` to `workspaceIds` arrays
2. **Blueprint Reconstruction** - Rebuilds pipelines and stages from school metadata
3. **Timeline Binding** - Binds activities and tasks to workspaces
4. **Domain Enrichment** - Enriches users, roles, and billing data

### ❌ What's Missing (Entities Migration)

The seed page **does NOT** currently include:

1. Migration from `schools` → `entities` + `workspace_entities`
2. Entity creation with `entityType: institution`
3. Workspace-entity link creation
4. Tag migration to `globalTags` and `workspaceTags`
5. Setting `migrationStatus: "migrated"` on schools

---

## Current Seed Page Architecture

### How It Works

The seed page uses a **3-phase pattern** for each migration:

#### Phase 1: Fetch
```typescript
// Fetch all documents from a collection
const snap = await getDocs(collection(firestore, 'schools'));
```

#### Phase 2: Enrich
```typescript
// For each document, add new fields
for (const docSnap of snap.docs) {
  const data = docSnap.data();
  
  // Create backup
  const backupRef = doc(firestore, `backup_phase2_schools`, docSnap.id);
  batch.set(backupRef, { ...data, backedUpAt: new Date().toISOString() });
  
  // Enrich with new fields
  const updates: any = {
    organizationId: DEFAULT_ORG_ID,
    updatedAt: new Date().toISOString()
  };
  
  // Migrate single ID to array
  if (data.workspaceId && !data.workspaceIds) {
    updates.workspaceIds = [data.workspaceId];
    updates.workspaceId = deleteField();
  }
  
  batch.update(docSnap.ref, updates);
}
```

#### Phase 3: Restore (Commit)
```typescript
// Commit all changes in batch
await batch.commit();
return count;
```

### Current Functions

| Function | Purpose | Collections Affected |
|----------|---------|---------------------|
| `enrichOperationalData()` | Migrates `workspaceId` → `workspaceIds` | schools, meetings, surveys, pdfs, contracts, templates, etc. |
| `syncOperationalArchitecture()` | Rebuilds pipelines/stages from school metadata | pipelines, onboardingStages |
| `enrichTasksWithWorkspace()` | Adds `workspaceId` to tasks | tasks |
| `enrichActivitiesWithWorkspace()` | Adds `workspaceId` to activities | activities |
| `enrichRolesWithWorkspaces()` | Adds `workspaceIds` to roles | roles |
| `enrichUsers()` | Adds `organizationId` and `workspaceIds` | users |

### Rollback Support

Each function creates a backup before making changes:

```typescript
// Backup collection naming pattern
const backupCol = `backup_phase2_${colName}`;

// Rollback function
async function performRollback(firestore: Firestore, colName: string) {
  const backupCol = `backup_phase2_${colName}`;
  const snap = await getDocs(collection(firestore, backupCol));
  const batch = writeBatch(firestore);
  
  snap.forEach(docSnap => {
    const { backedUpAt, ...originalData } = docSnap.data();
    batch.set(doc(firestore, colName, docSnap.id), originalData);
  });
  
  await batch.commit();
}
```

---

## What Needs to Be Added: Entities Migration

To complete the contacts expansion migration, you need to add a new function to the seed page that implements the **schools → entities + workspace_entities** migration.

### Required Function: `migrateSchoolsToEntities()`

This function should:

1. **Fetch** all schools from the `schools` collection
2. **For each school**:
   - Create an `entity` document with `entityType: institution`
   - Create `workspace_entities` documents for each workspace the school belongs to
   - Copy pipeline/stage data to `workspace_entities`
   - Migrate tags to `globalTags` (entity) and `workspaceTags` (workspace_entities)
   - Set `migrationStatus: "migrated"` on the school document
3. **Handle idempotency** - Skip schools already migrated
4. **Create backups** - Backup schools before migration
5. **Handle errors** - Log errors without aborting entire migration

### Implementation Template

```typescript
/**
 * ENTITIES MIGRATION: Schools → Entities + Workspace_Entities
 * Migrates legacy schools collection to new entity architecture
 */
export async function migrateSchoolsToEntities(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  const timestamp = new Date().toISOString();
  let count = 0;
  
  // Phase 1: Fetch all schools
  const schoolsSnap = await getDocs(collection(firestore, 'schools'));
  
  for (const schoolDoc of schoolsSnap.docs) {
    const school = schoolDoc.data() as School;
    
    // Skip if already migrated
    if (school.migrationStatus === 'migrated') {
      console.log(`Skipping ${schoolDoc.id} - already migrated`);
      continue;
    }
    
    try {
      // Phase 2a: Create backup
      const backupRef = doc(firestore, 'backup_schools_migration', schoolDoc.id);
      batch.set(backupRef, { ...school, backedUpAt: timestamp });
      
      // Phase 2b: Create entity document
      const entityId = `entity_${schoolDoc.id}`;
      const entityRef = doc(firestore, 'entities', entityId);
      
      batch.set(entityRef, {
        id: entityId,
        entityType: 'institution',
        organizationId: school.organizationId || DEFAULT_ORG_ID,
        name: school.name,
        slug: school.slug,
        email: school.email,
        phone: school.phone,
        address: school.address,
        website: school.website,
        contacts: school.contacts || [],
        globalTags: school.tags || [], // Migrate tags to globalTags
        institutionData: {
          nominalRoll: school.nominalRoll,
          billingAddress: school.billingAddress,
          currency: school.currency,
          subscriptionPackageId: school.subscriptionPackageId,
          focalPersons: school.focalPersons || []
        },
        createdAt: school.createdAt || timestamp,
        updatedAt: timestamp
      });
      
      // Phase 2c: Create workspace_entities documents
      const workspaceIds = school.workspaceIds || ['onboarding'];
      
      for (const workspaceId of workspaceIds) {
        const workspaceEntityId = `${workspaceId}_${entityId}`;
        const workspaceEntityRef = doc(firestore, 'workspace_entities', workspaceEntityId);
        
        batch.set(workspaceEntityRef, {
          id: workspaceEntityId,
          workspaceId: workspaceId,
          entityId: entityId,
          organizationId: school.organizationId || DEFAULT_ORG_ID,
          
          // Denormalized fields for query performance
          displayName: school.name,
          primaryEmail: school.email,
          primaryPhone: school.phone,
          
          // Workspace-specific operational state
          pipelineId: school.pipelineId,
          stageId: school.stage?.id,
          currentStageName: school.stage?.name,
          status: school.status,
          assignedTo: school.assignedTo,
          workspaceTags: [], // Workspace-specific tags (empty initially)
          
          createdAt: school.createdAt || timestamp,
          updatedAt: timestamp
        });
      }
      
      // Phase 2d: Update school with migration status
      batch.update(schoolDoc.ref, {
        migrationStatus: 'migrated',
        entityId: entityId,
        migratedAt: timestamp
      });
      
      count++;
      
      // Commit in batches of 500 (Firestore limit)
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`Migrated ${count} schools...`);
      }
      
    } catch (error) {
      console.error(`Error migrating school ${schoolDoc.id}:`, error);
      // Continue with next school
    }
  }
  
  // Phase 3: Commit remaining changes
  await batch.commit();
  console.log(`Migration complete: ${count} schools migrated`);
  
  return count;
}

/**
 * ROLLBACK: Entities Migration
 * Restores schools from backup and deletes entities/workspace_entities
 */
export async function rollbackEntitiesMigration(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  let count = 0;
  
  // Restore schools from backup
  const backupSnap = await getDocs(collection(firestore, 'backup_schools_migration'));
  
  for (const backupDoc of backupSnap.docs) {
    const { backedUpAt, ...originalSchool } = backupDoc.data();
    
    // Restore original school
    batch.set(doc(firestore, 'schools', backupDoc.id), originalSchool);
    
    // Delete entity
    const entityId = `entity_${backupDoc.id}`;
    batch.delete(doc(firestore, 'entities', entityId));
    
    // Delete workspace_entities
    const workspaceIds = originalSchool.workspaceIds || ['onboarding'];
    for (const workspaceId of workspaceIds) {
      const workspaceEntityId = `${workspaceId}_${entityId}`;
      batch.delete(doc(firestore, 'workspace_entities', workspaceEntityId));
    }
    
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
    }
  }
  
  await batch.commit();
  return count;
}
```

---

## How to Add to Seed Page

### Step 1: Add Function to `src/lib/seed.ts`

Add the `migrateSchoolsToEntities()` and `rollbackEntitiesMigration()` functions to `src/lib/seed.ts`.

### Step 2: Update Seed Client UI

Add a new migration card to `src/app/admin/seeds/SeedsClient.tsx`:

```typescript
// Add to state
const [seedingStatus, setSeedingStatus] = useState<Record<string, SeedingState>>({
  // ... existing states
  migrate_entities: 'idle',
  rollback_entities: 'idle'
});

// Add to UI (in the "Architectural Restoration" section)
<MigrationCard 
  title="Entities Migration" 
  description="Migrates schools to entities + workspace_entities architecture for multi-scope support."
  onSync={() => handleAction('migrate_entities', migrateSchoolsToEntities)}
  onRollback={() => handleAction('rollback_entities', rollbackEntitiesMigration)}
  status={seedingStatus.migrate_entities}
  icon={Database}
/>
```

### Step 3: Test in Development

1. Navigate to `/seeds` or `/admin/seeds`
2. Unlock with password: `mijay2123`
3. Click "Sync Domain" on the "Entities Migration" card
4. Monitor progress in console
5. Verify entities and workspace_entities created in Firestore

### Step 4: Verify Migration

After running the migration:

1. **Check Firestore Console**:
   - Verify `entities` collection has documents
   - Verify `workspace_entities` collection has documents
   - Verify schools have `migrationStatus: "migrated"`

2. **Test Adapter Layer**:
   - Verify `resolveContact()` returns entity data for migrated schools
   - Verify existing features still work

3. **Check Data Integrity**:
   - Verify entity data matches school data
   - Verify workspace_entities data matches school data
   - Verify all workspaces have corresponding workspace_entities

---

## Migration Workflow

### Pre-Migration

1. ✅ Deploy Firestore indexes
2. ✅ Deploy security rules
3. ✅ Deploy adapter layer code
4. ✅ Test in development environment

### Migration Execution

1. Navigate to `/seeds` page
2. Unlock with password
3. Click "Sync Domain" on "Entities Migration" card
4. Monitor progress (should take 5-10 minutes for ~1000 schools)
5. Review summary report

### Post-Migration

1. Verify data integrity
2. Test existing features
3. Test new entity features
4. Monitor for errors

### Rollback (If Needed)

1. Click rollback button on "Entities Migration" card
2. Verify schools restored from backup
3. Verify entities and workspace_entities deleted
4. Test existing features

---

## Key Differences from Current Implementation

### Current Pattern (Workspace Arrays)
- **Modifies existing documents** in place
- **Adds new fields** (`workspaceIds`, `organizationId`)
- **Single collection** affected per function

### New Pattern (Entities Migration)
- **Creates new documents** in new collections
- **Preserves original documents** (schools remain intact)
- **Multiple collections** affected (entities, workspace_entities, schools)
- **More complex relationships** (1 school → 1 entity + N workspace_entities)

---

## Error Handling

The migration should handle these scenarios:

1. **Already Migrated**: Skip schools with `migrationStatus: "migrated"`
2. **Missing Data**: Use defaults for missing fields
3. **Invalid Data**: Log error and continue with next school
4. **Firestore Errors**: Retry with exponential backoff
5. **Batch Limits**: Commit in batches of 500 operations

---

## Performance Considerations

### Batch Size
- Firestore allows max 500 operations per batch
- Commit every 500 schools to avoid hitting limits

### Denormalization
- Copy frequently-queried fields to `workspace_entities`
- Reduces need for joins in queries

### Indexes
- Ensure all indexes are READY before migration
- Migration will be slow without proper indexes

---

## Testing Checklist

Before running in production:

- [ ] Test with 1 school
- [ ] Test with 10 schools
- [ ] Test with 100 schools
- [ ] Test idempotency (run twice on same data)
- [ ] Test rollback
- [ ] Test adapter layer with migrated data
- [ ] Test existing features with migrated data
- [ ] Verify performance meets targets

---

## Next Steps

1. **Implement** `migrateSchoolsToEntities()` function in `src/lib/seed.ts`
2. **Add UI** to seed page in `src/app/admin/seeds/SeedsClient.tsx`
3. **Test** in development environment
4. **Deploy** to staging for QA testing
5. **Schedule** production migration window
6. **Execute** migration following MIGRATION_RUNBOOK.md
7. **Verify** data integrity and feature functionality
8. **Monitor** for issues post-migration

---

## Summary

The current seed page provides a solid foundation for data migration with its fetch → enrich → restore pattern. To complete the contacts expansion migration, you need to:

1. Add `migrateSchoolsToEntities()` function that creates entities and workspace_entities
2. Add UI card to trigger the migration
3. Test thoroughly in development
4. Follow the MIGRATION_RUNBOOK.md for production execution

The key difference is that this migration **creates new documents** in new collections rather than just enriching existing documents, making it more complex but also more powerful for the multi-scope architecture.
