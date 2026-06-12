import { adminDb } from '../../firebase-admin';
import { logActivity } from '../../activity-logger';
import { calculateEngagementAdjustment } from '../../scoring-rules-engine';
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
 * Modifies contact-level and entity-level lead scores in a transaction.
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
  const operation = (config.operation as 'add' | 'subtract' | 'set') || 'add';
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
  const entityRef = adminDb.collection('entities').doc(entityId);
  const weQuery = adminDb
    .collection('workspace_entities')
    .where('entityId', '==', entityId)
    .where('workspaceId', '==', workspaceId)
    .limit(1);

  await adminDb.runTransaction(async (transaction) => {
    // 1. Perform reads first
    const entitySnap = await transaction.get(entityRef);
    if (!entitySnap.exists) {
      throw new Error(`Entity ${entityId} not found during score update.`);
    }

    const weSnap = await transaction.get(weQuery);

    // 2. Perform updates
    const entityData = entitySnap.data() || {};
    const entityContacts = entityData.entityContacts || [];

    const { entityContacts: updatedContacts, leadScore } = calculateEngagementAdjustment(
      entityContacts,
      contactEmailOrId,
      value,
      operation
    );

    // Update Entity
    transaction.update(entityRef, {
      entityContacts: updatedContacts,
      leadScore,
      updatedAt: new Date().toISOString(),
    });

    // Update Workspace Entity if exists
    if (!weSnap.empty) {
      transaction.update(weSnap.docs[0].ref, {
        entityContacts: updatedContacts,
        leadScore,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  // Log system activity event for the lead score update
  const opLabel =
    operation === 'add'
      ? `increased by ${value}`
      : operation === 'subtract'
      ? `decreased by ${value}`
      : `set to ${value}`;

  await logActivity({
    type: 'lead_score_updated',
    description: `Lead score ${opLabel} for contact via automation`,
    source: 'system',
    organizationId: orgId,
    workspaceId: workspaceId,
    entityId: entityId,
    userId: 'system-scoring-engine',
    displayName: 'Automation Engine',
    metadata: {
      isAutomation: true,
      operation,
      value,
      contactEmailOrId,
    },
  });
}
