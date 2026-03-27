# Entity Schema Migration Plan: Fetch, Enrich, Restore Protocol

## Overview

This document outlines the complete migration strategy for transforming SmartSapp's data from the legacy single-scope model to the new multi-scope entity architecture. Each collection follows a **Fetch → Enrich → Restore** protocol with full rollback capability.

---

## Migration Phases

### Phase 1: Core Entity Migration
Migrate schools to entities + workspace_entities

### Phase 2: Operational Data Migration
Update tasks, activities, message logs to reference entities

### Phase 3: Portal Data Migration
Update PDFs, surveys, meetings to reference entities

### Phase 4: Workspace Configuration
Update workspaces with contactScope and capabilities

---

## Collection Migration Protocols

### 1. Schools → Entities + Workspace_Entities

**Purpose**: Transform schools into institution entities with workspace-specific operational state

**Affected Collections**:
- `schools` (read, update with migrationStatus)
- `entities` (create new)
- `workspace_entities` (create new)
- `backup_entities_migration` (backup)

**Fetch Phase**:
```typescript
const schoolsSnap = await getDocs(collection(firestore, 'schools'));
const schools = schoolsSnap.docs.filter(doc => {
  const data = doc.data();
  return data.migrationStatus !== 'migrated'; // Skip already migrated
});
```

**Enrich Phase**:
```typescript
for (const schoolDoc of schools) {
  const school = schoolDoc.data() as School;
  
  // 1. Create backup
  backups.push({ collection: 'schools', id: schoolDoc.id, data: school });
  
  // 2. Create entity
  const entityId = `entity_${schoolDoc.id}`;
  const entity = {
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
    globalTags: school.tags || [], // Migrate tags to global scope
    institutionData: {
      nominalRoll: school.nominalRoll,
      billingAddress: school.billingAddress,
      currency: school.currency,
      subscriptionPackageId: school.subscriptionPackageId,
      subscriptionRate: school.subscriptionRate,
      focalPersons: school.focalPersons || []
    },
    createdAt: school.createdAt || timestamp,
    updatedAt: timestamp
  };
  
  // 3. Create workspace_entities for each workspace
  const workspaceIds = school.workspaceIds || ['onboarding'];
  for (const workspaceId of workspaceIds) {
    const workspaceEntity = {
      id: `${workspaceId}_${entityId}`,
      workspaceId: workspaceId,
      entityId: entityId,
      organizationId: school.organizationId || DEFAULT_ORG_ID,
      
      // Denormalized fields for performance
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
    };
    workspaceEntities.push(workspaceEntity);
  }
  
  // 4. Update school with migration status
  schoolUpdates.push({
    id: schoolDoc.id,
    updates: {
      migrationStatus: 'migrated',
      entityId: entityId,
      migratedAt: timestamp
    }
  });
}
```

**Restore Phase**:
```typescript
// Write backups
for (const backup of backups) {
  batch.set(doc(firestore, 'backup_entities_migration', backup.id), {
    ...backup.data,
    backedUpAt: timestamp
  });
}

// Write entities
for (const entity of entities) {
  batch.set(doc(firestore, 'entities', entity.id), entity);
}

// Write workspace_entities
for (const we of workspaceEntities) {
  batch.set(doc(firestore, 'workspace_entities', we.id), we);
}

// Update schools
for (const update of schoolUpdates) {
  batch.update(doc(firestore, 'schools', update.id), update.updates);
}

await batch.commit();
```

**Rollback**:
```typescript
// Restore schools from backup
const backupSnap = await getDocs(collection(firestore, 'backup_entities_migration'));
for (const backupDoc of backupSnap.docs) {
  const { backedUpAt, ...original } = backupDoc.data();
  batch.set(doc(firestore, 'schools', backupDoc.id), original);
  
  // Delete created entities
  const entityId = `entity_${backupDoc.id}`;
  batch.delete(doc(firestore, 'entities', entityId));
  
  // Delete workspace_entities
  const workspaceIds = original.workspaceIds || ['onboarding'];
  for (const wId of workspaceIds) {
    batch.delete(doc(firestore, 'workspace_entities', `${wId}_${entityId}`));
  }
}
await batch.commit();
```

---

### 2. Tasks → Entity References

**Purpose**: Add entityId and entityType to tasks while maintaining schoolId for backward compatibility

**Affected Collections**:
- `tasks` (read, update)
- `backup_tasks_entity_migration` (backup)

**Fetch Phase**:
```typescript
const tasksSnap = await getDocs(collection(firestore, 'tasks'));
const tasks = tasksSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId; // Has schoolId but no entityId
});
```

**Enrich Phase**:
```typescript
for (const taskDoc of tasks) {
  const task = taskDoc.data() as Task;
  
  // 1. Create backup
  backups.push({ id: taskDoc.id, data: task });
  
  // 2. Resolve entity from school
  if (task.schoolId) {
    const schoolSnap = await getDoc(doc(firestore, 'schools', task.schoolId));
    if (schoolSnap.exists()) {
      const school = schoolSnap.data();
      
      // 3. Add entity references
      updates.push({
        id: taskDoc.id,
        updates: {
          entityId: school.entityId || `entity_${task.schoolId}`,
          entityType: 'institution',
          // Keep schoolId for backward compatibility
          updatedAt: timestamp
        }
      });
    }
  }
}
```

