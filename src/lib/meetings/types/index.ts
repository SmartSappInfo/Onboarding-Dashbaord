/**
 * @fileoverview Canonical TypeScript domain interfaces for SmartSapp Meetings 2.0.
 * Strictly typed definitions for Event Types, Availability Profiles, Scheduling Profiles,
 * Booking Holds, and Bookings.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All times stored in database records (startAt, endAt, expiresAt) MUST be ISO 8601 UTC strings.
 * - Timezone strings MUST conform to standard IANA timezone identifiers (e.g. 'Africa/Accra', 'America/New_York').
 * - Do not use 'any' or 'any[]' in these contracts.
 */

import type { TeamSchedulingConfig } from './team';

export interface AvailabilityInterval {
  /** HH:mm formatted 24h start time, e.g. "09:00" */
  start: string;
  /** HH:mm formatted 24h end time, e.g. "17:00" */
  end: string;
}

export interface AvailabilityRule {
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  dayOfWeek: number;
  /** Time ranges for this day */
  intervals: AvailabilityInterval[];
  /** Whether the host is open for bookings on this day */
  isAvailable: boolean;
}

/** Standard default Monday - Friday 09:00 - 17:00 weekly schedule */
export const DEFAULT_WEEKLY_RULES: AvailabilityRule[] = [
  { dayOfWeek: 1, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true }, // Monday
  { dayOfWeek: 2, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true }, // Tuesday
  { dayOfWeek: 3, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true }, // Wednesday
  { dayOfWeek: 4, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true }, // Thursday
  { dayOfWeek: 5, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true }, // Friday
  { dayOfWeek: 6, intervals: [], isAvailable: false }, // Saturday
  { dayOfWeek: 0, intervals: [], isAvailable: false }, // Sunday
];

export interface AvailabilityOverride {
  id: string;
  /** YYYY-MM-DD formatted date string */
  date: string;
  /** 'available' overrides regular rules with custom hours; 'unavailable' blocks the whole day */
  type: 'available' | 'unavailable';
  intervals?: AvailabilityInterval[];
  reason?: string;
}

