# Firebase Messaging Feature - Configuration Fix Summary

## Problem

The application was throwing a Firestore permission error when trying to access the `message_campaigns` collection:

```
FirebaseError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules
{"auth": {"uid": "wZn3YwYmrYQPCPJX2gaZIQClFUU2",...},"method": "list","path": "/databases/(default)/documents/message_campaigns"}
```

## Root Cause

The `message_campaigns` collection was missing:
1. **Security rules** in `firestore.rules`
2. **Composite indexes** in `firestore.indexes.json`

## Changes Made

### 1. Added Security Rules (`firestore.rules`)

Added comprehensive security rules for the `message_campaigns` collection with workspace-scoped access control:

- **Read (get)**: Users can read campaigns in workspaces they have access to
- **List**: All authorized users can list (filtering happens in queries)
- **Create**: Users can create campaigns in their workspaces (must match organizationId)
- **Update**: Users can update campaigns in their workspaces (cannot change workspace/org)
- **Delete**: Users can delete campaigns in their workspaces
- **System Admin**: Full access to all campaigns

**Location**: After `message_logs` rules (around line 408)

### 2. Added Composite Indexes (`firestore.indexes.json`)

Added 7 composite indexes to support common query patterns:

1. **workspaceId + status + updatedAt** - Filter by status within workspace
2. **workspaceId + updatedAt** - List all campaigns in workspace (most common)
3. **workspaceId + channel + updatedAt** - Filter by channel within workspace
4. **organizationId + status + updatedAt** - Organization-level queries
5. **status + scheduledAt** - Scheduled campaigns for background processing
6. **createdBy + updatedAt** - User's campaigns
7. **workspaceId + createdAt** - Campaigns by creation date

**Location**: After `message_logs` indexes (around line 880)

## Deployment Instructions

### Step 1: Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

This will immediately update the security rules and fix the permission error.

### Step 2: Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

**Important**: Index creation can take several minutes to complete. Monitor progress in Firebase Console.

### Step 3: Verify Deployment

1. **Check Rules**: Firebase Console → Firestore → Rules tab
2. **Check Indexes**: Firebase Console → Firestore → Indexes tab
3. **Test Application**: Try accessing the campaigns list in your application

## Testing Checklist

After deployment, verify:

- ✅ Can list campaigns in a workspace
- ✅ Can create a new campaign
- ✅ Can update an existing campaign
- ✅ Can delete a campaign
- ✅ Cannot access campaigns from other workspaces
- ✅ Cannot change workspaceId or organizationId on update
- ✅ System admin can access all campaigns
- ✅ Queries with status filter work
- ✅ Queries with channel filter work
- ✅ Scheduled campaign queries work

## Related Collections

The messaging feature uses these collections (all now properly configured):

| Collection | Security Rules | Indexes | Status |
|------------|---------------|---------|--------|
| message_campaigns | ✅ | ✅ | **Fixed** |
| message_templates | ✅ | ✅ | Already configured |
| message_logs | ✅ | ✅ | Already configured |
| message_jobs | ✅ | ✅ | Already configured |
| sender_profiles | ✅ | ✅ | Already configured |
| message_styles | ✅ | ✅ | Already configured |
| scheduled_messages | ✅ | ✅ | Already configured |
| template_variables | ✅ | ✅ | Already configured |

## Query Patterns Supported

The new indexes support these query patterns used in the codebase:

```typescript
// 1. List campaigns by workspace (most common - used in campaign-hooks.ts)
query(
  collection(firestore, 'message_campaigns'),
  where('workspaceId', '==', workspaceId),
  orderBy('updatedAt', 'desc')
)

// 2. Filter by status within workspace
query(
  collection(firestore, 'message_campaigns'),
  where('workspaceId', '==', workspaceId),
  where('status', '==', 'draft'),
  orderBy('updatedAt', 'desc')
)

// 3. Filter by channel within workspace
query(
  collection(firestore, 'message_campaigns'),
  where('workspaceId', '==', workspaceId),
  where('channel', '==', 'email'),
  orderBy('updatedAt', 'desc')
)

// 4. Organization-level queries
query(
  collection(firestore, 'message_campaigns'),
  where('organizationId', '==', orgId),
  where('status', '==', 'sent'),
  orderBy('updatedAt', 'desc')
)

// 5. Scheduled campaigns (for background processing)
query(
  collection(firestore, 'message_campaigns'),
  where('status', '==', 'scheduled'),
  orderBy('scheduledAt', 'asc')
)

// 6. User's campaigns
query(
  collection(firestore, 'message_campaigns'),
  where('createdBy', '==', userId),
  orderBy('updatedAt', 'desc')
)
```

## Security Model

The `message_campaigns` collection follows the same workspace-scoped security model as other operational collections:

- **Workspace Isolation**: Users can only access campaigns in workspaces they belong to
- **Organization Matching**: Campaign organizationId must match user's organizationId
- **Immutable Scope**: Cannot change workspaceId or organizationId after creation
- **System Admin Override**: System admins have full access to all campaigns

This aligns with the existing security patterns for `message_logs`, `automations`, `tasks`, and other workspace-scoped collections.

## Files Modified

1. `firestore.rules` - Added `message_campaigns` security rules
2. `firestore.indexes.json` - Added 7 composite indexes for `message_campaigns`

## Additional Documentation

See `MISSING_FIREBASE_CONFIG.md` for detailed analysis and configuration reference.
