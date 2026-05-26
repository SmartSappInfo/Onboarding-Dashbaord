# Webhook Indexes Quick Fix

## 🚨 Immediate Action Required

The survey editing/creation page is failing because of missing Firestore indexes for the `webhooks` collection.

## ⚡ Quick Fix (5 minutes)

### Option 1: Firebase CLI (Recommended)

```bash
# Deploy all indexes at once
firebase deploy --only firestore:indexes
```

### Option 2: Firebase Console (Manual)

Go to: https://console.firebase.google.com/ → Your Project → Firestore Database → Indexes

**Create these 3 indexes:**

#### Index 1: Webhooks by Workspace + Name
```
Collection ID: webhooks
Fields indexed:
  1. workspaceId (Ascending)
  2. name (Ascending)
Query scope: Collection
```

#### Index 2: Webhooks by Workspace + Created Date
```
Collection ID: webhooks
Fields indexed:
  1. workspaceId (Ascending)
  2. createdAt (Descending)
Query scope: Collection
```

#### Index 3: Webhooks by Organization + Name
```
Collection ID: webhooks
Fields indexed:
  1. organizationId (Ascending)
  2. name (Ascending)
Query scope: Collection
```

## 📋 What's Happening

**Query in Code** (`webhook-manager.tsx`):
```typescript
query(
  collection(firestore, 'webhooks'),
  where('workspaceId', '==', activeWorkspaceId),
  orderBy('name', 'asc')
)
```

**Why It Fails**:
- Compound queries (where + orderBy) require composite indexes
- Firestore can't execute the query without the index
- Results in "Missing or insufficient permissions" error

## ✅ Verification

After deploying indexes:

1. **Check Firebase Console**:
   - Firestore Database → Indexes tab
   - All indexes should show status: **Enabled** (green)
   - May take 1-5 minutes to build

2. **Test Survey Page**:
   - Navigate to `/admin/surveys/new` or `/admin/surveys/[id]/edit`
   - Webhook dropdown should load without errors
   - No console errors about permissions

## 🔧 Files Created

- ✅ `firestore.indexes.json` - Complete index definitions
- ✅ `FIRESTORE_INDEXES_DEPLOYMENT.md` - Full deployment guide
- ✅ `WEBHOOK_INDEXES_QUICK_FIX.md` - This quick reference

## 🎯 Root Cause

The webhook manager component queries webhooks filtered by workspace and sorted by name. This specific query pattern requires a composite index that wasn't created during initial setup.

## 📞 If Still Failing

1. **Wait for index build**: Check Firebase Console for build status
2. **Clear cache**: Hard refresh browser (Cmd+Shift+R on Mac)
3. **Check user permissions**: Verify user has `isAuthorized: true` in Firestore
4. **Check workspace access**: Verify user's `workspaceIds` includes active workspace

## 🚀 Deploy Command

```bash
firebase deploy --only firestore:indexes
```

**That's it!** The survey pages should work after indexes are built.
