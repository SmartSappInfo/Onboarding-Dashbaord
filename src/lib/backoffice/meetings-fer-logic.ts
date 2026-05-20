import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuditActor, PlatformJob } from './backoffice-types';
import type { Meeting, MeetingMessagingConfig } from '../types';

export async function processMeetingsFer(jobId: string, actor: AuditActor): Promise<{ success: boolean; result?: any }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);
  const logs: any[] = [];
  
  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const entry = { timestamp: new Date().toISOString(), level, message, data };
    logs.push(entry);
    jobRef.update({ logs: FieldValue.arrayUnion(entry) }).catch(() => {});
  };

  try {
    log('info', 'Started Meetings FER migration', { actor: actor.email });

    // ── 1. Count Total Meetings for Progress ──
    const meetingsSnap = await adminDb.collection('meetings').get();
    const totalMeetings = meetingsSnap.size;
    
    if (totalMeetings === 0) {
      log('info', 'No meetings found to migrate.');
      await jobRef.update({
        status: 'completed',
        progress: { total: 0, processed: 0, errors: 0 },
        completedAt: new Date().toISOString()
      });
      return { success: true };
    }

    let processedMeetings = 0;
    let errors = 0;
    let enrichedMeetingsCount = 0;
    let updatedRegistrantsCount = 0;

    await jobRef.update({
      progress: { total: totalMeetings, processed: 0, errors: 0 }
    });

    const now = new Date().toISOString();

    // ── 2. Paginate over Meetings ──
    // Using a cursor-based approach to avoid memory bloat
    let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const batchSize = 50;

    while (true) {
      let query = adminDb.collection('meetings').limit(batchSize);
      if (lastDocSnap) {
        query = query.startAfter(lastDocSnap);
      }

      const snap = await query.get();
      if (snap.empty) break;

      const batch = adminDb.batch();
      let batchWriteCount = 0;

      for (const doc of snap.docs) {
        try {
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
            // Inject the default starting now templates
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
            enrichedMeetingsCount++;
          }

          // -- C. Process Registrants via Cursor Pagination --
          const typeSlug = data.type?.slug || 'parent-engagement';
          const slug = data.meetingSlug || data.entitySlug || '';

          if (slug) {
            let lastRegSnap: FirebaseFirestore.QueryDocumentSnapshot | null = null;
            const regBatchSize = 100;

            while (true) {
              let regQuery = doc.ref.collection('registrants').limit(regBatchSize);
              if (lastRegSnap) {
                regQuery = regQuery.startAfter(lastRegSnap);
              }

              const regSnap = await regQuery.get();
              if (regSnap.empty) break;

              for (const regDoc of regSnap.docs) {
                const regData = regDoc.data();
                const token = regData.token;

                if (token) {
                  const currentUrl = regData.personalizedMeetingUrl || '';
                  
                  // Check if it's already using the /join format
                  if (!currentUrl.includes('/join?token=')) {
                    // Update to the new join room relative path (will be made absolute by URL helper at dispatch)
                    const newUrl = `/meetings/${typeSlug}/${slug}/join?token=${token}`;
                    
                    batch.update(regDoc.ref, {
                      personalizedMeetingUrl: newUrl,
                      ferEnrichedAt: now,
                    });
                    
                    batchWriteCount++;
                    updatedRegistrantsCount++;

                    // Commit early if batch gets too large
                    if (batchWriteCount >= 450) {
                      await batch.commit();
                      batchWriteCount = 0;
                    }
                  }
                }
                lastRegSnap = regDoc;
              }
            }
          }

          processedMeetings++;
        } catch (err: any) {
          log('error', `Failed to process meeting ${doc.id}`, { error: err.message });
          errors++;
        }

        lastDocSnap = doc;
      }

      if (batchWriteCount > 0) {
        await batch.commit();
      }

      // Update job progress after each meeting batch
      await jobRef.update({
        progress: { total: totalMeetings, processed: processedMeetings, errors }
      });
    }

    log('info', 'Meetings FER migration completed successfully', {
      enrichedMeetingsCount,
      updatedRegistrantsCount
    });

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: {
        enrichedMeetingsCount,
        updatedRegistrantsCount
      }
    });

    return { success: true };
  } catch (error: any) {
    log('error', 'Critical failure in Meetings FER Job', { error: error.message });
    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      result: { error: error.message }
    });
    return { success: false };
  }
}
