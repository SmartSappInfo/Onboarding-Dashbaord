# Workspace-Scoped Permissions

This document describes the workspace-scoped permission system implemented for Requirement 9.

## Overview

The workspace permission system ensures that users can only access workspace_entities records for workspaces they have explicit access to. Access is granted through roles, and permissions are evaluated at four levels:

1. **Organization level**: Does the user belong to the organization?
2. **Workspace level**: Does the user have access to the specific workspace (via role.workspaceIds)?
3. **Workspace-entity level**: Does the user have permission to access this workspace_entities record?
4. **Feature/capability level**: Does the workspace have the capability enabled?

## Key Principles

### Workspace Isolation (Requirement 9.1, 9.2)

Users can only access workspace_entities records for workspaces they have explicit access to. Having access to an entity in workspace A does NOT grant access to the same entity in workspace B.

```typescript
// ❌ WRONG: User has access to entity in workspace A
// This does NOT grant access to the same entity in workspace B
const entityInWorkspaceA = await getEntity(userId, entityId, workspaceA);
const entityInWorkspaceB = await getEntity(userId, entityId, workspaceB); // Should fail!

// ✅ CORRECT: Check workspace access separately for each workspace
const accessToA = await checkWorkspaceAccess(userId, workspaceA);
const accessToB = await checkWorkspaceAccess(userId, workspaceB);
```

### Role-Based Workspace Access

Users gain access to workspaces through roles. Each role has a `workspaceIds` array that determines which workspaces the role grants access to.

```typescript
interface Role {
  id: string;
  organizationId: string;
  name: string;
  permissions: AppPermissionId[];
  workspaceIds: string[]; // Grants access to these workspaces
}
```

### System Admin Bypass

Users with the `system_admin` permission bypass all permission checks and have access to all workspaces in their organization.

## API Reference

### Core Functions

#### `checkWorkspaceAccess(userId, workspaceId)`

Checks if a user has access to a specific workspace.

**Use when:**
- Querying workspace_entities by workspaceId
- Listing entities in a workspace
- Any read operation scoped to a workspace

**Example:**
```typescript
const accessCheck = await checkWorkspaceAccess(userId, workspaceId);
if (!accessCheck.granted) {
  return { success: false, error: accessCheck.reason };
}
```

#### `checkWorkspaceEntityAccess(userId, workspaceEntityId)`

Checks if a user has access to a specific workspace_entities record.

**Use when:**
- Reading a specific workspace_entities document by ID
- Updating a specific workspace_entities record
- Any operation on a known workspace_entities document

**Example:**
```typescript
const accessCheck = await checkWorkspaceEntityAccess(userId, workspaceEntityId);
if (!accessCheck.granted) {
  return { success: false, error: accessCheck.reason };
}
```

#### `checkWorkspacePermission(userId, workspaceId, permission)`

Checks if a user has workspace access AND a specific permission.

**Use when:**
- Creating, updating, or deleting workspace-scoped resources
- Operations that require specific permissions like 'schools_edit', 'tags_manage'

**Example:**
```typescript
const permissionCheck = await checkWorkspacePermission(
  userId,
  workspaceId,
  'schools_edit'
);
if (!permissionCheck.granted) {
  return { success: false, error: permissionCheck.reason };
}
```

#### `checkWorkspaceCapability(workspaceId, capability)`

Checks if a workspace has a specific capability enabled.

**Use when:**
- Operations depend on workspace capabilities (billing, admissions, messaging, etc.)
- Feature-gated functionality

**Example:**
```typescript
const capabilityCheck = await checkWorkspaceCapability(workspaceId, 'billing');
if (!capabilityCheck.granted) {
  return { success: false, error: capabilityCheck.reason };
}
```

#### `checkFullWorkspacePermission(userId, workspaceId, permission, capability?)`

Comprehensive check that evaluates all four permission levels.

**Use when:**
- Creating resources that require both permission and capability checks
- Complex operations with multiple permission requirements

**Example:**
```typescript
const fullCheck = await checkFullWorkspacePermission(
  userId,
  workspaceId,
  'finance_manage',
  'billing'
);
if (!fullCheck.granted) {
  return { success: false, error: fullCheck.reason };
}
```

#### `getUserWorkspaceIds(userId)`

Gets all workspace IDs that a user has access to.

**Use when:**
- Building workspace selectors
- Filtering data across multiple workspaces
- Bulk operations

**Example:**
```typescript
const workspaceIds = await getUserWorkspaceIds(userId);
// Query only workspaces user has access to
const entities = await queryEntitiesInWorkspaces(workspaceIds);
```

## Integration Patterns

### Pattern 1: Read workspace_entities by ID

```typescript
export async function getWorkspaceEntityAction(userId: string, workspaceEntityId: string) {
  // 1. Check access
  const accessCheck = await checkWorkspaceEntityAccess(userId, workspaceEntityId);
  if (!accessCheck.granted) {
    return { success: false, error: accessCheck.reason };
  }

  // 2. Fetch data
  const weSnap = await adminDb.collection('workspace_entities').doc(workspaceEntityId).get();
  return { success: true, data: weSnap.data() };
}
```

