'use server';

import { adminDb } from './firebase-admin';
import type { MessageJob, MessageTask, MessageCampaign } from './types';

/**
 * Gets campaign stats by aggregating from the job's tasks subcollection.
 * 
 * R3/R4 fix: Analytics use tasks, not message_logs. The email bulk path
 * (sendBatchEmails) creates no log entries — only task subcollection docs.
 */
export async function getCampaignStats(campaignId: string): Promise<{
  success: boolean;
  stats?: {
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    totalPending: number;
    totalOpened: number;
    totalClicked: number;
    deliveryRate: number;
    failureRate: number;
  };
  error?: string;
}> {
  try {
    // Find the linked job
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };

    const campaign = campaignSnap.data() as MessageCampaign;
    if (!campaign.jobId) {
      return {
        success: true,
        stats: {
          totalTargeted: campaign.estimatedRecipientCount || 0,
          totalSent: 0, totalFailed: 0, totalPending: 0,
          totalOpened: 0, totalClicked: 0,
          deliveryRate: 0, failureRate: 0,
        },
      };
    }

    const jobSnap = await adminDb.collection('message_jobs').doc(campaign.jobId).get();
    if (!jobSnap.exists) return { success: false, error: 'Linked job not found' };

    const job = jobSnap.data() as MessageJob;

    const totalTargeted = job.totalRecipients;
    const totalSent = job.success;
    const totalFailed = job.failed;
    const totalPending = totalTargeted - job.processed;
    const deliveryRate = totalTargeted > 0 ? Math.round((totalSent / totalTargeted) * 100) : 0;
    const failureRate = totalTargeted > 0 ? Math.round((totalFailed / totalTargeted) * 100) : 0;

    return {
      success: true,
      stats: {
        totalTargeted, totalSent, totalFailed, totalPending,
        totalOpened: campaign.stats?.totalOpened || 0,
        totalClicked: campaign.stats?.totalClicked || 0,
        deliveryRate, failureRate,
      },
    };
  } catch (error: any) {
    console.error('getCampaignStats error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gets per-recipient breakdown from the job's tasks subcollection.
 * Capped at 200 for performance.
 */
export async function getCampaignRecipientBreakdown(campaignId: string): Promise<{
  success: boolean;
  recipients?: { recipient: string; displayName: string; status: string; sentAt?: string; error?: string }[];
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };
    const campaign = campaignSnap.data() as MessageCampaign;
    if (!campaign.jobId) return { success: true, recipients: [] };

    const tasksSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .orderBy('status')
      .limit(200)
      .get();

    const recipients = tasksSnap.docs.map(d => {
      const task = d.data() as MessageTask;
      return {
        recipient: task.recipient,
        displayName: task.displayName || task.recipient,
        status: task.status,
        sentAt: task.sentAt,
        error: task.error,
      };
    });

    return { success: true, recipients };
  } catch (error: any) {
    console.error('getCampaignRecipientBreakdown error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gets failed recipients for resend action.
 */
export async function getFailedRecipients(campaignId: string): Promise<{
  success: boolean;
  failed?: { recipient: string; displayName: string; error?: string; variables: Record<string, any> }[];
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };
    const campaign = campaignSnap.data() as MessageCampaign;
    if (!campaign.jobId) return { success: true, failed: [] };

    const tasksSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .where('status', '==', 'failed')
      .limit(500)
      .get();

    const failed = tasksSnap.docs.map(d => {
      const task = d.data() as MessageTask;
      return {
        recipient: task.recipient,
        displayName: task.displayName || task.recipient,
        error: task.error,
        variables: task.variables || {},
      };
    });

    return { success: true, failed };
  } catch (error: any) {
    console.error('getFailedRecipients error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Syncs campaign stats from job data (denormalization for list view performance).
 */
export async function syncCampaignStats(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await getCampaignStats(campaignId);
    if (!result.success || !result.stats) return { success: false, error: result.error };

    await adminDb.collection('message_campaigns').doc(campaignId).update({
      'stats.totalTargeted': result.stats.totalTargeted,
      'stats.totalSent': result.stats.totalSent,
      'stats.totalFailed': result.stats.totalFailed,
      'stats.totalOpened': result.stats.totalOpened,
      'stats.totalClicked': result.stats.totalClicked,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('syncCampaignStats error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Increment a specific campaign stat in real-time.
 * Used by webhooks to avoid full sync overhead and race conditions.
 */
export async function updateCampaignRealtimeStat(
  campaignId: string, 
  stat: 'totalOpened' | 'totalClicked' | 'totalSent' | 'totalFailed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { FieldValue } = await import('./firebase-admin');
    const fieldPath = `stats.${stat}`;
    
    await adminDb.collection('message_campaigns').doc(campaignId).update({
      [fieldPath]: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[ANALYTICS] Failed to update ${stat}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gets engagement timeline data for charts.
 * Groups tasks by hour/day based on their sentAt, openedAt, and clickedAt timestamps.
 */
export async function getCampaignEngagementTimeline(campaignId: string): Promise<{
  success: boolean;
  timeline?: { timestamp: string; sent: number; opened: number; clicked: number }[];
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };
    const campaign = campaignSnap.data() as MessageCampaign;
    if (!campaign.jobId) return { success: true, timeline: [] };

    // Fetch up to 1000 tasks for timeline analysis (Phase 7 limit)
    const tasksSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .where('status', 'in', ['sent', 'delivered', 'opened', 'clicked'])
      .limit(1000)
      .get();

    const timelineMap: Record<string, { sent: number; opened: number; clicked: number }> = {};

    tasksSnap.docs.forEach(doc => {
      const task = doc.data() as MessageTask;
      
      const processEvent = (isoStr: string | undefined, type: 'sent' | 'opened' | 'clicked') => {
        if (!isoStr) return;
        // Group by hour: "YYYY-MM-DDTHH:00"
        const hour = isoStr.substring(0, 13) + ':00';
        if (!timelineMap[hour]) timelineMap[hour] = { sent: 0, opened: 0, clicked: 0 };
        timelineMap[hour][type]++;
      };

      processEvent(task.sentAt || task.deliveredAt, 'sent');
      processEvent(task.openedAt, 'opened');
      processEvent(task.clickedAt, 'clicked');
    });

    const timeline = Object.entries(timelineMap)
      .map(([timestamp, counts]) => ({
        timestamp,
        ...counts
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return { success: true, timeline };
  } catch (error: any) {
    console.error('getCampaignEngagementTimeline error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function updateCampaignUnsubscribeStat(campaignId: string, variantId: 'A' | 'B'): Promise<void> {
  const { FieldValue } = await import('./firebase-admin');
  await adminDb.collection('message_campaigns').doc(campaignId).update({
    'stats.totalUnsubscribed': FieldValue.increment(1)
  });
  
  await adminDb.runTransaction(async (transaction) => {
    const docRef = adminDb.collection('message_campaigns').doc(campaignId);
    const snap = await transaction.get(docRef);
    if (!snap.exists) return;
    const data = snap.data() as MessageCampaign;
    const variants = data.variants || [];
    const updatedVariants = variants.map(v => {
      if (v.id === variantId) {
        return {
          ...v,
          stats: { ...v.stats, totalUnsubscribed: (v.stats.totalUnsubscribed || 0) + 1 }
        };
      }
      return v;
    });
    transaction.update(docRef, { variants: updatedVariants });
  });
}
