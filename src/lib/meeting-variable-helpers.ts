/**
 * @fileOverview Meeting Variable Helpers
 *
 * Centralised builders for meeting messaging template variables.
 * Every dispatch function (registration ack, reminders, facilitator alerts,
 * post-event follow-ups) calls these helpers instead of manually assembling
 * the variables bag.  Single source of truth, zero duplication.
 */

import type { Meeting, MeetingFacilitator, MeetingRegistrant } from './types';
import { ensureAbsoluteUrl, cleanPersonalizedMeetingUrl } from './utils/url-helpers';
import { generateCalendarLinkFromMeeting } from './calendar-utils';

// ---------------------------------------------------------------------------
// Meeting base variables (available in ALL meeting templates)
// ---------------------------------------------------------------------------

/**
 * Builds the core meeting metadata variables from a Meeting document.
 * Optionally accepts a timezone string for locale-aware date formatting.
 */
export function buildMeetingBaseVariables(
  meeting: Meeting,
  timezone?: string,
): Record<string, string> {
  const tz = timezone || 'UTC';
  let meetingDate = '';
  let meetingTime = '';

  try {
    const dt = new Date(meeting.meetingTime);
    meetingDate = dt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });
    meetingTime = dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: tz,
    });
  } catch {
    // Fallback — invalid meetingTime or timezone
  }

  let calendarLink = '';
  try {
    calendarLink = generateCalendarLinkFromMeeting(meeting);
  } catch {
    // Fallback
  }

  return {
    meeting_title: meeting.heroTitle || meeting.type?.name || 'Meeting',
    meeting_date: meetingDate,
    meeting_time: meetingTime,
    meeting_timezone: tz,
    meeting_link: meeting.meetingLink || '',
    meeting_type: meeting.type?.name || '',
    meeting_duration: meeting.durationMinutes
      ? `${meeting.durationMinutes} minutes`
      : '',
    recording_url: meeting.recordingUrl || '',
    brochure_url: meeting.brochureUrl || '',
    feedback_form_url: meeting.feedbackFormUrl || '',
    calendar_link: calendarLink,
    _meetingId: meeting.id,
  };
}

// ---------------------------------------------------------------------------
// Registrant variables (per-registrant context)
// ---------------------------------------------------------------------------

/**
 * Builds registrant-specific variables from a registrant document.
 * Custom registration fields are flattened with the `registration_` prefix
 * (e.g. `registration_company`, `registration_job_title`).
 */
export function buildRegistrantVariables(
  registrant: Pick<
    MeetingRegistrant,
    'name' | 'email' | 'phone' | 'personalizedMeetingUrl' | 'status' | 'registrationData'
  >,
): Record<string, string> {
  const vars: Record<string, string> = {
    registrant_name: registrant.name || '',
    registrant_email: registrant.email || '',
    registrant_phone: registrant.phone || '',
    registrant_join_link: ensureAbsoluteUrl(cleanPersonalizedMeetingUrl(registrant.personalizedMeetingUrl || '')),
    // Backward compat aliases for templates
    contact_name: registrant.name || '',
    contact_email: registrant.email || '',
    contact_phone: registrant.phone || '',
    join_url: ensureAbsoluteUrl(cleanPersonalizedMeetingUrl(registrant.personalizedMeetingUrl || '')),
    registration_status: registrant.status || '',
  };

  // Flatten dynamic registration form data
  if (registrant.registrationData) {
    for (const [key, value] of Object.entries(registrant.registrationData)) {
      // Skip fields that already have dedicated variables
      if (['name', 'email', 'phone', 'full_name'].includes(key)) continue;
      vars[`registration_${key}`] = String(value ?? '');
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Facilitator variables (per-facilitator context)
// ---------------------------------------------------------------------------

/**
 * Builds facilitator-specific variables from a facilitator entry.
 */
export function buildFacilitatorVariables(
  facilitator: MeetingFacilitator,
): Record<string, string> {
  return {
    facilitator_name: facilitator.name || '',
    facilitator_email: facilitator.email || '',
    facilitator_phone: facilitator.phone || '',
    facilitator_role: facilitator.role || '',
    facilitator_bio: facilitator.bio || '',
    facilitator_join_link: facilitator.joinLink || '',
  };
}
