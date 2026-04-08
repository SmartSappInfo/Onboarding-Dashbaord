# Firestore Indexes Required for Meeting Registrations & Attendees

## Overview

This document outlines all Firestore indexes required for the meetings module, specifically for querying registrants and attendees data.

**Key Finding**: Only **1 composite index** needs to be explicitly defined. All other queries use single fields and are automatically indexed by Firestore.

> **Important**: Firestore automatically creates indexes for single-field queries (one `where` clause OR one `orderBy`). You only need to explicitly define composite indexes (2+ fields) in `firestore.indexes.json`.

## Current Status

### ✅ Already Configured (in firestore.indexes.json)

The following indexes are already present in the configuration:

1. **Meetings by Workspace and Time**
   ```json
   {
     "collectionGroup": "meetings",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "workspaceIds", "arrayConfig": "CONTAINS" },
       { "fieldPath": "meetingTime", "order": "DESCENDING" }
     ]
   }
   ```
   - **Used by**: `/admin/meetings`, `/admin/portals/PortalsClient.tsx`
   - **Query**: `where('workspaceIds', 'array-contains', workspaceId).orderBy('meetingTime', 'desc')`

2. **Meetings by Workspace, Entity, and Time**
   ```json
   {
     "collectionGroup": "meetings",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "workspaceIds", "arrayConfig": "CONTAINS" },
       { "fieldPath": "entityId", "order": "ASCENDING" },
       { "fieldPath": "meetingTime", "order": "ASCENDING" }
     ]
   }
   ```
   - **Used by**: Entity-specific meeting queries
   - **Query**: `where('workspaceIds', 'array-contains', workspaceId).where('entityId', '==', entityId).orderBy('meetingTime')`

## ⚠️ Missing Indexes - REQUIRED

The following **composite indexes** are NOT in the configuration but are REQUIRED for the application to function properly.

> **Note**: Single-field indexes (equality queries on one field, or orderBy on one field) are created automatically by Firestore and do NOT need to be explicitly defined. Only composite indexes (2+ fields) need to be added to `firestore.indexes.json`.

### 1. Meeting Duplicate Check (Type + Slug)
**Status**: ❌ MISSING - CRITICAL

```json
{
  "collectionGroup": "meetings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "type.slug", "order": "ASCENDING" },
    { "fieldPath": "schoolSlug", "order": "ASCENDING" }
  ]
}
```

- **Used by**: 
  - `src/app/admin/meetings/new/page.tsx` (line 215)
  - `src/app/admin/meetings/[id]/edit/page.tsx` (line 227)
- **Query**: `where('type.slug', '==', typeSlug).where('schoolSlug', '==', schoolSlug)`
- **Purpose**: Prevents duplicate meetings for the same school and meeting type
- **Impact if missing**: Meeting creation/editing will fail with Firestore error
- **Why composite**: Uses 2 equality filters (type.slug + schoolSlug)

## ✅ Single-Field Queries (Auto-Indexed by Firestore)

The following queries use single fields and do NOT require explicit index definitions:

### Meetings Collection

- **Meeting Lookup by School Slug**
  - Query: `where('schoolSlug', '==', schoolSlug)`
  - Used by: `src/components/school-meeting-loader.tsx`
  - Auto-indexed: ✅ Single equality filter

### Registrants Subcollection

- **Registrants by Registration Time**
  - Query: `orderBy('registeredAt', 'desc')`
  - Used by: `src/app/admin/meetings/[id]/registrants/RegistrantsClient.tsx`
  - Auto-indexed: ✅ Single orderBy

- **Registrants by Email**
  - Query: `where('email', '==', targetEmail).limit(1)`
  - Used by: `src/lib/messaging-engine.ts`
  - Auto-indexed: ✅ Single equality filter

- **Registrants by Phone**
  - Query: `where('phone', '==', targetPhone).limit(1)`
  - Used by: `src/lib/messaging-engine.ts`
  - Auto-indexed: ✅ Single equality filter

- **Registrants by Token**
  - Query: `where('token', '==', token).limit(1)`
  - Used by: `src/hooks/use-registration-token.ts`
  - Auto-indexed: ✅ Single equality filter

- **Registrants by Status**
  - Query: `where('status', 'in', ['registered', 'approved', 'attended'])`
  - Used by: `src/components/meeting-registration-form.tsx`
  - Auto-indexed: ✅ Single field with IN operator

