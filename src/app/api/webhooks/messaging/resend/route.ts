
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { adminDb } from '@/lib/firebase-admin';
import { updateCampaignRealtimeStat } from '@/lib/campaign-analytics';
import { incrementMessageNodeStat } from '@/lib/messaging/message-node-stats';
import type { MessageLog, MessageNodeStatCounter, TrackedMessageChannel } from '@/lib/types';

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Canonical Resend webhook. Campaign sends (carrying jobId/taskId tags) update
 * `message_jobs/{jobId}/tasks/{taskId}`. Automation/transactional sends carry no
 * such tags and are correlated to `message_logs` by providerId instead — see
 * {@link handleAutomationMessageEvent}. This folds in the previously insecure
 * `/api/webhooks/resend` route under Svix verification.
 */

/** Resend event type → the per-node counter it increments (first occurrence only). */
const NODE_STAT_BY_EVENT: Record<string, MessageNodeStatCounter | undefined> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

/**
 * Updates the `message_logs` record for a non-campaign (automation/transactional)
 * email and increments the owning node's denormalized stats. Idempotent: each
 * delivery milestone is applied once (guarded by its structured timestamp), so
 * Resend retries and repeat opens/clicks never double-count node stats.
 */
async function handleAutomationMessageEvent(
  type: string,
  emailId: string,
  createdAt: string | undefined,
  eventData?: any
): Promise<void> {
  const logsSnap = await adminDb
    .collection('message_logs')
    .where('providerId', '==', emailId)
    .limit(1)
    .get();

  if (logsSnap.empty) {
    console.warn(`>>> [WEBHOOK] No message_log found for email_id ${emailId}. Ignoring.`);
    return;
  }

  const logDoc = logsSnap.docs[0];
  const log = logDoc.data() as MessageLog;
  const ts = createdAt || new Date().toISOString();

  const updates: Record<string, unknown> = {
    providerStatus: type.replace('email.', ''),
    updatedAt: new Date().toISOString(),
  };

  // `isNewMilestone` gates both the structured timestamp and the node-stat count,
  // giving per-log idempotency and unique (not total) opened/clicked counts.
  let isNewMilestone = false;
  switch (type) {
    case 'email.delivered':
      if (!log.deliveredAt) {
        updates.deliveredAt = ts;
        updates.status = 'sent';
        isNewMilestone = true;
      }
      break;
    case 'email.opened':
      updates.openedCount = (log.openedCount || 0) + 1;
      if (!log.openedAt) {
        updates.openedAt = ts;
        isNewMilestone = true;
      }
      break;
    case 'email.clicked':
      updates.clickedCount = (log.clickedCount || 0) + 1;
      if (!log.clickedAt) {
        updates.clickedAt = ts;
        isNewMilestone = true;
      }
      break;
    case 'email.bounced':
      if (!log.bouncedAt) {
        updates.bouncedAt = ts;
        updates.status = 'failed';
        
        const bounceType = eventData?.bounce?.type;
        const bounceDesc = eventData?.bounce?.description;
        if (bounceType) {
          updates.bounceType = bounceType;
          updates.error = `${bounceType === 'permanent' ? 'Permanent' : 'Temporary'} Bounce: ${bounceDesc || 'Mailbox unavailable'}`;
        } else {
          updates.error = 'Bounced by recipient mail server';
        }
        isNewMilestone = true;
      }
      break;
    case 'email.complained':
      if (!log.complainedAt) {
        updates.complainedAt = ts;
        isNewMilestone = true;
      }
      break;
    default:
      return; // Unhandled event type — nothing to persist.
  }

  await logDoc.ref.update(updates);

  if (isNewMilestone) {
    try {
      const workspaceId = log.workspaceId || log.workspaceIds?.[0];
      if (workspaceId && log.entityId) {
        let eventType = '';
        if (log.channel === 'email') {
          if (type === 'email.opened') eventType = 'email_opened';
          else if (type === 'email.clicked') eventType = 'email_clicked';
          else if (type === 'email.bounced' || type === 'email.complained') eventType = 'email_bounced';
        } else if (log.channel === 'sms') {
          if (type === 'email.clicked') eventType = 'sms_link_clicked';
          else if (type === 'email.bounced' || type === 'email.complained') eventType = 'sms_failed';
        }

        if (eventType) {
          const { emitScoringEvent } = await import('@/lib/scoring-performance-engine');
          await emitScoringEvent({
            organizationId: log.organizationId || '',
            workspaceId,
            eventType,
            entityType: 'Contact',
            entityId: log.entityId,
            contactId: log.recipient,
            actorType: 'Automation',
            actorId: log.automationId || 'automation-system',
            metadata: {
              messageLogId: logDoc.id,
              channel: log.channel
            }
          });
        }
      }
    } catch (scoringErr) {
      console.error('>>> [WEBHOOK] Automation message scoring trigger failed:', scoringErr);
    }
  }

  const counter = NODE_STAT_BY_EVENT[type];
  if (isNewMilestone && counter && log.automationId && log.nodeId) {
    const channel: TrackedMessageChannel =
      log.channel === 'sms' || log.channel === 'whatsapp' ? log.channel : 'email';
    await incrementMessageNodeStat({
      automationId: log.automationId,
      nodeId: log.nodeId,
      workspaceId: log.workspaceId || log.workspaceIds?.[0] || '',
      organizationId: log.organizationId,
      channel,
      counter,
      resendNumber: log.resendNumber,
    }).catch((e: unknown) =>
      console.warn('>>> [WEBHOOK] node stat increment failed (non-fatal):', e)
    );

    const mappedStatusEvent: import('@/lib/types').MessageDeliveryStatusEvent | null =
      type === 'email.opened' ? 'opened' :
      type === 'email.clicked' ? 'clicked' :
      type === 'email.bounced' || type === 'email.complained' ? 'bounced' :
      type === 'email.delivered' ? 'delivered' : null;

    if (mappedStatusEvent && log.automationId && log.nodeId && log.entityId) {
      import('@/lib/automations/message-status-automations')
        .then(({ executeMessageStatusAutomations }) =>
          executeMessageStatusAutomations({
            automationId: log.automationId!,
            nodeId: log.nodeId!,
            eventStatus: mappedStatusEvent,
            entityId: log.entityId!,
            contactId: log.recipient,
            recipient: log.recipient,
            workspaceId: log.workspaceId || log.workspaceIds?.[0] || 'onboarding',
            runId: log.runId,
            messageSubject: log.subject || log.title || null,
            messagePreviewText: log.previewText || null,
          })
        )
        .catch((err: unknown) =>
          console.warn('>>> [WEBHOOK] message status automation execution failed (non-fatal):', err)
        );
    }
  }

  // Real-time resend release: an engaged contact advances immediately rather than
  // waiting for the next scheduled engagement check.
  if ((type === 'email.opened' || type === 'email.clicked') && log.runId && log.nodeId) {
    try {
      const { handleEngagementForNode } = await import('@/lib/automations/resend-jobs');
      await handleEngagementForNode(
        log.runId,
        log.nodeId,
        type === 'email.clicked' ? 'clicked' : 'opened'
      );
    } catch (e: unknown) {
      console.warn('>>> [WEBHOOK] resend engagement hook failed (non-fatal):', e);
    }
  }
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('>>> [WEBHOOK] RESEND_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // 1. Get headers for verification
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // 2. Get the body
  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // 3. Verify the signature
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as any;
  } catch (err) {
    console.error('>>> [WEBHOOK] Verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 4. Process the event
  const { type, data } = evt;
  const emailId = data.email_id;
  
  // Resolve IDs from tags
  // Resend webhook tags are typically an object { key: value }
  const jobId = data.tags?.jobId;
  const taskId = data.tags?.taskId;

  console.log(`>>> [WEBHOOK] Received ${type} for email ${emailId} (Job: ${jobId}, Task: ${taskId})`);

  if (!jobId || !taskId) {
    // Not a campaign send — automation/transactional emails carry no job tags.
    // Correlate to message_logs by providerId and update per-node stats instead.
    try {
      await handleAutomationMessageEvent(type, emailId, evt.created_at, data);
    } catch (err) {
      console.error('>>> [WEBHOOK] message_logs path error:', (err as Error).message);
      // Still ack — webhook retries should not be triggered by our processing errors.
    }
    return NextResponse.json({ success: true, message: 'Processed via message_logs path' });
  }

  try {
    const jobRef = adminDb.collection('message_jobs').doc(jobId);
    const taskRef = jobRef.collection('tasks').doc(taskId);

    // Get campaignId from the job to update stats
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const campaignId = jobSnap.data()?.campaignId;
    const taskSnap = await taskRef.get();
    const entityId = taskSnap.data()?.entityId;

    switch (type) {
      case 'email.sent':
        await taskRef.update({ 
            status: 'sent', 
            sentAt: evt.created_at,
            providerId: emailId 
        });
        if (campaignId && entityId) {
            const { emitSingleCampaignEvent } = await import('@/lib/campaign-events');
            await emitSingleCampaignEvent({ campaignId, entityId, event: 'campaign_delivered' });
        }
        break;

      case 'email.delivered':
        await taskRef.update({ 
            status: 'delivered', 
            deliveredAt: evt.created_at 
        });
        break;

      case 'email.opened':
        await taskRef.update({ 
            status: 'opened', 
            openedAt: evt.created_at 
        });
        if (campaignId) {
            await updateCampaignRealtimeStat(campaignId, 'totalOpened');
            if (entityId) {
                const { emitSingleCampaignEvent } = await import('@/lib/campaign-events');
                await emitSingleCampaignEvent({ campaignId, entityId, event: 'campaign_opened' });
            }
        }
        break;

      case 'email.clicked':
        await taskRef.update({ 
            status: 'clicked', 
            clickedAt: evt.created_at 
        });
        if (campaignId) {
            await updateCampaignRealtimeStat(campaignId, 'totalClicked');
            if (entityId) {
                const { emitSingleCampaignEvent } = await import('@/lib/campaign-events');
                await emitSingleCampaignEvent({ campaignId, entityId, event: 'campaign_clicked' });
            }
        }
        break;

      case 'email.bounced':
      case 'email.complained':
        await taskRef.update({ 
            status: 'failed', 
            error: type === 'email.bounced' ? 'Bounced' : 'Complained',
            failedAt: evt.created_at 
        });
        if (campaignId) {
            await updateCampaignRealtimeStat(campaignId, 'totalFailed');
            if (entityId) {
                const { emitSingleCampaignEvent } = await import('@/lib/campaign-events');
                await emitSingleCampaignEvent({ campaignId, entityId, event: 'campaign_failed' });

                if (type === 'email.bounced') {
                    const { triggerAutomationProtocols } = await import('@/lib/automation-processor');
                    const { buildAutomationPayload } = await import('@/lib/automation-payload');
                    const payload = buildAutomationPayload({
                        organizationId: jobSnap.data()?.organizationId || '',
                        workspaceId: jobSnap.data()?.workspaceId || '',
                        entityId,
                        action: 'email_bounced',
                        metadata: { campaignId, emailId }
                    });
                    await triggerAutomationProtocols('EMAIL_BOUNCED', payload);
                }
            }
        }
        break;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error(`>>> [WEBHOOK] Error processing ${type}:`, error.message);
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}
