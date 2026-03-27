/**
 * Workspace-Scoped Tag Filtering
 * 
 * This module provides tag filtering functionality that queries workspace_entities
 * for workspace-scoped tags, implementing Requirement 7 and Requirement 8.
 * 
 * - Global tag filters query entities.globalTags
 * - Workspace tag filters query workspace_entities.workspaceTags
 * 
 * Requirements: 7 (Global vs. Workspace Tag Separation), 8 (Workspace-Scoped Queries)
 */

'use server';

import { adminDb } from './firebase-admin';
import type { TagFilterQuery } from './types';

/**
 * Queries entities by tag filter with workspace-aware logic
 * 
 * @param workspaceId - The workspace to filter within
 * @param filter - Tag filter query with logic (AND/OR/NOT) and scope
 * @param scope - "global" to filter by entities.globalTags, "workspace" to filter by workspace_entities.workspaceTags
 * 
 * Returns array of entity IDs that match the filter
 * 
 * Requirements: 7, 8
 */
export async function getEntitiesByTagsAction(
  workspaceId: string,
  filter: TagFilterQuery,
  scope: 'global' | 'workspace' = 'workspace'
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const { tagIds, logic } = filter;

    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required' };
    }

    if (!tagIds || tagIds.length === 0) {
      return { success: false, error: 'tagIds array cannot be empty' };
    }

    const entityIds = new Set<string>();

    if (scope === 'workspace') {
      // Query workspace_entities.workspaceTags (Requirement 7, 8)
      if (logic === 'OR') {
        // OR logic: use array-contains-any (up to 10 tags)
        const chunks = [];
        for (let i = 0; i < tagIds.length; i += 10) {
          chunks.push(tagIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const weSnap = await adminDb
            .collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .where('workspaceTags', 'array-contains-any', chunk)
            .get();

          weSnap.docs.forEach(doc => entityIds.add(doc.data().entityId));
        }
      } else if (logic === 'AND') {
        // AND logic: query for first tag, then filter client-side for remaining tags
        const firstTagSnap = await adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .where('workspaceTags', 'array-contains', tagIds[0])
          .get();

        const remainingTagIds = tagIds.slice(1);

        firstTagSnap.docs.forEach(doc => {
          const workspaceTags: string[] = doc.data().workspaceTags || [];
          const hasAllTags = remainingTagIds.every(tagId => workspaceTags.includes(tagId));
          if (hasAllTags) {
            entityIds.add(doc.data().entityId);
          }
        });
      } else if (logic === 'NOT') {
        // NOT logic: get all entities in workspace, subtract those with any of the tags
        const allWeSnap = await adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .get();

        const excludedEntityIds = new Set<string>();

        // Find entities that have any of the excluded tags
        const chunks = [];
        for (let i = 0; i < tagIds.length; i += 10) {
          chunks.push(tagIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const excludedSnap = await adminDb
            .collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .where('workspaceTags', 'array-contains-any', chunk)
            .get();

          excludedSnap.docs.forEach(doc => excludedEntityIds.add(doc.data().entityId));
        }

        // Add entities that are NOT in the excluded set
        allWeSnap.docs.forEach(doc => {
          const entityId = doc.data().entityId;
          if (!excludedEntityIds.has(entityId)) {
            entityIds.add(entityId);
          }
        });
      }
    } else {
      // Query entities.globalTags (Requirement 7, 8)
      if (logic === 'OR') {
        // OR logic: use array-contains-any (up to 10 tags)
        const chunks = [];
        for (let i = 0; i < tagIds.length; i += 10) {
          chunks.push(tagIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const entitiesSnap = await adminDb
            .collection('entities')
            .where('globalTags', 'array-contains-any', chunk)
            .get();

          entitiesSnap.docs.forEach(doc => {
            // Verify entity is in the workspace
            entityIds.add(doc.id);
          });
        }

        // Filter to only entities that are in the workspace
        const workspaceEntityIds = new Set<string>();
        const weSnap = await adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .get();

        weSnap.docs.forEach(doc => workspaceEntityIds.add(doc.data().entityId));

        // Keep only entities that are in both sets
        const filteredEntityIds = new Set<string>();
        entityIds.forEach(id => {
          if (workspaceEntityIds.has(id)) {
            filteredEntityIds.add(id);
          }
        });

        return { success: true, data: Array.from(filteredEntityIds) };
      } else if (logic === 'AND') {
        // AND logic: query for first tag, then filter client-side for remaining tags
        const firstTagSnap = await adminDb
          .collection('entities')
          .where('globalTags', 'array-contains', tagIds[0])
          .get();

        const remainingTagIds = tagIds.slice(1);

        firstTagSnap.docs.forEach(doc => {
          const globalTags: string[] = doc.data().globalTags || [];
          const hasAllTags = remainingTagIds.every(tagId => globalTags.includes(tagId));
          if (hasAllTags) {
            entityIds.add(doc.id);
          }
        });

        // Filter to only entities that are in the workspace
        const workspaceEntityIds = new Set<string>();
        const weSnap = await adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .get();

        weSnap.docs.forEach(doc => workspaceEntityIds.add(doc.data().entityId));

        const filteredEntityIds = new Set<string>();
        entityIds.forEach(id => {
          if (workspaceEntityIds.has(id)) {
            filteredEntityIds.add(id);
          }
        });

        return { success: true, data: Array.from(filteredEntityIds) };
      } else if (logic === 'NOT') {
        // NOT logic: get all entities in workspace, subtract those with any of the excluded global tags
        const weSnap = await adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .get();

        const workspaceEntityIds = new Set<string>();
        weSnap.docs.forEach(doc => workspaceEntityIds.add(doc.data().entityId));

        const excludedEntityIds = new Set<string>();

        // Find entities that have any of the excluded tags
        const chunks = [];
        for (let i = 0; i < tagIds.length; i += 10) {
          chunks.push(tagIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const excludedSnap = await adminDb
            .collection('entities')
            .where('globalTags', 'array-contains-any', chunk)
            .get();

          excludedSnap.docs.forEach(doc => excludedEntityIds.add(doc.id));
        }

        // Add entities that are in workspace but NOT in the excluded set
        workspaceEntityIds.forEach(entityId => {
          if (!excludedEntityIds.has(entityId)) {
            entityIds.add(entityId);
          }
        });
      }
    }

    return { success: true, data: Array.from(entityIds) };
  } catch (error: any) {
    console.error('getEntitiesByTagsAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets combined tag data for an entity (both global and workspace tags)
 * 
 * @param entityId - The entity ID
 * @param workspaceId - The workspace ID
 * 
 * Returns both globalTags and workspaceTags with their metadata
 * 
 * Requirements: 7
 */
export async function getCombinedEntityTagsAction(
  entityId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  globalTags?: Array<{ id: string; name: string; scope: 'global' }>;
  workspaceTags?: Array<{ id: string; name: string; scope: 'workspace' }>;
  error?: string;
}> {
  try {
    // Get entity global tags
    const entitySnap = await adminDb.collection('entities').doc(entityId).get();

    if (!entitySnap.exists) {
      return { success: false, error: 'Entity not found' };
    }

    const entity = entitySnap.data();
    const globalTagIds: string[] = entity?.globalTags || [];

    // Get workspace tags
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    const workspaceTagIds: string[] = weSnap.empty ? [] : (weSnap.docs[0].data()?.workspaceTags || []);

    // Resolve tag names
    const allTagIds = Array.from(new Set([...globalTagIds, ...workspaceTagIds]));
    const tagNameMap = new Map<string, string>();

    if (allTagIds.length > 0) {
      const chunkSize = 10;
      for (let i = 0; i < allTagIds.length; i += chunkSize) {
        const chunk = allTagIds.slice(i, i + chunkSize);
        const tagsSnap = await adminDb
          .collection('tags')
          .where('__name__', 'in', chunk)
          .get();

        tagsSnap.docs.forEach(doc => {
          tagNameMap.set(doc.id, doc.data().name);
        });
      }
    }

    const globalTags = globalTagIds.map(id => ({
      id,
      name: tagNameMap.get(id) || id,
      scope: 'global' as const,
    }));

    const workspaceTags = workspaceTagIds.map(id => ({
      id,
      name: tagNameMap.get(id) || id,
      scope: 'workspace' as const,
    }));

    return {
      success: true,
      globalTags,
      workspaceTags,
    };
  } catch (error: any) {
    console.error('getCombinedEntityTagsAction error:', error);
    return { success: false, error: error.message };
  }
}