### Attendees Subcollection

- **Attendees by Join Time**
  - Query: `orderBy('joinedAt', 'desc')`
  - Used by: `src/app/admin/meetings/[id]/results/ResultsClient.tsx`
  - Auto-indexed: ✅ Single orderBy

## 🔧 Implementation Instructions

### Option 1: Manual Addition to firestore.indexes.json

Add the missing **composite index** to your `firestore.indexes.json` file:

```json
{
  "indexes": [
    // ... existing indexes ...
    
    // CRITICAL: Meeting duplicate check (composite index)
    {
      "collectionGroup": "meetings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type.slug", "order": "ASCENDING" },
        { "fieldPath": "schoolSlug", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**That's it!** All other queries use single fields and are automatically indexed by Firestore.

### Option 2: Deploy and Let Firebase Generate

1. Deploy your functions/app
2. Trigger the queries that need indexes
3. Firebase will provide error messages with direct links to create indexes
4. Click the links to auto-generate indexes in Firebase Console

### Option 3: Firebase CLI

Deploy the indexes using Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

## 📊 Query Performance Analysis

### Composite Index Required

1. **Meeting Duplicate Check** (`type.slug + schoolSlug`)
   - Frequency: Every meeting creation/edit
   - Volume: Low (1-2 queries per operation)
   - Index Type: Composite (2 equality filters)
   - Impact: CRITICAL - prevents data corruption and query failures

### Auto-Indexed Queries (No Action Needed)

1. **Registrants List** (`registeredAt DESC`)
   - Frequency: Every page load on registrants admin page
   - Volume: Potentially hundreds of registrants per meeting
   - Index Type: Single-field orderBy (auto-indexed)

2. **Attendees List** (`joinedAt DESC`)
   - Frequency: Every page load on results/intelligence page
   - Volume: Potentially hundreds of attendees per meeting
   - Index Type: Single-field orderBy (auto-indexed)

3. **Registrant Lookup by Email/Phone/Token**
   - Frequency: Per message sent or personalized link access
   - Volume: Low to medium
   - Index Type: Single equality filter (auto-indexed)

4. **Capacity Checks** (`status IN [...]`)
   - Frequency: Every registration attempt
   - Volume: Medium (depends on registration volume)
   - Index Type: Single field with IN operator (auto-indexed)

## 🚨 Error Messages to Watch For

If these indexes are missing, you'll see errors like:

```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

Common error patterns:
- `FAILED_PRECONDITION: The query requires an index`
- `indexes are not ready yet` (during index creation)

## ✅ Verification Checklist

After adding the composite index, verify:

- [ ] Meeting creation/editing works without errors (tests the type.slug + schoolSlug index)
- [ ] Registrants page loads and displays data (uses auto-indexed registeredAt)
- [ ] Results/intelligence page loads and displays attendees (uses auto-indexed joinedAt)
- [ ] Personalized registration links work (uses auto-indexed token)
- [ ] Capacity limits are enforced correctly (uses auto-indexed status)
- [ ] Messaging engine can find registrants by email/phone (uses auto-indexed fields)

## 📝 Notes

1. **Firestore Automatic Indexing**: 
   - Single-field queries (one `where` clause OR one `orderBy`) are automatically indexed
   - Composite queries (multiple `where` clauses, or `where` + `orderBy` on different fields) require explicit indexes
   - You only need to define composite indexes in `firestore.indexes.json`

2. **Collection Group vs Collection**: 
   - Use `COLLECTION_GROUP` for subcollections (registrants, attendees) to query across all meetings
   - Use `COLLECTION` for top-level collections (meetings)
   - Note: For this app, registrants and attendees queries are scoped to specific meetings, so they work with automatic single-field indexes

3. **Index Build Time**: 
   - Small collections: Minutes
   - Large collections: Hours
   - Monitor in Firebase Console under Firestore > Indexes

4. **Cost Considerations**:
   - Each index increases write costs slightly
   - Query performance gains far outweigh index costs
   - Only composite indexes need to be explicitly defined

5. **Why Only One Composite Index?**:
   - Most meeting queries use single fields (auto-indexed)
   - The duplicate check is the only query combining 2+ fields
   - This keeps index management simple and costs low
