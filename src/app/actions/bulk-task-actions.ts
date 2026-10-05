'use server';

/**
 * @fileOverview Public Server Action gateway for bulk task creation.
 *
 * SECURITY AUDIT REMEDIATION (VULN-01):
 * In Next.js, every top-level export of a `'use server'` file becomes a public HTTP RPC endpoint.
 * Previously, `bulkCreateTasksActionCore` was directly exported without authentication or workspace guards.
 *
 * Remediation:
 * 1. `bulkCreateTasksCore` has been moved to internal non-server library `@/lib/tasks/task-bulk-core`.
 * 2. Only `bulkCreateTasksAction` is exported here.
 * 3. `bulkCreateTasksAction` strictly enforces:
 *    - Session authentication (`requireAuth()`)
 *    - Workspace boundary membership (`requireWorkspace(data.workspaceId)`)
 *    - RBAC permissions (`canUser(uid, 'operations', 'tasks', 'create', data.workspaceId)`)
 */

import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { canUser } from '@/lib/workspace-permissions';
import { bulkCreateTasksCore, type BulkTaskCreationData, type BulkTaskCreationResult } from '@/lib/tasks/task-bulk-core';
import { getErrorMessage } from '@/lib/errors/report-error';

export type { BulkTaskCreationData, BulkTaskCreationResult };

/**
 * Server Action entry point for bulk task creation across multiple CRM entities.
 * Strictly verifies authentication, tenant boundary, and RBAC permissions.
 */
export async function bulkCreateTasksAction(data: BulkTaskCreationData): Promise<BulkTaskCreationResult> {
  try {
    const session = await requireAuth();
    await requireWorkspace(data.workspaceId);

    const permission = await canUser(session.uid, 'operations', 'tasks', 'create', data.workspaceId);
    if (!permission.granted) {
      return {
        success: false,
        error: permission.reason ?? 'User lacks operations:tasks:create permission.',
      };
    }

    return await bulkCreateTasksCore(data, { kind: 'user', uid: session.uid });
  } catch (error: unknown) {
    console.error('[bulkCreateTasksAction] Error:', error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
