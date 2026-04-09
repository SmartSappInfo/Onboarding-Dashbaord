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
