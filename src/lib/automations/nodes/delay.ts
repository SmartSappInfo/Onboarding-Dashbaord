import { adminDb } from '../../firebase-admin';
import type { ExecutionContext } from '../execution-types';

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

  await adminDb.collection('automation_jobs').add({
    automationId: context.automationId,
    runId: context.runId,
    targetNodeId: node.id,
    payload: context.payload,
    executeAt: executeAt.toISOString(),
    status: 'pending',
    createdAt: now.toISOString(),
  });
}
