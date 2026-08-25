/**
 * @fileoverview Standardized meeting activity logger in SmartSapp Meetings 2.0.
 * Writes immutable audit trail events to the `meeting_activities` collection.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Activity logs are append-only. Never mutate or delete activity documents during normal operations.
 * - Catch and log errors without failing the primary business transaction.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MeetingActivity, MeetingActivityType } from './types';

export interface LogMeetingActivityInput {
  workspaceId: string;
  meetingId: string;
  type: MeetingActivityType;
  description: string;
  actorType?: 'user' | 'system' | 'ai' | 'external';
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Creates and stores a new MeetingActivity record.
 */
export async function logMeetingActivity(
  input: LogMeetingActivityInput
): Promise<{ success: boolean; activityId?: string }> {
  try {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('meeting_activities').doc();

    const activity: MeetingActivity = {
      id: docRef.id,
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      actorType: input.actorType || 'system',
      actorId: input.actorId,
      actorName: input.actorName,
      type: input.type,
      description: input.description,
      metadata: input.metadata || {},
      createdAt: now,
    };

    await docRef.set(activity);
    return { success: true, activityId: docRef.id };
  } catch (error) {
    console.error('[logMeetingActivity] Failed to write activity log:', error);
    // Non-blocking for primary flows
    return { success: false };
  }
}
