'use server';

import { adminDb } from './firebase-admin';
import { createBulkMessageJob, processBulkJobChunk } from './bulk-messaging';
import { previewCampaignAudience } from './messaging-actions';
import { syncCampaignStats } from './campaign-analytics';
import { resolveContact } from './contact-adapter';
import type { MessageCampaign } from './types';

/**
 * Dispatches a campaign: resolves audience, creates job, triggers processing.
 * 
 * R1 fix: This is what the wizard "Send" button must call — not saveDraft.
 * R2 fix: Creates ephemeral template for campaigns without templateId.
 */
export async function dispatchCampaign(campaignId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    // 1. Load campaign
    const campaignRef = adminDb.collection('message_campaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };

    const campaign = campaignSnap.data() as MessageCampaign;

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return { success: false, error: `Cannot dispatch campaign in '${campaign.status}' status` };
    }

    if (!campaign.senderProfileId) {
      return { success: false, error: 'No sender profile selected' };
    }

    // 2. Resolve audience → get recipients (R4 fix: use high limit for dispatch, not preview)
    const audienceResult = await previewCampaignAudience({
      workspaceId: campaign.workspaceId,
      filters: campaign.audienceDefinition?.filters as any,
      filterLogic: campaign.audienceDefinition?.filterLogic,
      includeTagIds: campaign.audienceDefinition?.tagIds,
      excludeTagIds: campaign.audienceDefinition?.excludeTagIds,
      includeLogic: campaign.audienceDefinition?.tagLogic === 'all' ? 'AND' : 'OR',
      limit: 5000, // R4 fix: dispatch needs full audience, not preview-limited
    });

    if (!audienceResult.success || !audienceResult.preview) {
      return { success: false, error: audienceResult.error || 'Audience resolution failed' };
    }

    if (audienceResult.count === 0) {
      return { success: false, error: 'No recipients match the audience definition' };
    }

    // 3. R2 fix: Ensure a templateId exists — create ephemeral template if needed
    let templateId = campaign.templateId || '';

    if (!templateId) {
      const ephemeralRef = await adminDb.collection('message_templates').add({
        name: `[Campaign] ${campaign.internalName}`,
        channel: campaign.channel,
        category: 'campaign',
        target: campaign.target,
        contentMode: campaign.contentMode || 'plain_text',
        subject: campaign.customSubject || '',
        body: campaign.customBody || '',
        blocks: campaign.customBlocks || [],
        styleId: campaign.styleId || null,
        organizationId: campaign.organizationId,
        workspaceIds: [campaign.workspaceId],
        isEphemeral: true, // Marker for cleanup
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      templateId = ephemeralRef.id;
    }

    // 4. R2 fix: Resolve actual email/phone per entity via resolveContact
    const recipients: { recipient: string; variables: Record<string, any>; entityId: string; displayName: string }[] = [];

    for (const entity of audienceResult.preview!) {
      try {
        const contact = await resolveContact(entity.id, campaign.workspaceId);
        if (!contact) continue;

        let resolvedRecipient = '';
        if (campaign.channel === 'email') {
          const primary = contact.entityContacts?.find((ec: any) => ec.isPrimary);
          resolvedRecipient = primary?.email || contact.contacts?.[0]?.email || '';
        } else {
          const primary = contact.entityContacts?.find((ec: any) => ec.isPrimary);
          resolvedRecipient = primary?.phone || contact.contacts?.[0]?.phone || '';
        }

        if (!resolvedRecipient) continue; // Skip entities without valid contact info

        recipients.push({
          recipient: resolvedRecipient,
          variables: {
            entity_name: entity.name,
            entity_email: contact.entityContacts?.find((ec: any) => ec.isPrimary)?.email || '',
            entity_phone: contact.entityContacts?.find((ec: any) => ec.isPrimary)?.phone || '',
            tags: entity.tags.join(', '),
          },
          entityId: entity.id,
          displayName: entity.name,
        });
      } catch (resolveErr) {
        console.warn(`[DISPATCH] Skipped entity ${entity.id}:`, (resolveErr as Error).message);
      }
    }

    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipients found (all entities missing contact info)' };
    }

    // 5. Update campaign status → 'sending'
    await campaignRef.update({
      status: 'sending',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 6. Create bulk job with campaignId linkage
    const jobResult = await createBulkMessageJob({
      templateId,
      senderProfileId: campaign.senderProfileId,
      recipients,
      userId: campaign.createdBy,
    });

    // 7. Link job to campaign (two-phase commit — R3 fix from Phase 3)
    await campaignRef.update({
      jobId: jobResult.jobId,
      'stats.totalTargeted': audienceResult.count || recipients.length,
    });

    // 8. Write campaignId to the job document
    await adminDb.collection('message_jobs').doc(jobResult.jobId).update({
      campaignId,
      workspaceId: campaign.workspaceId,
      organizationId: campaign.organizationId,
    });

    // 9. Trigger first chunk processing (rest will be polled by client)
    try {
      await processBulkJobChunk(jobResult.jobId);
    } catch (e) {
      // Non-fatal — client can retry via polling
      console.warn('[DISPATCH] First chunk processing failed, client will retry:', (e as Error).message);
    }

    return { success: true, jobId: jobResult.jobId };

  } catch (error: any) {
    // Rollback campaign status on critical failure
    try {
      await adminDb.collection('message_campaigns').doc(campaignId).update({
        status: 'failed',
        updatedAt: new Date().toISOString(),
      });
    } catch (rollbackErr) {
      console.error('[DISPATCH] Rollback failed:', (rollbackErr as Error).message);
    }
    console.error('[DISPATCH] Campaign dispatch failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Resends a campaign to failed recipients only.
 * Creates a new job from the original campaign's failed tasks.
 */
export async function resendToFailed(campaignId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };
    const campaign = campaignSnap.data() as MessageCampaign;

    if (!campaign.jobId) return { success: false, error: 'No linked job found' };

    // Get failed tasks
    const failedSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .where('status', '==', 'failed')
      .limit(500)
      .get();

    if (failedSnap.empty) return { success: false, error: 'No failed recipients to resend' };

    const recipients = failedSnap.docs.map(d => ({
      recipient: d.data().recipient,
      variables: d.data().variables || {},
    }));

    const templateId = campaign.templateId || '';
    if (!templateId) return { success: false, error: 'No template available for resend' };

    const jobResult = await createBulkMessageJob({
      templateId,
      senderProfileId: campaign.senderProfileId || '',
      recipients,
      userId: campaign.createdBy,
    });

    // Link retry job
    await adminDb.collection('message_jobs').doc(jobResult.jobId).update({
      campaignId,
      workspaceId: campaign.workspaceId,
    });

    // Process first chunk
    await processBulkJobChunk(jobResult.jobId);

    return { success: true, jobId: jobResult.jobId };
  } catch (error: any) {
    console.error('[RESEND] Failed:', error.message);
    return { success: false, error: error.message };
  }
}
