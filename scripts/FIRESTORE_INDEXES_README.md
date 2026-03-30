# Firestore Indexes for EntityId Migration

This document describes the Firestore composite indexes required for the SchoolId to EntityId migration.

## Overview

The migration from `schoolId` to `entityId` requires new composite indexes to support efficient queries across all feature collections. These indexes ensure query performance remains under 1000ms as specified in Requirement 28.1.

## Required Indexes

All indexes are defined in `firestore.indexes.json` and include:

### Core Entity Indexes

1. **workspace_entities** (workspaceId + entityType + status)
   - Supports filtering entities by type and status within a workspace
   
2. **workspace_entities** (workspaceId + pipelineId + stageId)
   - Supports pipeline stage queries for contact management

### Feature Collection Indexes

3. **tasks** (workspaceId + entityId + dueDate)
   - Already exists - supports task queries by entity with date sorting

4. **activities** (workspaceId + entityId + timestamp)
   - Supports activity timeline queries for entities

5. **forms** (workspaceId + entityId + status)
   - Supports form queries filtered by entity and status

6. **invoices** (organizationId + entityId + status)
   - Supports invoice queries by entity at organization level

7. **meetings** (workspaceIds + entityId + meetingTime)
   - Already exists - supports meeting queries by entity with time sorting

8. **surveys** (workspaceIds + entityId + status)
   - Already exists - supports survey queries by entity and status

9. **pdfs** (workspaceIds + entityId + createdAt)
   - Already exists - supports PDF queries by entity with date sorting

10. **message_logs** (workspaceId + entityId + sentAt)
    - Already exists - supports message history queries by entity

11. **automation_logs** (workspaceId + entityId + executedAt)
    - Supports automation log queries by entity with execution time sorting

## Deployment

### 1. Deploy Indexes to Firebase

```bash
# Deploy all indexes defined in firestore.indexes.json
firebase deploy --only firestore:indexes
```

This command will:
- Create new indexes that don't exist
- Update existing indexes if definitions changed
- Not delete indexes that aren't in the file (manual deletion required)

### 2. Monitor Index Creation

Index creation can take time depending on collection size:

```bash
# Check index status in Firebase Console
# Navigate to: Firestore Database > Indexes
```

Or use the Firebase CLI:

```bash
firebase firestore:indexes
```

### 3. Verify Index Performance

After indexes are created, run the verification script:

```bash
# Set environment variables
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-service-account-email"
export FIREBASE_PRIVATE_KEY="your-private-key"

# Run verification
npx tsx scripts/verify-firestore-indexes.ts
```

The script will:
- Test all entityId-based queries
- Measure query performance
- Report any queries exceeding 1000ms threshold
- Provide a summary of index health

## Performance Requirements

Per Requirement 28.1:
- All queries must complete in < 1000ms
- Indexes should be optimized for common query patterns
- Monitor query performance in production

## Troubleshooting

### Index Creation Fails

If index deployment fails:

1. Check for conflicting indexes in Firebase Console
2. Verify field names match your data model
3. Ensure you have sufficient permissions
4. Check Firebase project quota limits

### Queries Still Slow

If queries exceed 1000ms after index creation:

1. Verify indexes are in "Enabled" state (not "Building")
2. Check query patterns match index definitions exactly
3. Consider denormalizing frequently accessed data
4. Review collection size and data distribution

### Missing Indexes Warning

If you see "missing index" errors in logs:

1. Check the error message for the required index URL
2. Click the URL to auto-generate the index
3. Add the index definition to `firestore.indexes.json`
4. Redeploy indexes

## Maintenance

### Adding New Indexes

When adding new entityId-based queries:

1. Add index definition to `firestore.indexes.json`
2. Deploy: `firebase deploy --only firestore:indexes`
3. Update verification script with new test case
4. Run verification to confirm performance

### Removing Old Indexes

After migration is complete and schoolId is deprecated:

1. Identify schoolId-based indexes in Firebase Console
2. Verify they're no longer used (check query logs)
3. Delete manually from Firebase Console
4. Remove from `firestore.indexes.json` if present

## Index Definitions Reference

All indexes follow this structure:

```json
{
  "collectionGroup": "collection_name",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "field1", "order": "ASCENDING" },
    { "fieldPath": "field2", "order": "ASCENDING" },
    { "fieldPath": "field3", "order": "DESCENDING" }
  ]
}
```

For array-contains queries:

```json
{
  "collectionGroup": "collection_name",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "arrayField", "arrayConfig": "CONTAINS" },
    { "fieldPath": "sortField", "order": "ASCENDING" }
  ]
}
```

## Related Documentation

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Migration Design Document](../.kiro/specs/schoolid-to-entityid-migration/design.md)
- [Migration Requirements](../.kiro/specs/schoolid-to-entityid-migration/requirements.md)
- [Migration Tasks](../.kiro/specs/schoolid-to-entityid-migration/tasks.md)
