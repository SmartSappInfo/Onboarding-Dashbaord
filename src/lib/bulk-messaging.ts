'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { after } from 'next/server';
import { sendMessage } from './messaging-engine';
import { getBaseUrl } from './utils/url-helpers';
import { sendBatchEmails } from './resend-service';
import { resolveVariables, renderBlocksToHtml, plainTextToHtml } from './messaging-utils';
import { resolveOrgBrandingVars } from './messaging-branding';
import { resolveOrgProviderKeys } from './messaging/org-provider-keys';
import { notifyMessagingFailure } from './messaging/messaging-failure-notice';
import type { MessageJob, MessageTask, MessageTemplate, SenderProfile, MessageStyle, MessageCampaign } from './types';

const CHUNK_SIZE = 50; // Number of tasks to process in one server action call

function safeAfter(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch (e) {
    fn().catch(err => {
      console.error('[BULK-BG] SafeAfter fallback execution failed:', err.message);
    });
  }
}

interface BulkJobInput {
  templateId: string;
  senderProfileId: string;
  recipients: { recipient: string; variables: Record<string, any>; entityId?: string; displayName?: string; campaignVariantId?: 'A' | 'B' }[];
  userId: string;
  trackLinks?: boolean;
  campaignId?: string;
}

/**
 * Creates a new bulk message job and fans out the individual tasks.
 */
export async function createBulkMessageJob(input: BulkJobInput): Promise<{ jobId: string }> {
  const { templateId, senderProfileId, recipients, userId } = input;

  try {
    // 1. Fetch Template to confirm channel
    const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
    if (!templateSnap.exists) throw new Error("Template not found");
    const template = templateSnap.data() as MessageTemplate;

    // Email uses the inline batch path; SMS and WhatsApp fall into the `else`
    // branch below, which delegates per-recipient to the messaging engine
    // (the engine's WhatsApp branch handles session/template/approval rules).
    // Anything else is unsupported — fail loud rather than silently coercing to
    // email (spec §3A F2).
    if (template.channel !== 'email' && template.channel !== 'sms' && template.channel !== 'whatsapp') {
      throw new Error(
        `[bulk-messaging] Channel '${template.channel}' is not supported by bulk dispatch. Use the messaging engine.`,
      );
    }

    // 2. Initialize Job record
    const jobData: Omit<MessageJob, 'id'> = {
      templateId,
      senderProfileId,
      channel: template.channel,
      createdBy: userId,
      status: 'queued',
      totalRecipients: recipients.length,
      processed: 0,
      success: 0,
      failed: 0,
      trackLinks: input.trackLinks || false,
      campaignId: input.campaignId,
      createdAt: new Date().toISOString()
    };

    const jobRef = await adminDb.collection('message_jobs').add(jobData);

    // 3. Task Fan-out (Batched for Firestore limits)
    const taskChunks = [];
    for (let i = 0; i < recipients.length; i += 450) {
      taskChunks.push(recipients.slice(i, i + 450));
    }

    for (const chunk of taskChunks) {
      const batch = adminDb.batch();
      for (const item of chunk) {
        const taskRef = jobRef.collection('tasks').doc();
        const taskData: Omit<MessageTask, 'id'> = {
          recipient: item.recipient,
          variables: item.variables,
          status: 'pending',
          ...(item.entityId && { entityId: item.entityId }),
          ...(item.displayName && { displayName: item.displayName }),
          ...(item.campaignVariantId && { campaignVariantId: item.campaignVariantId }),
        };
        batch.set(taskRef, taskData);
      }
      await batch.commit();
    }

    return { jobId: jobRef.id };

  } catch (error: any) {
    console.error(">>> [BULK] JOB CREATION FAILED:", error.message);
    throw error;
  }
}

/**
 * Processes a single chunk of tasks for a given job.
 */