**Restore Phase**:
```typescript
// Write backups
for (const backup of backups) {
  batch.set(doc(firestore, 'backup_tasks_entity_migration', backup.id), {
    ...backup.data,
    backedUpAt: timestamp
  });
}

// Update tasks
for (const update of updates) {
  batch.update(doc(firestore, 'tasks', update.id), update.updates);
}

await batch.commit();
```

**Rollback**:
```typescript
const backupSnap = await getDocs(collection(firestore, 'backup_tasks_entity_migration'));
for (const backupDoc of backupSnap.docs) {
  const { backedUpAt, ...original } = backupDoc.data();
  batch.set(doc(firestore, 'tasks', backupDoc.id), original);
}
await batch.commit();
```

---

### 3. Activities → Entity References

**Purpose**: Add entityId and entityType to activities while maintaining schoolId

**Affected Collections**:
- `activities` (read, update)
- `backup_activities_entity_migration` (backup)

**Fetch Phase**:
```typescript
const activitiesSnap = await getDocs(collection(firestore, 'activities'));
const activities = activitiesSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId;
});
```

**Enrich Phase**:
```typescript
for (const activityDoc of activities) {
  const activity = activityDoc.data() as Activity;
  
  // 1. Create backup
  backups.push({ id: activityDoc.id, data: activity });
  
  // 2. Resolve entity from school
  if (activity.schoolId) {
    const schoolSnap = await getDoc(doc(firestore, 'schools', activity.schoolId));
    if (schoolSnap.exists()) {
      const school = schoolSnap.data();
      const entityId = school.entityId || `entity_${activity.schoolId}`;
      
      // 3. Add entity references with denormalized fields
      updates.push({
        id: activityDoc.id,
        updates: {
          entityId: entityId,
          entityType: 'institution',
          entitySlug: school.slug,
          displayName: school.name,
          // Keep schoolId and schoolName for backward compatibility
          updatedAt: timestamp
        }
      });
    }
  }
}
```

**Restore Phase**: Same as tasks

**Rollback**: Same as tasks

---

### 4. Message Logs → Entity References

**Purpose**: Add entityId and entityType to message logs

**Affected Collections**:
- `message_logs` (read, update)
- `backup_message_logs_entity_migration` (backup)

**Fetch Phase**:
```typescript
const logsSnap = await getDocs(collection(firestore, 'message_logs'));
const logs = logsSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId;
});
```

**Enrich Phase**: Similar to tasks/activities

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

### 5. PDF Forms → Entity References

**Purpose**: Add entityId to PDF forms while maintaining schoolId

**Affected Collections**:
- `pdfs` (read, update)
- `backup_pdfs_entity_migration` (backup)

**Fetch Phase**:
```typescript
const pdfsSnap = await getDocs(collection(firestore, 'pdfs'));
const pdfs = pdfsSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId;
});
```

**Enrich Phase**: Similar to tasks

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

### 6. Surveys → Entity References

**Purpose**: Add entityId to surveys while maintaining schoolId

**Affected Collections**:
- `surveys` (read, update)
- `backup_surveys_entity_migration` (backup)

**Fetch Phase**: Similar to PDFs

**Enrich Phase**: Similar to PDFs

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

### 7. Meetings → Entity References

**Purpose**: Add entityId to meetings while maintaining schoolSlug

**Affected Collections**:
- `meetings` (read, update)
- `backup_meetings_entity_migration` (backup)

**Fetch Phase**:
```typescript
const meetingsSnap = await getDocs(collection(firestore, 'meetings'));
const meetings = meetingsSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolSlug && !data.entityId;
});
```

**Enrich Phase**:
```typescript
for (const meetingDoc of meetings) {
  const meeting = meetingDoc.data() as Meeting;
  
  // 1. Create backup
  backups.push({ id: meetingDoc.id, data: meeting });
  
  // 2. Find school by slug
  const schoolsSnap = await getDocs(
    query(collection(firestore, 'schools'), where('slug', '==', meeting.schoolSlug))
  );
  
  if (!schoolsSnap.empty) {
    const school = schoolsSnap.docs[0].data();
    
    // 3. Add entity reference
    updates.push({
      id: meetingDoc.id,
      updates: {
        entityId: school.entityId || `entity_${schoolsSnap.docs[0].id}`,
        entityType: 'institution',
        // Keep schoolSlug for public URL routing
        updatedAt: timestamp
      }
    });
  }
}
```

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

### 8. Workspaces → Contact Scope Configuration

**Purpose**: Add contactScope and capabilities to workspaces

**Affected Collections**:
- `workspaces` (read, update)
- `backup_workspaces_entity_migration` (backup)

**Fetch Phase**:
```typescript
const workspacesSnap = await getDocs(collection(firestore, 'workspaces'));
const workspaces = workspacesSnap.docs.filter(doc => {
  const data = doc.data();
  return !data.contactScope; // Missing contactScope
});
```

