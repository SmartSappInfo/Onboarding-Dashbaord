/**
 * @fileoverview Domain Types for Multi-Channel Notification Policies & Reminders.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Supported Channels: 'whatsapp' | 'sms' | 'email'.
 * - Zero 'any' policy strictly enforced.
 */

export type NotificationChannel = 'whatsapp' | 'sms' | 'email';

export type MeetingLifecycleTrigger =
  | 'booking_confirmed'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'reminder_15m'
  | 'meeting_completed_feedback'
  | 'booking_rescheduled'
  | 'booking_cancelled';

export interface NotificationDispatchJob {
  id: string; // Unique composite key e.g. reminder_m123_60_whatsapp
  meetingId: string;
  workspaceId: string;
  trigger: MeetingLifecycleTrigger;
  channel: NotificationChannel;
  recipientEmail?: string;
  recipientPhone?: string;
  templateId?: string;
  renderedBody?: string;
  status: 'pending' | 'sent' | 'failed' | 'fallback_triggered';
  scheduledFor: string; // ISO 8601 UTC
  sentAt?: string;
  errorMessage?: string;
}
