import { adminDb } from '../../firebase-admin';
import type { ExecutionContext } from '../execution-types';
import { scheduleDelayTask } from '../../gcp-tasks-client';

export async function handleDelayNode(
  node: { id: string; data?: { config?: { value?: number; unit?: string } } },
  context: ExecutionContext
): Promise<void> {
  console.log('[REAL handleDelayNode] called for node:', node.id);
  const { value, unit } = node.data?.config || { value: 5, unit: 'Minutes' };

  const now = new Date();
  const executeAt = new Date(now);
  if (unit === 'Minutes') executeAt.setMinutes(executeAt.getMinutes() + (value || 5));
  else if (unit === 'Hours') executeAt.setHours(executeAt.getHours() + (value || 1));
  else if (unit === 'Days') executeAt.setDate(executeAt.getDate() + (value || 1));
  else if (unit === 'Weeks') executeAt.setDate(executeAt.getDate() + (value || 1) * 7);

  // Persist the context-only fields (organizationId, entityType, workspaceId,
  // entityId) INTO the payload. These live on the ExecutionContext, not in
  // payload, so without this they are lost when the run is parked here and the
  // resumed context is degraded — most importantly organizationId, which scopes
  // sender + provider-key resolution for any downstream message/notification step.
  const persistedPayload = {
    ...context.payload,
    ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
    ...(context.organizationId ? { organizationId: context.organizationId } : {}),
    ...(context.entityId ? { entityId: context.entityId } : {}),
    ...(context.entityType ? { entityType: context.entityType } : {}),
  };

  await scheduleDelayTask({
    runId: context.runId,
    nodeId: node.id,
    automationId: context.automationId,
    executeAt: executeAt.toISOString(),
    payload: persistedPayload,
  });
}