**Enrich Phase**:
```typescript
for (const workspaceDoc of workspaces) {
  const workspace = workspaceDoc.data() as Workspace;
  
  // 1. Create backup
  backups.push({ id: workspaceDoc.id, data: workspace });
  
  // 2. Determine default contactScope based on workspace name/purpose
  let contactScope: 'institution' | 'family' | 'person' = 'institution';
  if (workspace.name?.toLowerCase().includes('family')) {
    contactScope = 'family';
  } else if (workspace.name?.toLowerCase().includes('person') || 
             workspace.name?.toLowerCase().includes('lead')) {
    contactScope = 'person';
  }
  
  // 3. Set default capabilities based on scope
  const capabilities = {
    billing: contactScope === 'institution',
    admissions: contactScope === 'family',
    children: contactScope === 'family',
    contracts: contactScope === 'institution',
    messaging: true,
    automations: true,
    tasks: true
  };
  
  // 4. Add scope configuration
  updates.push({
    id: workspaceDoc.id,
    updates: {
      contactScope: contactScope,
      scopeLocked: false, // Will be locked when first entity is linked
      capabilities: capabilities,
      updatedAt: timestamp
    }
  });
}
```

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

### 9. Automations → Entity References

**Purpose**: Add entityId and entityType to automation logs/events

**Affected Collections**:
- `automations` (read, update if needed)
- `automation_logs` (read, update)
- `backup_automations_entity_migration` (backup)

**Fetch Phase**:
```typescript
const logsSnap = await getDocs(collection(firestore, 'automation_logs'));
const logs = logsSnap.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId;
});
```

**Enrich Phase**: Similar to tasks

**Restore Phase**: Same pattern

**Rollback**: Same pattern

---

## Migration Execution Order

Execute migrations in this order to maintain referential integrity:

1. **Schools → Entities** (Core migration, creates entities and workspace_entities)
2. **Workspaces → Contact Scope** (Configure workspaces for entity types)
3. **Tasks → Entity References** (Update task references)
4. **Activities → Entity References** (Update activity references)
5. **Message Logs → Entity References** (Update message log references)
6. **PDF Forms → Entity References** (Update PDF references)
7. **Surveys → Entity References** (Update survey references)
8. **Meetings → Entity References** (Update meeting references)
9. **Automations → Entity References** (Update automation references)

---

## Idempotency Strategy

Each migration function checks if records are already migrated:

```typescript
// For schools
if (school.migrationStatus === 'migrated') {
  console.log(`Skipping ${schoolId} - already migrated`);
  continue;
}

// For other collections
if (task.entityId) {
  console.log(`Skipping task ${taskId} - already has entityId`);
  continue;
}
```

This allows migrations to be run multiple times safely.

---

## Batch Processing Strategy

Process records in batches to avoid Firestore limits:

```typescript
const BATCH_SIZE = 500; // Firestore limit
let batch = writeBatch(firestore);
let operationCount = 0;

for (const record of records) {
  // Add operations to batch
  batch.set(...);
  operationCount++;
  
  // Commit when reaching batch size
  if (operationCount >= BATCH_SIZE) {
    await batch.commit();
    batch = writeBatch(firestore);
    operationCount = 0;
    console.log(`Processed ${processedCount} records...`);
  }
}

// Commit remaining operations
if (operationCount > 0) {
  await batch.commit();
}
```

---

## Error Handling Strategy

Handle errors gracefully without aborting entire migration:

```typescript
const errors: Array<{ id: string; error: string }> = [];

for (const record of records) {
  try {
    // Process record
    await processRecord(record);
    successCount++;
  } catch (error) {
    console.error(`Error processing ${record.id}:`, error);
    errors.push({
      id: record.id,
      error: error.message
    });
    // Continue with next record
  }
}

// Return summary
return {
  total: records.length,
  succeeded: successCount,
  failed: errors.length,
  errors: errors
};
```

---

## Progress Reporting

Provide real-time progress updates:

```typescript
const total = records.length;
let processed = 0;

for (const record of records) {
  await processRecord(record);
  processed++;
  
  // Report progress every 10%
  if (processed % Math.ceil(total / 10) === 0) {
    const percent = Math.round((processed / total) * 100);
    console.log(`Progress: ${percent}% (${processed}/${total})`);
  }
}
```

---

## Verification Checklist

After each migration, verify:

- [ ] Backup collection created with all original data
- [ ] New documents/fields created correctly
- [ ] Original documents updated with migration markers
- [ ] No data loss (count matches)
- [ ] Referential integrity maintained
- [ ] Idempotency works (can run again safely)
- [ ] Rollback works (can restore original state)

---

## Summary

This migration plan provides:

1. **9 distinct migrations** covering all affected collections
2. **Fetch → Enrich → Restore** protocol for each
3. **Full rollback capability** with backup collections
4. **Idempotency** for safe re-runs
5. **Batch processing** to handle large datasets
6. **Error handling** to continue on failures
7. **Progress reporting** for monitoring

Next step: Implement these migrations in `src/lib/seed.ts` and add UI buttons to the seed page.
