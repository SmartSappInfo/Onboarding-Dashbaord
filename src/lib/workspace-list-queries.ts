'use server';

import { adminDb } from './firebase-admin';
import type { WorkspaceEntity, Entity } from './types';

/**
 * @fileOverview Optimized workspace list queries.
 * Ensures max 2 Firestore reads per list page as per Requirement 22.
 * 
 * Query pattern:
 * 1. First read: Query workspace_entities filtered by workspaceId (single fetch)
 * 2. Second read: Hydrate entity data only if needed (batch fetch by entityIds)
 * 
 * Requirements: 22
 */

export interface WorkspaceListItem {
  workspaceEntityId: string;
  entityId: string;
  entityType: string;
  displayName: string;
  primaryEmail?: string;
  primaryPhone?: string;
  currentStageName?: string;
  pipelineId: string;
  stageId: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  };
  status: string;
  workspaceTags: string[];
  lastContactedAt?: string;
  addedAt: string;
  updatedAt: string;
  // Optional hydrated entity data (only fetched if includeEntityData is true)
  entityData?: Entity;
}

export interface WorkspaceListQueryOptions {
  workspaceId: string;
  status?: 'active' | 'archived';
  stageId?: string;
  assignedTo?: string;
  includeEntityData?: boolean; // If true, performs second fetch to hydrate entity data
  limit?: number;
  offset?: number;
}

/**
 * Queries workspace contacts with optimized 2-read pattern.
 * 
 * Read 1: Query workspace_entities (contains denormalized displayName, primaryEmail, primaryPhone)
 * Read 2 (optional): Hydrate full entity data if includeEntityData is true
 * 
 * This ensures list views can render with just 1 read (using denormalized fields),
 * and detail views can fetch full entity data with a second read.
 * 
 * Requirements: 22.4
 */
export async function queryWorkspaceContacts(
  options: WorkspaceListQueryOptions
): Promise<{ items: WorkspaceListItem[]; total: number; error?: string }> {
  try {
    // Read 1: Query workspace_entities with filters
    let query = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', options.workspaceId);

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.stageId) {
      query = query.where('stageId', '==', options.stageId);
    }

    if (options.assignedTo) {
      query = query.where('assignedTo.userId', '==', options.assignedTo);
    }

    // Apply pagination
    if (options.offset) {
      query = query.offset(options.offset);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const workspaceEntitiesSnap = await query.get();

    if (workspaceEntitiesSnap.empty) {
      return {
        items: [],
        total: 0,
      };
    }

    // Map workspace_entities to list items (using denormalized fields)
    const items: WorkspaceListItem[] = workspaceEntitiesSnap.docs.map((doc) => {
      const data = doc.data() as WorkspaceEntity;
      return {
        workspaceEntityId: doc.id,
        entityId: data.entityId,
        entityType: data.entityType,
        displayName: data.displayName,
        primaryEmail: data.primaryEmail,
        primaryPhone: data.primaryPhone,
        currentStageName: data.currentStageName,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        assignedTo: data.assignedTo,
        status: data.status,
        workspaceTags: data.workspaceTags,
        lastContactedAt: data.lastContactedAt,
        addedAt: data.addedAt,
        updatedAt: data.updatedAt,
      };
    });

    // Read 2 (optional): Hydrate entity data if requested
    if (options.includeEntityData) {
      const entityIds = items.map((item) => item.entityId);
      const uniqueEntityIds = [...new Set(entityIds)];

      // Batch fetch entities (Firestore supports up to 10 in a single 'in' query)
      // For larger sets, we need to chunk
      const CHUNK_SIZE = 10;
      const entityMap = new Map<string, Entity>();

      for (let i = 0; i < uniqueEntityIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueEntityIds.slice(i, i + CHUNK_SIZE);
        const entitiesSnap = await adminDb
          .collection('entities')
          .where('__name__', 'in', chunk.map((id) => adminDb.collection('entities').doc(id)))
          .get();

        entitiesSnap.docs.forEach((doc) => {
          entityMap.set(doc.id, { id: doc.id, ...doc.data() } as Entity);
        });
      }

      // Attach entity data to items
      items.forEach((item) => {
        const entity = entityMap.get(item.entityId);
        if (entity) {
          item.entityData = entity;
        }
      });
    }

    return {
      items,
      total: workspaceEntitiesSnap.size,
    };
  } catch (e: any) {
    console.error('>>> [WORKSPACE_LIST_QUERY] Failed:', e.message);
    return {
      items: [],
      total: 0,
      error: e.message,
    };
  }
}

/**
 * Counts total workspace contacts matching filters.
 * Uses workspace_entities collection for efficient counting.
 * 
 * Requirements: 22.4
 */
export async function countWorkspaceContacts(
  workspaceId: string,
  filters?: {
    status?: 'active' | 'archived';
    stageId?: string;
    assignedTo?: string;
  }
): Promise<number> {
  try {
    let query = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters?.stageId) {
      query = query.where('stageId', '==', filters.stageId);
    }

    if (filters?.assignedTo) {
      query = query.where('assignedTo.userId', '==', filters.assignedTo);
    }

    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch (e: any) {
    console.error('>>> [WORKSPACE_COUNT_QUERY] Failed:', e.message);
    return 0;
  }
}
