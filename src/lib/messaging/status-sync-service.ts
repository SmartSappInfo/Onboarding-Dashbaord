import { adminDb } from '../firebase-admin';
import { getSmsStatus } from '../mnotify-service';
import { incrementMessageNodeStat } from './message-node-stats';
import type { MessageLog } from '../types';

/**
 * Normalizes mNotify's raw status string into our unified system status.
 */
function normalizeMnotifyStatus(status: string): 'delivered' | 'bounced' | 'pending' {
  const s = status.toUpperCase().trim();
  if (s === 'DELIVRD' || s === 'DELIVERED' || s === 'SUCCESS') return 'delivered';
  if (s === 'EXPIRED' || s === 'UNDELIV' || s === 'FAILED' || s === 'BOUNCED') return 'bounced';
  return 'pending';
}

/**
 * Resolves the mNotify API key for a given organization if custom routing is enabled.
 */
async function resolveMnotifyApiKey(organizationId?: string): Promise<string | undefined> {
  if (!organizationId) return undefined;
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data();
      if (org?.smsKeyMode === 'custom' && org?.mnotifyApiKey) {
        return org.mnotifyApiKey as string;
      }
    }
  } catch (error) {
    console.warn("[STATUS-SYNC] Failed to resolve custom API key:", error instanceof Error ? error.message : String(error));
  }
  return undefined;
}

/**
 * Helper to process an array in chunks concurrently.
 */
async function processInChunks<T, R>(items: T[], chunkSize: number, processor: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(processor);
    const chunkResults = await Promise.allSettled(chunkPromises);
    results.push(...chunkResults);
    // Add a tiny delay between chunks to avoid hammering the API
    if (i + chunkSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  return results;
}

/**
 * Polling service that syncs the delivery status of pending SMS messages.
 * Designed to be invoked frequently via a cron job.
 */
export async function syncPendingSmsStatuses(): Promise<{ processed: number; success: boolean; errors: string[] }> {
  const BATCH_SIZE = 200;
  const CHUNK_SIZE = 20;
  const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes lock
  const MAX_CHECK_COUNT = 4320; // Approx 72 hours if checked every minute

  const errors: string[] = [];

  try {
    // 1. Fetch the oldest unchecked pending SMS logs
    const logsSnap = await adminDb
      .collection('message_logs')
      .where('channel', '==', 'sms')
      .where('providerStatus', '==', 'pending')
      .orderBy('lastStatusCheckAt', 'asc')
      .limit(BATCH_SIZE)
      .get();

    if (logsSnap.empty) {
      return { processed: 0, success: true, errors };
    }

    const docs = logsSnap.docs;

    // 2. Optimistically lock these docs to prevent overlapping cron runs from processing them
    const lockWriter = adminDb.bulkWriter();
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    
    docs.forEach((doc) => {
      lockWriter.update(doc.ref, { lastStatusCheckAt: lockedUntil });
    });
    await lockWriter.close();

    // 3. Process the documents in chunks to respect mNotify API rate limits
    const updateWriter = adminDb.bulkWriter();

    await processInChunks(docs, CHUNK_SIZE, async (doc) => {
      const data = doc.data() as MessageLog;
      const providerId = data.providerId;
      const organizationId = data.organizationId;
      
      const currentCheckCount = (data.statusCheckCount || 0) + 1;

      if (!providerId) {
        // Log is missing a providerId, mark it as failed to prevent infinite loops
        updateWriter.update(doc.ref, {
          providerStatus: 'bounced',
          status: 'failed',
          bouncedAt: new Date().toISOString(),
          error: 'Missing providerId for polling',
          lastStatusCheckAt: new Date().toISOString(),
          statusCheckCount: currentCheckCount,
        });
        return;
      }

      // Fetch the API Key if custom routing is used
      const apiKey = await resolveMnotifyApiKey(organizationId);

      // Hit mNotify
      let mNotifyData;
      try {
        mNotifyData = await getSmsStatus(providerId, apiKey);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        
        // If the message is completely unfound on mNotify's side and we've checked a few times
        if (message.toLowerCase().includes('not found') && currentCheckCount > 5) {
          updateWriter.update(doc.ref, {
            providerStatus: 'bounced',
            status: 'failed',
            bouncedAt: new Date().toISOString(),
            error: 'Message not found on gateway after multiple checks',
            lastStatusCheckAt: new Date().toISOString(),
            statusCheckCount: currentCheckCount,
          });
          return;
        }

        throw new Error(`API Error for ${providerId}: ${message}`);
      }

      // mNotify returns status under message or status property depending on the endpoint wrapper
      // We expect the mnotify-service wrapper to return the direct status object or string
      const rawStatus = String(mNotifyData?.status || mNotifyData?.message || 'pending').trim();
      const targetStatus = normalizeMnotifyStatus(rawStatus);
      const now = new Date().toISOString();

      // If status is still pending
      if (targetStatus === 'pending') {
        if (currentCheckCount > MAX_CHECK_COUNT) {
          // Expire the message
          updateWriter.update(doc.ref, {
            providerStatus: 'bounced',
            status: 'failed',
            bouncedAt: now,
            error: 'Status polling expired (timeout)',
            lastStatusCheckAt: now,
            statusCheckCount: currentCheckCount,
          });
        } else {
          // Keep polling, unlock the item by setting the real last checked time
          updateWriter.update(doc.ref, {
            lastStatusCheckAt: now,
            statusCheckCount: currentCheckCount,
          });
        }
        return;
      }

      // If status has finalized
      updateWriter.update(doc.ref, {
        providerStatus: targetStatus,
        status: targetStatus === 'delivered' ? 'delivered' : 'failed',
        updatedAt: now,
        lastStatusCheckAt: now,
        statusCheckCount: currentCheckCount,
        ...(targetStatus === 'delivered' ? { deliveredAt: now } : { bouncedAt: now }),
      });

      // Update Node Stats if tied to an automation
      if (data.automationId && data.nodeId) {
        await incrementMessageNodeStat({
          automationId: data.automationId,
          nodeId: data.nodeId,
          workspaceId: data.workspaceId || 'onboarding',
          organizationId: data.organizationId,
          channel: 'sms',
          counter: targetStatus === 'delivered' ? 'delivered' : 'bounced',
        }).catch((err) => {
          errors.push(`Stat update failed for ${data.id}: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    });

    await updateWriter.close();

    return { processed: docs.length, success: true, errors };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { processed: 0, success: false, errors: [msg] };
  }
}
