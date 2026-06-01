import { MeetingInvitationSlot } from './types';

const INVITATION_OFFSETS: Record<string, number> = {
  initial: 999999, // practically always due
  '1_month': 30 * 24 * 60,
  '1_week': 7 * 24 * 60,
  '5_days': 5 * 24 * 60,
  '3_days': 3 * 24 * 60,
  '2_days': 2 * 24 * 60,
  '1_day': 1 * 24 * 60,
  today: 12 * 60,
  last_chance: 2 * 60,
};

export function getInvitationOffsetMinutes(stageId: string): number {
  return INVITATION_OFFSETS[stageId] ?? 0;
}

export function calculateChannelTriggerTime(
  meetingTime: Date, 
  stage: MeetingInvitationSlot, 
  channel: 'email' | 'sms',
  timezone: string
): Date {
  const offsetMinutes = getInvitationOffsetMinutes(stage.id);
  const triggerTime = new Date(meetingTime.getTime() - (offsetMinutes * 60 * 1000));

  if (stage.id === 'initial') {
    const scheduledDate = (channel === 'email' ? stage.emailScheduledDate : stage.smsScheduledDate) || stage.scheduledDate;
    if (scheduledDate) {
      return new Date(scheduledDate);
    }
    return meetingTime; // Default to the meeting time
  }

  const scheduledTime = (channel === 'email' ? stage.emailScheduledTime : stage.smsScheduledTime) || stage.scheduledTime;
  if (scheduledTime) {
    try {
      const parts = scheduledTime.split(':');
      if (parts.length >= 2) {
        const targetHours = parseInt(parts[0], 10);
        const targetMinutes = parseInt(parts[1], 10);
        if (!isNaN(targetHours) && !isNaN(targetMinutes)) {
          const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
          });
          const formatted = dtf.format(meetingTime);
          const formattedParts = formatted.split(':');
          if (formattedParts.length >= 2) {
            const meetingHours = parseInt(formattedParts[0], 10);
            const meetingMinutes = parseInt(formattedParts[1], 10);
            if (!isNaN(meetingHours) && !isNaN(meetingMinutes)) {
              const meetingTotalMins = meetingHours * 60 + meetingMinutes;
              const targetTotalMins = targetHours * 60 + targetMinutes;
              const diffMinutes = targetTotalMins - meetingTotalMins;

              triggerTime.setTime(triggerTime.getTime() + (diffMinutes * 60 * 1000));
            }
          }
        }
      }
    } catch (e) {
      console.warn('[calculateChannelTriggerTime] Error adjusting timezone-aware time:', e);
    }
  }

  return triggerTime;
}
