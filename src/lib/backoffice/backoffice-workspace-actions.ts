'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor } from './backoffice-types';
import type { Workspace, Organization } from '../types';

// ─────────────────────────────────────────────────
// Backoffice Workspace Server Actions
// Extends existing workspace functionality with
// backoffice-specific operations and audit logging.
// ─────────────────────────────────────────────────

export interface BackofficeWorkspace extends Workspace {
  organizationName: string;
  organizationSlug: string;
  userCount: number;
}

/**
 * Lists all workspaces across all organizations.
 */
export async function listAllWorkspaces(): Promise<{
  success: boolean;
  data?: BackofficeWorkspace[];
  error?: string;
}> {
  try {
    const [workspacesSnap, orgsSnap, usersSnap] = await Promise.all([
      adminDb.collection('workspaces').orderBy('name', 'asc').get(),
      adminDb.collection('organizations').get(),
      adminDb.collection('users').get(),
    ]);

    const orgsMap = new Map<string, Organization>();
    orgsSnap.docs.forEach((doc) => orgsMap.set(doc.id, doc.data() as Organization));

    const workspaces = workspacesSnap.docs.map((doc) => {
      const data = doc.data() as Workspace;
      const wsId = doc.id;
      const org = orgsMap.get(data.organizationId);

      // Count users assigned to this workspace
      const userCount = usersSnap.docs.filter((u) => 
        u.data().workspaceIds?.includes(wsId)
      ).length;

      return {
        ...data,
        id: wsId,
        organizationName: org?.name || 'Unknown Organization',
        organizationSlug: org?.slug || 'unknown',
        userCount,
      };
    });

    return { success: true, data: workspaces };
  } catch (error: any) {
    console.error('[BACKOFFICE_WORKSPACE] listAllWorkspaces failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets detailed diagnostic information for a specific workspace.
 */
export async function getWorkspaceDiagnostics(workspaceId: string): Promise<{
  success: boolean;
  data?: {
    workspaceId: string;
    organizationName?: string;
    organizationId: string;
    status: string;
    scope: string;
    userCount: number;
    entityCount: number;
    teamCount: number;
    pipelineCount: number;
    featureOverrides: Record<string, boolean>;
    capabilities: Record<string, boolean>;
    createdAt: string;
  };
  error?: string;
}> {
  try {
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists) {
      return { success: false, error: 'Workspace not found' };
    }

    const wsData = wsSnap.data() as Workspace;
    
    // Fetch related data in parallel
    const [orgSnap, usersSnap, entitiesSnap, teamsSnap, pipelinesSnap] = await Promise.all([
      adminDb.collection('organizations').doc(wsData.organizationId).get(),
      adminDb.collection('users').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('teams').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('pipelines').where('workspaceIds', 'array-contains', workspaceId).get(),
    ]);

    return {
      success: true,
      data: {
        workspaceId,
        organizationName: orgSnap.exists ? orgSnap.data()?.name : undefined,
        organizationId: wsData.organizationId,
        status: wsData.status || 'active',
        scope: wsData.contactScope || 'unknown',
        userCount: usersSnap.size,
        entityCount: entitiesSnap.size,
        teamCount: teamsSnap.size,
        pipelineCount: pipelinesSnap.size,
        featureOverrides: wsData.enabledFeatures || {},
        capabilities: (wsData.capabilities || {}) as Record<string, boolean>,
        createdAt: wsData.createdAt,
      },
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_WORKSPACE] getWorkspaceDiagnostics failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Archives a workspace.
 */
export async function archiveWorkspaceFromBackoffice(
  workspaceId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists) {
      return { success: false, error: 'Workspace not found' };
    }

    const before = createAuditSnapshot(wsSnap.data() as Record<string, unknown>);

    await adminDb.collection('workspaces').doc(workspaceId).update({
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'workspace.archive', 'workspace', workspaceId, {
      scope: 'workspace',
      scopeId: workspaceId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_WORKSPACE] archiveWorkspaceFromBackoffice failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restores an archived workspace.
 */
export async function restoreWorkspaceFromBackoffice(
  workspaceId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists) {
      return { success: false, error: 'Workspace not found' };
    }

    const before = createAuditSnapshot(wsSnap.data() as Record<string, unknown>);

    await adminDb.collection('workspaces').doc(workspaceId).update({
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'workspace.restore', 'workspace', workspaceId, {
      scope: 'workspace',
      scopeId: workspaceId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_WORKSPACE] restoreWorkspaceFromBackoffice failed:', error);
    return { success: false, error: error.message };
  }
}
