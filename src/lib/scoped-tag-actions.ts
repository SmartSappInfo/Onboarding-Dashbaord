/**
 * Scoped Tag Actions for Entity and Workspace Entity Models
 * 
 * This module provides tag application and removal logic that respects
 * the global vs workspace tag separation defined in Requirement 7.
 * 
 * - Global tags are stored in entities.globalTags (identity-level)
 * - Workspace tags are stored in workspace_entities.workspaceTags (operational)
 * 
 * Requirements: 7 (Global vs. Workspace Tag Separation)
 */

'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Entity, WorkspaceEntity } from './types';

/**
 * Applies tags to an entity, automatically determining scope from tag definitions
 * 
 * This function reads each tag's designated scope from the tags collection and writes to:
 * - entities.globalTags for tags with scope="global"
 * - workspace_entities.workspaceTags for tags with scope="workspace"
 * 
 * @param entityId - The entity ID to tag
 * @param tagIds - Array of tag IDs to apply
 * @param workspaceId - Required for workspace-scoped tags
 * @param userId - User performing the action
 */
export async function applyTagAction(
  entityId: string,
  tagIds: string[],
  workspaceId: string | null,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!entityId || !tagIds || tagIds.length === 0 || !userId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const timestamp = new Date().toISOString();

    // Fetch tag definitions to determine their scopes
    const tagRefs = tagIds.map(id => adminDb.collection('tags').doc(id));
    const tagSnaps = await Promise.all(tagRefs.map(ref => ref.get()));
    
    const globalTagIds: string[] = [];
    const workspaceTagIds: string[] = [];
    
    for (let i = 0; i < tagSnaps.length; i++) {
      const tagSnap = tagSnaps[i];
      if (!tagSnap.exists) {
        console.warn(`Tag ${tagIds[i]} not found, skipping`);
        continue;
      }
      
      const tag = tagSnap.data();
      const tagScope = tag?.scope || 'workspace'; // Default to workspace if not specified
      
      if (tagScope === 'global') {
        globalTagIds.push(tagIds[i]);
      } else {
        workspaceTagIds.push(tagIds[i]);
      }
    }

    // Apply global tags
    if (globalTagIds.length > 0) {
      // Apply to entities.globalTags
      const entityRef = adminDb.collection('entities').doc(entityId);
      const entitySnap = await entityRef.get();

      if (!entitySnap.exists) {
        return { success: false, error: 'Entity not found' };
      }

      const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
      const globalTags = new Set<string>(entity.globalTags || []);
      
      // Add new tags
      const newGlobalTags: string[] = [];
      globalTagIds.forEach(tagId => {
        if (!globalTags.has(tagId)) {
          globalTags.add(tagId);
          newGlobalTags.push(tagId);
        }
      });

      if (newGlobalTags.length > 0) {
        await entityRef.update({
          globalTags: Array.from(globalTags),
          updatedAt: timestamp,
        });

        // Increment usage counts
        const usageBatch = adminDb.batch();
        for (const tagId of newGlobalTags) {
          usageBatch.update(adminDb.collection('tags').doc(tagId), {
            usageCount: FieldValue.increment(1),
          });
        }
        await usageBatch.commit();

        console.log(`✅ Applied ${newGlobalTags.length} global tags to entity ${entityId}`);
      }
    }

    // Apply workspace tags
    if (workspaceTagIds.length > 0) {
      if (!workspaceId) {
        return { success: false, error: 'workspaceId is required for workspace-scoped tags' };
      }

      // Apply to workspace_entities.workspaceTags
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (weSnap.empty) {
        return { success: false, error: 'Workspace-entity relationship not found' };
      }

      const weDoc = weSnap.docs[0];
      const workspaceEntity = { id: weDoc.id, ...weDoc.data() } as WorkspaceEntity;
      const workspaceTags = new Set<string>(workspaceEntity.workspaceTags || []);

      // Add new tags
      const newWorkspaceTags: string[] = [];
      workspaceTagIds.forEach(tagId => {
        if (!workspaceTags.has(tagId)) {
          workspaceTags.add(tagId);
          newWorkspaceTags.push(tagId);
        }
      });

      if (newWorkspaceTags.length > 0) {
        await weDoc.ref.update({
          workspaceTags: Array.from(workspaceTags),
          updatedAt: timestamp,
        });

        // Increment usage counts
        const usageBatch = adminDb.batch();
        for (const tagId of newWorkspaceTags) {
          usageBatch.update(adminDb.collection('tags').doc(tagId), {
            usageCount: FieldValue.increment(1),
          });
        }
        await usageBatch.commit();

        console.log(`✅ Applied ${newWorkspaceTags.length} workspace tags to entity ${entityId} in workspace ${workspaceId}`);
      }
    }

    revalidatePath(`/admin/contacts/${entityId}`);
    if (workspaceId) {
      revalidatePath(`/admin/workspaces/${workspaceId}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error('applyTagAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Removes tags from an entity, automatically determining scope from tag definitions
 * 
 * This function reads each tag's designated scope from the tags collection and removes from:
 * - entities.globalTags for tags with scope="global"
 * - workspace_entities.workspaceTags for tags with scope="workspace"
 * 
 * Ensures that:
 * - Removing a workspace tag does NOT remove the global tag
 * - Removing a global tag does NOT remove workspace tags
 * 
 * @param entityId - The entity ID to untag
 * @param tagIds - Array of tag IDs to remove
 * @param workspaceId - Required for workspace-scoped tags
 * @param userId - User performing the action
 */
export async function removeTagAction(
  entityId: string,
  tagIds: string[],
  workspaceId: string | null,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!entityId || !tagIds || tagIds.length === 0 || !userId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const timestamp = new Date().toISOString();

    // Fetch tag definitions to determine their scopes
    const tagRefs = tagIds.map(id => adminDb.collection('tags').doc(id));
    const tagSnaps = await Promise.all(tagRefs.map(ref => ref.get()));
    
    const globalTagIds: string[] = [];
    const workspaceTagIds: string[] = [];
    
    for (let i = 0; i < tagSnaps.length; i++) {
      const tagSnap = tagSnaps[i];
      if (!tagSnap.exists) {
        console.warn(`Tag ${tagIds[i]} not found, skipping`);
        continue;
      }
      
      const tag = tagSnap.data();
      const tagScope = tag?.scope || 'workspace'; // Default to workspace if not specified
      
      if (tagScope === 'global') {
        globalTagIds.push(tagIds[i]);
      } else {
        workspaceTagIds.push(tagIds[i]);
      }
    }

    // Remove global tags
    if (globalTagIds.length > 0) {
      // Remove from entities.globalTags
      const entityRef = adminDb.collection('entities').doc(entityId);
      const entitySnap = await entityRef.get();

      if (!entitySnap.exists) {
        return { success: false, error: 'Entity not found' };
      }

      const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
      const globalTags = new Set<string>(entity.globalTags || []);
      
      // Remove tags
      const removedGlobalTags: string[] = [];
      globalTagIds.forEach(tagId => {
        if (globalTags.has(tagId)) {
          globalTags.delete(tagId);
          removedGlobalTags.push(tagId);
        }
      });

      if (removedGlobalTags.length > 0) {
        await entityRef.update({
          globalTags: Array.from(globalTags),
          updatedAt: timestamp,
        });

        // Decrement usage counts
        const usageBatch = adminDb.batch();
        for (const tagId of removedGlobalTags) {
          usageBatch.update(adminDb.collection('tags').doc(tagId), {
            usageCount: FieldValue.increment(-1),
          });
        }
        await usageBatch.commit();

        console.log(`✅ Removed ${removedGlobalTags.length} global tags from entity ${entityId}`);
      }
    }

    // Remove workspace tags
    if (workspaceTagIds.length > 0) {
      if (!workspaceId) {
        return { success: false, error: 'workspaceId is required for workspace-scoped tags' };
      }

      // Remove from workspace_entities.workspaceTags
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (weSnap.empty) {
        return { success: false, error: 'Workspace-entity relationship not found' };
      }

      const weDoc = weSnap.docs[0];
      const workspaceEntity = { id: weDoc.id, ...weDoc.data() } as WorkspaceEntity;
      const workspaceTags = new Set<string>(workspaceEntity.workspaceTags || []);

      // Remove tags
      const removedWorkspaceTags: string[] = [];
      workspaceTagIds.forEach(tagId => {
        if (workspaceTags.has(tagId)) {
          workspaceTags.delete(tagId);
          removedWorkspaceTags.push(tagId);
        }
      });

      if (removedWorkspaceTags.length > 0) {
        await weDoc.ref.update({
          workspaceTags: Array.from(workspaceTags),
          updatedAt: timestamp,
        });

        // Decrement usage counts
        const usageBatch = adminDb.batch();
        for (const tagId of removedWorkspaceTags) {
          usageBatch.update(adminDb.collection('tags').doc(tagId), {
            usageCount: FieldValue.increment(-1),
          });
        }
        await usageBatch.commit();

        console.log(`✅ Removed ${removedWorkspaceTags.length} workspace tags from entity ${entityId} in workspace ${workspaceId}`);
      }
    }

    revalidatePath(`/admin/contacts/${entityId}`);
    if (workspaceId) {
      revalidatePath(`/admin/workspaces/${workspaceId}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error('removeTagAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets all tags for an entity, separated by scope
 * 
 * @param entityId - The entity ID
 * @param workspaceId - Optional workspace ID to include workspace tags
 */
export async function getEntityTagsAction(
  entityId: string,
  workspaceId?: string
): Promise<{
  success: boolean;
  globalTags?: string[];
  workspaceTags?: string[];
  error?: string;
}> {
  try {
    // Get entity global tags
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) {
      return { success: false, error: 'Entity not found' };
    }

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
    const globalTags = entity.globalTags || [];

    // Get workspace tags if workspaceId provided
    let workspaceTags: string[] = [];
    if (workspaceId) {
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        const workspaceEntity = { id: weSnap.docs[0].id, ...weSnap.docs[0].data() } as WorkspaceEntity;
        workspaceTags = workspaceEntity.workspaceTags || [];
      }
    }

    return {
      success: true,
      globalTags,
      workspaceTags,
    };
  } catch (error: any) {
    console.error('getEntityTagsAction error:', error);
    return { success: false, error: error.message };
  }
}
