# Firestore Index Fix - Campaign Sessions

## Issue
**Error**: `Missing or insufficient permissions` when accessing campaign_sessions collection
**Location**: `/campaign/school-comparison/statistics` page
**Root Cause**: Missing composite index for campaign_sessions query

## Error Details
```
FirestoreError: Missing or insufficient permissions
Request: {
  "method": "list",
  "path": "/databases/(default)/documents/campaign_sessions"
}
```

## Query Analysis
The statistics page performs the following query:
```typescript
query(
    collection(firestore, 'campaign_sessions'),
    where('campaignId', '==', 'school-comparison'),
    orderBy('updatedAt', 'desc')
)
```

This query requires a composite index on:
1. `campaignId` (ASCENDING)
2. `updatedAt` (DESCENDING)

## Solution Applied

### 1. Added Composite Index
**File**: `firestore.indexes.json`

Added the following index definition:
```json
{
  "collectionGroup": "campaign_sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "campaignId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

### 2. Security Rules (Already Correct)
**File**: `firestore.rules`

The security rules already allow public access to campaign_sessions:
```javascript
match /campaign_sessions/{sId} {
  allow read, list, create, update: if true;
}
```

## Deployment Steps

### Option 1: Firebase CLI (Recommended)
```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# This will create the index in Firebase Console
# Index creation typically takes a few minutes
```

### Option 2: Firebase Console
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection: `campaign_sessions`
4. Add fields:
   - `campaignId` - Ascending
   - `updatedAt` - Descending
5. Query scope: Collection
6. Click "Create"

## Verification

After deploying the index, verify it works:

1. Wait for index to build (check Firebase Console)
2. Navigate to `/campaign/school-comparison/statistics`
3. Confirm no permission errors
4. Data should load successfully

## Related Files

### Query Usage
- `src/app/campaign/school-comparison/statistics/page.tsx` - Main statistics page
- `src/app/campaign/school-comparison/components/SchoolComparisonClient.tsx` - Campaign client
- `src/app/campaign/school-comparison-1/components/SchoolComparisonClientV1.tsx` - V1 campaign client

### Configuration Files
- `firestore.indexes.json` - Index definitions
- `firestore.rules` - Security rules

## Additional Campaign Sessions Queries

The codebase also uses campaign_sessions for:
- Creating session documents (no index needed)
- Updating session documents (no index needed)
- Single document reads by ID (no index needed)

Only the statistics page list query requires the composite index.

## Index Build Time

- Small collections (<1000 docs): ~1-2 minutes
- Medium collections (1000-10000 docs): ~5-10 minutes
- Large collections (>10000 docs): ~15-30 minutes

Monitor index build status in Firebase Console → Firestore → Indexes tab.

## Testing

After index is built, test the following:
1. ✅ Statistics page loads without errors
2. ✅ Campaign data displays correctly
3. ✅ Charts render with proper data
4. ✅ No console errors related to Firestore

## Notes

- The error message "Missing or insufficient permissions" is misleading - it's actually about missing indexes, not security rules
- Firestore requires composite indexes for queries with multiple filters or orderBy clauses
- Single-field indexes are created automatically, but composite indexes must be defined explicitly

**Date Fixed**: March 23, 2026
**Status**: Index definition added, awaiting deployment
