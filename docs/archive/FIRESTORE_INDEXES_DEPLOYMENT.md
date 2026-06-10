# Firestore Indexes Deployment Guide

**Date**: 2025-01-XX  
**Issue**: Missing Firestore indexes causing permission errors on survey pages

## Problem

When loading the survey editing/creation page, the app attempts to query the `webhooks` collection with:
```typescript
query(
  collection(firestore, 'webhooks'),
  where('workspaceId', '==', activeWorkspaceId),
  orderBy('name', 'asc')
)
```

This compound query requires a Firestore composite index to work properly.

## Error Message

```
FirebaseError: Missing or insufficient permissions
{"method": "list", "path": "/databases/(default)/documents/webhooks"}
```

This error occurs because:
1. The query uses both `where()` and `orderBy()` clauses
2. Firestore requires a composite index for such queries
3. The index hasn't been created yet

## Solution

### Step 1: Deploy Firestore Indexes

The `firestore.indexes.json` file has been created with all necessary indexes.

**Deploy using Firebase CLI**:

```bash
# Navigate to project directory
cd /Users/josephaidoo/Desktop/Codes/vibe\ Coding/Onboarding-Dashbaord-main

# Deploy indexes to Firebase
firebase deploy --only firestore:indexes
```

**Alternative: Deploy via Firebase Console**:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Add Index** and create the following:

### Step 2: Required Indexes for Webhooks

#### Index 1: Webhooks by Workspace and Name
```
Collection: webhooks
Fields:
  - workspaceId (Ascending)
  - name (Ascending)
Query Scope: Collection
```

#### Index 2: Webhooks by Workspace and Created Date
```
Collection: webhooks
Fields:
  - workspaceId (Ascending)
  - createdAt (Descending)
Query Scope: Collection
```

#### Index 3: Webhooks by Organization and Name
```
Collection: webhooks
Fields:
  - organizationId (Ascending)
  - name (Ascending)
Query Scope: Collection
```

### Step 3: Verify Security Rules

The security rules for webhooks are already in place in `firestore.rules`:

```javascript
match /webhooks/{webhookId} {
  allow get: if isAuthorized() && (
    isSystemAdmin() || 
    hasWorkspaceAccess(resource.data.workspaceId)
  );
  allow list: if isAuthorized();
  allow create: if isAuthorized() && (
    isSystemAdmin() || 
    hasWorkspaceAccess(request.resource.data.workspaceId)
  );
  allow update: if isAuthorized() && (
    isSystemAdmin() || 
    (hasWorkspaceAccess(resource.data.workspaceId) && 
     request.resource.data.workspaceId == resource.data.workspaceId)
  );
  allow delete: if isAuthorized() && (
    isSystemAdmin() || 
    hasWorkspaceAccess(resource.data.workspaceId)
  );
}
```

These rules are correct and allow:
- ✅ List access for all authorized users
- ✅ Get/Create/Update/Delete based on workspace access

### Step 4: Deploy Security Rules (if needed)

If you've made any changes to `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

## Complete Index List

The `firestore.indexes.json` file includes indexes for:

### Core Collections
- ✅ **webhooks** - Workspace and organization queries
- ✅ **surveys** - Workspace and status queries
- ✅ **message_templates** - Multi-axis filtering (category, channel, recipientType, status)
- ✅ **tags** - Workspace and category queries
- ✅ **entities** - Organization and entity type queries
- ✅ **workspace_entities** - Workspace, status, and entity type queries

### Activity & Logging
- ✅ **activities** - Workspace and entity queries
- ✅ **import_logs** - Workspace and status queries
- ✅ **scheduled_messages** - Organization and status queries

### Operations
- ✅ **deals** - Workspace, pipeline, and stage queries
- ✅ **tasks** - Workspace, status, and assignment queries
- ✅ **automations** - Workspace and active status queries
- ✅ **message_campaigns** - Workspace and status queries

## Deployment Commands

### Deploy Everything
```bash
# Deploy both rules and indexes
firebase deploy --only firestore
```

### Deploy Only Indexes
```bash
firebase deploy --only firestore:indexes
```

### Deploy Only Rules
```bash
firebase deploy --only firestore:rules
```

## Verification

After deployment, verify the indexes are created:

1. **Firebase Console**:
   - Go to Firestore Database → Indexes
   - Check that all indexes show status: **Enabled**

2. **Test the Query**:
   - Navigate to the survey editing page
   - The webhook dropdown should load without errors
   - Check browser console for any Firestore errors

## Index Build Time

- **Small collections** (< 1000 docs): ~1-5 minutes
- **Medium collections** (1000-10000 docs): ~5-15 minutes
- **Large collections** (> 10000 docs): ~15-60 minutes

You can monitor index build progress in the Firebase Console.

## Troubleshooting

### Issue: "Index already exists"
**Solution**: The index is already created. No action needed.

### Issue: "Index build failed"
**Solution**: 
1. Check for invalid field paths
2. Verify collection names are correct
3. Try deploying again

### Issue: Still getting permission errors after deployment
**Solution**:
1. Wait for indexes to finish building (check Firebase Console)
2. Clear browser cache and reload
3. Verify user has `isAuthorized: true` in their user document
4. Check that user's `workspaceIds` array includes the active workspace

### Issue: "Missing index" error with different fields
**Solution**: 
1. Copy the index suggestion from the error message
2. Add it to `firestore.indexes.json`
3. Deploy again with `firebase deploy --only firestore:indexes`

## Firebase CLI Setup

If you don't have Firebase CLI installed:

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
firebase init firestore

# Select your Firebase project
firebase use --add
```

## Additional Indexes for Survey Features

If you encounter other missing index errors on survey pages, here are common queries:

### Survey Responses
```
Collection: surveys/{surveyId}/responses
Fields:
  - submittedAt (Descending)
```

### Survey Summaries
```
Collection: surveys/{surveyId}/summaries
Fields:
  - questionId (Ascending)
  - createdAt (Descending)
```

Add these to `firestore.indexes.json` if needed.

## Next Steps

1. ✅ Deploy indexes: `firebase deploy --only firestore:indexes`
2. ✅ Wait for indexes to build (check Firebase Console)
3. ✅ Test survey page loading
4. ✅ Verify webhook dropdown works
5. ✅ Monitor for any other missing index errors

## Related Files

- `firestore.indexes.json` - Index definitions
- `firestore.rules` - Security rules
- `src/app/admin/surveys/components/webhook-manager.tsx` - Webhook query usage
- `src/app/admin/surveys/` - Survey pages

---

**Status**: Ready for deployment  
**Priority**: High (blocking survey page functionality)  
**Estimated Time**: 5-15 minutes (including index build time)
