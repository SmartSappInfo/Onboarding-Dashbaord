'use server';

import { adminDb } from './firebase-admin';
import type { EntityContact } from './types';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import { EntitySyncGateway } from '@/lib/services/entity-sync-gateway';

/**
 * Profile Update Actions
 * 
 * Routes profile updates to the correct collections based on field type:
 * - Identity fields (name, contacts, globalTags) → entities collection
 * - Operational fields (pipelineId, stageId, assignedTo, workspaceTags) → workspace_entities collection
 * 
 * Requirements: 11.4, 11.5
 */

interface UpdateProfileInput {
  entityId: string;
  workspaceId: string;
  updates: {
    // Identity fields (go to entities)
    name?: string;
    contacts?: EntityContact[];
    entityContacts?: EntityContact[];
    globalTags?: string[];
    
    // Operational fields (go to workspace_entities)
    pipelineId?: string;
    stageId?: string;
    assignedTo?: {
      userId: string | null;
      name: string | null;
      email: string | null;
    };
    workspaceTags?: string[];
    status?: 'active' | 'archived';
    
    // Additional domain fields (strictly typed Record)
    [key: string]: unknown;
  };
}

/**
 * Update profile with atomic synchronization to entities and workspace_entities collections.
 * Routes identity modifications through EntitySyncGateway to guarantee that all linked
 * tenant workspace projections remain in lockstep.
 * 
 * Requirements: 11.4, 11.5, Rule 10 (Strict Typing & Zero-Drift Guarantee)
 */
export async function updateProfile(input: UpdateProfileInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { entityId, workspaceId, updates } = input;
    
    // Separate identity and operational fields
    const identityFields: Record<string, unknown> = {};
    const operationalFields: Record<string, unknown> = {};
    const extraFields: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'name' || key === 'contacts' || key === 'entityContacts' || key === 'globalTags') {
        identityFields[key] = value;
      } else if (key === 'pipelineId' || key === 'stageId' || key === 'assignedTo' || key === 'workspaceTags' || key === 'status') {
        operationalFields[key] = value;
      } else {
        extraFields[key] = value;
      }
    }
    
    // If identity fields are present, route through EntitySyncGateway for atomic batch synchronization
    if (entityId && Object.keys(identityFields).length > 0) {
      const contactsToSync = (identityFields.entityContacts || identityFields.contacts) as EntityContact[] | undefined;
      const syncRes = await EntitySyncGateway.syncEntityAndWorkspaces(
        entityId,
        {
          name: identityFields.name as string | undefined,
          entityContacts: contactsToSync,
          globalTags: identityFields.globalTags as string[] | undefined,
          customData: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        },
        {
          sourceWorkspaceId: workspaceId,
          workspaceUpdates: {
            assignedTo: operationalFields.assignedTo as UpdateProfileInput['updates']['assignedTo'],
            workspaceTags: operationalFields.workspaceTags as string[] | undefined,
            status: operationalFields.status as 'active' | 'archived' | undefined,
          },
        }
      );

      if (!syncRes.success) {
        return { success: false, error: syncRes.error };
      }

      // If there are remaining operational fields like pipelineId or stageId, update workspace_entity doc
      if (operationalFields.pipelineId !== undefined || operationalFields.stageId !== undefined) {
        const weQuery = await adminDb
          .collection('workspace_entities')
          .where('entityId', '==', entityId)
          .where('workspaceId', '==', workspaceId)
          .limit(1)
          .get();

        if (!weQuery.empty) {
          const opsUpdate: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
          };
          if (operationalFields.pipelineId !== undefined) opsUpdate.pipelineId = operationalFields.pipelineId;
          if (operationalFields.stageId !== undefined) opsUpdate.stageId = operationalFields.stageId;
          await weQuery.docs[0].ref.update(opsUpdate);
        }
      }

      return { success: true };
    }
    
    // Operational-only updates (no identity changes)
    if (entityId && Object.keys(operationalFields).length > 0) {
      const weQuery = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();
      
      if (!weQuery.empty) {
        const weRef = weQuery.docs[0].ref;
        await weRef.update({
          ...operationalFields,
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    return { success: true };
  } catch (error: unknown) {
    console.error('[PROFILE] Update failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Update only identity fields (routes to entities collection and atomically propagates
 * to all linked workspace_entities via EntitySyncGateway).
 * 
 * @param entityId - Entity ID
 * @param updates - Identity field updates
 * @returns Success status
 */
export async function updateEntityIdentity(
  entityId: string,
  updates: {
    name?: string;
    contacts?: EntityContact[];
    entityContacts?: EntityContact[];
    globalTags?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const syncRes = await EntitySyncGateway.syncEntityAndWorkspaces(entityId, {
      name: updates.name,
      entityContacts: updates.entityContacts || updates.contacts,
      globalTags: updates.globalTags,
    });

    if (!syncRes.success) {
      return { success: false, error: syncRes.error };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[PROFILE] Entity identity update failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Update only operational fields (routes to workspace_entities collection)
 * 
 * @param entityId - Entity ID
 * @param workspaceId - Workspace ID
 * @param updates - Operational field updates
 * @returns Success status
 */
export async function updateWorkspaceEntityOperations(
  entityId: string,
  workspaceId: string,
  updates: {
    pipelineId?: string;
    stageId?: string;
    assignedTo?: {
      userId: string | null;
      name: string | null;
      email: string | null;
    };
    workspaceTags?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    // Find workspace_entity record
    const weQuery = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();
    
    if (weQuery.empty) {
      return { success: false, error: 'Workspace entity not found' };
    }
    
    const weRef = weQuery.docs[0].ref;
    await weRef.update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: unknown) {
    console.error('[PROFILE] Workspace entity operations update failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
