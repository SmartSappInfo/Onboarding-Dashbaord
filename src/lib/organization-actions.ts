'use server';

import { adminDb } from './firebase-admin';
import type { Organization, AppPermissionId } from './types';
import { getFullAdminPermissions } from './permissions-engine';
import { migrateToPermissionsSchema } from './permissions-migration';
import { assertUserTenantPermission } from './organization-utils';

/**
 * Generate a random 4-character hex string for slug entropy
 */
function generateEntropy(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
}

/**
 * Save (create or update) an organization
 */
export async function saveOrganizationAction(
    organizationId: string | null,
    data: Partial<Organization>,
    userId: string
): Promise<{ success: boolean; error?: string; organizationId?: string }> {
    try {
        const timestamp = new Date().toISOString();

        if (organizationId) {
            // Assert Edit permissions for this specific tenant (prevent parameter tampering IDOR)
            await assertUserTenantPermission(userId, organizationId, 'administrator');

            const flatData: Record<string, unknown> = { ...data };
            if (data.settings) {
                delete flatData.settings;
                for (const [k, v] of Object.entries(data.settings)) {
                    if (v !== undefined) {
                        flatData[`settings.${k}`] = v;
                    }
                }
            }

            // Update existing organization
            await adminDb.collection('organizations').doc(organizationId).update({
                ...flatData,
                updatedAt: timestamp,
                updatedBy: userId
            });

            return { success: true, organizationId };
        } else {
            // Validate required fields
            if (!data.name || !data.name.trim()) {
                return { success: false, error: 'Organization name is required' };
            }

            const baseSlug = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            // Ensure departments defaults to ['General'] if not provided or empty
            const departments = data.departments && data.departments.length > 0 
                ? data.departments 
                : ['General'];

            // To create an organization, user must have system_admin access
            const userRef = adminDb.collection('users').doc(userId);
            const userSnap = await userRef.get();
            if (!userSnap.exists || !userSnap.data()?.permissions?.includes('system_admin')) {
                return { success: false, error: 'Unauthorized: Only system administrators can build new organizations.' };
            }

            // Create new organization with high-entropy suffix namespaces
            const slug = `${baseSlug}-${generateEntropy()}`;
            const newOrgRef = adminDb.collection('organizations').doc(slug);
            
            // Check if organization with this exact slug already exists (extremely rare with entropy, but safe)
            const existingOrg = await newOrgRef.get();
            if (existingOrg.exists) {
                return { 
                    success: false, 
                    error: 'An organization namespace conflict occurred. Please try saving again.' 
                };
            }

            await newOrgRef.set({
                ...data,
                id: slug,
                slug,
                departments,
                status: data.status || 'active',
                createdAt: timestamp,
                updatedAt: timestamp,
                createdBy: userId,
                updatedBy: userId
            });

            // Provision defaults securely for new organization
            await provisionOrganizationDefaults(slug, userId);

            return { success: true, organizationId: slug };
        }
    } catch (error: unknown) {
        console.error('Error saving organization:', error);
        const err = error as { code?: string; message?: string };

        if (err.code === 'permission-denied') {
            return { success: false, error: 'Permission denied. Please check your Firebase security rules.' };
        }

        if (err.message?.includes('credentials')) {
            return {
                success: false,
                error: 'Firebase Admin credentials not configured. Please set up FIREBASE_SERVICE_ACCOUNT_KEY environment variable.',
            };
        }

        return { success: false, error: err.message || 'Failed to save organization' };
    }
}

/**
 * Delete an organization
 * Note: This should check for dependencies (workspaces, users, etc.)
 */
export async function deleteOrganizationAction(
    organizationId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Assert Admin permissions for this specific tenant (prevent parameter tampering IDOR)
        await assertUserTenantPermission(userId, organizationId, 'administrator');

        // Check if organization has any workspaces
        const workspacesSnapshot = await adminDb
            .collection('workspaces')
            .where('organizationId', '==', organizationId)
            .limit(1)
            .get();

        if (!workspacesSnapshot.empty) {
            return { 
                success: false, 
                error: 'Cannot delete organization with existing workspaces. Please delete all workspaces first.' 
            };
        }

        // Check if organization has any users
        const usersSnapshot = await adminDb
            .collection('users')
            .where('organizationId', '==', organizationId)
            .limit(1)
            .get();

        if (!usersSnapshot.empty) {
            return { 
                success: false, 
                error: 'Cannot delete organization with existing users. Please reassign or remove all users first.' 
            };
        }

        // Safe to delete
        await adminDb.collection('organizations').doc(organizationId).delete();

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting organization:', error);
        return { success: false, error: error.message || 'Failed to delete organization' };
    }
}

/**
 * Archive/Unarchive an organization
 */
