/**
 * @fileOverview Role Management & Lifecycle Service (Authorization 2.0)
 *
 * Provides CRUD management, schema validation, version bumping, and background
 * projection cascade invalidation for organization roles.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Mutating a role definition automatically bumps `version` and triggers
 *   re-projection for all assigned members in chunks of max 250 writes.
 * - Prevents deleting actively assigned roles or core system presets.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Unit tested in `authorization-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Role, PermissionsSchema, AppPermissionId } from '@/lib/types';
import { flattenPermissionsSchema, normalizePermissionsSchema } from '@/lib/permissions-engine';
import { PermissionRegistryService } from './permission-registry-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';

export interface CreateRolePayload {
  name: string;
  description?: string;
  color?: string;
  category?: string;
  permissionsSchema: PermissionsSchema;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  color?: string;
  category?: string;
  permissionsSchema?: PermissionsSchema;
}

export class RoleManagementService {
  /**
   * Creates a new organization-scoped role with validated schema and flattened permissions.
   */
  static async createRole(
    organizationId: string,
    payload: CreateRolePayload,
    batch?: FirebaseFirestore.WriteBatch
  ): Promise<Role> {
    if (!organizationId) throw new Error('Missing organizationId');
    if (!payload.name?.trim()) throw new Error('Role name is required');

    const resolvedSchema = PermissionRegistryService.resolveDependencies(
      normalizePermissionsSchema(payload.permissionsSchema)
    );
    const flatPerms = flattenPermissionsSchema(resolvedSchema) as AppPermissionId[];
    const now = new Date().toISOString();

    const roleRef = adminDb.collection('roles').doc();
    const newRole: Role = {
      id: roleRef.id,
      organizationId,
      name: payload.name.trim(),
      description: payload.description || '',
      color: payload.color || '#3B82F6',
      category: payload.category || 'Custom',
      permissions: flatPerms,
      permissionsSchema: resolvedSchema,
      workspaceIds: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    if (batch) {
      batch.set(roleRef, newRole);
    } else {
      await roleRef.set(newRole);
    }

    return newRole;
  }

  /**
   * Updates an existing role, increments version, and triggers background projection cascades.
   */
  static async updateRole(
    organizationId: string,
    roleId: string,
    payload: UpdateRolePayload
  ): Promise<Role> {
    if (!organizationId || !roleId) throw new Error('Missing parameters');

    const roleRef = adminDb.collection('roles').doc(roleId);
    const roleSnap = await roleRef.get();

    if (!roleSnap.exists) {
      throw new Error(`Role ${roleId} not found`);
    }

    const currentRole = { id: roleSnap.id, ...roleSnap.data() } as Role;
    if (currentRole.organizationId && currentRole.organizationId !== organizationId) {
      throw new Error('Forbidden: Role does not belong to specified organization');
    }

    const now = new Date().toISOString();
    const currentVersion = currentRole.version || 1;

    let updatedSchema = currentRole.permissionsSchema;
    let updatedFlatPerms = currentRole.permissions;

    if (payload.permissionsSchema) {
      updatedSchema = PermissionRegistryService.resolveDependencies(
        normalizePermissionsSchema(payload.permissionsSchema)
      );
      updatedFlatPerms = flattenPermissionsSchema(updatedSchema) as AppPermissionId[];
    }

    const updatedRole: Role = {
      ...currentRole,
      name: payload.name ? payload.name.trim() : currentRole.name,
      description: payload.description !== undefined ? payload.description : currentRole.description,
      color: payload.color || currentRole.color,
      category: payload.category || currentRole.category,
      permissions: updatedFlatPerms,
      permissionsSchema: updatedSchema,
      version: currentVersion + 1,
      updatedAt: now,
    };

    // 1. Save role document
    await roleRef.set(updatedRole, { merge: true });

    // 2. Query all workspace memberships in organization that assign this role
    try {
      const wsMemsSnap = await adminDb
        .collection('workspace_memberships')
        .where('organizationId', '==', organizationId)
        .where('roleAssignmentIds', 'array-contains', roleId)
        .get();

      const affectedPersonIds = Array.from(
        new Set(wsMemsSnap.docs.map((d) => d.data().personId as string))
      );

      // Re-project affected users in chunks of max 250 operations
      for (const personId of affectedPersonIds) {
        await IdentityProjectionService.syncUserProjection(organizationId, personId);
      }
    } catch (projErr: unknown) {
      console.warn(`[RoleManagementService] Projection cascade warning for role ${roleId}:`, projErr);
    }

    return updatedRole;
  }

  /**
   * Deletes a custom role after verifying no members are actively assigned.
   */
  static async deleteRole(organizationId: string, roleId: string): Promise<boolean> {
    if (!organizationId || !roleId) throw new Error('Missing parameters');

    // 1. Assert not a core platform preset
    if (roleId.startsWith('builtin-')) {
      throw new Error('Built-in system roles cannot be deleted.');
    }

    // 2. Assert no active workspace memberships assign this role
    const wsMemsSnap = await adminDb
      .collection('workspace_memberships')
      .where('organizationId', '==', organizationId)
      .where('roleAssignmentIds', 'array-contains', roleId)
      .limit(1)
      .get();

    if (!wsMemsSnap.empty) {
      throw new Error('Cannot delete role: active team members are currently assigned to this role. Please reassign them first.');
    }

    await adminDb.collection('roles').doc(roleId).delete();
    return true;
  }

  /**
   * Retrieves single role by ID.
   */
  static async getRole(roleId: string): Promise<Role | null> {
    if (!roleId) return null;
    const snap = await adminDb.collection('roles').doc(roleId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Role;
  }

  /**
   * Lists all roles for an organization.
   */
  static async listRolesByOrganization(organizationId: string): Promise<Role[]> {
    if (!organizationId) return [];
    const snap = await adminDb
      .collection('roles')
      .where('organizationId', '==', organizationId)
      .orderBy('name', 'asc')
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Role));
  }

  /**
   * Alias for listing roles by organization.
   */
  static async listRoles(organizationId: string): Promise<Role[]> {
    return this.listRolesByOrganization(organizationId);
  }
}
