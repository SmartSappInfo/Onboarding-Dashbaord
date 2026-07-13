import { adminDb } from '../firebase-admin';

/**
 * Checks message delivery logs to determine contact verification details.
 * Implements the "most positive delivery status" rule:
 * - If at least one log is positive (delivered, opened, clicked), return { status: 'verified', score: 100 }
 * - Else if only failed/bounced logs exist, return { status: 'bounced', score: 10 }
 * - Otherwise return { status: null, score: null } to trigger existing verifiers.
 */
export async function checkMessageDeliveryLogs(
  recipient: string,
  type: 'email' | 'phone'
): Promise<{ status: 'verified' | 'bounced' | 'undelivered' | null; score: number | null }> {
  const cleanRecipient = recipient.toLowerCase().trim();

  // Query message logs for this recipient, order by sentAt desc to get latest
  const snap = await adminDb
    .collection('message_logs')
    .where('recipient', '==', cleanRecipient)
    .orderBy('sentAt', 'desc')
    .limit(100)
    .get();

  if (snap.empty) {
    return { status: null, score: null };
  }

  // Map to raw log objects safely
  const logs = snap.docs.map(doc => {
    const data = doc.data();
    return {
      deliveredAt: data.deliveredAt || null,
      openedAt: data.openedAt || null,
      clickedAt: data.clickedAt || null,
      providerStatus: data.providerStatus || null,
      status: data.status || null,
    };
  });

  // 1. Check for any positive delivery events (most positive delivery status algorithm)
  const hasSuccessfulSend = logs.some(
    log =>
      log.deliveredAt ||
      log.openedAt ||
      log.clickedAt ||
      log.providerStatus === 'delivered' ||
      log.providerStatus === 'opened' ||
      log.providerStatus === 'clicked'
  );

  if (hasSuccessfulSend) {
    return { status: 'verified', score: 100 };
  }

  // 2. Check for bounces or failure events (if no successful sends exist)
  const hasBounce = logs.some(
    log => log.status === 'failed' || log.providerStatus === 'bounced'
  );

  if (hasBounce) {
    return {
      status: type === 'email' ? 'bounced' : 'undelivered',
      score: 10,
    };
  }

  return { status: null, score: null };
}