export async function archiveOrganizationAction(
    organizationId: string,
    archive: boolean,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Assert Admin permissions
        await assertUserTenantPermission(userId, organizationId, 'administrator');

        await adminDb.collection('organizations').doc(organizationId).update({
            status: archive ? 'archived' : 'active',
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error archiving organization:', error);
        return { success: false, error: error.message || 'Failed to archive organization' };
    }
}

/**
 * Sets the default workspace for an organization
 */
export async function setOrganizationDefaultWorkspaceAction(
    organizationId: string,
    workspaceId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Assert Admin permissions
        await assertUserTenantPermission(userId, organizationId, 'administrator');

        await adminDb.collection('organizations').doc(organizationId).update({
            defaultWorkspaceId: workspaceId,
            updatedAt: new Date().toISOString(),
            updatedBy: userId
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error setting default workspace:', error);
        return { success: false, error: error.message || 'Failed to set default workspace' };
    }
}

/**
 * Provisions default roles, modules and zones for a new organization.
 * Uses a single atomic batch with parallel fetches to prevent waterfalls.
 */
async function provisionOrganizationDefaults(organizationId: string, userId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Hardcoded Zones.
    //    Note: "Unassigned" is a VIRTUAL sentinel zone (UNASSIGNED_ZONE), not a
    //    Firestore doc — the zones collection is shared across orgs by a fixed
    //    doc id would collide. Display surfaces inject the sentinel via
    //    withUnassignedZone(); entities store the constant {id,name} directly.
    const defaultZones = ['Zone 1', 'Zone 2', 'Zone 3'];
    for (const zoneName of defaultZones) {
        const ref = adminDb.collection('zones').doc();
        batch.set(ref, {
            name: zoneName,
            organizationId,
            isDefault: false
        });
    }

    // 2. Hardcoded Modules
    const defaultModules = [
        { name: 'Product 1', abbreviation: 'P1', color: '#3B5FFF', order: 0 },
        { name: 'Product 2', abbreviation: 'P2', color: '#10B981', order: 1 },
        { name: 'Product 3', abbreviation: 'P3', color: '#F59E0B', order: 2 }
    ];
    for (const mod of defaultModules) {
        const ref = adminDb.collection('modules').doc();
        batch.set(ref, {
            ...mod,
            organizationId,
            isDefault: false
        });
    }

    // 3. Hardcoded FER Roles
    const ferRoles = [
        { name: 'Administrator', description: 'Institutional Administrator with full oversight.', color: '#EF4444' },
        { name: 'Supervisor', description: 'Operations Supervisor managing day-to-day tracks.', color: '#8B5CF6' },
        { name: 'Finance Officer', description: 'Financial oversight and billing management.', color: '#10B981' }
    ];
    for (const role of ferRoles) {
        // NOTE: never seed 'system_admin' on org-scoped roles — it is the
        // PLATFORM super-admin token (rules isSystemAdmin() + org switcher).
        // Org administrators get the full operational set instead.
        const perms: AppPermissionId[] = role.name === 'Administrator'
            ? ['schools_view', 'schools_edit', 'prospects_view', 'finance_view', 'finance_manage',
               'contracts_delete', 'studios_view', 'studios_edit', 'dashboard_manage',
               'meetings_manage', 'tasks_manage', 'activities_view',
               'tags_view', 'tags_manage', 'tags_apply', 'forms_manage', 'fields_manage']
            : ['schools_view', 'activities_view'];
        
        const ref = adminDb.collection('roles').doc();
        batch.set(ref, {
            ...role,
            organizationId,
            workspaceIds: [], 
            permissions: perms,
            permissionsSchema: role.name === 'Administrator' ? getFullAdminPermissions() : migrateToPermissionsSchema(perms),
            createdAt: timestamp,
            updatedAt: timestamp,
            isDefault: false
        });
    }

    // 4. Clone Global Default Templates (Fetch templates in parallel via Promise.all)
    const [rolesSnap, modulesSnap, zonesSnap] = await Promise.all([
        adminDb.collection('roles').where('isDefault', '==', true).get(),
        adminDb.collection('modules').where('isDefault', '==', true).get(),
        adminDb.collection('zones').where('isDefault', '==', true).get()
    ]);

    // Clone global roles
    for (const doc of rolesSnap.docs) {
        const data = doc.data();
        const ref = adminDb.collection('roles').doc();
        batch.set(ref, {
            ...data,
            organizationId,
            isDefault: false,
            createdAt: timestamp,
            updatedAt: timestamp
        });
    }

    // Clone global modules
    for (const doc of modulesSnap.docs) {
        const data = doc.data();
        const ref = adminDb.collection('modules').doc();
        batch.set(ref, {
            ...data,
            organizationId,
            isDefault: false,
            createdAt: timestamp,
            updatedAt: timestamp
        });
    }

    // Clone global zones
    for (const doc of zonesSnap.docs) {
        const data = doc.data();
        const ref = adminDb.collection('zones').doc();
        batch.set(ref, {
            ...data,
            organizationId,
            isDefault: false
        });
    }

    // Commit all provisioned items atomically
    await batch.commit();
}
