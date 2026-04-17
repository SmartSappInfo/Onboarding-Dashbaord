'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Workspace } from './types';
import { resolveTerminologyFromWorkspace } from './terminology';

/**
 * @fileOverview Server-side actions for Workspace Management.
 */

/**
 * Resolves terminology for a workspace (Server Action for public portals)
 */
export async function getTerminologyAction(workspaceId: string) {
    if (!workspaceId) return resolveTerminologyFromWorkspace(null);
    try {
        const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
        if (!snap.exists) return resolveTerminologyFromWorkspace(null);
        return resolveTerminologyFromWorkspace(snap.data());
    } catch (e) {
        console.error(`[TERMINOLOGY] Resolution failed for ${workspaceId}:`, e);
        return resolveTerminologyFromWorkspace(null);
    }
}

/**
 * Creates or updates a Workspace.
 */
export async function saveWorkspaceAction(id: string | null, data: Partial<Workspace>, userId: string) {
    try {
        const timestamp = new Date().toISOString();
        const slug = data.name?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Validate contactScope if provided
        if (data.contactScope && !['institution', 'family', 'person'].includes(data.contactScope)) {
            throw new Error("Invalid contactScope. Must be one of: institution, family, person");
        }

        // Set default capabilities if not provided
        const capabilities = data.capabilities || {
            billing: true,
            admissions: true,
            children: true,
            contracts: true,
            messaging: true,
            automations: true,
            tasks: true
        };
        
        const payload = {
            ...data,
            slug,
            capabilities,
            updatedAt: timestamp,
        };

        if (id) {
            // Check if attempting to change contactScope on a locked workspace
            if (data.contactScope !== undefined) {
                const workspaceSnap = await adminDb.collection('workspaces').doc(id).get();
                if (workspaceSnap.exists) {
                    const workspace = workspaceSnap.data() as Workspace;
                    
                    // If scopeLocked is true and contactScope is being changed, reject
                    if (workspace.scopeLocked && workspace.contactScope !== data.contactScope) {
                        return {
                            success: false,
                            error: "Scope cannot be changed after activation. Create a new workspace and migrate records intentionally."
                        };
                    }
                }
            }
            
            await adminDb.collection('workspaces').doc(id).update(payload);
            revalidatePath('/admin/settings');
            return { success: true, id };
        } else {
            const newId = slug || `workspace_${Date.now()}`;
            const docRef = adminDb.collection('workspaces').doc(newId);
            
            // Check for collision
            const existing = await docRef.get();
            if (existing.exists) throw new Error("A workspace with this name already exists.");

            await docRef.set({
                ...payload,
                id: newId,
                status: 'active',
                scopeLocked: false,
                createdAt: timestamp
            });

            // Check if organization has a default workspace. If not, set this one as default.
            if (data.organizationId) {
                const orgRef = adminDb.collection('organizations').doc(data.organizationId);
                const orgSnap = await orgRef.get();
                if (orgSnap.exists) {
                    const orgData = orgSnap.data();
                    if (!orgData?.defaultWorkspaceId) {
                        await orgRef.update({
                            defaultWorkspaceId: newId,
                            updatedAt: timestamp
                        });
                    }
                }
            }

            await logActivity({
                entityId: '',
                organizationId: 'default',
                userId,
                workspaceId: 'system',
                type: 'school_created',
                source: 'user_action',
                description: `architected new workspace: "${data.name}"`
            });

            revalidatePath('/admin/settings');
            return { success: true, id: newId };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Attempts to delete a workspace. 
 */
export async function deleteWorkspaceAction(id: string, userId: string) {
    try {
        const db = adminDb;
        
        // Audit associated data
        const entitiesCount = (await db.collection('workspace_entities').where('workspaceId', '==', id).limit(1).get()).size;
        const tasksCount = (await db.collection('tasks').where('workspaceId', '==', id).limit(1).get()).size;
        const pipelinesCount = (await db.collection('pipelines').where('workspaceId', '==', id).limit(1).get()).size;
        const activitiesCount = (await db.collection('activities').where('workspaceId', '==', id).limit(1).get()).size;

        const associations = [];
        if (entitiesCount > 0) associations.push("Entities");
        if (tasksCount > 0) associations.push("CRM Tasks");
        if (pipelinesCount > 0) associations.push("Pipelines/Workflows");
        if (activitiesCount > 0) associations.push("Activity Logs");

        if (associations.length > 0) {
            return { 
                success: false, 
                error: `Deletion rejected. Workspace has active associations in: ${associations.join(', ')}.`,
                canArchive: true 
            };
        }

        await db.collection('workspaces').doc(id).delete();
        revalidatePath('/admin/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Archives a workspace.
 */
export async function archiveWorkspaceAction(id: string, archive: boolean) {
    try {
        await adminDb.collection('workspaces').doc(id).update({
            status: archive ? 'archived' : 'active',
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates workspace contactScope.
 * Only allowed if workspace has zero active workspace_entities and scopeLocked is false.
 */
export async function updateWorkspaceScopeAction(
    workspaceId: string, 
    newContactScope: 'institution' | 'family' | 'person',
    userId: string
) {
    try {
        // Validate contactScope
        if (!['institution', 'family', 'person'].includes(newContactScope)) {
            throw new Error("Invalid contactScope. Must be one of: institution, family, person");
        }

        // Get workspace to check scopeLocked status
        const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        if (!workspaceSnap.exists) {
            return {
                success: false,
                error: "Workspace not found"
            };
        }

        const workspace = workspaceSnap.data() as Workspace;

        // Check if scope is locked
        if (workspace.scopeLocked) {
            return {
                success: false,
                error: "Scope cannot be changed after activation. Create a new workspace and migrate records intentionally."
            };
        }

        // Check if workspace has any active workspace_entities
        const activeEntitiesSnapshot = await adminDb
            .collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (!activeEntitiesSnapshot.empty) {
            return {
                success: false,
                error: "Scope cannot be changed after activation. Create a new workspace and migrate records intentionally."
            };
        }

        // Update the workspace contactScope
        await adminDb.collection('workspaces').doc(workspaceId).update({
            contactScope: newContactScope,
            updatedAt: new Date().toISOString()
        });

        await logActivity({
            entityId: '',
            organizationId: 'default',
            userId,
            workspaceId,
            type: 'workspace_scope_updated',
            source: 'user_action',
            description: `Updated workspace scope to: ${newContactScope}`
        });

        revalidatePath('/admin/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
