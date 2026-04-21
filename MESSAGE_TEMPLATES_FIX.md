# Message Templates Index and Security Fix

## Issue Summary

When trying to list `message_templates` on the survey editing page, you're encountering:

```
FirebaseError: Missing or insufficient permissions
```

This error has **two potential causes**:

1. **Missing Composite Index** (CONFIRMED)
2. **Security Rules Issue** (NEEDS INVESTIGATION)

---

## 1. Missing Composite Index (FIXED)

### The Problem

The query in `submission-behavior-step.tsx` (line 93-96) uses:

```typescript
query(
  collection(firestore, 'message_templates'),
  where('workspaceIds', 'array-contains', activeWorkspaceId),
  orderBy('name', 'asc')
)
```

This requires a composite index with:
- `workspaceIds` (array-contains)
- `name` (ascending)

### The Fix

Added the following index to `firestore.indexes.json`:

```json
{
  "collectionGroup": "message_templates",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceIds",
      "arrayConfig": "CONTAINS"
    },
    {
      "fieldPath": "name",
      "order": "ASCENDING"
    }
  ]
}
```

### Deploy the Index

```bash
firebase deploy --only firestore:indexes
```

**Note**: Index creation can take several minutes. You'll see a message like:
```
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

---

## 2. Security Rules Investigation (NEEDS VERIFICATION)

### Current Security Rule

From `firestore.rules` (lines 197-201):

```javascript
match /message_templates/{tId} {
  allow get: if isAuthorized() && (isSystemAdmin() || canAccessWorkspace(resource.data.workspaceIds));
  allow list: if isAuthorized();
  allow write: if isAuthorized() && hasPermission('studios_edit') && canAccessWorkspace(request.resource.data.workspaceIds);
}
```

### The `isAuthorized()` Function

From `firestore.rules` (lines 16-19):

```javascript
function isAuthorized() {
  let data = getUserData();
  return (isSignedIn() && request.auth.token.email == 'admin@smartsapp.com') ||
         (data != null && data.get('isAuthorized', false) == true);
}
```

### Why the Error Might Occur

The error shows you're authenticated as `admin@smartsapp.com`, which should satisfy the first condition of `isAuthorized()`. However, the error persists, which suggests:

1. **The email check might not be working** - Verify that `request.auth.token.email` is exactly `'admin@smartsapp.com'` (no extra spaces, correct case)

2. **The user document might not exist** - If the first condition fails, it falls back to checking the user document's `isAuthorized` field

3. **Firestore Rules might be cached** - After deploying new rules, they can take a few seconds to propagate

### Recommended Actions

#### Option A: Verify User Document

Check if the user document exists and has the correct fields:

```bash
# In Firebase Console or using Firebase CLI
firebase firestore:get users/wZn3YwYmrYQPCPJX2gaZIQClFUU2
```

The document should have:
```json
{
  "email": "admin@smartsapp.com",
  "isAuthorized": true,
  "organizationId": "...",
  "workspaceIds": ["..."],
  "permissions": ["system_admin"]
}
```

#### Option B: Simplify the Rule Temporarily (FOR TESTING ONLY)

To isolate the issue, you could temporarily change the rule to:

```javascript
match /message_templates/{tId} {
  allow list: if isSignedIn();  // Temporarily allow any signed-in user
}
```

**WARNING**: This is less secure and should only be used for testing. Revert to the original rule after confirming the index works.

#### Option C: Check Firebase Auth Token

In your browser console, check the auth token:

```javascript
firebase.auth().currentUser.getIdTokenResult().then(token => {
  console.log('Email:', token.claims.email);
  console.log('Claims:', token.claims);
});
```

Verify that `token.claims.email` is exactly `'admin@smartsapp.com'`.

---

## 3. Other Queries Using message_templates

There are 3 different queries for `message_templates` in your codebase:

### Query 1: In `submission-behavior-step.tsx`
```typescript
where('workspaceIds', 'array-contains', activeWorkspaceId)
  .orderBy('name', 'asc')
```
**Index**: ✅ Added (workspaceIds + name)

### Query 2: In `result-rule-manager.tsx`
```typescript
where('isActive', '==', true)
```
**Index**: ✅ Already exists (line 1779-1791 in firestore.indexes.json)

### Query 3: In `external-notification-config.tsx`
```typescript
where('isActive', '==', true)
```
**Index**: ✅ Already exists (same as Query 2)

---

## Summary of Changes

### Files Modified

1. **firestore.indexes.json**
   - Added composite index for `message_templates` with `workspaceIds` (array-contains) + `name` (ascending)

2. **MISSING_INDEXES.md**
   - Documented the new index requirement

3. **MESSAGE_TEMPLATES_FIX.md** (this file)
   - Comprehensive troubleshooting guide

### Next Steps

1. **Deploy the index**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Wait for index creation** (2-5 minutes typically)

3. **Test the survey editing page** - Try to open the submission behavior step

4. **If the error persists**:
   - Check the user document in Firestore
   - Verify the auth token email
   - Check Firebase Console for any error messages
   - Consider temporarily simplifying the security rule for testing

5. **Monitor the deployment**:
   ```bash
   firebase firestore:indexes
   ```

---

## Expected Outcome

After deploying the index and waiting for it to build:

- ✅ The survey editing page should load without errors
- ✅ The message templates dropdown should populate with templates from your workspace
- ✅ You should be able to select templates for email/SMS notifications

If the error persists after the index is built, the issue is with the security rules, not the index.
