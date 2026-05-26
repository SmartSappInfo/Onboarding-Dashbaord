# Workspace Entities Indexes Fix

## Issue
FirebaseError: Missing or insufficient permissions when accessing `workspace_entities` collection on the pipeline page.

## Root Cause
The `workspace_entities` collection requires additional composite indexes to support the various query patterns used across the application.

## Solution
Added 5 new composite indexes for the `workspace_entities` collection to support all query patterns.

## New Indexes Added

### 1. workspaceId + displayName (ASCENDING)
**Purpose**: Most common query pattern for listing entities with sorting by display name
**Used in**:
- Meetings pages (new, edit)
- Surveys pages (new, edit)
- Finance pages (contracts, invoices)
- Activities timeline
- PDF editor
- And many more...

```json
{
  "collectionGroup": "workspace_entities",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "displayName",
      "order": "ASCENDING"
    }
  ]
}
```

### 2. workspaceId + name (ASCENDING)
**Purpose**: Alternative query pattern for entities using 'name' field
**Used in**:
- Create Deal Modal
- Some legacy queries

```json
{
  "collectionGroup": "workspace_entities",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "name",
      "order": "ASCENDING"
    }
  ]
}
```

### 3. entityId + workspaceId
**Purpose**: Lookup workspace entities by global entity ID
**Used in**:
- Entity detail pages
- Manage Workspaces Modal
- Cross-workspace entity queries

```json
{
  "collectionGroup": "workspace_entities",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "entityId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    }
  ]
}
```

### 4. workspaceId + lifecycleStatus + addedAt (DESC)
**Purpose**: Filter and sort entities by lifecycle stage
**Used in**:
- Pipeline/deals pages
- Lifecycle filtering in entities hub
- Stage-based queries

```json
{
  "collectionGroup": "workspace_entities",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "lifecycleStatus",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "addedAt",
      "order": "DESCENDING"
    }
  ]
}
```

### 5. workspaceId + pipelineStage + addedAt (DESC)
**Purpose**: Filter and sort entities by pipeline stage
**Used in**:
- Pipeline boards
- Stage-based filtering
- Deal management

```json
{
  "collectionGroup": "workspace_entities",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "pipelineStage",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "addedAt",
      "order": "DESCENDING"
    }
  ]
}
```

## Existing Indexes (Preserved)

### 1. workspaceId + status + addedAt (DESC)
**Purpose**: Filter entities by status (active, inactive, archived)

### 2. workspaceId + entityType + addedAt (DESC)
**Purpose**: Filter entities by type (institution, family, person)

## Deployment Steps

### Option 1: Firebase Console (Recommended for Quick Fix)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Add Index** for each new index above
5. Wait for indexes to build (usually 1-5 minutes per index)

### Option 2: Firebase CLI (Recommended for Production)

```bash
# 1. Deploy the indexes file
firebase deploy --only firestore:indexes

# 2. Monitor index build status
firebase firestore:indexes

# 3. Wait for all indexes to show status: READY
```

### Option 3: Automatic Deployment

The indexes will be automatically created when you deploy the full Firestore configuration:

```bash
firebase deploy --only firestore
```

## Verification

After deployment, verify the indexes are active:

```bash
# Check index status
firebase firestore:indexes

# Expected output should show all indexes with status: READY
```

## Security Rules Status

✅ **Security rules are already correct** - No changes needed

The `workspace_entities` collection already has proper security rules that:
- Allow `admin@smartsapp.com` full access
- Allow authorized users with workspace access to read/write
- Enforce workspace boundaries
- Prevent cross-workspace data leakage

## Testing

After deploying indexes, test the following pages:
1. ✅ Pipeline/Deals page
2. ✅ Entities Hub
3. ✅ Meetings pages (new, edit)
4. ✅ Surveys pages (new, edit)
5. ✅ Finance pages (contracts, invoices)
6. ✅ Activities timeline

## Notes

- All existing indexes have been preserved
- No indexes were removed
- The new indexes complement the existing ones
- Total workspace_entities indexes: 7 (2 existing + 5 new)

## Rollback

If you need to rollback, simply remove the new indexes from `firestore.indexes.json` and redeploy:

```bash
firebase deploy --only firestore:indexes
```

The old indexes will remain active and functional.
