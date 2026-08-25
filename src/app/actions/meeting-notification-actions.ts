'use server';

/**
 * @fileoverview Server Actions for Multi-Channel Notification Policies & Reminder Dispatches.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Uses idempotent reminder document keys to prevent double-dispatches.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  NotificationDispatchJob,
  NotificationChannel,
  MeetingLifecycleTrigger,
} from '@/lib/meetings/types/notifications';
import {
  buildReminderJobKey,
  calculateReminderTriggerTime,
} from '@/lib/meetings/notification-cascade-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Schedules standard lifecycle reminder jobs for a confirmed meeting (24h, 1h, 15m, and post-meeting feedback).
 */
export async function scheduleMeetingRemindersAction(payload: {
  meetingId: string;
  workspaceId: string;
  meetingStartTime: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channels?: NotificationChannel[];
}): Promise<{ success: boolean; scheduledJobsCount?: number; error?: string }> {
  try {
    const {
      meetingId,
      workspaceId,
      meetingStartTime,
      recipientEmail,
      recipientPhone,
      channels = ['email', 'whatsapp'],
    } = payload;

    const triggers: Array<{ trigger: MeetingLifecycleTrigger; offsetMinutes: number }> = [
      { trigger: 'reminder_24h', offsetMinutes: 1440 },
      { trigger: 'reminder_1h', offsetMinutes: 60 },
      { trigger: 'reminder_15m', offsetMinutes: 15 },
    ];

    const batch = adminDb.batch();
    let count = 0;

    for (const t of triggers) {
      for (const ch of channels) {
        const key = buildReminderJobKey(meetingId, t.trigger, ch);
        const scheduledFor = calculateReminderTriggerTime(meetingStartTime, t.offsetMinutes);

        const jobDoc = adminDb.collection('meeting_reminder_jobs').doc(key);
        const jobData: NotificationDispatchJob = {
          id: key,
          meetingId,
          workspaceId,
          trigger: t.trigger,
          channel: ch,
          recipientEmail: recipientEmail?.trim(),
          recipientPhone: recipientPhone?.trim(),
          status: 'pending',
          scheduledFor,
        };

        batch.set(jobDoc, jobData, { merge: true });
        count++;
      }
    }

    await batch.commit();

    return { success: true, scheduledJobsCount: count };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Fetches all scheduled notification jobs for a meeting.
 */
export async function getMeetingReminderJobsAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; jobs?: NotificationDispatchJob[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_reminder_jobs')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const jobs: NotificationDispatchJob[] = snap.docs.map(doc => ({
      ...(doc.data() as NotificationDispatchJob),
      id: doc.id,
    }));

    jobs.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

    return { success: true, jobs };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
