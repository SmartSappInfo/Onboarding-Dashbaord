'use server';

import { adminDb } from './firebase-admin';
import { createBulkMessageJob, processBulkJobChunk, processJobChunkBackground } from './bulk-messaging';
import { previewCampaignAudience, resolveRecipientContacts } from './messaging-actions';
import { syncCampaignStats } from './campaign-analytics';
import type { MessageCampaign } from './types';
import { after } from 'next/server';

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
      selectedContacts: campaign.audienceDefinition?.selectedContacts,
      audienceMode: campaign.audienceDefinition?.mode,
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

    // 4. Resolve actual email/phone per entity via resolveRecipientContacts
    const recipients: { recipient: string; variables: Record<string, any>; entityId: string; displayName: string }[] = [];
    const contactRolesFilter = campaign.audienceDefinition?.filters?.find((f: any) => f.field === 'contactRoles');
    const contactRoles = contactRolesFilter ? contactRolesFilter.value as string[] : null;
    const selectedContacts = campaign.audienceDefinition?.selectedContacts || [];
    const isManualMode = campaign.audienceDefinition?.mode === 'manual';

    for (const entity of audienceResult.preview!) {
      try {
        let resolved = await resolveRecipientContacts({
          entityId: entity.id,
          workspaceId: campaign.workspaceId,
          contactScope: isManualMode ? 'all' : (campaign.audienceDefinition?.contactScope || 'primary'),
          channel: campaign.channel === 'email' ? 'email' : 'sms',
          contactRoles: isManualMode ? null : contactRoles,
        });

        if (isManualMode) {
          resolved = resolved.filter(r => {
            return selectedContacts.some(sc => {
              if (sc.entityId !== entity.id) return false;
              const contactVal = campaign.channel === 'email' ? sc.email : sc.phone;
              return r.contact.toLowerCase() === contactVal?.toLowerCase();
            });
          });
        }

        for (const r of resolved) {
          recipients.push({
            recipient: r.contact,
            variables: {
              entity_name: entity.name,
              entity_email: r.contact,
              entity_phone: r.contact,
              contact_name: r.contactName,
              tags: entity.tags.join(', '),
            },
            entityId: entity.id,
            displayName: entity.name,
          });
        }
      } catch (resolveErr) {
        console.warn(`[DISPATCH] Skipped entity ${entity.id}:`, (resolveErr as Error).message);
      }
    }

    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipient contacts resolved' };
    }

    if (campaign.abTestEnabled && campaign.variants?.length) {
      const testPct = campaign.abTestConfig?.testSizePercentage || 100;
      
      // Safety check for empty or small list sizes
      if (recipients.length < 2) {
        // Small list fallback: bypass test phase entirely, default to Variant A
        const testRecipients = recipients.map(r => ({ ...r, campaignVariantId: 'A' as const }));
        
        await campaignRef.update({
          status: 'sending',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        const jobResult = await createBulkMessageJob({
          templateId: campaign.variants.find(v => v.id === 'A')?.templateId || templateId,
          senderProfileId: campaign.senderProfileId,
          recipients: testRecipients,
          userId: campaign.createdBy,
        });
        
        await campaignRef.update({
          jobId: jobResult.jobId,
          'stats.totalTargeted': audienceResult.count || recipients.length,
        });
        
        await adminDb.collection('message_jobs').doc(jobResult.jobId).update({
          campaignId,
          workspaceId: campaign.workspaceId,
          organizationId: campaign.organizationId,
        });
        
        try {
          after(async () => {
            await processJobChunkBackground(jobResult.jobId);
          });
        } catch (e) {
          console.warn('[DISPATCH] next/server after() called outside request context, running asynchronously:', (e as Error).message);
          processJobChunkBackground(jobResult.jobId).catch(err => {
            console.error('[DISPATCH] Background processing error:', err.message);
          });
        }
        
        return { success: true, jobId: jobResult.jobId };
      }
      
      const testSize = testPct < 100 
        ? Math.max(2, Math.ceil(recipients.length * (testPct / 100))) 
        : recipients.length;
        
      const testRecipients = recipients.slice(0, testSize).map((r, idx) => ({
        ...r,
        campaignVariantId: idx % 2 === 0 ? ('A' as const) : ('B' as const)
      }));

      const finalStatus = testPct < 100 ? 'testing' : 'sending';

      await campaignRef.update({
        status: finalStatus,
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const jobResult = await createBulkMessageJob({
        templateId,
        senderProfileId: campaign.senderProfileId,
        recipients: testRecipients,
        userId: campaign.createdBy,
      });

      await campaignRef.update({
        jobId: jobResult.jobId,
        'stats.totalTargeted': audienceResult.count || recipients.length,
      });

      await adminDb.collection('message_jobs').doc(jobResult.jobId).update({
        campaignId,
        workspaceId: campaign.workspaceId,
        organizationId: campaign.organizationId,
      });

      if (testPct < 100) {
        const executeAt = new Date();
        executeAt.setHours(executeAt.getHours() + (campaign.abTestConfig?.testDurationHours || 4));
        
        const jobRef = await adminDb.collection('automation_jobs').add({
          targetNodeId: '__campaign_ab_evaluate__',
          executeAt: executeAt.toISOString(),
          status: 'pending',
          automationId: 'campaign_ab_eval',
          runId: '',
          payload: { campaignId },
          createdAt: new Date().toISOString(),
        });
        
        await campaignRef.update({ 'abTestConfig.evaluationJobId': jobRef.id });
      }

      try {
        after(async () => {
          await processJobChunkBackground(jobResult.jobId);
        });
      } catch (e) {
        console.warn('[DISPATCH] next/server after() called outside request context, running asynchronously:', (e as Error).message);
        processJobChunkBackground(jobResult.jobId).catch(err => {
          console.error('[DISPATCH] Background processing error:', err.message);
        });
      }

      return { success: true, jobId: jobResult.jobId };
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

    // 9. Trigger async background chunk processing (fire-and-forget via after())
    try {
      after(async () => {
        await processJobChunkBackground(jobResult.jobId);
      });
    } catch (e) {
      console.warn('[DISPATCH] next/server after() called outside request context, running asynchronously:', (e as Error).message);
      processJobChunkBackground(jobResult.jobId).catch(err => {
        console.error('[DISPATCH] Background processing error:', err.message);
      });
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
      entityId: d.data().entityId,
      displayName: d.data().displayName,
      campaignVariantId: d.data().campaignVariantId || 'A', // Preserve variant
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

    // Process first chunk in background
    try {
      after(async () => {
        await processJobChunkBackground(jobResult.jobId);
      });
    } catch (e) {
      console.warn('[RESEND] next/server after() called outside request context, running asynchronously:', (e as Error).message);
      processJobChunkBackground(jobResult.jobId).catch(err => {
        console.error('[RESEND] Background processing error:', err.message);
      });
    }

    return { success: true, jobId: jobResult.jobId };
  } catch (error: any) {
    console.error('[RESEND] Failed:', error.message);
    return { success: false, error: error.message };
  }
}
