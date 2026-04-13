'use server';

import { adminDb } from './firebase-admin';
import type { FocalPerson, EntityType } from './types';

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
    contacts?: FocalPerson[];
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
    
    // Legacy school fields (for backward compatibility)
    [key: string]: any;
  };
}

/**
 * Update profile with proper routing to entities and workspace_entities collections
 * 
 * @param input - Profile update input with field routing
 * @returns Success status
 */
export async function updateProfile(input: UpdateProfileInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { entityId, workspaceId, updates } = input;
    
    // Separate identity and operational fields
    const identityFields: Record<string, any> = {};
    const operationalFields: Record<string, any> = {};
    const legacyFields: Record<string, any> = {};
    
    // Route fields to appropriate collections
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'name' || key === 'contacts' || key === 'globalTags') {
        identityFields[key] = value;
      } else if (key === 'pipelineId' || key === 'stageId' || key === 'assignedTo' || key === 'workspaceTags') {
        operationalFields[key] = value;
      } else {
        legacyFields[key] = value;
      }
    }
    
    // Update entities collection if we have identity fields and entityId
    if (entityId && Object.keys(identityFields).length > 0) {
      const entityRef = adminDb.collection('entities').doc(entityId);
      await entityRef.update({
        ...identityFields,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Update workspace_entities collection if we have operational fields and entityId
    if (entityId && Object.keys(operationalFields).length > 0) {
      // Find workspace_entity record
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
    
    // Always update legacy schools collection for backward compatibility
    const schoolRef = adminDb.collection('schools').doc(entityId);
    await schoolRef.update({
      ...legacyFields,
      ...identityFields,
      ...operationalFields,
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[PROFILE] Update failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update only identity fields (routes to entities collection)
 * 
 * @param entityId - Entity ID
 * @param updates - Identity field updates
 * @returns Success status
 */
export async function updateEntityIdentity(
  entityId: string,
  updates: {
    name?: string;
    contacts?: FocalPerson[];
    globalTags?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const entityRef = adminDb.collection('entities').doc(entityId);
    await entityRef.update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[PROFILE] Entity identity update failed:', error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('[PROFILE] Workspace entity operations update failed:', error);
    return { success: false, error: error.message };
  }
}
