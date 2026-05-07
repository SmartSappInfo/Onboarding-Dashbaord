# Missing Firebase Configuration for Messaging Feature

## Error Analysis

The error indicates that the `message_campaigns` collection is missing security rules:

```
FirebaseError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules
```

## Current State

### Existing Message-Related Rules ✅

The following collections already have security rules:

1. **message_templates** - Two-tier system (global/organization scope)
2. **template_variables** - Variable registry for templates
3. **scheduled_messages** - Reminder system
4. **sender_profiles** - Sender profile management
5. **message_styles** - Message styling
6. **message_logs** - Message delivery logs
7. **message_jobs** - Background message processing

### Existing Message-Related Indexes ✅

The following indexes exist:

1. **message_templates** - Multiple composite indexes for filtering
2. **scheduled_messages** - Indexes for status and scheduling
3. **message_logs** - Indexes for workspace, entity, and time-based queries
4. **sender_profiles** - Indexes for active profiles
5. **message_styles** - Indexes for workspace filtering

## Missing Configuration

### 1. Missing Security Rules ❌

The `message_campaigns` collection is completely missing from `firestore.rules`.

#### Required Rule

Add this rule to `firestore.rules` after the `message_logs` section:

```javascript
// --- Message Campaigns ---
// Campaign management for bulk messaging
match /message_campaigns/{campaignId} {
  // Read access: users in matching workspace
  allow get: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(resource.data.workspaceId)
  );
  
  // List access: all authorized users (filtering by workspace happens in queries)
  allow list: if isAuthorized();
  
  // Create: users with workspace access
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(request.resource.data.workspaceId) &&
     isOrgMatch(request.resource.data.organizationId))
  );
  
  // Update: users with workspace access
  // Prevent workspace and organization changes
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(resource.data.workspaceId) &&
     isOrgMatch(resource.data.organizationId) &&
     request.resource.data.workspaceId == resource.data.workspaceId &&
     request.resource.data.organizationId == resource.data.organizationId)
  );
  
  // Delete: super admins or users with workspace access
  allow delete: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(resource.data.workspaceId)
  );
}
```

### 2. Missing Indexes ❌

The `message_campaigns` collection needs several composite indexes for efficient querying.

#### Required Indexes

Add these indexes to `firestore.indexes.json` in the `indexes` array:

```json
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "channel",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "organizationId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "scheduledAt",
      "order": "ASCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "createdBy",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
},
{
  "collectionGroup": "message_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

## Implementation Steps

### Step 1: Update Security Rules

1. Open `firestore.rules`
2. Locate the `message_logs` section (around line 450)
3. Add the `message_campaigns` rule block after it
4. Deploy rules: `firebase deploy --only firestore:rules`

### Step 2: Update Indexes

1. Open `firestore.indexes.json`
2. Add the 7 composite indexes to the `indexes` array
3. Deploy indexes: `firebase deploy --only firestore:indexes`

**Note**: Index creation can take several minutes. Monitor progress in Firebase Console.

### Step 3: Verify Deployment

1. Check Firebase Console → Firestore → Rules tab
2. Check Firebase Console → Firestore → Indexes tab
3. Test the campaign list query in your application

## Query Patterns Supported

The indexes support these common query patterns:

1. **List campaigns by workspace** (most common)
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('workspaceId', '==', workspaceId),
     orderBy('updatedAt', 'desc')
   )
   ```

2. **Filter by status within workspace**
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('workspaceId', '==', workspaceId),
     where('status', '==', 'draft'),
     orderBy('updatedAt', 'desc')
   )
   ```

3. **Filter by channel within workspace**
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('workspaceId', '==', workspaceId),
     where('channel', '==', 'email'),
     orderBy('updatedAt', 'desc')
   )
   ```

4. **Organization-level queries**
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('organizationId', '==', orgId),
     where('status', '==', 'sent'),
     orderBy('updatedAt', 'desc')
   )
   ```

5. **Scheduled campaigns (for background processing)**
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('status', '==', 'scheduled'),
     orderBy('scheduledAt', 'asc')
   )
   ```

6. **User's campaigns**
   ```typescript
   query(
     collection(firestore, 'message_campaigns'),
     where('createdBy', '==', userId),
     orderBy('updatedAt', 'desc')
   )
   ```

## Security Model

The `message_campaigns` collection follows the workspace-scoped security model:

- **Read**: Users can read campaigns in workspaces they have access to
- **Create**: Users can create campaigns in their workspaces (must match organizationId)
- **Update**: Users can update campaigns in their workspaces (cannot change workspace/org)
- **Delete**: Users can delete campaigns in their workspaces
- **System Admin**: Full access to all campaigns

This aligns with the existing security patterns for `message_logs`, `automations`, and other workspace-scoped collections.

## Related Collections

These collections work together for the messaging feature:

1. **message_campaigns** ← Missing (this document)
2. **message_templates** ✅ Has rules and indexes
3. **message_logs** ✅ Has rules and indexes
4. **message_jobs** ✅ Has rules and indexes
5. **sender_profiles** ✅ Has rules and indexes
6. **message_styles** ✅ Has rules and indexes
7. **scheduled_messages** ✅ Has rules and indexes

## Testing Checklist

After deploying the rules and indexes:

- [ ] Can list campaigns in a workspace
- [ ] Can create a new campaign
- [ ] Can update an existing campaign
- [ ] Can delete a campaign
- [ ] Cannot access campaigns from other workspaces
- [ ] Cannot change workspaceId or organizationId on update
- [ ] System admin can access all campaigns
- [ ] Queries with status filter work
- [ ] Queries with channel filter work
- [ ] Scheduled campaign queries work
