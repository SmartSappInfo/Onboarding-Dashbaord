'use server';

import { adminDb } from '../firebase-admin';
import { exportEntitiesToCSV } from './export-service';
import { logActivity } from '../activity-logger';
import type { Entity, WorkspaceEntity } from '../types';

export async function exportEntitiesToCSVAction(
  workspaceEntityIds: string[],
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<{ success: boolean; data?: string; count?: number; error?: string }> {
  try {
    if (!workspaceEntityIds || workspaceEntityIds.length === 0) {
      return { success: true, data: '', count: 0 };
    }

    // Limit maximum exported entities to 5000 for server-side performance stability
    const idsToFetch = workspaceEntityIds.slice(0, 5000);

    const workspaceEntities: WorkspaceEntity[] = [];
    const chunks: string[][] = [];
    for (let i = 0; i < idsToFetch.length; i += 30) {
      chunks.push(idsToFetch.slice(i, i + 30));
    }

    const wsPromises = chunks.map(async (chunk) => {
      const snap = await adminDb
        .collection('workspace_entities')
        .where('__name__', 'in', chunk)
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WorkspaceEntity));
    });

    const wsResults = await Promise.all(wsPromises);
    workspaceEntities.push(...wsResults.flat());

    const entityIds = Array.from(new Set(workspaceEntities.map((we) => we.entityId).filter(Boolean)));
    if (entityIds.length === 0) {
      return { success: true, data: '', count: 0 };
    }

    const entities: Entity[] = [];
    const entityChunks: string[][] = [];
    for (let i = 0; i < entityIds.length; i += 30) {
      entityChunks.push(entityIds.slice(i, i + 30));
    }

    const entityPromises = entityChunks.map(async (chunk) => {
      const snap = await adminDb
        .collection('entities')
        .where('__name__', 'in', chunk)
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Entity));
    });

    const entityResults = await Promise.all(entityPromises);
    entities.push(...entityResults.flat());

    const wsMap = new Map<string, WorkspaceEntity>();
    for (const we of workspaceEntities) {
      wsMap.set(we.entityId, we);
    }

    const csvContent = exportEntitiesToCSV(entities, wsMap);

    // Audit Log creation (Requirement 18 / 12)
    await logActivity({
      organizationId,
      workspaceId,
      userId,
      type: 'export',
      source: 'web',
      description: `Exported ${workspaceEntities.length} entities to CSV format.`,
    });

    return { success: true, data: csvContent, count: entities.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to export entities to CSV:', error);
    return { success: false, error: message };
  }
}
