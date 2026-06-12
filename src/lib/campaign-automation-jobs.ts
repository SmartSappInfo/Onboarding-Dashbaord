'use server';

import { adminDb } from './firebase-admin';
import type { MessageCampaign } from './types';
import { FieldValue } from 'firebase-admin/firestore';

export async function evaluateCampaignABTest(campaignId: string, forcedWinnerId?: 'A' | 'B'): Promise<void> {
  const campaignRef = adminDb.collection('message_campaigns').doc(campaignId);
  
  // Use transaction to atomically evaluate winner and lock status to 'sending'
  const winnerDetails = await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(campaignRef);
    if (!snap.exists) throw new Error('Campaign not found');
    const campaign = snap.data() as MessageCampaign;

    if (campaign.status !== 'testing' && campaign.status !== 'paused') {
      return null; // Already evaluated or not in a valid state
    }

    const variantA = campaign.variants?.find(v => v.id === 'A')!;
    const variantB = campaign.variants?.find(v => v.id === 'B')!;

    const statsA = variantA?.stats || { totalSent: 0, totalOpened: 0, totalClicked: 0, totalUnsubscribed: 0 };
    const statsB = variantB?.stats || { totalSent: 0, totalOpened: 0, totalClicked: 0, totalUnsubscribed: 0 };

    let winningVariantId: 'A' | 'B' = 'A';
    
    if (forcedWinnerId) {
      winningVariantId = forcedWinnerId;
    } else {
      const metric = campaign.abTestConfig?.winnerMetric || 'open_rate';
      let scoreA = 0;
      let scoreB = 0;

      if (metric === 'open_rate') {
        scoreA = statsA.totalSent > 0 ? statsA.totalOpened / statsA.totalSent : 0;
        scoreB = statsB.totalSent > 0 ? statsB.totalOpened / statsB.totalSent : 0;
      } else if (metric === 'click_rate') {
        scoreA = statsA.totalSent > 0 ? statsA.totalClicked / statsA.totalSent : 0;
        scoreB = statsB.totalSent > 0 ? statsB.totalClicked / statsB.totalSent : 0;
      } else if (metric === 'low_unsubscribe_rate') {
        scoreA = statsA.totalSent > 0 ? (statsA.totalSent - (statsA.totalUnsubscribed || 0)) / statsA.totalSent : 1;
        scoreB = statsB.totalSent > 0 ? (statsB.totalSent - (statsB.totalUnsubscribed || 0)) / statsB.totalSent : 1;
      }

      winningVariantId = scoreB > scoreA ? 'B' : 'A';
    }

    transaction.update(campaignRef, {
      'abTestConfig.winningVariantId': winningVariantId,
      'abTestConfig.winnerSelectedAt': new Date().toISOString(),
      status: 'sending',
      updatedAt: new Date().toISOString(),
    });

    return { winningVariantId, campaign };
  });

  if (!winnerDetails) return; // Exit if already processed

  const { winningVariantId, campaign } = winnerDetails;

  // Resolve already sent recipients across all jobs of this campaign in parallel
  const sentRecipients = new Set<string>();
  const jobsSnap = await adminDb.collection('message_jobs')
    .where('campaignId', '==', campaignId)
    .get();

  const taskPromises = jobsSnap.docs.map(async (jobDoc) => {
    const tasksSnap = await jobDoc.ref.collection('tasks').get();
    return tasksSnap.docs.map(tDoc => tDoc.data().recipient);
  });

  const nestedRecipients = await Promise.all(taskPromises);
  nestedRecipients.flat().forEach(recipient => {
    if (recipient) sentRecipients.add(recipient);
  });

  const { previewCampaignAudience, resolveRecipientContacts } = await import('./messaging-actions');
  const audienceResult = await previewCampaignAudience({
    workspaceId: campaign.workspaceId,
    filters: campaign.audienceDefinition?.filters as any,
    filterLogic: campaign.audienceDefinition?.filterLogic,
    includeTagIds: campaign.audienceDefinition?.tagIds,
    excludeTagIds: campaign.audienceDefinition?.excludeTagIds,
    includeLogic: campaign.audienceDefinition?.tagLogic === 'all' ? 'AND' : 'OR',
    limit: 5000,
  });

  if (!audienceResult.success || !audienceResult.preview) {
    throw new Error('Failed to resolve audience during remainder dispatch');
  }

  const recipients: any[] = [];
  const contactRolesFilter = campaign.audienceDefinition?.filters?.find((f: any) => f.field === 'contactRoles');
  const contactRoles = contactRolesFilter ? contactRolesFilter.value as string[] : null;

  for (const entity of audienceResult.preview!) {
    try {
      const resolved = await resolveRecipientContacts({
        entityId: entity.id,
        workspaceId: campaign.workspaceId,
        contactScope: campaign.audienceDefinition?.contactScope || 'primary',
        channel: campaign.channel === 'email' ? 'email' : 'sms',
        contactRoles,
      });

      for (const r of resolved) {
        if (sentRecipients.has(r.contact)) continue;

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
          campaignVariantId: winningVariantId,
        });
      }
    } catch (err) {}
  }

  if (recipients.length === 0) {
    await campaignRef.update({ status: 'sent', updatedAt: new Date().toISOString() });
    return;
  }

  const winningVariant = campaign.variants?.find(v => v.id === winningVariantId)!;
  let templateId = winningVariant.templateId || '';

  if (!templateId) {
    const ephemeralRef = await adminDb.collection('message_templates').add({
      name: `[Campaign remainder] ${campaign.internalName} - Variant ${winningVariantId}`,
      channel: campaign.channel,
      category: 'campaign',
      target: campaign.target,
      contentMode: campaign.contentMode || 'plain_text',
      subject: winningVariant.customSubject || '',
      body: winningVariant.customBody || '',
      blocks: winningVariant.customBlocks || [],
      styleId: campaign.styleId || null,
      organizationId: campaign.organizationId,
      workspaceIds: [campaign.workspaceId],
      isEphemeral: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    templateId = ephemeralRef.id;
  }

  const { createBulkMessageJob, processJobChunkBackground } = await import('./bulk-messaging');
  const jobResult = await createBulkMessageJob({
    templateId,
    senderProfileId: campaign.senderProfileId || '',
    recipients,
    userId: campaign.createdBy,
  });

  await campaignRef.update({ jobId: jobResult.jobId });
  await adminDb.collection('message_jobs').doc(jobResult.jobId).update({
    campaignId,
    workspaceId: campaign.workspaceId,
    organizationId: campaign.organizationId,
  });

  try {
    const { after } = await import('next/server');
    after(async () => {
      await processJobChunkBackground(jobResult.jobId);
    });
  } catch (e) {
    console.warn('[AB-EVAL] next/server after() called outside request context, running asynchronously:', (e as Error).message);
    processJobChunkBackground(jobResult.jobId).catch(err => {
      console.error('[AB-EVAL] Background processing error:', err.message);
    });
  }
}

export async function selectCampaignWinnerManual(campaignId: string, winningVariantId: 'A' | 'B'): Promise<void> {
  const pendingJobs = await adminDb.collection('automation_jobs')
    .where('payload.campaignId', '==', campaignId)
    .where('targetNodeId', '==', '__campaign_ab_evaluate__')
    .where('status', '==', 'pending')
    .get();

  for (const doc of pendingJobs.docs) {
    await doc.ref.update({ status: 'cancelled' });
  }

  await evaluateCampaignABTest(campaignId, winningVariantId);
}

export async function cancelCampaignABTest(campaignId: string): Promise<void> {
  const campaignRef = adminDb.collection('message_campaigns').doc(campaignId);
  
  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(campaignRef);
    if (!snap.exists) throw new Error('Campaign not found');
    const campaign = snap.data() as MessageCampaign;
    
    if (campaign.status !== 'testing') {
      throw new Error(`Cannot cancel A/B test in '${campaign.status}' status`);
    }
    
    transaction.update(campaignRef, {
      status: 'paused',
      updatedAt: new Date().toISOString(),
    });
  });

  const pendingJobs = await adminDb.collection('automation_jobs')
    .where('payload.campaignId', '==', campaignId)
    .where('targetNodeId', '==', '__campaign_ab_evaluate__')
    .where('status', '==', 'pending')
    .get();

  const batch = adminDb.batch();
  for (const doc of pendingJobs.docs) {
    batch.update(doc.ref, { status: 'cancelled' });
  }
  await batch.commit();
}

export async function resumeCampaignABTest(campaignId: string): Promise<void> {
  const campaignRef = adminDb.collection('message_campaigns').doc(campaignId);
  
  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(campaignRef);
    if (!snap.exists) throw new Error('Campaign not found');
    const campaign = snap.data() as MessageCampaign;
    
    if (campaign.status !== 'paused') {
      throw new Error(`Cannot resume A/B test in '${campaign.status}' status`);
    }
    
    transaction.update(campaignRef, {
      status: 'testing',
      updatedAt: new Date().toISOString(),
    });
  });

  const campaignSnap = await campaignRef.get();
  const campaign = campaignSnap.data() as MessageCampaign;
  
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
