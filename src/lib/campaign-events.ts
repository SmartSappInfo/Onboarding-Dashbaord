'use server';

import { adminDb } from './firebase-admin';
import type { MessageCampaign, MessageTask, AutomationTrigger } from './types';
import {
  buildCampaignAutomationJobPayload,
  campaignAutomationJobDocId,
} from './campaign-automation-jobs';

/**
 * Phase 6 Story 3: Campaign event emission for the automation engine.
 * 
 * Uses the existing `automation_jobs` queuing pattern (R6 mitigation) instead of
 * direct `triggerAutomationProtocols` calls to prevent unbounded fan-out.
 * 
 * Campaign events are emitted per-entity batch after job completion:
 * - CAMPAIGN_DELIVERED: entities with task status === 'sent'
 * - CAMPAIGN_FAILED: entities with task status === 'failed'
 * - CAMPAIGN_NOT_DELIVERED: entities with task status !== 'sent'
 */

/** Map of campaign engagement cohorts to automation triggers */
const COHORT_TRIGGER_MAP: Record<string, AutomationTrigger> = {
  delivered: 'CAMPAIGN_DELIVERED',
  failed: 'CAMPAIGN_FAILED',
  not_delivered: 'CAMPAIGN_NOT_DELIVERED',
};

/**
 * Emits campaign engagement events by queuing automation jobs.
 * Called from the bulk-messaging completion hook alongside post-send tags.
 * 
 * Flow:
 * 1. Load campaign's automationHooks configuration
 * 2. Load task subcollection to resolve entity cohorts
 * 3. For each hook, create `automation_jobs` entries (batched)
 * 4. The automation heartbeat (`processScheduledJobsAction`) picks them up
 */
export async function emitCampaignEvents(campaignId: string): Promise<{
  success: boolean;
  queuedCount?: number;
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };

    const campaign = campaignSnap.data() as MessageCampaign;
    const hooks = campaign.automationHooks;

    if (!hooks || hooks.length === 0) {
      return { success: true, queuedCount: 0 };
    }

    if (!campaign.jobId) {
      return { success: false, error: 'No linked job found' };
    }

    // Load tasks for cohort resolution
    const tasksSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .limit(5000)
      .get();

    const allTasks = tasksSnap.docs.map(d => ({ ...d.data() as MessageTask, id: d.id }));

    const cohorts: Record<string, string[]> = {
      delivered: allTasks.filter(t => t.status === 'sent' && t.entityId).map(t => t.entityId!),
      failed: allTasks.filter(t => t.status === 'failed' && t.entityId).map(t => t.entityId!),
      not_delivered: allTasks.filter(t => t.status !== 'sent' && t.entityId).map(t => t.entityId!),
    };

    let totalQueued = 0;

    for (const hook of hooks) {
      // Map hook event to cohort key
      const cohortKey = hook.event.replace('campaign_', ''); // 'campaign_delivered' → 'delivered'
      const entityIds = cohorts[cohortKey] || [];

      if (entityIds.length === 0) continue;

      // Queue automation jobs in batches
      const now = new Date();
      const executeAt = hook.delayMinutes
        ? new Date(now.getTime() + hook.delayMinutes * 60_000)
        : now;

      // Create one job per entity (matching automation-processor pattern)
      // Batch writes in chunks of 450 for Firestore limits
      const BATCH_SIZE = 450;
      for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
        const chunk = entityIds.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        for (const entityId of chunk) {
          const jobId = campaignAutomationJobDocId(
            campaignId,
            hook.event,
            hook.automationId,
            entityId
          );
          const jobRef = adminDb.collection('automation_jobs').doc(jobId);
          batch.set(
            jobRef,
            {
              automationId: hook.automationId,
              runId: '',
              targetNodeId: '__campaign_trigger__',
              payload: buildCampaignAutomationJobPayload({
                entityId,
                workspaceId: campaign.workspaceId,
                organizationId: campaign.organizationId || '',
                campaignId,
                campaignName: campaign.internalName,
                event: hook.event,
                channel: campaign.channel,
              }),
              executeAt: executeAt.toISOString(),
              status: 'pending',
              source: 'campaign_event',
              idempotencyKey: jobId,
            },
            { merge: true }
          );
        }

        await batch.commit();
        totalQueued += chunk.length;
      }

      console.log(`[CAMPAIGN-EVENT] Queued ${entityIds.length} jobs for ${hook.event} → automation "${hook.automationName}"`);
    }

    return { success: true, queuedCount: totalQueued };

  } catch (error: any) {
    console.error('[CAMPAIGN-EVENT] Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Emits a real-time campaign engagement event for a single entity.
 * Called by webhooks (e.g. email.opened, email.clicked).
 */
export async function emitSingleCampaignEvent(params: {
  campaignId: string;
  entityId: string;
  event: 'campaign_opened' | 'campaign_clicked' | 'campaign_delivered' | 'campaign_failed';
}): Promise<{ success: boolean; queuedCount: number; error?: string }> {
  const { campaignId, entityId, event } = params;

  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, queuedCount: 0, error: 'Campaign not found' };

    const campaign = campaignSnap.data() as MessageCampaign;
    const hooks = campaign.automationHooks || [];

    // Filter hooks that match this specific event
    const matchingHooks = hooks.filter(h => h.event === event);
    if (matchingHooks.length === 0) return { success: true, queuedCount: 0 };

    let queuedCount = 0;
    const now = new Date();

    const { runAutomationById } = await import('./automation-processor');

    for (const hook of matchingHooks) {
      const payload = buildCampaignAutomationJobPayload({
        entityId,
        workspaceId: campaign.workspaceId,
        organizationId: campaign.organizationId || '',
        campaignId,
        campaignName: campaign.internalName,
        event: hook.event,
        channel: campaign.channel,
      });

      if (!hook.delayMinutes || hook.delayMinutes === 0) {
        await runAutomationById(hook.automationId, { ...payload });
        const { dispatchCampaignBlueprintTriggers } = await import('./campaign-automation-dispatch');
        await dispatchCampaignBlueprintTriggers({
          hookEvent: event,
          payload: { ...payload },
          excludeAutomationIds: [hook.automationId],
        });
      } else {
        // Queued execution
        const executeAt = new Date(now.getTime() + hook.delayMinutes * 60_000);
        const jobId = campaignAutomationJobDocId(
          campaignId,
          hook.event,
          hook.automationId,
          entityId
        );
        await adminDb
          .collection('automation_jobs')
          .doc(jobId)
          .set(
            {
              automationId: hook.automationId,
              runId: '',
              targetNodeId: '__campaign_trigger__',
              payload,
              executeAt: executeAt.toISOString(),
              status: 'pending',
              source: 'campaign_realtime_event',
              idempotencyKey: jobId,
            },
            { merge: true }
          );
      }
      queuedCount++;
    }

    return { success: true, queuedCount };

  } catch (error: any) {
    console.error('[CAMPAIGN-EVENT-SINGLE] Failed:', error.message);
    return { success: false, queuedCount: 0, error: error.message };
  }
}
