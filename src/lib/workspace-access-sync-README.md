# Workspace Access Synchronization

This document describes the workspace access synchronization system that ensures immediate access revocation when users lose workspace access.

## Overview

Firestore security rules enforce workspace access by checking if `workspaceId in getUserData().workspaceIds`. However, workspace access is actually determined by roles: a user has access to a workspace if they belong to a role that includes that workspace in its `workspaceIds` array.

To bridge this gap, we maintain a denormalized `workspaceIds` array on each user document that is kept in sync with their role-based access. This allows security rules to enforce access without complex queries.

## Critical Requirement

**Requirement 9.5**: When a user's workspace access is revoked, the system SHALL immediately deny reads and writes to all `workspace_entities` records for that workspace.

This is achieved by:
1. Maintaining a denormalized `user.workspaceIds` array
2. Updating this array immediately when role membership changes
3. Security rules checking this array for access control

## When to Sync

You MUST call the sync functions in these scenarios:

### 1. User Added to Role

```typescript
import { handleUserAddedToRole } from '@/lib/workspace-access-sync';

// After adding user to role
await adminDb.collection('users').doc(userId).update({
  roles: admin.firestore.FieldValue.arrayUnion(roleId)
});

// CRITICAL: Sync workspace access immediately
await handleUserAddedToRole(userId, roleId);
```

### 2. User Removed from Role

```typescript
import { handleUserRemovedFromRole } from '@/lib/workspace-access-sync';

// After removing user from role
await adminDb.collection('users').doc(userId).update({
  roles: admin.firestore.FieldValue.arrayRemove(roleId)
});

// CRITICAL: Sync workspace access immediately
await handleUserRemovedFromRole(userId, roleId);
```

### 3. Workspace Added to Role

```typescript
import { handleRoleWorkspaceIdsChanged } from '@/lib/workspace-access-sync';

// After adding workspace to role
await adminDb.collection('roles').doc(roleId).update({
  workspaceIds: admin.firestore.FieldValue.arrayUnion(workspaceId)
});

// CRITICAL: Sync all role members immediately
await handleRoleWorkspaceIdsChanged(roleId, workspaceId);
```

### 4. Workspace Removed from Role

```typescript
import { handleRoleWorkspaceIdsChanged } from '@/lib/workspace-access-sync';

// After removing workspace from role
await adminDb.collection('roles').doc(roleId).update({
  workspaceIds: admin.firestore.FieldValue.arrayRemove(workspaceId)
});

// CRITICAL: Sync all role members immediately
await handleRoleWorkspaceIdsChanged(roleId, workspaceId);
```

### 5. Role Deleted

```typescript
import { syncRoleMembersWorkspaceAccess } from '@/lib/workspace-access-sync';

// BEFORE deleting role, sync all members
await syncRoleMembersWorkspaceAccess(roleId);

// Then delete role
await adminDb.collection('roles').doc(roleId).delete();
```

## API Reference

### `syncUserWorkspaceAccess(userId: string)`

Recomputes and updates a user's `workspaceIds` array based on their current roles.

**Use when:**
- A user's role membership changes
- Recovering from sync failures
- Manual sync operations

**Example:**
```typescript
await syncUserWorkspaceAccess('user123');
```

### `syncRoleMembersWorkspaceAccess(roleId: string)`

Syncs workspace access for all users who belong to a specific role.

**Use when:**
- A role's `workspaceIds` array changes
- A workspace is added to or removed from a role

**Example:**
```typescript
await syncRoleMembersWorkspaceAccess('role456');
```

### `syncOrganizationWorkspaceAccess(organizationId: string)`

Syncs workspace access for all users in an organization.

**Use when:**
- Migrating to the new workspace access system
- Bulk role updates
- Recovering from widespread sync failures

**WARNING:** This can be expensive for large organizations. Use sparingly.

**Example:**
```typescript
await syncOrganizationWorkspaceAccess('org789');
```

### `handleUserAddedToRole(userId: string, roleId: string)`

Convenience function for when a user is added to a role.

### `handleUserRemovedFromRole(userId: string, roleId: string)`

Convenience function for when a user is removed from a role.

### `handleRoleWorkspaceIdsChanged(roleId: string, workspaceId: string)`

Convenience function for when a workspace is added to or removed from a role.

## Integration Patterns

### Pattern 1: Add User to Role (Server Action)

```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { handleUserAddedToRole } from '@/lib/workspace-access-sync';

export async function addUserToRoleAction(userId: string, roleId: string) {
  try {
    // 1. Update user document
    await adminDb.collection('users').doc(userId).update({
      roles: admin.firestore.FieldValue.arrayUnion(roleId),
      updatedAt: new Date().toISOString(),
    });

    // 2. Sync workspace access immediately
    await handleUserAddedToRole(userId, roleId);

    return { success: true };
  } catch (error: any) {
    console.error('Failed to add user to role:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 2: Remove User from Role (Server Action)

```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { handleUserRemovedFromRole } from '@/lib/workspace-access-sync';