export interface AvailabilityProfile {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  /** IANA timezone identifier, e.g. 'Africa/Accra' */
  timezone: string;
  isDefault: boolean;
  weeklyRules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  /** Minimum notice required before a slot can be booked, in minutes (e.g. 120 = 2 hours) */
  minimumNoticeMinutes: number;
  /** Maximum booking horizon in the future, in days (e.g. 30 = up to 30 days ahead) */
  maximumBookingHorizonDays: number;
  /** Default buffer before every meeting in minutes */
  defaultBufferBeforeMinutes: number;
  /** Default buffer after every meeting in minutes */
  defaultBufferAfterMinutes: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingProfile {
  id: string;
  workspaceId: string;
  organizationId: string;
  type: 'individual' | 'team';
  userId?: string;
  teamId?: string;
  availabilityProfileId: string;
  timezone: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface BookingField {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
  crmTargetProperty?: string;
}

export type EventTypePurpose =
  | 'sales'
  | 'consultation'
  | 'support'
  | 'training'
  | 'parent_engagement'
  | 'webinar'
  | 'internal'
  | 'custom';

export type EventTypeFormat = 'one_to_one' | 'group' | 'round_robin' | 'collective';

export type MeetingLocationType =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'phone'
  | 'in_person'
  | 'custom';

export interface EventType {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  purpose: EventTypePurpose;
  format: EventTypeFormat;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumBookingHorizonDays: number;
  /** Step increment for start times (e.g. 15, 30, 60). Defaults to durationMinutes if omitted */
  slotIntervalMinutes?: number;
  schedulingProfileId?: string;
  availabilityProfileId?: string;
  hostUserId?: string;
  color?: string;
  locationType: MeetingLocationType;
  locationDetails?: string;
  customQuestions?: BookingField[];
  crmPrefillEnabled?: boolean;
  autoTags?: string[];
  autoAutomations?: string[];
  confirmationMessage?: string;
  teamConfig?: TeamSchedulingConfig;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface BookingHold {
  id: string;
  workspaceId: string;
  organizationId: string;
  eventTypeId: string;
  schedulingProfileId?: string;
  hostUserId?: string;
  /** ISO 8601 UTC string */
  startAt: string;
  /** ISO 8601 UTC string */
  endAt: string;
  /** Visitor session identifier or token to prevent hold hijacking */
  sessionId: string;
  /** ISO 8601 UTC timestamp when hold expires (e.g. 5 minutes from creation) */
  expiresAt: string;
  status: 'active' | 'converted' | 'expired' | 'released';
  createdAt: string;
  updatedAt: string;
}

export interface BookerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  customResponses?: Record<string, string | number | boolean | string[]>;
  contactId?: string;
  entityId?: string;
}

export type BookingStatus =
  | 'pending'
  | 'held'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'declined'
  | 'expired'
  | 'completed'
  | 'no_show';

export interface Booking {
  id: string;
  workspaceId: string;
  organizationId: string;
  eventTypeId: string;
  eventTypeName: string;
  schedulingProfileId?: string;
  hostUserId?: string;
  /** Linked Meeting document id materialized upon confirmation */
  meetingId?: string;
  booker: BookerInfo;
  /** ISO 8601 UTC timestamp */
  startAt: string;
  /** ISO 8601 UTC timestamp */
  endAt: string;
  /** The visitor's selected timezone when booking */
  timezone: string;
  locationType: MeetingLocationType;
  locationDetails?: string;
  joinUrl?: string;
  status: BookingStatus;
  bookingSource: 'booking_page' | 'crm' | 'admin' | 'api' | 'ai' | 'automation';
  /** SHA-256 hash of the secure manage token for self-service reschedule/cancel */
  manageTokenHash?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  rescheduledFromId?: string;
  rescheduledAt?: string;
  externalCalendarEventId?: string;
  externalCalendarEventUrl?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  /** ISO 8601 UTC start time */
  start: string;
  /** ISO 8601 UTC end time */
  end: string;
  /** Localized display time in visitor's timezone, e.g. "09:30" */
  formattedTime: string;
  /** Localized display end time in visitor's timezone, e.g. "10:00" */
  formattedEndTime: string;
  available: boolean;
}

export interface HostPublicProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  bio?: string;
}

export interface PublicBookingPageData {
  eventType: EventType;
  availabilityProfile: AvailabilityProfile;
  hostProfile?: HostPublicProfile;
  workspaceName?: string;
  workspaceLogo?: string;
}

// ── Phase 2: Unified Participant, Conference Session & Activity Domain ──────────

export type ParticipantRole =
  | 'host'
  | 'co_host'
  | 'facilitator'
  | 'attendee'
  | 'panelist'
  | 'guest';

export type ParticipantRsvpStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'tentative';

export type ParticipantAttendanceStatus =
  | 'not_joined'
  | 'joined'
  | 'left'
  | 'no_show';

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  contactId?: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: ParticipantRole;
  rsvpStatus: ParticipantRsvpStatus;
  attendanceStatus: ParticipantAttendanceStatus;
  registrationId?: string;
  /** SHA-256 hash of the attendee magic join link */
  tokenHash?: string;
  joinedAt?: string;
  leftAt?: string;
  totalAttendanceSeconds?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConferenceProvider =
  | 'google_meet'
  | 'zoom'
  | 'microsoft_teams'
  | 'daily'
  | 'smart_sapp'
  | 'physical'
  | 'custom';

export type ConferenceSessionStatus =
  | 'pending'
  | 'creating'
  | 'active'
  | 'ended'
  | 'cancelled'
  | 'failed';

export interface ConferenceSession {
  id: string;
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  provider: ConferenceProvider;
  externalMeetingId?: string;
  joinUrl?: string;
  hostUrl?: string;
  passwordReference?: string;
  dialIn?: { phone: string; pin?: string };
  physicalAddress?: string;
  providerMetadata?: Record<string, string | number | boolean | null>;
  status: ConferenceSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type MeetingActivityType =
  | 'meeting_created'
  | 'booking_confirmed'
  | 'participant_added'
  | 'participant_removed'
  | 'role_updated'
  | 'rsvp_updated'
  | 'participant_joined'
  | 'participant_left'
  | 'meeting_started'
  | 'meeting_completed'
  | 'meeting_cancelled'
  | 'recording_uploaded';

export interface MeetingActivity {
  id: string;
  workspaceId: string;
  meetingId: string;
  actorType: 'user' | 'system' | 'ai' | 'external';
  actorId?: string;
  actorName?: string;
  type: MeetingActivityType;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export type RegistrationStatus =
  | 'pending'
  | 'registered'
  | 'approved'
  | 'waitlisted'
  | 'cancelled';

export interface Registration {
  id: string;
  meetingId: string;
  participantId: string;
  tokenHash: string;
  registrationData?: Record<string, string | number | boolean | string[]>;
  status: RegistrationStatus;
  registeredAt: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export * from './calendar';
export * from './team';
export * from './routing';
export * from './intelligence';
export * from './polls';
export * from './calendar-view';
export * from './webhooks';
export * from './crm-attribution';
export * from './webinar-stage';
export * from './feedback';
export * from './payments';
export * from './resources';
export * from './compliance';
export * from './localization';
export type { ParsedSchedulingIntent, SuggestedBookingSlot } from './ai-assistant';
export * from './notifications';
export * from './calendar-links';
export * from './bulk-operations';
export * from './offline-cache';
export * from './telemetry';
export * from './templates';
export * from './speech-coach';
export * from './deal-advancer';

