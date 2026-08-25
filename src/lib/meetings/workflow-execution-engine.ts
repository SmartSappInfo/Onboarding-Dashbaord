/**
 * @fileoverview Pure Workflow Execution Engine.
 * Evaluates trigger predicates for event lifecycle automation rules.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure rule evaluation.
 * - Single source of truth for workflow trigger logic.
 */

import type {
  MeetingWorkflowRule,
  MeetingWorkflowTrigger,
} from './types/polls';

export interface WorkflowEvaluationContext {
  bookingStatus?: string; // 'confirmed', 'cancelled', 'rescheduled'
  attendanceSeconds?: number;
  meetingDurationSeconds?: number;
  eventStartAt?: string; // ISO 8601 UTC
  referenceNow?: Date;
}

/**
 * Checks if a given workflow trigger rule is eligible for execution against current meeting context.
 */
export function evaluateWorkflowEligibility(
  trigger: MeetingWorkflowTrigger,
  context: WorkflowEvaluationContext
): boolean {
  const { bookingStatus, attendanceSeconds = 0, meetingDurationSeconds = 1800, eventStartAt, referenceNow = new Date() } = context;

  switch (trigger) {
    case 'on_booking':
      return bookingStatus === 'confirmed';

    case 'on_cancellation':
      return bookingStatus === 'cancelled';

    case 'after_attended':
      // Qualified as attended if attended >= 25% of meeting duration or >= 5 mins
      return attendanceSeconds >= Math.min(300, meetingDurationSeconds * 0.25);

    case 'on_no_show':
      // Qualified as no-show if attended < 60 seconds
      return attendanceSeconds < 60 && bookingStatus !== 'cancelled';

    case 'before_24h': {
      if (!eventStartAt) return false;
      const startMs = new Date(eventStartAt).getTime();
      const diffHours = (startMs - referenceNow.getTime()) / (1000 * 60 * 60);
      return diffHours <= 24 && diffHours > 0;
    }

    case 'before_1h': {
      if (!eventStartAt) return false;
      const startMs = new Date(eventStartAt).getTime();
      const diffMins = (startMs - referenceNow.getTime()) / (1000 * 60);
      return diffMins <= 60 && diffMins > 0;
    }

    default:
      return false;
  }
}

/**
 * Produces a human-readable description for an automated workflow rule.
 */
export function formatWorkflowActionSummary(rule: MeetingWorkflowRule): string {
  const triggerLabels: Record<MeetingWorkflowTrigger, string> = {
    on_booking: 'Immediately after booking',
    before_24h: '24 hours before meeting',
    before_1h: '1 hour before meeting',
    after_attended: 'After attendee completes meeting',
    on_no_show: 'When participant is marked no-show',
    on_cancellation: 'When booking is cancelled',
  };

  const actionLabels: Record<MeetingWorkflowRule['actionType'], string> = {
    send_whatsapp: 'Send WhatsApp message',
    send_sms: 'Send SMS notification',
    send_email: 'Send email notification',
    create_crm_task: `Create CRM task: "${rule.config.taskTitle || 'Follow-up'}"`,
    update_lead_score: `Increment lead score by ${rule.config.scoreDelta || 0} pts`,
    add_contact_tag: `Apply ${rule.config.tagIds?.length || 0} contact tag(s)`,
  };

  return `${triggerLabels[rule.trigger] || rule.trigger} → ${actionLabels[rule.actionType] || rule.actionType}`;
}
