'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Meeting, MeetingMessagingConfig } from '@/lib/types';

export async function runMeetingsFerAction(
  workspaceId: string,
  organizationId: string
): Promise<{
  success: boolean;
  processedMeetings: number;
  enrichedMeetings: number;
  updatedRegistrants: number;
  error?: string;
}> {
  try {
    const now = new Date().toISOString();
    let processedMeetings = 0;
    let enrichedMeetings = 0;
    let updatedRegistrants = 0;

    // ── 1. Query Meetings Scoped to Workspace ──
    const meetingsSnap = await adminDb
      .collection('meetings')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    if (meetingsSnap.empty) {
      return {
        success: true,
        processedMeetings: 0,
        enrichedMeetings: 0,
        updatedRegistrants: 0
      };
    }

    const batch = adminDb.batch();
    let batchWriteCount = 0;

    for (const doc of meetingsSnap.docs) {
      const data = doc.data() as Meeting;
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // -- A. Enrich Meeting Configs --
      if (!data.meetingSlug && data.entitySlug) {
        updates.meetingSlug = data.entitySlug.toLowerCase();
        needsUpdate = true;
      }

      if (data.registrationEnabled === undefined) {
        updates.registrationEnabled = false;
        needsUpdate = true;
      }

      if (!data.heroLayout) {
        updates.heroLayout = data.registrationEnabled ? 'form' : 'image';
        needsUpdate = true;
      }

      if (!data.bannerType) {
        updates.bannerType = 'none';
        needsUpdate = true;
      }

      if (data.brandingEnabled === undefined) {
        updates.brandingEnabled = true;
        needsUpdate = true;
      }

      // -- B. Ensure 'At meeting time' slot exists --
      const messagingConfig = data.messagingConfig || ({} as MeetingMessagingConfig);
      const reminders = messagingConfig.reminders || [];
      const hasTimeUpSlot = reminders.some(r => r.offsetMinutes === 0);

      if (!hasTimeUpSlot) {
        reminders.push({
          id: `reminder_${Date.now()}_timeup`,
          offsetMinutes: 0,
          offsetLabel: 'At event time',
          emailTemplateId: 'global_meeting_time_up_email',
          smsTemplateId: 'global_meeting_time_up_sms',
          channels: ['email', 'sms'],
          enabled: true
        });

        updates['messagingConfig.reminders'] = reminders;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.ferEnrichedAt = now;
        updates.ferVersion = 'v3-join-page';
        batch.update(doc.ref, updates);
        batchWriteCount++;
        enrichedMeetings++;
      }

      // -- C. Process Registrants --
      const typeSlug = data.type?.slug || 'parent-engagement';
      const slug = data.meetingSlug || data.entitySlug || '';

      if (slug) {
        const regSnap = await doc.ref.collection('registrants').get();
        for (const regDoc of regSnap.docs) {
          const regData = regDoc.data();
          const token = regData.token;

          if (token) {
            const currentUrl = regData.personalizedMeetingUrl || '';
            
            // Check if it's already using the /join format
            if (!currentUrl.includes('/join?token=')) {
              const newUrl = `/meetings/${typeSlug}/${slug}/join?token=${token}`;
              
              batch.update(regDoc.ref, {
                personalizedMeetingUrl: newUrl,
                ferEnrichedAt: now,
              });
              
              batchWriteCount++;
              updatedRegistrants++;

              // Commit early if batch gets too large
              if (batchWriteCount >= 450) {
                await batch.commit();
                batchWriteCount = 0;
              }
            }
          }
        }
      }

      processedMeetings++;
    }

    if (batchWriteCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      processedMeetings,
      enrichedMeetings,
      updatedRegistrants
    };
  } catch (error: any) {
    console.error('[runMeetingsFerAction] Error:', error);
    return {
      success: false,
      processedMeetings: 0,
      enrichedMeetings: 0,
      updatedRegistrants: 0,
      error: error.message || 'Failed to execute Meetings FER'
    };
  }
}
