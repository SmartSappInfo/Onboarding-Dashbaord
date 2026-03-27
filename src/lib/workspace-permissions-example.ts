'use server';

/**
 * @fileOverview Example usage of workspace-scoped permission checks.
 * 
 * This file demonstrates how to integrate workspace permission checks
 * into server actions that access workspace_entities or workspace-scoped data.
 * 
 * Requirements: 9 (Workspace-Scoped Permissions)
 */

import { adminDb } from './firebase-admin';
import {
  checkWorkspaceAccess,
  checkWorkspaceEntityAccess,
  checkWorkspacePermission,
  checkFullWorkspacePermission,
} from './workspace-permissions';
import type { WorkspaceEntity } from './types';

/**
 * Example 1: Reading a workspace_entities record
 * 
 * This demonstrates the basic pattern for checking workspace-entity access.
 * Use this pattern in any server action that reads workspace_entities data.
 */
export async function getWorkspaceEntityAction(
  userId: string,
  workspaceEntityId: string
) {
  try {
    // 1. Check if user has access to this workspace_entities record
    const accessCheck = await checkWorkspaceEntityAccess(userId, workspaceEntityId);

    if (!accessCheck.granted) {
      return {
        success: false,
        error: accessCheck.reason || 'Access denied',
        level: accessCheck.level,
      };
    }

    // 2. Fetch the workspace_entities record
    const weSnap = await adminDb
      .collection('workspace_entities')
      .doc(workspaceEntityId)
      .get();

    if (!weSnap.exists) {
      return {
        success: false,
        error: 'Workspace entity not found',
      };
    }

    const workspaceEntity = { id: weSnap.id, ...weSnap.data() } as WorkspaceEntity;

    return {
      success: true,
      data: workspaceEntity,
    };
  } catch (error: any) {
    console.error('>>> [EXAMPLE] getWorkspaceEntityAction failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Example 2: Updating a workspace_entities record
 * 
 * This demonstrates checking both workspace access AND a specific permission.
 * Use this pattern when the action requires a specific permission like 'schools_edit'.
 */
export async function updateWorkspaceEntityStageAction(
  userId: string,
  workspaceEntityId: string,
  newStageId: string
) {
  try {
    // 1. Fetch workspace_entities record to get workspaceId
    const weSnap = await adminDb
      .collection('workspace_entities')
      .doc(workspaceEntityId)
      .get();

    if (!weSnap.exists) {
      return {
        success: false,
        error: 'Workspace entity not found',
      };
    }

    const workspaceEntity = { id: weSnap.id, ...weSnap.data() } as WorkspaceEntity;

    // 2. Check if user has workspace access AND schools_edit permission
    const permissionCheck = await checkWorkspacePermission(
      userId,
      workspaceEntity.workspaceId,
      'schools_edit'
    );

    if (!permissionCheck.granted) {
      return {
        success: false,
        error: permissionCheck.reason || 'Permission denied',
        level: permissionCheck.level,
      };
    }

    // 3. Update the stage
    await adminDb
      .collection('workspace_entities')
      .doc(workspaceEntityId)
      .update({
        stageId: newStageId,
        updatedAt: new Date().toISOString(),
      });

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('>>> [EXAMPLE] updateWorkspaceEntityStageAction failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Example 3: Querying workspace_entities for a workspace
 * 
 * This demonstrates checking workspace access before querying workspace_entities.
 * Use this pattern for list views and queries.
 */
export async function listWorkspaceEntitiesAction(
  userId: string,
  workspaceId: string,
  options?: {
    limit?: number;
    stageId?: string;
  }
) {
  try {
    // 1. Check if user has access to this workspace
    const accessCheck = await checkWorkspaceAccess(userId, workspaceId);

    if (!accessCheck.granted) {
      return {
        success: false,
        error: accessCheck.reason || 'Access denied',
        level: accessCheck.level,
        items: [],
      };
    }

    // 2. Query workspace_entities
    let query = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'active');

    if (options?.stageId) {
      query = query.where('stageId', '==', options.stageId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as WorkspaceEntity[];

    return {
      success: true,
      items,
    };
  } catch (error: any) {
    console.error('>>> [EXAMPLE] listWorkspaceEntitiesAction failed:', error.message);
    return {
      success: false,
      error: error.message,
      items: [],
    };
  }
}

/**
 * Example 4: Creating a workspace-scoped resource with capability check
 * 
 * This demonstrates the full four-level permission check:
 * 1. Organization membership
 * 2. Workspace access
 * 3. Feature permission
 * 4. Workspace capability
 * 
 * Use this pattern when creating resources that depend on workspace capabilities.
 */
export async function createWorkspaceBillingRecordAction(
  userId: string,
  workspaceId: string,
  entityId: string,
  billingData: {
    amount: number;
    currency: string;
    description: string;
  }
) {
  try {
    // 1. Check full permissions: workspace access + finance_manage permission + billing capability
    const permissionCheck = await checkFullWorkspacePermission(
      userId,
      workspaceId,
      'finance_manage',
      'billing'
    );

    if (!permissionCheck.granted) {
      return {
        success: false,
        error: permissionCheck.reason || 'Permission denied',
        level: permissionCheck.level,
      };
    }

    // 2. Create the billing record
    const billingRecord = {
      workspaceId,
      entityId,
      ...billingData,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('billing_records').add(billingRecord);

    return {
      success: true,
      id: docRef.id,
    };
  } catch (error: any) {
    console.error('>>> [EXAMPLE] createWorkspaceBillingRecordAction failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Example 5: Bulk operation across multiple workspaces
 * 
 * This demonstrates checking access to multiple workspaces before performing
 * a bulk operation. Use this pattern for operations that span workspaces.
 */
export async function bulkUpdateEntitiesAcrossWorkspacesAction(
  userId: string,
  workspaceIds: string[],
  updates: {
    field: string;
    value: any;
  }
) {
  try {
    // 1. Check access to all workspaces
    const accessChecks = await Promise.all(
      workspaceIds.map((wsId) => checkWorkspaceAccess(userId, wsId))
    );

    // 2. Filter to only workspaces user has access to
    const accessibleWorkspaceIds = workspaceIds.filter(
      (wsId, index) => accessChecks[index].granted
    );

    if (accessibleWorkspaceIds.length === 0) {
      return {
        success: false,
        error: 'No access to any of the specified workspaces',
        updated: 0,
      };
    }

    // 3. Perform bulk update only on accessible workspaces
    const batch = adminDb.batch();
    let updateCount = 0;

    for (const workspaceId of accessibleWorkspaceIds) {
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .get();

      weSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          [updates.field]: updates.value,
          updatedAt: new Date().toISOString(),
        });
        updateCount++;
      });
    }

    await batch.commit();

    return {
      success: true,
      updated: updateCount,
      accessibleWorkspaces: accessibleWorkspaceIds.length,
      totalWorkspaces: workspaceIds.length,
    };
  } catch (error: any) {
    console.error('>>> [EXAMPLE] bulkUpdateEntitiesAcrossWorkspacesAction failed:', error.message);
    return {
      success: false,
      error: error.message,
      updated: 0,
    };
  }
}

/**
 * INTEGRATION GUIDELINES
 * 
 * When adding permission checks to existing server actions:
 * 
 * 1. For READ operations on workspace_entities:
 *    - Use checkWorkspaceEntityAccess() if you have the workspace_entities ID
 *    - Use checkWorkspaceAccess() if you're querying by workspaceId
 * 
 * 2. For WRITE operations (create, update, delete):
 *    - Use checkWorkspacePermission() with the appropriate permission
 *    - Common permissions: 'schools_edit', 'tags_manage', 'finance_manage'
 * 
 * 3. For operations requiring workspace capabilities:
 *    - Use checkFullWorkspacePermission() with both permission and capability
 *    - Common capabilities: 'billing', 'admissions', 'messaging', 'contracts'
 * 
 * 4. Always return structured errors with:
 *    - success: false
 *    - error: descriptive message
 *    - level: the permission level that failed (optional but helpful)
 * 
 * 5. Log permission denials for security auditing:
 *    - Consider logging to activities collection with type: 'permission_denied'
 *    - Include userId, workspaceId, and attempted action
 */
