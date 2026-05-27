
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { adminDb } from '@/lib/firebase-admin';
import { updateCampaignRealtimeStat } from '@/lib/campaign-analytics';

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

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
    console.warn('>>> [WEBHOOK] Missing jobId or taskId in tags. Skipping database updates.');
    return NextResponse.json({ success: true, message: 'No job context found' });
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