export async function processBulkJobChunk(jobId: string) {
  try {
    const jobRef = adminDb.collection('message_jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    
    if (!jobSnap.exists) throw new Error("Job not found");
    const job = jobSnap.data() as MessageJob;

    if (job.status === 'completed' || job.status === 'failed') {
        return { status: job.status, progress: 100 };
    }

    if (job.status === 'queued') {
        await jobRef.update({ status: 'processing' });
    }

    const tasksSnap = await jobRef.collection('tasks')
        .where('status', '==', 'pending')
        .limit(CHUNK_SIZE)
        .get();

    if (tasksSnap.empty) {
        await jobRef.update({ status: 'completed' });
        return { status: 'completed', progress: 100 };
    }

    const [templateSnap, senderSnap] = await Promise.all([
        adminDb.collection('message_templates').doc(job.templateId).get(),
        adminDb.collection('sender_profiles').doc(job.senderProfileId).get(),
    ]);

    let template = templateSnap.data() as MessageTemplate;
    const sender = senderSnap.data() as SenderProfile;

    let campaign: MessageCampaign | null = null;
    if (job.campaignId) {
        const campSnap = await adminDb.collection('message_campaigns').doc(job.campaignId).get();
        if (campSnap.exists) {
            campaign = campSnap.data() as MessageCampaign;
        }
    }

    // Resolve org (job is authoritative, template is fallback) + org-scoped provider keys.
    const orgId = job.organizationId || template.organizationId || '';
    const providerKeys = await resolveOrgProviderKeys(orgId);

    // Tenant guard: never send using a sender owned by a different organization.
    if (sender?.organizationId && orgId && sender.organizationId !== orgId) {
        await notifyMessagingFailure({
            orgId, channel: job.channel, templateId: job.templateId,
            recipient: 'bulk-job', outcome: 'cross_org_explicit', workspaceId: job.workspaceId,
        });
        const failBatch = adminDb.batch();
        tasksSnap.docs.forEach((d) => failBatch.update(d.ref, { status: 'failed', error: 'Sender belongs to a different organization' }));
        await failBatch.commit();
        await jobRef.update({ status: 'failed', failed: FieldValue.increment(tasksSnap.size) });
        return { status: 'failed', progress: Math.round((job.processed / job.totalRecipients) * 100) };
    }

    const orgBrandingVars = await resolveOrgBrandingVars(orgId);

    let styleWrapper = '';
    if (template.channel === 'email' && template.styleId && template.styleId !== 'none') {
        const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
        if (styleSnap.exists) {
            styleWrapper = (styleSnap.data() as MessageStyle).htmlWrapper || '';
        }
    }

    // Phase 3: Page Link Pre-pass — resolve {{page_link:slug}} tokens in the template body.
    // Runs once per job (template is shared across all recipients).
    // Entity identity is NOT added here; the /api/l/{id} redirect appends ?ref= per-recipient.
    {
        const { extractPageLinkSlugs, resolvePageLinkTokens, buildPageLinkMap } = await import('./page-link-resolver');
        const bodyToScan = template.body || '';
        const slugs = extractPageLinkSlugs(bodyToScan);
        if (slugs.length > 0) {
            const pageLinks = await buildPageLinkMap(slugs, adminDb);
            template = { ...template, body: resolvePageLinkTokens(bodyToScan, pageLinks) };
        }
    }

    let successIncrement = 0;
    let failedIncrement = 0;

    if (job.channel === 'email') {
        const { isSuppressed } = await import('./suppression-service');
        
        const batchPayload: Array<{
            from: string;
            to: string;
            subject: string;
            html: string;
            entityId?: string;
            taskDocRef: FirebaseFirestore.DocumentReference;
            tags: { name: string; value: string }[];
        }> = [];
        for (const taskDoc of tasksSnap.docs) {
            const task = taskDoc.data() as MessageTask;
            
            // Suppression Check
            const suppressed = await isSuppressed({
                recipient: task.recipient,
                workspaceId: job.workspaceId || 'onboarding',
                channel: 'email'
            });
            
            if (suppressed) {
                failedIncrement++;
                await taskDoc.ref.update({ status: 'failed', error: 'Recipient unsubscribed' });
                continue;
            }

            // Merge org branding as base layer; task-specific vars override
            const mergedVars = { ...orgBrandingVars, ...task.variables };
            
            // Phase 7: Inject Unsubscribe Link
            const baseUrl = getBaseUrl();
            const unsubId = task.entityId || task.recipient;
            let unsubUrl = `${baseUrl}/unsubscribe/${encodeURIComponent(unsubId)}?ws=${job.workspaceId || 'onboarding'}&c=${job.channel}`;
            if (job.campaignId) {
                unsubUrl += `&cmp=${encodeURIComponent(job.campaignId)}`;
            }
            if (task.campaignVariantId) {
                unsubUrl += `&v=${encodeURIComponent(task.campaignVariantId)}`;
            }
            mergedVars.unsubscribe_link = unsubUrl;

            let html = '';
            let currentSubject = template.subject || '';
            let currentBody = template.body || '';
            let currentBlocks = template.blocks || [];
            let currentContentMode = template.contentMode || 'plain_text';

            if (campaign?.abTestEnabled && campaign.variants?.length) {
                const variantId = task.campaignVariantId || 'A';
                const variant = campaign.variants.find(v => v.id === variantId);
                if (variant) {
                    currentSubject = variant.customSubject ?? currentSubject;
                    currentBody = variant.customBody ?? currentBody;
                    currentBlocks = variant.customBlocks ?? currentBlocks;
                    if (variant.customBlocks && variant.customBlocks.length > 0) {
                        currentContentMode = 'rich_builder';
                    }
                }
            }

            let subject = resolveVariables(currentSubject, mergedVars);

            // contentMode-aware routing (matches messaging-engine.ts)
            const useBlocks = currentContentMode === 'rich_builder'
                || (!currentContentMode && currentBlocks.length);

            if (useBlocks && currentBlocks.length) {
                html = renderBlocksToHtml(currentBlocks, mergedVars, {
                    wrapper: styleWrapper || undefined
                });
            } else {
                html = resolveVariables(currentBody, mergedVars);
                if (styleWrapper && styleWrapper.includes('{{content}}')) {
                    html = resolveVariables(styleWrapper, mergedVars).replace('{{content}}', html);
                } else if (currentContentMode === 'plain_text' || !currentContentMode) {
                    html = plainTextToHtml(html);
                }
            }

            // Phase 7: Branded Link Tracking placeholder (applied in batch below)

            batchPayload.push({
                from: sender.identifier,
                to: task.recipient,
                subject: subject,
                html: html,
                entityId: task.entityId,
                taskDocRef: taskDoc.ref,
                tags: [
                    { name: 'jobId', value: jobId },
                    { name: 'taskId', value: taskDoc.id }
                ]
            });
        }

        // Phase 7: Apply link tracking transformation in parallel (one tracked link per unique URL)
        if (job.trackLinks) {
            const { transformBodyWithTracking } = await import('./link-tracking');
            await Promise.all(
                batchPayload.map(async (payload) => {
                    payload.html = await transformBodyWithTracking({
                        body: payload.html,
                        campaignId: job.campaignId || 'manual',
                        jobId: jobId,
                        taskId: payload.taskDocRef.id,
                        entityId: payload.entityId,
                    });
                })
            );
        }

        try {
            const result = await sendBatchEmails(batchPayload, providerKeys.resendKey, providerKeys.resendDomain);
            if (result.data) {
                for (let i = 0; i < result.data.length; i++) {
                    const res = result.data[i];
                    const taskRef = batchPayload[i].taskDocRef;
                    if (res.id) {
                        successIncrement++;
                        await taskRef.update({ status: 'sent', providerId: res.id, sentAt: new Date().toISOString() });
                    } else {
                        failedIncrement++;
                        await taskRef.update({ status: 'failed', error: 'Provider rejection in batch' });
                    }
                }
            }
        } catch (e: any) {
            failedIncrement = tasksSnap.size;
            for (const doc of tasksSnap.docs) {
                await doc.ref.update({ status: 'failed', error: e.message });
            }
        }
    } else {
        const { transformBodyWithTracking } = await import('./link-tracking');
        for (const taskDoc of tasksSnap.docs) {
            const task = taskDoc.data() as MessageTask;
            
            // Resolve variables for individual task body (if not already handled)
            // For raw messages or simple templates, we need to ensure the body is ready for tracking
            // In bulk-messaging, individual tasks don't have their own bodies, they use template.body + variables
            
            let finalBody = ''; // This is handled inside sendMessage, but for tracking we need it BEFORE
            // Actually, sendMessage handles the resolution.
            // If we want to track links in SMS, we should probably resolve variables, then track, then pass as override.
            
            let subjectOverride = undefined;
            let bodyOverride = undefined;

            if (campaign?.abTestEnabled && campaign.variants?.length) {
                const variantId = task.campaignVariantId || 'A';
                const variant = campaign.variants.find(v => v.id === variantId);
                if (variant) {
                    subjectOverride = variant.customSubject ?? undefined;
                    bodyOverride = variant.customBody ?? undefined;
                }
            }

            const result = await sendMessage({
                templateId: job.templateId,
                senderProfileId: job.senderProfileId,
                organizationId: orgId,
                recipient: task.recipient,
                variables: task.variables,
                entityId: task.entityId || task.variables?.entityId || undefined,
                trackLinks: job.trackLinks,
                subject: subjectOverride,
                body: bodyOverride,
                campaignId: job.campaignId,
                campaignVariantId: task.campaignVariantId,
                tags: [
                    { name: 'jobId', value: jobId },
                    { name: 'taskId', value: taskDoc.id }
                ]
            });

            if (result.success) {
                successIncrement++;
                await taskDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
            } else {
                failedIncrement++;
                await taskDoc.ref.update({ status: 'failed', error: result.error });
            }
        }
    }

    const newProcessed = job.processed + tasksSnap.size;
    const newSuccess = job.success + successIncrement;
    const newFailed = job.failed + failedIncrement;
    const isFinished = newProcessed >= job.totalRecipients;

    await jobRef.update({
        processed: newProcessed,
        success: newSuccess,
        failed: newFailed,
        status: isFinished ? 'completed' : 'processing'
    });

    // R1 fix: Fire campaign completion hooks when job finishes
    if (isFinished && job.campaignId) {
        // Fire-and-forget: don't block the chunk return
        Promise.resolve().then(async () => {
            try {
                const { applyCampaignPostSendTags } = await import('./campaign-post-send');
                const { syncCampaignStats } = await import('./campaign-analytics');

                // Update campaign status to 'sent'
                await adminDb.collection('message_campaigns').doc(job.campaignId!).update({
                    status: 'sent',
                    updatedAt: new Date().toISOString(),
                });

                // Sync denormalized stats
                await syncCampaignStats(job.campaignId!);

                // Apply post-send tag rules
                await applyCampaignPostSendTags(job.campaignId!);

                // Emit campaign events for automation triggers (Story 3)
                const { emitCampaignEvents } = await import('./campaign-events');
                await emitCampaignEvents(job.campaignId!);

                console.log(`>>> [BULK] Campaign ${job.campaignId} completion hooks fired`);
            } catch (hookErr) {
                console.error('>>> [BULK] Completion hook error:', (hookErr as Error).message);
            }
        });
    }

    const progress = Math.round((newProcessed / job.totalRecipients) * 100);
    return { 
        status: isFinished ? 'completed' : 'processing', 
        progress,
        processed: newProcessed,
        total: job.totalRecipients
    };

  } catch (error: any) {
    console.error(">>> [BULK] CHUNK PROCESSING FAILED:", error.message);
    throw error;
  }
}

/**
 * Background Worker: Processes a chunk of tasks server-side without requiring
 * a client connection. Uses Next.js `after()` to recursively schedule the
 * next chunk, enabling true fire-and-forget processing.
 *
 * Key improvements over `processBulkJobChunk`:
 * - **Idempotency**: Skips tasks already marked as 'sent' to prevent duplicates.
 * - **Atomic counters**: Uses FieldValue.increment() instead of read-modify-write.
 * - **Self-scheduling**: Uses after() to chain chunks without client polling.
 * - **SDK error handling**: Checks Resend { data, error } explicitly (no try/catch).
 */
export async function processJobChunkBackground(jobId: string): Promise<void> {
  const jobRef = adminDb.collection('message_jobs').doc(jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    console.error(`>>> [BULK-BG] Job ${jobId} not found`);
    return;
  }

  const job = jobSnap.data() as MessageJob;

  // Already finished — no-op
  if (job.status === 'completed' || job.status === 'failed') return;

  // Mark as processing if still queued
  if (job.status === 'queued') {
    await jobRef.update({ status: 'processing' });
  }

  // Fetch the next chunk of PENDING tasks only
  const tasksSnap = await jobRef.collection('tasks')
    .where('status', '==', 'pending')
    .limit(CHUNK_SIZE)
    .get();

  // No pending tasks remaining → mark job as completed
  if (tasksSnap.empty) {
    await jobRef.update({ status: 'completed' });

    // Fire campaign completion hooks
    if (job.campaignId) {
      safeAfter(async () => {
        try {
          const { applyCampaignPostSendTags } = await import('./campaign-post-send');
          const { syncCampaignStats } = await import('./campaign-analytics');

          await adminDb.collection('message_campaigns').doc(job.campaignId!).update({
            status: 'sent',
            updatedAt: new Date().toISOString(),
          });

          await syncCampaignStats(job.campaignId!);
          await applyCampaignPostSendTags(job.campaignId!);

          const { emitCampaignEvents } = await import('./campaign-events');
          await emitCampaignEvents(job.campaignId!);

          console.log(`>>> [BULK-BG] Campaign ${job.campaignId} completion hooks fired`);
        } catch (hookErr) {
          console.error('>>> [BULK-BG] Completion hook error:', (hookErr as Error).message);
        }
      });
    }

    return;
  }

  // ── Resolve shared resources once per chunk (async-parallel) ──────────
  const [templateSnap, senderSnap] = await Promise.all([
    adminDb.collection('message_templates').doc(job.templateId).get(),
    adminDb.collection('sender_profiles').doc(job.senderProfileId).get(),
  ]);

  const template = templateSnap.data() as MessageTemplate;
  const sender = senderSnap.data() as SenderProfile;

  let campaign: MessageCampaign | null = null;
  if (job.campaignId) {
    const campSnap = await adminDb.collection('message_campaigns').doc(job.campaignId).get();
    if (campSnap.exists) {
      campaign = campSnap.data() as MessageCampaign;
    }
  }

  // Resolve org (job is authoritative, template is fallback) + org-scoped provider keys.
  const orgId = job.organizationId || template.organizationId || '';
  const providerKeys = await resolveOrgProviderKeys(orgId);

  // Tenant guard: never send using a sender owned by a different organization.
  if (sender?.organizationId && orgId && sender.organizationId !== orgId) {
    await notifyMessagingFailure({
      orgId, channel: job.channel, templateId: job.templateId,
      recipient: 'bulk-job', outcome: 'cross_org_explicit', workspaceId: job.workspaceId,
    });
    const failBatch = adminDb.batch();
    tasksSnap.docs.forEach((d) => failBatch.update(d.ref, { status: 'failed', error: 'Sender belongs to a different organization' }));
    await failBatch.commit();
    await jobRef.update({ status: 'failed', failed: FieldValue.increment(tasksSnap.size) });
    return;
  }

  const orgBrandingVars = await resolveOrgBrandingVars(orgId);

  let styleWrapper = '';
  if (template.channel === 'email' && template.styleId && template.styleId !== 'none') {
    const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
    if (styleSnap.exists) {
      styleWrapper = (styleSnap.data() as MessageStyle).htmlWrapper || '';
    }
  }

  // ── Process tasks with idempotency ───────────────────────────────────
  let successIncrement = 0;
  let failedIncrement = 0;
  let processedCount = 0;

  if (job.channel === 'email') {
    const { isSuppressed } = await import('./suppression-service');
    const batchPayload: any[] = [];

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data() as MessageTask;

      // ── Idempotency: Skip already-sent tasks ──
      if (task.status === 'sent') continue;

      processedCount++;

      // Suppression Check
      const suppressed = await isSuppressed({
        recipient: task.recipient,
        workspaceId: job.workspaceId || 'onboarding',
        channel: 'email',
      });

      if (suppressed) {
        failedIncrement++;
        await taskDoc.ref.update({ status: 'failed', error: 'Recipient unsubscribed' });
        continue;
      }

      // Merge org branding as base layer; task-specific vars override
      const mergedVars = { ...orgBrandingVars, ...task.variables };

      // Inject unsubscribe link
      const baseUrl = getBaseUrl();
      const unsubId = task.entityId || task.recipient;
      let unsubUrl = `${baseUrl}/unsubscribe/${encodeURIComponent(unsubId)}?ws=${job.workspaceId || 'onboarding'}&c=${job.channel}`;
      if (job.campaignId) {
        unsubUrl += `&cmp=${encodeURIComponent(job.campaignId)}`;
      }
      if (task.campaignVariantId) {
        unsubUrl += `&v=${encodeURIComponent(task.campaignVariantId)}`;
      }
      mergedVars.unsubscribe_link = unsubUrl;

      let html = '';
      let currentSubject = template.subject || '';
      let currentBody = template.body || '';
      let currentBlocks = template.blocks || [];
      let currentContentMode = template.contentMode || 'plain_text';

      if (campaign?.abTestEnabled && campaign.variants?.length) {
        const variantId = task.campaignVariantId || 'A';
        const variant = campaign.variants.find(v => v.id === variantId);
        if (variant) {
          currentSubject = variant.customSubject ?? currentSubject;
          currentBody = variant.customBody ?? currentBody;
          currentBlocks = variant.customBlocks ?? currentBlocks;
          if (variant.customBlocks && variant.customBlocks.length > 0) {
            currentContentMode = 'rich_builder';
          }
        }
      }

      const subject = resolveVariables(currentSubject, mergedVars);

      const useBlocks =
        currentContentMode === 'rich_builder' ||
        (!currentContentMode && currentBlocks.length);

      if (useBlocks && currentBlocks.length) {
        html = renderBlocksToHtml(currentBlocks, mergedVars, {
          wrapper: styleWrapper || undefined,
        });
      } else {
        html = resolveVariables(currentBody, mergedVars);
        if (styleWrapper && styleWrapper.includes('{{content}}')) {
          html = resolveVariables(styleWrapper, mergedVars).replace('{{content}}', html);
        } else if (currentContentMode === 'plain_text' || !currentContentMode) {
          html = plainTextToHtml(html);
        }
      }

      batchPayload.push({
        from: sender.identifier,
        to: task.recipient,
        subject,
        html,
        taskDocRef: taskDoc.ref,
        taskDocId: taskDoc.id,
        tags: [
          { name: 'jobId', value: jobId },
          { name: 'taskId', value: taskDoc.id },
        ],
      });
    }

    // Phase 7: Apply link tracking
    if (job.trackLinks && batchPayload.length > 0) {
      const { transformBodyWithTracking } = await import('./link-tracking');
      for (const payload of batchPayload) {
        payload.html = await transformBodyWithTracking({
          body: payload.html,
          campaignId: job.campaignId || 'manual',
          jobId,
          taskId: payload.taskDocId,
        });
      }
    }

    // Send batch — use Resend { data, error } pattern with robust request try/catch
    if (batchPayload.length > 0) {
      try {
        const result = await sendBatchEmails(batchPayload, providerKeys.resendKey, providerKeys.resendDomain);
        if (result.data) {
          for (let i = 0; i < result.data.length; i++) {
            const res = result.data[i];
            const taskRef = batchPayload[i].taskDocRef;
            if (res.id) {
              successIncrement++;
              await taskRef.update({
                status: 'sent',
                providerId: res.id,
                providerMessageId: res.id,
                sentAt: new Date().toISOString(),
              });
            } else {
              failedIncrement++;
              await taskRef.update({ status: 'failed', error: 'Provider rejection in batch' });
            }
          }
        }
        if (result.error) {
          console.error('>>> [BULK-BG] Batch send error:', result.error);
          // Mark remaining un-processed tasks as failed
          for (const payload of batchPayload) {
            failedIncrement++;
            await payload.taskDocRef.update({ status: 'failed', error: String(result.error) });
          }
        }
      } catch (e: any) {
        console.error('>>> [BULK-BG] Batch send API call crashed:', e.message);
        failedIncrement = batchPayload.length;
        for (const payload of batchPayload) {
          await payload.taskDocRef.update({ status: 'failed', error: e.message });
        }
      }
    }
  } else {
    // SMS / Push / In-app — individual sends
    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data() as MessageTask;

      // ── Idempotency: Skip already-sent tasks ──
      if (task.status === 'sent') continue;

      processedCount++;

      let subjectOverride = undefined;
      let bodyOverride = undefined;

      if (campaign?.abTestEnabled && campaign.variants?.length) {
        const variantId = task.campaignVariantId || 'A';
        const variant = campaign.variants.find(v => v.id === variantId);
        if (variant) {
          subjectOverride = variant.customSubject ?? undefined;
          bodyOverride = variant.customBody ?? undefined;
        }
      }

      const result = await sendMessage({
        templateId: job.templateId,
        senderProfileId: job.senderProfileId,
        organizationId: orgId,
        recipient: task.recipient,
        variables: task.variables,
        trackLinks: job.trackLinks,
        subject: subjectOverride,
        body: bodyOverride,
        campaignId: job.campaignId,
        campaignVariantId: task.campaignVariantId,
        tags: [
          { name: 'jobId', value: jobId },
          { name: 'taskId', value: taskDoc.id },
        ],
      });

      if (result.success) {
        successIncrement++;
        await taskDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
      } else {
        failedIncrement++;
        await taskDoc.ref.update({ status: 'failed', error: result.error });
      }
    }
  }

  // ── Atomic counter update ────────────────────────────────────────────
  const updatePayload: Record<string, any> = {
    processed: FieldValue.increment(processedCount || tasksSnap.size),
    success: FieldValue.increment(successIncrement),
    failed: FieldValue.increment(failedIncrement),
  };

  // Check if job is now complete (after this chunk)
  const currentProcessed = (job.processed || 0) + (processedCount || tasksSnap.size);
  const isFinished = currentProcessed >= job.totalRecipients;

  if (isFinished) {
    updatePayload.status = 'completed';
  }

  await jobRef.update(updatePayload);

  // ── Self-schedule next chunk via after() if not finished ─────────────
  if (!isFinished) {
    safeAfter(async () => {
      try {
        await processJobChunkBackground(jobId);
      } catch (e) {
        console.error('>>> [BULK-BG] Next chunk scheduling failed:', (e as Error).message);
      }
    });
  } else if (job.campaignId) {
    // Fire campaign completion hooks on finish
    safeAfter(async () => {
      try {
        const { applyCampaignPostSendTags } = await import('./campaign-post-send');
        const { syncCampaignStats } = await import('./campaign-analytics');

        await adminDb.collection('message_campaigns').doc(job.campaignId!).update({
          status: 'sent',
          updatedAt: new Date().toISOString(),
        });

        await syncCampaignStats(job.campaignId!);
        await applyCampaignPostSendTags(job.campaignId!);

        const { emitCampaignEvents } = await import('./campaign-events');
        await emitCampaignEvents(job.campaignId!);

        console.log(`>>> [BULK-BG] Campaign ${job.campaignId} completion hooks fired`);
      } catch (hookErr) {
        console.error('>>> [BULK-BG] Completion hook error:', (hookErr as Error).message);
      }
    });
  }
}
