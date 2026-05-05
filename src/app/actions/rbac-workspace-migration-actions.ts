'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { UserProfile, Role, PermissionsSchema, AppPermissionId } from '@/lib/types';
import { mergePermissionsSchemas, getBlankPermissions } from '@/lib/permissions-engine';

export type WorkspaceRbacMigrationResult = {
    total: number;
    needingMigration: number;
    skipped: number;
    succeeded: number;
    failed: number;
    invalid: number;
    errors: string[];
};

/**
 * 1. FETCH
 * Identifies users who still rely on the legacy `roles` array
 * rather than the new `workspaceRoles` map.
 */
export async function fetchUsersForWorkspaceRbacMigration(organizationId: string): Promise<{ success: boolean; data?: WorkspaceRbacMigrationResult; error?: string }> {
    try {
        const usersSnap = await adminDb.collection('users')
            .where('organizationId', '==', organizationId)
            .get();

        let needingMigration = 0;
        let skipped = 0;

        usersSnap.forEach(doc => {
            const user = doc.data() as UserProfile;
            // If they have legacy roles but NO workspaceRoles, they need migration
            if ((user.roles && user.roles.length > 0) && !user.workspaceRoles) {
                needingMigration++;
            } else {
                skipped++;
            }
        });

        return {
            success: true,
            data: {
                total: usersSnap.size,
                needingMigration,
                skipped,
                succeeded: 0,
                failed: 0,
                invalid: 0,
                errors: []
            }
        };
    } catch (e: any) {
        console.error('Fetch error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 2. ENRICH
 * Maps the legacy global `roles` into `workspaceRoles` for every assigned workspace.
 * Computes `workspacePermissions` and `workspacePermissionsSchemas` for each workspace.
 */
export async function enrichUsersWithWorkspaceRbac(organizationId: string): Promise<{ success: boolean; data?: WorkspaceRbacMigrationResult; error?: string }> {
    try {
        const usersSnap = await adminDb.collection('users')
            .where('organizationId', '==', organizationId)
            .get();

        // Pre-fetch all roles for the organization to avoid N queries
        const rolesSnap = await adminDb.collection('roles')
            .where('organizationId', '==', organizationId)
            .get();
            
        const orgRoles = new Map<string, Role>();
        rolesSnap.forEach(doc => orgRoles.set(doc.id, { id: doc.id, ...doc.data() } as Role));

        let succeeded = 0;
        let failed = 0;
        let skipped = 0;
        const errors: string[] = [];

        const batch = adminDb.batch();
        let batchCount = 0;

        for (const doc of usersSnap.docs) {
            const user = doc.data() as UserProfile;

            // Skip if already migrated or no legacy roles
            if (user.workspaceRoles || !user.roles || user.roles.length === 0) {
                skipped++;
                continue;
            }

            try {
                const legacyRoles = user.roles || [];
                const assignedWorkspaces = user.workspaceIds || [];
                
                const newWorkspaceRoles: Record<string, string[]> = {};
                const newWorkspacePermissions: Record<string, AppPermissionId[]> = {};
                const newWorkspaceSchemas: Record<string, PermissionsSchema> = {};

                // For each workspace they have access to, apply the global roles
                for (const wsId of assignedWorkspaces) {
                    newWorkspaceRoles[wsId] = [...legacyRoles];
                    
                    // Flatten permissions for this workspace
                    const selectedRoleObjects = legacyRoles
                        .map(rId => orgRoles.get(rId))
                        .filter((r): r is Role => !!r);

                    const allPerms = new Set<AppPermissionId>();
                    selectedRoleObjects.forEach(r => {
                        if (r.permissions) r.permissions.forEach(p => allPerms.add(p));
                    });
                    newWorkspacePermissions[wsId] = Array.from(allPerms);

                    // Flatten hierarchical schemas
                    const schemas = selectedRoleObjects
                        .map(r => r.permissionsSchema)
                        .filter((s): s is PermissionsSchema => !!s);
                    
                    newWorkspaceSchemas[wsId] = schemas.length > 0 
                        ? mergePermissionsSchemas(schemas) 
                        : getBlankPermissions();
                }

                // If user has NO workspaces but has roles, assign to a special 'unassigned' map? 
                // We'll just leave it empty. The user has no workspace access.
                
                batch.update(doc.ref, {
                    workspaceRoles: newWorkspaceRoles,
                    workspacePermissions: newWorkspacePermissions,
                    workspacePermissionsSchemas: newWorkspaceSchemas,
                    updatedAt: new Date().toISOString()
                });

                batchCount++;
                succeeded++;

                if (batchCount === 450) {
                    await batch.commit();
                    batchCount = 0;
                }
            } catch (err: any) {
                failed++;
                errors.push(`User ${user.id}: ${err.message}`);
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return {
            success: true,
            data: {
                total: usersSnap.size,
                needingMigration: 0,
                skipped,
                succeeded,
                failed,
                invalid: 0,
                errors
            }
        };

    } catch (e: any) {
        console.error('Enrich error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 3. RESTORE / VALIDATE
 * Ensures all users in the org have `workspaceRoles` mapped safely.
 */
export async function restoreWorkspaceRbacMigration(organizationId: string): Promise<{ success: boolean; data?: WorkspaceRbacMigrationResult; error?: string }> {
    try {
        const usersSnap = await adminDb.collection('users')
            .where('organizationId', '==', organizationId)
            .get();

        let valid = 0;
        let invalid = 0;
        const errors: string[] = [];

        usersSnap.forEach(doc => {
            const user = doc.data() as UserProfile;
            
            // It's valid if workspaceRoles exists, OR if they have absolutely no legacy roles anyway.
            if (user.workspaceRoles !== undefined || (!user.roles || user.roles.length === 0)) {
                valid++;
            } else {
                invalid++;
                errors.push(`User ${user.id} missing workspaceRoles but has legacy roles.`);
            }
        });

        return {
            success: true,
            data: {
                total: usersSnap.size,
                needingMigration: 0,
                skipped: 0,
                succeeded: valid,
                failed: 0,
                invalid,
                errors
            }
        };
    } catch (e: any) {
        console.error('Restore error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 4. ROLLBACK
 * Strips the new workspace maps to revert to the legacy array.
 */
export async function rollbackWorkspaceRbacMigration(organizationId: string): Promise<{ success: boolean; data?: WorkspaceRbacMigrationResult; error?: string }> {
    try {
        const usersSnap = await adminDb.collection('users')
            .where('organizationId', '==', organizationId)
            .get();

        let succeeded = 0;
        const errors: string[] = [];

        const batch = adminDb.batch();
        let batchCount = 0;

        for (const doc of usersSnap.docs) {
            const user = doc.data() as UserProfile;

            if (user.workspaceRoles !== undefined) {
                batch.update(doc.ref, {
                    workspaceRoles: FieldValue.delete(),
                    workspacePermissions: FieldValue.delete(),
                    workspacePermissionsSchemas: FieldValue.delete(),
                    updatedAt: new Date().toISOString()
                });
                succeeded++;
                batchCount++;

                if (batchCount === 450) {
                    await batch.commit();
                    batchCount = 0;
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return {
            success: true,
            data: {
                total: usersSnap.size,
                needingMigration: 0,
                skipped: usersSnap.size - succeeded,
                succeeded,
                failed: 0,
                invalid: 0,
                errors
            }
        };
    } catch (e: any) {
        console.error('Rollback error:', e);
        return { success: false, error: e.message };
    }
}