export async function removeUserFromRoleAction(userId: string, roleId: string) {
  try {
    // 1. Update user document
    await adminDb.collection('users').doc(userId).update({
      roles: admin.firestore.FieldValue.arrayRemove(roleId),
      updatedAt: new Date().toISOString(),
    });

    // 2. Sync workspace access immediately (CRITICAL for Requirement 9.5)
    await handleUserRemovedFromRole(userId, roleId);

    return { success: true };
  } catch (error: any) {
    console.error('Failed to remove user from role:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 3: Update Role Workspaces (Server Action)

```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncRoleMembersWorkspaceAccess } from '@/lib/workspace-access-sync';

export async function updateRoleWorkspacesAction(
  roleId: string,
  workspaceIds: string[]
) {
  try {
    // 1. Update role document
    await adminDb.collection('roles').doc(roleId).update({
      workspaceIds,
      updatedAt: new Date().toISOString(),
    });

    // 2. Sync all role members immediately (CRITICAL for Requirement 9.5)
    await syncRoleMembersWorkspaceAccess(roleId);

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update role workspaces:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 4: Batch Role Updates

```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncRoleMembersWorkspaceAccess } from '@/lib/workspace-access-sync';

export async function batchUpdateRolesAction(updates: Array<{ roleId: string; workspaceIds: string[] }>) {
  try {
    const batch = adminDb.batch();

    // 1. Batch update all roles
    updates.forEach(({ roleId, workspaceIds }) => {
      const roleRef = adminDb.collection('roles').doc(roleId);
      batch.update(roleRef, {
        workspaceIds,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();

    // 2. Sync all affected role members
    await Promise.all(
      updates.map(({ roleId }) => syncRoleMembersWorkspaceAccess(roleId))
    );

    return { success: true };
  } catch (error: any) {
    console.error('Failed to batch update roles:', error);
    return { success: false, error: error.message };
  }
}
```

## Security Considerations

### Immediate Revocation

The sync functions MUST be called immediately after role changes to ensure security rules deny access without delay. Do NOT defer sync to background jobs or scheduled tasks.

### Atomicity

For critical operations, consider using Firestore transactions to ensure role changes and sync operations are atomic:

```typescript
await adminDb.runTransaction(async (transaction) => {
  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await transaction.get(userRef);
  
  // Update role membership
  transaction.update(userRef, {
    roles: admin.firestore.FieldValue.arrayRemove(roleId)
  });
  
  // Note: syncUserWorkspaceAccess cannot run inside transaction
  // Call it immediately after transaction commits
});

// Sync immediately after transaction
await syncUserWorkspaceAccess(userId);
```

### Error Handling

If sync fails, the user's access may not be immediately revoked. Implement retry logic and monitoring:

```typescript
try {
  await handleUserRemovedFromRole(userId, roleId);
} catch (error) {
  // Log error for monitoring
  console.error('CRITICAL: Failed to sync workspace access:', error);
  
  // Retry once
  try {
    await handleUserRemovedFromRole(userId, roleId);
  } catch (retryError) {
    // Alert administrators
    await sendAdminAlert({
      severity: 'critical',
      message: `Failed to revoke workspace access for user ${userId}`,
      error: retryError,
    });
  }
}
```

## Migration

To migrate existing users to the new system:

```typescript
import { syncOrganizationWorkspaceAccess } from '@/lib/workspace-access-sync';

// Run once per organization
await syncOrganizationWorkspaceAccess('org123');
```

This will populate the `workspaceIds` array for all users based on their current role memberships.

## Monitoring

Monitor these metrics:
1. Sync operation failures
2. Time between role change and sync completion
3. Users with empty `workspaceIds` who have roles
4. Discrepancies between role-based access and `workspaceIds`

## Testing

See `src/lib/__tests__/workspace-access-sync.test.ts` for comprehensive test coverage.

## Related Files

- `src/lib/workspace-access-sync.ts` - Implementation
- `src/lib/workspace-permissions.ts` - Permission checking
- `firestore.rules` - Security rules that enforce access
- `.kiro/specs/contacts-expansion/requirements.md` - Requirement 9.5

## Troubleshooting

### User has role but no workspace access

**Symptom:** User belongs to a role with workspaces, but `user.workspaceIds` is empty or outdated.

**Solution:**
```typescript
await syncUserWorkspaceAccess(userId);
```

### Workspace access not immediately revoked

**Symptom:** User removed from role but can still access workspace_entities.

**Cause:** Sync function was not called after role change.

**Solution:**
```typescript
// Always call sync after role changes
await handleUserRemovedFromRole(userId, roleId);
```

### Bulk sync needed

**Symptom:** Multiple users have outdated workspace access.

**Solution:**
```typescript
await syncOrganizationWorkspaceAccess(organizationId);
```
