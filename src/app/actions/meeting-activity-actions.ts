'use server';

/**
 * @fileoverview Server Actions for Meeting Activity timeline stream in SmartSapp Meetings 2.0.
 * Queries chronological audit events for meeting occurrences.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MeetingActivity } from '@/lib/meetings/types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Fetches recent activity stream events for a meeting occurrence.
 */
export async function getMeetingActivitiesAction(
  meetingId: string,
  limitCount: number = 50
): Promise<{ success: boolean; activities?: MeetingActivity[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_activities')
      .where('meetingId', '==', meetingId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const activities: MeetingActivity[] = snap.docs.map(
      d => ({ id: d.id, ...d.data() } as MeetingActivity)
    );

    return { success: true, activities };
  } catch (error) {
    console.error('[getMeetingActivitiesAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
