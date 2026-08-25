/**
 * @fileoverview Pure Multi-Channel Notification Cascade & Idempotent Reminder Engine.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Deterministic job key format: `reminder_{meetingId}_{trigger}_{channel}`.
 * - 100% pure with zero side-effects.
 */

import type {
  NotificationChannel,
  MeetingLifecycleTrigger,
  NotificationDispatchJob,
} from './types/notifications';

/**
 * Builds idempotent Firestore document ID for a notification dispatch job.
 */
export function buildReminderJobKey(
  meetingId: string,
  trigger: MeetingLifecycleTrigger,
  channel: NotificationChannel
): string {
  return `reminder_${meetingId}_${trigger}_${channel}`;
}

/**
 * Determines next fallback channel if primary delivery fails.
 * Hierarchy: whatsapp -> sms -> email -> null
 */
export function evaluateNotificationFallback(
  currentChannel: NotificationChannel
): NotificationChannel | null {
  if (currentChannel === 'whatsapp') return 'sms';
  if (currentChannel === 'sms') return 'email';
  return null;
}

/**
 * Calculates scheduled reminder ISO timestamp from meeting start time and offset minutes.
 */
export function calculateReminderTriggerTime(
  meetingStartTime: string,
  offsetMinutes: number
): string {
  const startMs = new Date(meetingStartTime).getTime();
  const triggerMs = startMs - offsetMinutes * 60000;
  return new Date(triggerMs).toISOString();
}
