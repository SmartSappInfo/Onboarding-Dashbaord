'use server';

import { adminDb } from './firebase-admin';
import type { EntityType } from './types';

/**
 * Metrics Actions for Requirement 21: Reporting — Distinct Metrics
 * 
 * Provides server actions for fetching distinct metrics that clearly separate:
 * - Unique entities (from entities collection)
 * - Workspace memberships (from workspace_entities collection)
 * - Active pipeline items
 * - Shared contacts across workspaces
 */

export interface EntityMetrics {
  totalByType: Record<EntityType, number>;
  totalUnique: number;
}

export interface WorkspaceMembershipMetrics {
  workspaceId: string;
  workspaceName: string;
  totalMemberships: number;
  byType: Record<EntityType, number>;
}

export interface PipelineMetrics {
  workspaceId: string;
  workspaceName: string;
  activeInPipeline: number;
  byType: Record<EntityType, number>;
}

export interface SharedContactMetrics {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  workspaceCount: number;
  workspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    stageName?: string;
    assignedTo?: string;
  }>;
}

/**
 * Fetches total unique entities by type (Requirement 21.1, 21.4)
 * Queries the entities collection to count distinct entities
 * Supports filtering by entityType
 */
export async function getUniqueEntityMetrics(
  organizationId: string,
  entityType?: EntityType
): Promise<EntityMetrics> {
  let query = adminDb
    .collection('entities')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active');

  if (entityType) {
    query = query.where('entityType', '==', entityType);
  }

  const entitiesSnap = await query.get();

  const totalByType: Record<EntityType, number> = {
    institution: 0,
    family: 0,
    person: 0,
  };

  entitiesSnap.docs.forEach((doc) => {
    const data = doc.data();
    const entityType = data.entityType as EntityType;
    if (entityType in totalByType) {
      totalByType[entityType]++;
    }
  });

  return {
    totalByType,
    totalUnique: entitiesSnap.size,
  };
}

/**
 * Fetches workspace-entity membership counts by workspace (Requirement 21.1, 21.3, 21.4)
 * Queries workspace_entities collection to count memberships per workspace
 * Supports filtering by workspaceId and entityType independently
 */
export async function getWorkspaceMembershipMetrics(
  organizationId: string,
  workspaceId?: string,
  entityType?: EntityType
): Promise<WorkspaceMembershipMetrics[]> {
  // First, get all workspaces for the organization
  const workspacesSnap = await adminDb
    .collection('workspaces')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .get();

  const workspaces = workspacesSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
  }));

  // Filter to specific workspace if provided
  const targetWorkspaces = workspaceId
    ? workspaces.filter((w) => w.id === workspaceId)
    : workspaces;

  const metrics: WorkspaceMembershipMetrics[] = [];

  for (const workspace of targetWorkspaces) {
    let query = adminDb
      .collection('workspace_entities')
      .where('organizationId', '==', organizationId)
      .where('workspaceId', '==', workspace.id)
      .where('status', '==', 'active');

    if (entityType) {
      query = query.where('entityType', '==', entityType);
    }

    const weSnap = await query.get();

    const byType: Record<EntityType, number> = {
      institution: 0,
      family: 0,
      person: 0,
    };

    weSnap.docs.forEach((doc) => {
      const data = doc.data();
      const entityType = data.entityType as EntityType;
      if (entityType in byType) {
        byType[entityType]++;
      }
    });

    metrics.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      totalMemberships: weSnap.size,
      byType,
    });
  }

  return metrics;
}

/**
 * Fetches entities active in pipeline by workspace (Requirement 21.1, 21.4)
 * Counts workspace_entities that have a stageId (indicating they're in a pipeline)
 * Supports filtering by workspaceId and entityType independently
 */
export async function getPipelineMetrics(
  organizationId: string,
  workspaceId?: string,
  entityType?: EntityType
): Promise<PipelineMetrics[]> {
  // Get all workspaces
  const workspacesSnap = await adminDb
    .collection('workspaces')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .get();

  const workspaces = workspacesSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
  }));

  const targetWorkspaces = workspaceId
    ? workspaces.filter((w) => w.id === workspaceId)
    : workspaces;

  const metrics: PipelineMetrics[] = [];

  for (const workspace of targetWorkspaces) {
    // Query workspace_entities with optional entityType filter
    let query = adminDb
      .collection('workspace_entities')
      .where('organizationId', '==', organizationId)
      .where('workspaceId', '==', workspace.id)
      .where('status', '==', 'active');

    if (entityType) {
      query = query.where('entityType', '==', entityType);
    }

    const weSnap = await query.get();

    const byType: Record<EntityType, number> = {
      institution: 0,
      family: 0,
      person: 0,
    };

    let activeCount = 0;

    weSnap.docs.forEach((doc) => {
      const data = doc.data();
      // Only count if they have a stageId (active in pipeline)
      if (data.stageId) {
        activeCount++;
        const entityType = data.entityType as EntityType;
        if (entityType in byType) {
          byType[entityType]++;
        }
      }
    });

    metrics.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      activeInPipeline: activeCount,
      byType,
    });
  }

  return metrics;
}

/**
 * Fetches entities shared across 2+ workspaces (Requirement 21.1, 21.5)
 * Groups workspace_entities by entityId and identifies those appearing in multiple workspaces
 */
export async function getSharedContactMetrics(
  organizationId: string,
  entityType?: EntityType
): Promise<SharedContactMetrics[]> {
  // Query all workspace_entities
  let query = adminDb
    .collection('workspace_entities')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active');

  if (entityType) {
    query = query.where('entityType', '==', entityType);
  }

  const weSnap = await query.get();

  // Group by entityId
  const entityMap = new Map<
    string,
    Array<{
      workspaceId: string;
      workspaceName?: string;
      stageName?: string;
      assignedTo?: string;
      entityName: string;
      entityType: EntityType;
    }>
  >();

  weSnap.docs.forEach((doc) => {
    const data = doc.data();
    const entityId = data.entityId;

    if (!entityMap.has(entityId)) {
      entityMap.set(entityId, []);
    }

    entityMap.get(entityId)!.push({
      workspaceId: data.workspaceId,
      stageName: data.currentStageName,
      assignedTo: data.assignedTo?.name || undefined,
      entityName: data.displayName,
      entityType: data.entityType,
    });
  });

  // Get workspace names
  const workspaceIds = new Set<string>();
  entityMap.forEach((workspaces) => {
    workspaces.forEach((w) => workspaceIds.add(w.workspaceId));
  });

  const workspaceNames = new Map<string, string>();
  if (workspaceIds.size > 0) {
    const workspacesSnap = await adminDb
      .collection('workspaces')
      .where('organizationId', '==', organizationId)
      .get();

    workspacesSnap.docs.forEach((doc) => {
      workspaceNames.set(doc.id, doc.data().name);
    });
  }

  // Filter to only entities in 2+ workspaces
  const sharedContacts: SharedContactMetrics[] = [];

  entityMap.forEach((workspaces, entityId) => {
    if (workspaces.length >= 2) {
      const first = workspaces[0];
      sharedContacts.push({
        entityId,
        entityName: first.entityName,
        entityType: first.entityType,
        workspaceCount: workspaces.length,
        workspaces: workspaces.map((w) => ({
          workspaceId: w.workspaceId,
          workspaceName: workspaceNames.get(w.workspaceId) || w.workspaceId,
          stageName: w.stageName,
          assignedTo: w.assignedTo,
        })),
      });
    }
  });

  return sharedContacts.sort((a, b) => b.workspaceCount - a.workspaceCount);
}
