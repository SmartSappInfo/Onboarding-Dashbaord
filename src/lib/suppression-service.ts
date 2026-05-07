
import { adminDb } from './firebase-admin';

/**
 * Checks if a recipient is suppressed for a given channel or workspace.
 */
export async function isSuppressed(params: {
  recipient: string;
  workspaceId: string;
  channel: 'email' | 'sms';
}): Promise<boolean> {
  const { recipient, workspaceId, channel } = params;
  
  try {
    const suppressionSnap = await adminDb.collection('suppressions')
      .where('recipient', '==', recipient)
      .where('workspaceId', 'in', [workspaceId, 'global'])
      .where('channel', 'in', [channel, 'all'])
      .where('status', '==', 'active')
      .limit(1)
      .get();

    return !suppressionSnap.empty;
  } catch (error) {
    console.error('[SUPPRESSION] Check failed:', error);
    return false; // Fail open to ensure delivery unless explicitly blocked
  }
}

/**
 * Adds a recipient to the suppression list.
 */
export async function suppressRecipient(params: {
  recipient: string;
  workspaceId: string;
  channel: 'email' | 'sms' | 'all';
  reason?: string;
  entityId?: string;
}) {
  const { recipient, workspaceId, channel, reason, entityId } = params;
  
  const suppressionData = {
    recipient,
    workspaceId,
    channel,
    reason: reason || 'unsubscribed',
    entityId: entityId || null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection('suppressions').add(suppressionData);
}

/**
 * Removes a recipient from the suppression list.
 */
export async function removeSuppression(recipient: string, workspaceId: string) {
  const query = await adminDb.collection('suppressions')
    .where('recipient', '==', recipient)
    .where('workspaceId', '==', workspaceId)
    .get();
    
  const batch = adminDb.batch();
  query.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
