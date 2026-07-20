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
  const BATCH_SIZE = 100;
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
    // Using Precondition (lastUpdateTime) ensures we don't overwrite if another worker grabbed it first.
    const lockWriter = adminDb.bulkWriter();
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    
    docs.forEach((doc) => {
      lockWriter.update(doc.ref, { lastStatusCheckAt: lockedUntil }, { lastUpdateTime: doc.updateTime });
    });
    
    // We catch and ignore 'Failed precondition' errors here, as that means another worker got the lock.
    lockWriter.onWriteError((error) => {
      if (error.code === 9) { // 9 = FAILED_PRECONDITION
        return false; // Tells BulkWriter not to retry this document
      }
      return true; // Retry other transient errors
    });

    await lockWriter.close();

    // 3. Setup API Key cache to avoid N+1 queries for organization keys
    const apiKeyCache = new Map<string, string | undefined>();
    const getCachedApiKey = async (orgId?: string) => {
      if (!orgId) return undefined;
      if (apiKeyCache.has(orgId)) return apiKeyCache.get(orgId);
      const key = await resolveMnotifyApiKey(orgId);
      apiKeyCache.set(orgId, key);
      return key;
    };

    // 4. Process the documents in chunks to respect mNotify API rate limits
    const updateWriter = adminDb.bulkWriter();

    await processInChunks(docs, CHUNK_SIZE, async (doc) => {
      const data = doc.data() as MessageLog;
      const providerId = data.providerId;
      const organizationId = data.organizationId;
      
      const currentCheckCount = (data.statusCheckCount || 0) + 1;

      if (!providerId) {
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

      // Fetch the API Key using cache
      const apiKey = await getCachedApiKey(organizationId);

      let mNotifyData;
      try {
        mNotifyData = await getSmsStatus(providerId, apiKey);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        
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

      const rawStatus = String(mNotifyData?.status || mNotifyData?.message || 'pending').trim();
      const targetStatus = normalizeMnotifyStatus(rawStatus);
      const now = new Date().toISOString();

      if (targetStatus === 'pending') {
        if (currentCheckCount > MAX_CHECK_COUNT) {
          updateWriter.update(doc.ref, {
            providerStatus: 'bounced',
            status: 'failed',
            bouncedAt: now,
            error: 'Status polling expired (timeout)',
            lastStatusCheckAt: now,
            statusCheckCount: currentCheckCount,
          });
        } else {
          updateWriter.update(doc.ref, {
            lastStatusCheckAt: now,
            statusCheckCount: currentCheckCount,
          });
        }
        return;
      }

      // Important fix: If tied to an automation, await the node stat increment first.
      // If it fails, we throw an error and DO NOT update the document, allowing it to retry next cycle.
      if (data.automationId && data.nodeId) {
        try {
          await incrementMessageNodeStat({
            automationId: data.automationId,
            nodeId: data.nodeId,
            workspaceId: data.workspaceId || 'onboarding',
            organizationId: data.organizationId,
            channel: 'sms',
            counter: targetStatus === 'delivered' ? 'delivered' : 'bounced',
          });
        } catch (err) {
          const errMsg = `Stat update failed for ${data.id}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errMsg);
          throw new Error(errMsg); // Bubble up so promise rejects and doc is NOT finalized
        }
      }

      // Finalize the status update in the writer
      updateWriter.update(doc.ref, {
        providerStatus: targetStatus,
        status: targetStatus === 'delivered' ? 'delivered' : 'failed',
        updatedAt: now,
        lastStatusCheckAt: now,
        statusCheckCount: currentCheckCount,
        ...(targetStatus === 'delivered' ? { deliveredAt: now } : { bouncedAt: now }),
      });
    });

    await updateWriter.close();

    return { processed: docs.length, success: true, errors };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { processed: 0, success: false, errors: [msg] };
  }
}
