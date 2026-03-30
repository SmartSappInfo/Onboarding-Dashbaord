# Troubleshooting Guide: Entity Migration

## Overview

This guide provides solutions to common issues encountered during and after the schoolId to entityId migration. Use this as a reference when debugging problems with entity resolution, queries, or data integrity.

## Table of Contents

1. [Migration Issues](#migration-issues)
2. [Contact Resolution Issues](#contact-resolution-issues)
3. [Query Performance Issues](#query-performance-issues)
4. [Data Integrity Issues](#data-integrity-issues)
5. [UI Display Issues](#ui-display-issues)
6. [API Integration Issues](#api-integration-issues)
7. [Security and Permissions Issues](#security-and-permissions-issues)

## Migration Issues

### Issue: Migration Fetch Returns Zero Records

**Symptoms:**
- Fetch operation shows 0 records to migrate
- You know there are unmigrated records in the collection

**Causes:**
1. Records already have `entityId` populated
2. Records don't have `schoolId` field
3. Wrong collection name

**Solutions:**

```typescript
// Check if records are already migrated
const tasks = await getDocs(collection(firestore, 'tasks'));
const unmigrated = tasks.docs.filter(doc => {
  const data = doc.data();
  return data.schoolId && !data.entityId;
});
console.log('Unmigrated count:', unmigrated.length);

// Check for records without schoolId
const noSchoolId = tasks.docs.filter(doc => !doc.data().schoolId);
console.log('Records without schoolId:', noSchoolId.length);
```

**Prevention:**
- Run verify operation before fetch to check collection state
- Review collection schema to ensure schoolId field exists

### Issue: Migration Enrichment Fails

**Symptoms:**
- Enrich operation fails with "School not found" errors
- High failure rate during migration

**Causes:**
1. School records deleted from schools collection
2. Invalid schoolId references
3. School collection not accessible

**Solutions:**

```typescript
// Check if school exists
const schoolId = 'school_xyz789';
const schoolDoc = await getDoc(doc(firestore, 'schools', schoolId));
console.log('School exists:', schoolDoc.exists());

// Find records with missing schools
const tasks = await getDocs(
  query(collection(firestore, 'tasks'), where('schoolId', '!=', null))
);

for (const task of tasks.docs) {
  const schoolId = task.data().schoolId;
  const school = await getDoc(doc(firestore, 'schools', schoolId));
  
  if (!school.exists()) {
    console.log('Missing school for task:', task.id, 'schoolId:', schoolId);
  }
}
```

**Prevention:**
- Run data validation before migration
- Create placeholder entities for orphaned records
- Use migration error logs to identify problematic records

### Issue: Migration Backup Collection Not Created

**Symptoms:**
- Rollback button disabled
- No backup collection found after migration

**Causes:**
1. Migration failed before backup creation
2. Insufficient permissions
3. Backup collection deleted manually

**Solutions:**

```bash
# Check if backup collection exists
firebase firestore:collections:list | grep backup_

# Manually create backup if needed
# (Run before re-attempting migration)
```

**Prevention:**
- Verify Firestore permissions before migration
- Monitor migration logs for backup creation confirmation
- Don't delete backup collections until migration is verified

### Issue: Migration Progress Stuck

**Symptoms:**
- Migration progress bar stops updating
- Operation appears frozen

**Causes:**
1. Large batch size causing timeout
2. Network connectivity issues
3. Firestore rate limiting

**Solutions:**

```typescript
// Reduce batch size in migration engine
const BATCH_SIZE = 250; // Instead of 450

// Add retry logic
async function migrateWithRetry(collection: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await migrateCollection(collection);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Retry attempt ${attempt}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
    }
  }
}
```

**Prevention:**
- Use smaller batch sizes for large collections
- Monitor Firestore quotas and limits
- Run migrations during off-peak hours

## Contact Resolution Issues

### Issue: Contact Adapter Returns Null

**Symptoms:**
- `contactAdapter.resolveContact()` returns `null`
- UI shows "Contact not found"

**Causes:**
1. Entity doesn't exist in entities collection
2. Workspace entity doesn't exist for the workspace
3. Wrong workspace ID provided
4. Legacy school doesn't exist

**Solutions:**

```typescript
// Debug contact resolution
async function debugContactResolution(
  entityId: string,
  workspaceId: string
) {
  console.log('Debugging contact resolution:', { entityId, workspaceId });
  
  // Check entity exists
  const entity = await getDoc(doc(firestore, 'entities', entityId));
  console.log('Entity exists:', entity.exists());
  if (entity.exists()) {
    console.log('Entity data:', entity.data());
  }
  
  // Check workspace entity exists
  const weId = `${workspaceId}_${entityId}`;
  const we = await getDoc(doc(firestore, 'workspace_entities', weId));
  console.log('Workspace entity exists:', we.exists());
  if (we.exists()) {
    console.log('Workspace entity data:', we.data());
  }
  
  // Try contact adapter
  const contact = await contactAdapter.resolveContact(
    { entityId },
    workspaceId
  );
  console.log('Contact adapter result:', contact);
}
```

**Prevention:**
- Always create both entity and workspace_entity records
- Validate entityId format before queries
- Use proper workspace ID from context

### Issue: Contact Adapter Returns Stale Data

**Symptoms:**
- Contact information is outdated
- Recent updates not reflected

**Causes:**
1. Cache not invalidated after update
2. Cache TTL too long
3. Multiple cache layers

**Solutions:**

```typescript
// Clear contact adapter cache
contactAdapter.clearCache();

// Or clear specific contact
contactAdapter.clearCacheForContact(entityId, workspaceId);

// Reduce cache TTL
const CACHE_TTL = 1 * 60 * 1000; // 1 minute instead of 5
```

**Prevention:**
- Invalidate cache after entity updates
- Use shorter cache TTL in development
- Implement cache versioning

### Issue: Contact Adapter Slow Performance

**Symptoms:**
- Contact resolution takes > 1 second
- UI feels sluggish

**Causes:**
1. Cache not being used
2. Missing Firestore indexes
3. Too many sequential lookups

**Causes:**
1. Cache not being used
2. Missing Firestore indexes
3. Too many sequential lookups

**Solutions:**

```typescript
// Enable cache logging
const DEBUG_CACHE = true;

async function resolveContactWithLogging(entityId, workspaceId) {
  const start = Date.now();
  
  const contact = await contactAdapter.resolveContact(
    { entityId },
    workspaceId
  );
  
  const duration = Date.now() - start;
  console.log(`Contact resolution took ${duration}ms`);
  
  return contact;
}

// Batch contact resolutions
async function resolveContactsBatch(entityIds: string[], workspaceId: string) {
  return Promise.all(
    entityIds.map(id => contactAdapter.resolveContact({ entityId: id }, workspaceId))
  );
}
```

**Prevention:**
- Verify cache is enabled
- Create proper Firestore indexes
- Use denormalized fields from workspace_entities

## Query Performance Issues

### Issue: Queries Take > 1 Second

**Symptoms:**
- Slow page loads
- Timeout errors
- Poor user experience

**Causes:**
1. Missing composite indexes
2. Querying without workspace filter
3. Large result sets without pagination

**Solutions:**

```typescript
// Check if index exists
// Go to Firebase Console → Firestore → Indexes

// Add missing index to firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    }
  ]
}

// Deploy indexes
firebase deploy --only firestore:indexes

// Add pagination
async function getTasksPaginated(
  entityId: string,
  workspaceId: string,
  limit = 50,
  startAfter?: DocumentSnapshot
) {
  let q = query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('dueDate', 'asc'),
    limit(limit)
  );
  
  if (startAfter) {
    q = query(q, startAfter(startAfter));
  }
  
  return await getDocs(q);
}
```

**Prevention:**
- Create indexes before deploying queries
- Always filter by workspace
- Use pagination for large result sets
- Monitor query performance in Firebase Console

### Issue: Query Returns No Results

**Symptoms:**
- Query returns empty array
- Expected records not found

**Causes:**
1. Records not migrated yet
2. Wrong workspace ID
3. Missing index causing query failure
4. Incorrect field names

**Solutions:**

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

// Try query without entityId filter
const allTasks = await getDocs(
  query(
    collection(firestore, 'tasks'),
    where('workspaceId', '==', workspaceId)
  )
);
console.log('Total tasks:', allTasks.size);

// Check field names
const sampleTask = allTasks.docs[0]?.data();
console.log('Task fields:', Object.keys(sampleTask || {}));
```

**Prevention:**
- Verify migration status before querying
- Use correct workspace ID from context
- Test queries in Firestore console first

## Data Integrity Issues

### Issue: Orphaned Entity References

**Symptoms:**
- Records reference entityId that doesn't exist
- Verify operation shows orphaned records

**Causes:**
1. Entity deleted but references not cleaned up
2. Migration created invalid entityId
3. Manual data manipulation

**Solutions:**

```typescript
// Find orphaned records
async function findOrphanedRecords(collection: string) {
  const records = await getDocs(collection(firestore, collection));
  const orphaned = [];
  
  for (const record of records.docs) {
    const data = record.data();
    if (data.entityId) {
      const entity = await getDoc(doc(firestore, 'entities', data.entityId));
      if (!entity.exists()) {
        orphaned.push({ id: record.id, entityId: data.entityId });
      }
    }
  }
  
  return orphaned;
}

// Clean up orphaned records
async function cleanupOrphanedRecords(collection: string) {
  const orphaned = await findOrphanedRecords(collection);
  
  for (const record of orphaned) {
    // Option 1: Delete the record
    await deleteDoc(doc(firestore, collection, record.id));
    
    // Option 2: Create placeholder entity
    // await createPlaceholderEntity(record.entityId);
    
    // Option 3: Remove entityId field
    // await updateDoc(doc(firestore, collection, record.id), {
    //   entityId: null,
    //   entityType: null
    // });
  }
}
```

**Prevention:**
- Use cascade delete for entity removal
- Validate entityId before creating records
- Run verify operation regularly

### Issue: Duplicate Entities

**Symptoms:**
- Multiple entities with same name
- Duplicate contacts in UI

**Causes:**
1. Signup flow created duplicate
2. Manual entity creation without checking
3. Migration created duplicates

**Solutions:**

```typescript
// Find duplicates by name
async function findDuplicateEntities(organizationId: string) {
  const entities = await getDocs(
    query(
      collection(firestore, 'entities'),
      where('organizationId', '==', organizationId)
    )
  );
  
  const nameMap = new Map<string, string[]>();
  
  entities.docs.forEach(doc => {
    const name = doc.data().name.toLowerCase();
    if (!nameMap.has(name)) {
      nameMap.set(name, []);
    }
    nameMap.get(name)!.push(doc.id);
  });
  
  const duplicates = Array.from(nameMap.entries())
    .filter(([_, ids]) => ids.length > 1);
  
  return duplicates;
}

// Merge duplicate entities
async function mergeDuplicateEntities(
  keepEntityId: string,
  removeEntityId: string
) {
  // Update all references to point to keepEntityId
  const collections = ['tasks', 'activities', 'forms', 'invoices'];
  
  for (const collectionName of collections) {
    const records = await getDocs(
      query(
        collection(firestore, collectionName),
        where('entityId', '==', removeEntityId)
      )
    );
    
    for (const record of records.docs) {
      await updateDoc(doc(firestore, collectionName, record.id), {
        entityId: keepEntityId
      });
    }
  }
  
  // Delete duplicate entity
  await deleteDoc(doc(firestore, 'entities', removeEntityId));
}
```

**Prevention:**
- Check for existing entity before creation
- Use unique constraints where possible
- Implement deduplication in signup flow

## UI Display Issues

### Issue: Contact Name Shows "Unknown"

**Symptoms:**
- UI displays "Unknown" instead of contact name
- Contact information missing

**Causes:**
1. Contact adapter returned null
2. Denormalized fields not populated
3. Wrong field being accessed

**Solutions:**

```typescript
// Add fallback logic
function getContactDisplayName(contact: ResolvedContact | null): string {
  if (!contact) return 'Unknown Contact';
  return contact.displayName || contact.name || 'Unnamed Contact';
}

// Update denormalized fields
async function updateDenormalizedFields(
  entityId: string,
  workspaceId: string
) {
  const entity = await getDoc(doc(firestore, 'entities', entityId));
  if (!entity.exists()) return;
  
  const data = entity.data();
  const weId = `${workspaceId}_${entityId}`;
  
  await updateDoc(doc(firestore, 'workspace_entities', weId), {
    displayName: data.name,
    primaryEmail: data.contacts[0]?.email || null,
    primaryPhone: data.contacts[0]?.phone || null,
    updatedAt: new Date().toISOString()
  });
}
```

**Prevention:**
- Always populate denormalized fields
- Use fallback values in UI
- Handle null contacts gracefully

### Issue: Contact Information Outdated

**Symptoms:**
- UI shows old contact details
- Recent updates not visible

**Causes:**
1. Component state not updated
2. Cache not invalidated
3. Denormalized fields not synced

**Solutions:**

```typescript
// Force refresh in React component
const [refreshKey, setRefreshKey] = useState(0);

useEffect(() => {
  async function loadContact() {
    const contact = await contactAdapter.resolveContact(
      { entityId },
      workspaceId
    );
    setContact(contact);
  }
  
  loadContact();
}, [entityId, workspaceId, refreshKey]);

// Trigger refresh after update
async function handleUpdateContact(updates) {
  await updateEntity(entityId, updates);
  contactAdapter.clearCacheForContact(entityId, workspaceId);
  setRefreshKey(prev => prev + 1);
}
```

**Prevention:**
- Invalidate cache after updates
- Use real-time listeners for critical data
- Sync denormalized fields on entity updates

## API Integration Issues

### Issue: API Returns 400 "Invalid Identifier"

**Symptoms:**
- API requests fail with 400 error
- Error message: "Either entityId or schoolId must be provided"

**Causes:**
1. Neither identifier provided
2. Empty string passed as identifier
3. Wrong parameter name

**Solutions:**

```typescript
// Validate before API call
function validateContactIdentifier(
  identifier: { entityId?: string; schoolId?: string }
): boolean {
  return !!(identifier.entityId || identifier.schoolId);
}

// Example API call
async function createTask(input) {
  if (!validateContactIdentifier(input)) {
    throw new Error('Either entityId or schoolId must be provided');
  }
  
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('API error:', error);
    throw new Error(error.message);
  }
  
  return response.json();
}
```

**Prevention:**
- Validate input before API calls
- Use TypeScript for type safety
- Check API documentation for required fields

### Issue: API Returns 404 "Contact Not Found"

**Symptoms:**
- API requests fail with 404 error
- Contact exists in database

**Causes:**
1. Wrong entityId provided
2. Entity not linked to workspace
3. User doesn't have access to workspace

**Solutions:**

```typescript
// Verify entity exists and is accessible
async function verifyEntityAccess(
  entityId: string,
  workspaceId: string
) {
  // Check entity exists
  const entity = await getDoc(doc(firestore, 'entities', entityId));
  console.log('Entity exists:', entity.exists());
  
  // Check workspace entity exists
  const weId = `${workspaceId}_${entityId}`;
  const we = await getDoc(doc(firestore, 'workspace_entities', weId));
  console.log('Workspace entity exists:', we.exists());
  
  // Check user has workspace access
  const user = auth.currentUser;
  const token = await user?.getIdTokenResult();
  const workspaceIds = token?.claims.workspaceIds || [];
  console.log('User has access:', workspaceIds.includes(workspaceId));
}
```

**Prevention:**
- Verify entity is linked to workspace
- Check user permissions before API calls
- Use correct workspace ID from context

## Security and Permissions Issues

### Issue: Unauthorized Workspace Access

**Symptoms:**
- 403 Forbidden errors
- "User does not have access to workspace" message

**Causes:**
1. User not added to workspace
2. Token claims not updated
3. Security rules too restrictive

**Solutions:**

```typescript
// Check user's workspace access
async function checkWorkspaceAccess(workspaceId: string) {
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return false;
  }
  
  const token = await user.getIdTokenResult();
  const workspaceIds = token.claims.workspaceIds || [];
  
  console.log('User workspaces:', workspaceIds);
  console.log('Has access:', workspaceIds.includes(workspaceId));
  
  return workspaceIds.includes(workspaceId);
}

// Force token refresh
async function refreshUserToken() {
  const user = auth.currentUser;
  if (user) {
    await user.getIdToken(true); // Force refresh
  }
}
```

**Prevention:**
- Add users to workspaces properly
- Refresh tokens after permission changes
- Test security rules thoroughly

### Issue: Cross-Workspace Data Leakage

**Symptoms:**
- Users see entities from other workspaces
- Security audit shows unauthorized access

**Causes:**
1. Missing workspace filter in queries
2. Security rules not enforcing boundaries
3. Client-side filtering only

**Solutions:**

```typescript
// Always filter by workspace
async function getWorkspaceEntities(workspaceId: string) {
  // ✅ Good: Server-side filtering
  const q = query(
    collection(firestore, 'workspace_entities'),
    where('workspaceId', '==', workspaceId)
  );
  
  return await getDocs(q);
}

// Update security rules
// firestore.rules
match /workspace_entities/{docId} {
  allow read: if request.auth != null && 
    resource.data.workspaceId in request.auth.token.workspaceIds;
}
```

**Prevention:**
- Always filter by workspace in queries
- Enforce workspace boundaries in security rules
- Audit queries for missing workspace filters

## FAQ

### Q: How do I know if a record has been migrated?

**A:** Check if the record has an `entityId` field:

```typescript
const task = await getDoc(doc(firestore, 'tasks', taskId));
const isMigrated = !!task.data().entityId;
console.log('Task migrated:', isMigrated);
```

### Q: Can I rollback a migration after verifying it?

**A:** Yes, as long as the backup collection exists:

```typescript
// Check if backup exists
const backups = await getDocs(collection(firestore, 'backup_tasks_entity_migration'));
console.log('Backup exists:', backups.size > 0);

// Rollback via Seeds page or programmatically
await rollbackMigration('tasks');
```

### Q: What happens if I delete an entity?

**A:** You should cascade delete all references:

```typescript
async function deleteEntityCascade(entityId: string) {
  // Delete from all feature collections
  const collections = ['tasks', 'activities', 'forms', 'invoices'];
  
  for (const collectionName of collections) {
    const records = await getDocs(
      query(
        collection(firestore, collectionName),
        where('entityId', '==', entityId)
      )
    );
    
    for (const record of records.docs) {
      await deleteDoc(doc(firestore, collectionName, record.id));
    }
  }
  
  // Delete workspace entities
  const workspaceEntities = await getDocs(
    query(
      collection(firestore, 'workspace_entities'),
      where('entityId', '==', entityId)
    )
  );
  
  for (const we of workspaceEntities.docs) {
    await deleteDoc(doc(firestore, 'workspace_entities', we.id));
  }
  
  // Delete entity
  await deleteDoc(doc(firestore, 'entities', entityId));
}
```

### Q: How do I migrate custom feature collections?

**A:** Follow the migration engine pattern:

```typescript
// Use migration engine for your collection
const result = await migrateCollection('my_custom_collection');
console.log('Migration result:', result);

// Or implement custom migration
async function migrateCustomCollection() {
  const records = await getDocs(
    query(
      collection(firestore, 'my_custom_collection'),
      where('schoolId', '!=', null),
      where('entityId', '==', null)
    )
  );
  
  for (const record of records.docs) {
    const schoolId = record.data().schoolId;
    const school = await getDoc(doc(firestore, 'schools', schoolId));
    
    if (school.exists()) {
      const entityId = school.data().entityId || `entity_${schoolId}`;
      
      await updateDoc(doc(firestore, 'my_custom_collection', record.id), {
        entityId,
        entityType: 'institution'
      });
    }
  }
}
```

### Q: How do I test entity-based features locally?

**A:** Use Firebase emulators:

```bash
# Start emulators
firebase emulators:start

# Run tests against emulators
FIRESTORE_EMULATOR_HOST=localhost:8080 npm test

# Seed test data
node scripts/seed-test-entities.js
```

### Q: What's the performance impact of the migration?

**A:** Minimal if done correctly:

- Contact Adapter caching reduces lookups by ~80%
- Composite indexes keep queries under 1 second
- Denormalized fields eliminate additional lookups
- Batch processing handles large datasets efficiently

Monitor performance in Firebase Console and adjust as needed.

## Getting Help

If you're still experiencing issues:

1. **Check the logs**: Review migration logs in Seeds page
2. **Run diagnostics**: Use the debug functions provided in this guide
3. **Ask for help**: 
   - Internal Slack: #dev-entity-migration
   - GitHub Issues: Tag @entity-migration-team
   - Email: dev-support@smartsapp.com

## Related Documentation

- [Entity Architecture](./ENTITY_ARCHITECTURE.md)
- [Migration Runbook](./MIGRATION_RUNBOOK.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
