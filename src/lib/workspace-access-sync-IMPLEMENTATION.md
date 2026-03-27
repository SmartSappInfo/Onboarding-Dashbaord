# Workspace Access Sync Implementation Guide

This guide provides step-by-step instructions for integrating workspace access synchronization into your existing role management code.

## Overview

To satisfy Requirement 9.5 (immediate workspace access revocation), you must call sync functions whenever role membership or role workspace access changes. This ensures the `user.workspaceIds` array stays in sync with role-based access, allowing Firestore security rules to enforce immediate access revocation.

## Step 1: Identify Role Management Code

Find all server actions and functions that modify:
1. User role membership (`user.roles` array)
2. Role workspace access (`role.workspaceIds` array)
3. Role deletion

Common locations:
- `src/app/actions/roles.ts`
- `src/app/actions/users.ts`
- `src/lib/role-management.ts`
- Admin dashboard role management pages

## Step 2: Add Sync Calls

### Example 1: Add User to Role

**Before:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function addUserToRoleAction(userId: string, roleId: string) {
  await adminDb.collection('users').doc(userId).update({
    roles: admin.firestore.FieldValue.arrayUnion(roleId),
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
```

**After:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { handleUserAddedToRole } from '@/lib/workspace-access-sync';

export async function addUserToRoleAction(userId: string, roleId: string) {
  // 1. Update user document
  await adminDb.collection('users').doc(userId).update({
    roles: admin.firestore.FieldValue.arrayUnion(roleId),
    updatedAt: new Date().toISOString(),
  });

  // 2. CRITICAL: Sync workspace access immediately (Requirement 9.5)
  await handleUserAddedToRole(userId, roleId);

  return { success: true };
}
```

### Example 2: Remove User from Role

**Before:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function removeUserFromRoleAction(userId: string, roleId: string) {
  await adminDb.collection('users').doc(userId).update({
    roles: admin.firestore.FieldValue.arrayRemove(roleId),
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
```

**After:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { handleUserRemovedFromRole } from '@/lib/workspace-access-sync';

export async function removeUserFromRoleAction(userId: string, roleId: string) {
  // 1. Update user document
  await adminDb.collection('users').doc(userId).update({
    roles: admin.firestore.FieldValue.arrayRemove(roleId),
    updatedAt: new Date().toISOString(),
  });

  // 2. CRITICAL: Sync workspace access immediately (Requirement 9.5)
  // This ensures security rules immediately deny access to workspace_entities
  await handleUserRemovedFromRole(userId, roleId);

  return { success: true };
}
```

### Example 3: Update Role Workspaces

**Before:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function updateRoleAction(roleId: string, updates: Partial<Role>) {
  await adminDb.collection('roles').doc(roleId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
```

**After:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncRoleMembersWorkspaceAccess } from '@/lib/workspace-access-sync';
import type { Role } from '@/lib/types';

export async function updateRoleAction(roleId: string, updates: Partial<Role>) {
  // 1. Update role document
  await adminDb.collection('roles').doc(roleId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  // 2. CRITICAL: If workspaceIds changed, sync all role members (Requirement 9.5)
  if (updates.workspaceIds !== undefined) {
    await syncRoleMembersWorkspaceAccess(roleId);
  }

  return { success: true };
}
```

### Example 4: Delete Role

**Before:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function deleteRoleAction(roleId: string) {
  // Remove role from all users
  const usersSnap = await adminDb
    .collection('users')
    .where('roles', 'array-contains', roleId)
    .get();

  const batch = adminDb.batch();
  usersSnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      roles: admin.firestore.FieldValue.arrayRemove(roleId),
    });
  });

  // Delete role
  batch.delete(adminDb.collection('roles').doc(roleId));
  await batch.commit();

  return { success: true };
}
```

**After:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncRoleMembersWorkspaceAccess } from '@/lib/workspace-access-sync';

export async function deleteRoleAction(roleId: string) {
  // 1. Sync all role members BEFORE deleting role (Requirement 9.5)
  // This ensures their workspaceIds are updated before role is gone
  await syncRoleMembersWorkspaceAccess(roleId);

  // 2. Remove role from all users
  const usersSnap = await adminDb
    .collection('users')
    .where('roles', 'array-contains', roleId)
    .get();

  const batch = adminDb.batch();
  usersSnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      roles: admin.firestore.FieldValue.arrayRemove(roleId),
    });
  });

  // 3. Delete role
  batch.delete(adminDb.collection('roles').doc(roleId));
  await batch.commit();

  // 4. Sync all affected users again to ensure workspaceIds are correct
  const syncPromises = usersSnap.docs.map((doc) =>
    syncUserWorkspaceAccess(doc.id)
  );
  await Promise.all(syncPromises);

  return { success: true };
}
```

### Example 5: Bulk Role Assignment

**Before:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function assignRolesToUsersAction(
  userIds: string[],
  roleIds: string[]
) {
  const batch = adminDb.batch();

  userIds.forEach((userId) => {
    const userRef = adminDb.collection('users').doc(userId);
    batch.update(userRef, {
      roles: admin.firestore.FieldValue.arrayUnion(...roleIds),
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
  return { success: true };
}
```

**After:**
```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncUserWorkspaceAccess } from '@/lib/workspace-access-sync';

export async function assignRolesToUsersAction(
  userIds: string[],
  roleIds: string[]
) {
  // 1. Update all users in batch
  const batch = adminDb.batch();

  userIds.forEach((userId) => {
    const userRef = adminDb.collection('users').doc(userId);
    batch.update(userRef, {
      roles: admin.firestore.FieldValue.arrayUnion(...roleIds),
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();

  // 2. CRITICAL: Sync workspace access for all affected users (Requirement 9.5)
  const syncPromises = userIds.map((userId) => syncUserWorkspaceAccess(userId));
  await Promise.all(syncPromises);

  return { success: true };
}
```

## Step 3: Add Error Handling

Wrap sync calls in try-catch blocks with retry logic:

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

    // 2. Sync workspace access with retry
    try {
      await handleUserRemovedFromRole(userId, roleId);
    } catch (syncError) {
      console.error('CRITICAL: Failed to sync workspace access:', syncError);
      
      // Retry once
      try {
        await handleUserRemovedFromRole(userId, roleId);
      } catch (retryError) {
        // Log for monitoring but don't fail the operation
        console.error('CRITICAL: Retry failed for workspace access sync:', retryError);
        
        // TODO: Send alert to administrators
        // await sendAdminAlert({ ... });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to remove user from role:', error);
    return { success: false, error: error.message };
  }
}
```

## Step 4: Add Monitoring

Add logging and metrics to track sync operations:

```typescript
import { handleUserRemovedFromRole } from '@/lib/workspace-access-sync';

export async function removeUserFromRoleAction(userId: string, roleId: string) {
  const startTime = Date.now();

  try {
    await adminDb.collection('users').doc(userId).update({
      roles: admin.firestore.FieldValue.arrayRemove(roleId),
      updatedAt: new Date().toISOString(),
    });

    await handleUserRemovedFromRole(userId, roleId);

    const duration = Date.now() - startTime;
    
    // Log metrics
    console.log('>>> [METRICS] Workspace access sync completed', {
      userId,
      roleId,
      operation: 'remove_user_from_role',
      duration,
      success: true,
    });

    return { success: true };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log error metrics
    console.error('>>> [METRICS] Workspace access sync failed', {
      userId,
      roleId,
      operation: 'remove_user_from_role',
      duration,
      success: false,
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}
```

## Step 5: Migration Script

Create a one-time migration script to populate `workspaceIds` for existing users:

```typescript
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { syncOrganizationWorkspaceAccess } from '@/lib/workspace-access-sync';

/**
 * One-time migration script to populate user.workspaceIds for all users.
 * 
 * Run this once per organization after deploying the workspace access sync system.
 */
export async function migrateWorkspaceAccessAction(organizationId: string) {
  console.log(`>>> [MIGRATION] Starting workspace access migration for org ${organizationId}`);

  try {
    await syncOrganizationWorkspaceAccess(organizationId);

    console.log(`>>> [MIGRATION] Completed workspace access migration for org ${organizationId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`>>> [MIGRATION] Failed workspace access migration:`, error);
    return { success: false, error: error.message };
  }
}
```

## Step 6: Testing

Create integration tests to verify sync behavior:

```typescript
import { describe, it, expect } from 'vitest';
import { removeUserFromRoleAction } from '@/app/actions/roles';
import { adminDb } from '@/lib/firebase-admin';

describe('Role Management with Workspace Access Sync', () => {
  it('should immediately revoke workspace access when user removed from role', async () => {
    const userId = 'test-user';
    const roleId = 'test-role';

    // Setup: User has role with workspace access
    await adminDb.collection('users').doc(userId).set({
      roles: [roleId],
      workspaceIds: ['ws1', 'ws2'],
      organizationId: 'org1',
    });

    await adminDb.collection('roles').doc(roleId).set({
      workspaceIds: ['ws1', 'ws2'],
      organizationId: 'org1',
    });

    // Action: Remove user from role
    await removeUserFromRoleAction(userId, roleId);

    // Verify: User workspaceIds should be empty
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();

    expect(userData?.workspaceIds).toEqual([]);
    expect(userData?.roles).not.toContain(roleId);
  });
});
```

## Step 7: Documentation

Update your role management documentation to include:

1. **When to sync**: List all scenarios that require sync calls
2. **How to sync**: Code examples for each scenario
3. **Error handling**: How to handle sync failures
4. **Monitoring**: What metrics to track
5. **Troubleshooting**: Common issues and solutions

## Checklist

Use this checklist to ensure complete integration:

- [ ] Identified all role management server actions
- [ ] Added sync calls to user role assignment
- [ ] Added sync calls to user role removal
- [ ] Added sync calls to role workspace updates
- [ ] Added sync calls to role deletion
- [ ] Added error handling with retry logic
- [ ] Added monitoring and logging
- [ ] Created migration script
- [ ] Ran migration for all organizations
- [ ] Created integration tests
- [ ] Updated documentation
- [ ] Verified security rules enforce immediate revocation
- [ ] Tested with real users in staging environment

## Common Pitfalls

### Pitfall 1: Forgetting to sync after batch operations

**Problem:** Batch updating multiple users but only syncing once.

**Solution:** Sync each user individually after batch commit.

```typescript
// ❌ WRONG
await batch.commit();
await syncUserWorkspaceAccess(userIds[0]); // Only syncs first user!

// ✅ CORRECT
await batch.commit();
await Promise.all(userIds.map(id => syncUserWorkspaceAccess(id)));
```

### Pitfall 2: Not handling sync failures

**Problem:** Sync fails silently, leaving user with incorrect access.

**Solution:** Add retry logic and monitoring.

```typescript
try {
  await handleUserRemovedFromRole(userId, roleId);
} catch (error) {
  // Retry once
  await handleUserRemovedFromRole(userId, roleId);
}
```

### Pitfall 3: Syncing inside transactions

**Problem:** Sync functions cannot run inside Firestore transactions.

**Solution:** Call sync immediately after transaction commits.

```typescript
// ❌ WRONG
await adminDb.runTransaction(async (transaction) => {
  transaction.update(userRef, { roles: [...] });
  await syncUserWorkspaceAccess(userId); // Cannot call async functions in transaction!
});

// ✅ CORRECT
await adminDb.runTransaction(async (transaction) => {
  transaction.update(userRef, { roles: [...] });
});
await syncUserWorkspaceAccess(userId); // Call after transaction
```

### Pitfall 4: Not syncing on role deletion

**Problem:** Deleting role without syncing users first.

**Solution:** Sync before and after role deletion.

```typescript
// Sync before deletion (while role still exists)
await syncRoleMembersWorkspaceAccess(roleId);

// Delete role
await adminDb.collection('roles').doc(roleId).delete();

// Sync affected users again
await Promise.all(userIds.map(id => syncUserWorkspaceAccess(id)));
```

## Related Files

- `src/lib/workspace-access-sync.ts` - Core implementation
- `src/lib/workspace-access-sync-README.md` - API documentation
- `src/lib/__tests__/workspace-access-sync.test.ts` - Tests
- `firestore.rules` - Security rules that enforce access

## Support

If you encounter issues:
1. Check logs for sync errors
2. Verify user.workspaceIds matches role-based access
3. Run manual sync: `await syncUserWorkspaceAccess(userId)`
4. Check Firestore security rules are deployed
5. Verify role.workspaceIds arrays are correct
