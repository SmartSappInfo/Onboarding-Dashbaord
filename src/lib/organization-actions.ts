'use server';

import { adminDb } from './firebase-admin';
import type { Organization } from './types';

/**
 * Save (create or update) an organization
 */
export async function saveOrganizationAction(
    organizationId: string | null,
    data: Partial<Organization>,
    userId: string
): Promise<{ success: boolean; error?: string; organizationId?: string }> {
    try {
        // Validate required fields
        if (!data.name || !data.name.trim()) {
            return { success: false, error: 'Organization name is required' };
        }

        const timestamp = new Date().toISOString();
        const slug = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        if (organizationId) {
            // Update existing organization
            await adminDb.collection('organizations').doc(organizationId).update({
                ...data,
                slug,
                updatedAt: timestamp,
                updatedBy: userId
            });

            return { success: true, organizationId };
        } else {
            // Create new organization - use slug as ID for consistency
            const newOrgRef = adminDb.collection('organizations').doc(slug);
            
            // Check if organization with this slug already exists
            const existingOrg = await newOrgRef.get();
            if (existingOrg.exists) {
                return { 
                    success: false, 
                    error: 'An organization with this name already exists. Please choose a different name.' 
                };
            }

            await newOrgRef.set({
                ...data,
                id: slug,
                slug,
                status: data.status || 'active',
                createdAt: timestamp,
                updatedAt: timestamp,
                createdBy: userId,
                updatedBy: userId
            });

            // Provision defaults for new organization
            await provisionOrganizationDefaults(slug, userId);

            return { success: true, organizationId: slug };
        }
    } catch (error: any) {
        console.error('Error saving organization:', error);
        
        // Provide more specific error messages
        if (error.code === 'permission-denied') {
            return { success: false, error: 'Permission denied. Please check your Firebase security rules.' };
        }
        
        if (error.message?.includes('credentials')) {
            return { 
                success: false, 
                error: 'Firebase Admin credentials not configured. Please set up FIREBASE_SERVICE_ACCOUNT_KEY environment variable.' 
            };
        }
        
        return { success: false, error: error.message || 'Failed to save organization' };
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
    archive: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
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
 * Provisions default roles, modules and zones for a new organization
 */
async function provisionOrganizationDefaults(organizationId: string, userId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // 1. Hardcoded Zones
    const defaultZones = ['Zone 1', 'Zone 2', 'Zone 3'];
    for (const zoneName of defaultZones) {
        await adminDb.collection('zones').add({
            name: zoneName,
            organizationId,
            isDefault: false // These are instances, not templates
        });
    }

    // 2. Hardcoded Modules
    const defaultModules = [
        { name: 'Product 1', abbreviation: 'P1', color: '#3B5FFF', order: 0 },
        { name: 'Product 2', abbreviation: 'P2', color: '#10B981', order: 1 },
        { name: 'Product 3', abbreviation: 'P3', color: '#F59E0B', order: 2 }
    ];
    for (const mod of defaultModules) {
        await adminDb.collection('modules').add({
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
        await adminDb.collection('roles').add({
            ...role,
            organizationId,
            workspaceIds: [], // To be assigned by user
            permissions: ['users_view', 'entities_view'], // Basic default permissions
            createdAt: timestamp,
            updatedAt: timestamp,
            isDefault: false
        });
    }

    // 4. Clone Global Default Templates
    // Roles
    const defaultRolesSnapshot = await adminDb.collection('roles')
        .where('isDefault', '==', true)
        .get();
    
    for (const doc of defaultRolesSnapshot.docs) {
        const data = doc.data();
        await adminDb.collection('roles').add({
            ...data,
            organizationId,
            isDefault: false, // It's no longer a template in the new org
            createdAt: timestamp,
            updatedAt: timestamp
        });
    }

    // Modules
    const defaultModulesSnapshot = await adminDb.collection('modules')
        .where('isDefault', '==', true)
        .get();
    
    for (const doc of defaultModulesSnapshot.docs) {
        const data = doc.data();
        await adminDb.collection('modules').add({
            ...data,
            organizationId,
            isDefault: false,
            createdAt: timestamp,
            updatedAt: timestamp
        });
    }

    // Zones
    const defaultZonesSnapshot = await adminDb.collection('zones')
        .where('isDefault', '==', true)
        .get();
    
    for (const doc of defaultZonesSnapshot.docs) {
        const data = doc.data();
        await adminDb.collection('zones').add({
            ...data,
            organizationId,
            isDefault: false
        });
    }
}
