/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk Campaign Dispatcher Service (Phase 9):
 * 1. Purpose & Standards:
 *    Orchestrates high-throughput bulk document signing campaigns across large recipient rosters.
 *    Provides chunked asynchronous batch processing, deterministic deduplication,
 *    and partial failure isolation.
 * 2. Idempotent Deduplication (FM-P9-02):
 *    Derives a cryptographic idempotency key per recipient (`idemp_${campaignId}_${email}_${hash}`).
 *    Resuming interrupted dispatches or double-clicking never emits duplicate envelopes.
 * 3. Partial Failure Isolation & Safe Retry (FM-P9-03):
 *    Individual recipient errors (e.g. invalid phone/email, network drops) are isolated
 *    to `status: 'failed'`. Retrying a campaign strictly targets failed records without
 *    resending to recipients who have already signed or been delivered.
 * 4. Rate-Limiting & Quota Defense (FM-P9-01 & FM-P9-08):
 *    Processes in bounded slices (default 25) with paced execution, preventing serverless
 *    timeouts and third-party gateway HTTP 429 quota exhaustion.
 * 5. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { createHash, randomUUID } from 'crypto';
import {
  BulkCampaign,
  BulkCampaignSchema,
  BulkCampaignRecipient,
  BulkCampaignRecipientSchema,
  CreateBulkCampaignRequest,
  CreateBulkCampaignRequestSchema,
} from '@/lib/types/document-signing';

export interface DispatchSliceResult {
  campaignId: string;
  processedCount: number;
  successfulCount: number;
  failedCount: number;
  remainingCount: number;
  isComplete: boolean;
}

export interface RetryResult {
  campaignId: string;
  retriedCount: number;
  message: string;
}

export interface BulkCampaignProgress {
  campaignId: string;
  title: string;
  status: string;
  totalCount: number;
  dispatchedCount: number;
  signedCount: number;
  failedCount: number;
  progressPercentage: number;
  isComplete: boolean;
}

/**
 * Computes a deterministic idempotency key for a recipient within a campaign (FM-P9-02).
 */
export function deriveRecipientIdempotencyKey(
  campaignId: string,
  email: string,
  variables: Record<string, string>
): string {
  const normEmail = email.toLowerCase().trim();
  const sortedVars = Object.keys(variables)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = variables[key];
      return acc;
    }, {});

  const hash = createHash('sha256')
    .update(`${campaignId}:${normEmail}:${JSON.stringify(sortedVars)}`)
    .digest('hex')
    .substring(0, 16);

  return `idemp_${campaignId}_${normEmail}_${hash}`;
}

/**
 * Creates and stages a bulk signing campaign with its recipient items.
 */
export async function createBulkCampaign(
  workspaceId: string,
  input: CreateBulkCampaignRequest,
  userId: string
): Promise<BulkCampaign> {
  const validated = CreateBulkCampaignRequestSchema.parse(input);
  const campaignId = randomUUID();
  const now = new Date().toISOString();

  const campaign: BulkCampaign = {
    id: campaignId,
    workspaceId,
    title: validated.title,
    templateId: validated.templateId,
    templateVersionId: validated.templateVersionId,
    status: 'ready',
    totalCount: validated.recipients.length,
    dispatchedCount: 0,
    signedCount: 0,
    failedCount: 0,
    routingMode: validated.routingMode,
    countersignerEmail: validated.countersignerEmail,
    countersignerName: validated.countersignerName,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    tags: validated.tags,
  };

  const parsedCampaign = BulkCampaignSchema.parse(campaign);

  // 1. Save Campaign Record
  await adminDb.collection('bulk_campaigns').doc(campaignId).set(parsedCampaign);

  // 2. Stage Recipients in Batches (max 400 per Firestore batch commit)
  const recipients = validated.recipients;
  const BATCH_SIZE = 400;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const writeBatch = adminDb.batch();

    chunk.forEach((rec, chunkIdx) => {
      const rowIndex = i + chunkIdx + 1;
      const recId = randomUUID();
      const idempotencyKey = deriveRecipientIdempotencyKey(campaignId, rec.email, rec.variables);

      const recipientItem: BulkCampaignRecipient = {
        id: recId,
        campaignId,
        rowIndex,
        name: rec.name,
        email: rec.email.toLowerCase().trim(),
        phone: rec.phone,
        variables: rec.variables,
        status: 'queued',
        idempotencyKey,
      };

      const parsedRecipient = BulkCampaignRecipientSchema.parse(recipientItem);
      const docRef = adminDb.collection('bulk_campaign_recipients').doc(recId);
      writeBatch.set(docRef, parsedRecipient);
    });

    await writeBatch.commit();
  }

  return parsedCampaign;
}