### Pattern 2: Query workspace_entities by workspaceId

```typescript
export async function listWorkspaceEntitiesAction(userId: string, workspaceId: string) {
  // 1. Check workspace access
  const accessCheck = await checkWorkspaceAccess(userId, workspaceId);
  if (!accessCheck.granted) {
    return { success: false, error: accessCheck.reason };
  }

  // 2. Query workspace_entities
  const snapshot = await adminDb
    .collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .get();

  return { success: true, items: snapshot.docs.map(doc => doc.data()) };
}
```

### Pattern 3: Update workspace_entities with permission check

```typescript
export async function updateWorkspaceEntityAction(
  userId: string,
  workspaceEntityId: string,
  updates: any
) {
  // 1. Fetch workspace_entities to get workspaceId
  const weSnap = await adminDb.collection('workspace_entities').doc(workspaceEntityId).get();
  const workspaceEntity = weSnap.data();

  // 2. Check permission
  const permissionCheck = await checkWorkspacePermission(
    userId,
    workspaceEntity.workspaceId,
    'schools_edit'
  );
  if (!permissionCheck.granted) {
    return { success: false, error: permissionCheck.reason };
  }

  // 3. Update
  await weSnap.ref.update(updates);
  return { success: true };
}
```

### Pattern 4: Create resource with capability check

```typescript
export async function createBillingRecordAction(
  userId: string,
  workspaceId: string,
  data: any
) {
  // 1. Check full permissions
  const permissionCheck = await checkFullWorkspacePermission(
    userId,
    workspaceId,
    'finance_manage',
    'billing'
  );
  if (!permissionCheck.granted) {
    return { success: false, error: permissionCheck.reason };
  }

  // 2. Create resource
  const docRef = await adminDb.collection('billing_records').add({
    workspaceId,
    ...data,
  });
  return { success: true, id: docRef.id };
}
```

## Permission Levels

### Organization Level

Checks if the user belongs to the same organization as the workspace.

**Fails when:**
- User not found
- User belongs to a different organization

### Workspace Level

Checks if the user has a role that grants access to the workspace.

**Fails when:**
- Workspace not found
- User has no role with the workspace in its workspaceIds array

### Workspace-Entity Level

Checks if the user has access to the workspace that owns the workspace_entities record.

**Fails when:**
- workspace_entities record not found
- User doesn't have access to the workspace

### Feature Level

Checks if the user has the required permission AND the workspace has the required capability.

**Fails when:**
- User lacks the required permission
- Workspace doesn't have the required capability enabled

## Error Handling

All permission check functions return a `PermissionCheckResult`:

```typescript
interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  level?: 'organization' | 'workspace' | 'workspace-entity' | 'feature';
}
```

**Best practices:**
1. Always check `granted` before proceeding
2. Return the `reason` to the caller for debugging
3. Include the `level` in error responses to help identify the issue
4. Log permission denials for security auditing

## Security Considerations

### Firestore Security Rules

The permission checks in this module are server-side only. Firestore security rules (task 34.2) provide an additional layer of security for direct SDK access.

### Workspace Access Revocation (Requirement 9.5)

When a user's workspace access is revoked (by removing them from a role or removing the workspace from a role's workspaceIds), the permission checks immediately deny access. No additional cleanup is required.

### System Admin Bypass

System admins bypass all permission checks. This is intentional for administrative operations, but should be used carefully.

## Testing

See `src/lib/__tests__/workspace-permissions.test.ts` for comprehensive test coverage of all permission check functions.

## Migration Guide

To add permission checks to existing server actions:

1. **Identify the operation type:**
   - Read workspace_entities by ID → use `checkWorkspaceEntityAccess`
   - Query workspace_entities by workspaceId → use `checkWorkspaceAccess`
   - Write operations → use `checkWorkspacePermission`
   - Capability-dependent operations → use `checkFullWorkspacePermission`

2. **Add the permission check at the start of the function:**
   ```typescript
   const accessCheck = await checkWorkspaceAccess(userId, workspaceId);
   if (!accessCheck.granted) {
     return { success: false, error: accessCheck.reason };
   }
   ```

3. **Update the function signature to include userId if not already present**

4. **Test the permission check with different user roles**

## Related Requirements

- **Requirement 9.1**: Grant access to workspace_entities only to users with workspace access
- **Requirement 9.2**: Do NOT grant access to workspace B data just because user has access to same entity in workspace A
- **Requirement 9.3**: Firestore security rules enforce workspace membership (see task 34.2)
- **Requirement 9.4**: Evaluate permissions at four levels
- **Requirement 9.5**: Immediately deny access when workspace access is revoked

## See Also

- `src/lib/workspace-permissions.ts` - Implementation
- `src/lib/workspace-permissions-example.ts` - Usage examples
- `src/lib/__tests__/workspace-permissions.test.ts` - Tests
- `firestore.rules` - Security rules (task 34.2)
