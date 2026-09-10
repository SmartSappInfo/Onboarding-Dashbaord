'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Meeting, MeetingMessagingConfig } from '@/lib/types';
import { schedulePostEventMessages } from '@/lib/reminder-actions';
import { requireAuth } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

// ---------------------------------------------------------------------------
// endMeetingAction
// ---------------------------------------------------------------------------

/**
 * Marks a meeting as 'ended' and triggers post-event messages.
 * Uses async-defer-await pattern to avoid blocking the UI.
 */
export async function endMeetingAction(
  meetingId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingSnap = await meetingRef.get();

    if (!meetingSnap.exists) {
      return { success: false, error: 'Meeting not found' };
    }

    const meetingData = { id: meetingSnap.id, ...meetingSnap.data() } as Meeting & { messagingConfig?: MeetingMessagingConfig };

    if (meetingData.publishStatus === 'archived') {
      return { success: false, error: 'Cannot end an archived meeting' };
    }

    // 1. Update status to 'ended'
    await meetingRef.update({ 
      status: 'ended',
      endedAt: new Date().toISOString()
    });

    // 2. Trigger post-event messages (non-blocking)
    if (meetingData.messagingConfig?.postEventEnabled) {
      // Defer the scheduling to avoid waterfall
      schedulePostEventMessages(meetingData, orgId).catch(err => {
        console.error('[endMeetingAction] Failed to schedule post-event messages:', err);
      });
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[endMeetingAction] Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// scheduleMeetingPostEvent (Legacy Wrapper)
// ---------------------------------------------------------------------------

/**
 * Wrapper for backward compatibility. 
 * Delegates to the unified schedulePostEventMessages in reminder-actions.ts
 */
export async function scheduleMeetingPostEvent(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
): Promise<void> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  await schedulePostEventMessages(meeting, orgId);
}

// ---------------------------------------------------------------------------
// cancelMeetingPostEvent
// ---------------------------------------------------------------------------

/**
 * Cancels any pending post-event follow-up messages for a meeting.
 * Used when the meeting is rescheduled or the post-event config changes.
 */
export async function cancelMeetingPostEvent(meetingId: string): Promise<void> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const snap = await adminDb
    .collection('scheduled_messages')
    .where('sourceEventId', '==', meetingId)
    .where('sourceEventType', '==', 'meeting')
    .where('reminderType', 'in', ['post_event_followup', 'post_event_thankyou', 'post_event_absentee'])
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const MAX_BATCH_SIZE = 450;
  let batch = adminDb.batch();
  let opCount = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    opCount++;

    if (opCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
}