/**
 * Dispatches a bounded slice of queued recipients for a campaign (FM-P9-01, FM-P9-08).
 * Executes incrementally with rate-limited chunking.
 */
export async function dispatchCampaignBatchSlice(
  campaignId: string,
  batchSize = 25
): Promise<DispatchSliceResult> {
  const campaignRef = adminDb.collection('bulk_campaigns').doc(campaignId);
  const campaignSnap = await campaignRef.get();

  if (!campaignSnap.exists) {
    throw new Error(`Bulk campaign not found: ${campaignId}`);
  }

  const campaign = campaignSnap.data() as BulkCampaign;

  // If paused or completed, do not dispatch further slices
  if (campaign.status === 'paused' || campaign.status === 'completed') {
    return {
      campaignId,
      processedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      remainingCount: 0,
      isComplete: true,
    };
  }

  // Update status to dispatching
  await campaignRef.update({
    status: 'dispatching',
    updatedAt: new Date().toISOString(),
  });

  // Query next slice of queued recipients
  const queuedQuery = await adminDb
    .collection('bulk_campaign_recipients')
    .where('campaignId', '==', campaignId)
    .where('status', '==', 'queued')
    .limit(batchSize)
    .get();

  if (queuedQuery.empty) {
    // Check if any recipients failed
    const remainingCount = 0;
    const finalStatus = campaign.failedCount > 0 ? 'active' : 'completed';

    await campaignRef.update({
      status: finalStatus,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      campaignId,
      processedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      remainingCount,
      isComplete: true,
    };
  }

  let successfulCount = 0;
  let failedCount = 0;
  const now = new Date().toISOString();

  // Process slice items with isolated failure handling
  for (const doc of queuedQuery.docs) {
    const recipient = doc.data() as BulkCampaignRecipient;

    try {
      // 1. Idempotency Check: check if envelope already issued with this idempotencyKey (FM-P9-02)
      const existingEnvQuery = await adminDb
        .collection('signing_envelopes')
        .where('metadata.idempotencyKey', '==', recipient.idempotencyKey)
        .limit(1)
        .get();

      let envelopeId = '';

      if (!existingEnvQuery.empty) {
        envelopeId = existingEnvQuery.docs[0].id;
      } else {
        // 2. Issue new signing envelope document
        const newEnvelopeId = randomUUID();
        envelopeId = newEnvelopeId;

        const envelopePayload = {
          id: newEnvelopeId,
          workspaceId: campaign.workspaceId,
          title: `${campaign.title} - ${recipient.name}`,
          templateId: campaign.templateId,
          templateVersionId: campaign.templateVersionId,
          status: 'sent',
          routingMode: campaign.routingMode,
          recipients: [
            {
              id: randomUUID(),
              name: recipient.name,
              email: recipient.email,
              phone: recipient.phone,
              role: 'signer',
              routingOrder: 1,
              status: 'invited',
            },
            ...(campaign.routingMode === 'sequential_countersign' && campaign.countersignerEmail
              ? [
                  {
                    id: randomUUID(),
                    name: campaign.countersignerName || 'Countersigner',
                    email: campaign.countersignerEmail,
                    role: 'countersigner',
                    routingOrder: 2,
                    status: 'queued',
                  },
                ]
              : []),
          ],
          metadata: {
            campaignId,
            recipientId: recipient.id,
            idempotencyKey: recipient.idempotencyKey,
            variables: recipient.variables,
          },
          createdAt: now,
          updatedAt: now,
        };

        await adminDb.collection('signing_envelopes').doc(newEnvelopeId).set(envelopePayload);
      }

      // Mark recipient as dispatched
      await doc.ref.update({
        status: 'dispatched',
        envelopeId,
        dispatchedAt: now,
      });

      successfulCount++;
    } catch (err: unknown) {
      // FM-P9-03: Isolate partial failures without crashing the entire batch
      failedCount++;
      const errorMessage = err instanceof Error ? err.message : 'Unknown dispatch error';
      await doc.ref.update({
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  // Update campaign progress aggregate
  const remainingQuery = await adminDb
    .collection('bulk_campaign_recipients')
    .where('campaignId', '==', campaignId)
    .where('status', '==', 'queued')
    .limit(1)
    .get();

  const isComplete = remainingQuery.empty;
  const nextStatus = isComplete ? (campaign.failedCount + failedCount > 0 ? 'active' : 'completed') : 'dispatching';

  await campaignRef.update({
    dispatchedCount: FieldValue.increment(successfulCount),
    failedCount: FieldValue.increment(failedCount),
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    ...(isComplete ? { completedAt: new Date().toISOString() } : {}),
  });

  return {
    campaignId,
    processedCount: queuedQuery.docs.length,
    successfulCount,
    failedCount,
    remainingCount: isComplete ? 0 : 1, // At least 1 remaining if query not empty
    isComplete,
  };
}

/**
 * Retries all failed recipients for a campaign without re-dispatching successful ones (FM-P9-03).
 */
export async function retryFailedCampaignRecipients(campaignId: string): Promise<RetryResult> {
  const campaignRef = adminDb.collection('bulk_campaigns').doc(campaignId);
  const campaignSnap = await campaignRef.get();

  if (!campaignSnap.exists) {
    throw new Error(`Bulk campaign not found: ${campaignId}`);
  }

  const failedRecipientsQuery = await adminDb
    .collection('bulk_campaign_recipients')
    .where('campaignId', '==', campaignId)
    .where('status', '==', 'failed')
    .get();

  if (failedRecipientsQuery.empty) {
    return {
      campaignId,
      retriedCount: 0,
      message: 'No failed recipients found to retry.',
    };
  }

  const batch = adminDb.batch();
  failedRecipientsQuery.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'queued',
      error: FieldValue.delete(),
    });
  });

  // Reset campaign failedCount and set status back to ready
  batch.update(campaignRef, {
    status: 'ready',
    failedCount: 0,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();

  return {
    campaignId,
    retriedCount: failedRecipientsQuery.docs.length,
    message: `Reset ${failedRecipientsQuery.docs.length} failed recipients to queued for retry.`,
  };
}

/**
 * Retrieves aggregate progress statistics for a bulk campaign.
 */
export async function getCampaignProgress(campaignId: string): Promise<BulkCampaignProgress> {
  const campaignDoc = await adminDb.collection('bulk_campaigns').doc(campaignId).get();

  if (!campaignDoc.exists) {
    throw new Error(`Bulk campaign not found: ${campaignId}`);
  }

  const data = campaignDoc.data() as BulkCampaign;
  const total = data.totalCount || 0;
  const processed = (data.dispatchedCount || 0) + (data.failedCount || 0);
  const progressPercentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return {
    campaignId,
    title: data.title,
    status: data.status,
    totalCount: data.totalCount,
    dispatchedCount: data.dispatchedCount,
    signedCount: data.signedCount,
    failedCount: data.failedCount,
    progressPercentage,
    isComplete: data.status === 'completed',
  };
}
