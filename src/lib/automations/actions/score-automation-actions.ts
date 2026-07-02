import { adminDb } from '../../firebase-admin';
import { adjustLeadScoreAction } from '../../scoring-performance-engine';
import type { ExecutionContext } from '../execution-types';

/**
 * Resolves the workspace's organizationId.
 */
async function resolveOrgId(context: ExecutionContext): Promise<string> {
  if (context.organizationId) return context.organizationId;
  const snap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
  return (snap.data()?.organizationId as string) || '';
}

/**
 * Handles the UPDATE_LEAD_SCORE automation action.
 * Modifies contact-level and entity-level lead scores via centralized engine.
 */
export async function handleUpdateLeadScore(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  const entityId = context.entityId;
  if (!entityId) {
    throw new Error('Cannot update lead score: Context is missing entityId.');
  }

  const workspaceId = context.workspaceId;
  const operation = (config.operation as 'add' | 'subtract' | 'set' | 'reset') || 'add';
  const rawValue = config.value !== undefined ? config.value : 0;
  const value = Math.max(0, Number(rawValue) || 0);

  // Determine target contact email or ID from config or metadata payload fallbacks
  const contactEmailOrId =
    (config.contactEmailOrId as string | undefined) ||
    (context.payload?.contactId as string | undefined) ||
    (context.payload?.contactEmail as string | undefined) ||
    (context.payload?.email as string | undefined) ||
    (context.payload?.recipientEmail as string | undefined);

  const orgId = await resolveOrgId(context);

  const opLabel =
    operation === 'add'
      ? `increased by ${value}`
      : operation === 'subtract'
      ? `decreased by ${value}`
      : operation === 'reset'
      ? 'reset to 0'
      : `set to ${value}`;

  const res = await adjustLeadScoreAction({
    organizationId: orgId,
    workspaceId,
    entityId,
    contactEmailOrId,
    value,
    operation,
    reason: `Lead score ${opLabel} via automation`,
    source: 'automation',
    actorId: context.automationId || 'automation-engine',
    actorType: 'Automation'
  });

  if (!res.success) {
    throw new Error(res.error || 'Failed to adjust lead score via automation.');
  }
}
