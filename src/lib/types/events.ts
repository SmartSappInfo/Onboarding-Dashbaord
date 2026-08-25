/**
 * {{Org_name}} Experience Platform — Live Learning, Cohorts & Events Types
 *
 * Strict TypeScript definitions for Live Events, Webinars, Workshops,
 * Course Cohorts, Registrations, Attendance Records, and AI Replay Summaries.
 * Zero `any` or `any[]` typing.
 */

// ── Enum & Status Types ──────────────────────────────────────────────────────

export type LiveEventType =
  | 'webinar'
  | 'workshop'
  | 'coaching'
  | 'office_hours'
  | 'masterclass'
  | 'cohort_session';

export type EventType = LiveEventType;

export type MeetingProvider = 'zoom' | 'google_meet' | 'teams' | 'custom';

export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export type EventRegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'waitlist';

export type RegistrationStatus = EventRegistrationStatus;

export type CohortStatus = 'upcoming' | 'in_progress' | 'completed' | 'archived';

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * Live Event Aggregate
 * Represents webinars, workshops, coaching clinics, or scheduled cohort sessions.
 */
export interface LiveEvent {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  title: string;
  slug: string;
  description?: string;
  type: EventType;
  coverImageUrl?: string;

  // Instructor / Speaker Profile
  instructorName: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;

  // Video Conferencing & Room Access
  meetingProvider: MeetingProvider;
  meetingUrl: string;
  meetingId?: string;
  meetingPasscode?: string;

  // Schedule & Capacity (UTC ISO Strings)
  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes: number;
  maxAttendees?: number; // Optional cap; undefined = unlimited
  registeredCount: number;
  attendedCount: number;

  status: EventStatus;
  isPublic: boolean;
  allowedPlanIds?: string[]; // Gating to specific membership plans

  // Linkages
  cohortId?: string; // Optional link to specific course cohort
  courseId?: string; // Optional link to parent course
  lessonId?: string; // Optional link to satisfy lesson completion

  // Replay & AI Pipeline
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  aiSummary?: string;
  keyTakeaways?: string[];
  actionItems?: string[];
  slideDeckUrl?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Event Registration Entity
 * Record of a member's reservation / ticket to a live session.
 */
export interface EventRegistration {
  id: string;
  organizationId: string;
  portalId: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;

  status: RegistrationStatus;
  calendarIcsUrl?: string;

  registeredAt: string;
  joinedAt?: string;
  leftAt?: string;
  attendedDurationSeconds?: number;
  updatedAt: string;
}

/**
 * Course Cohort Aggregate
 * Date-bound student cohort structure for synchronous programs.
 */
export interface CourseCohort {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  workspaceIds: string[];

  name: string;
  slug: string;
  description?: string;

  instructorId?: string;
  instructorName?: string;

  startDate: string; // ISO String
  endDate: string; // ISO String

  maxCapacity?: number;
  enrolledCount: number;
  status: CohortStatus;

  linkedSpaceId?: string; // Optional link to private Community Space (e.g. #march-cohort)

  createdAt: string;
  updatedAt: string;
}

/**
 * Cohort Member Entity
 */
export interface CohortMember {
  id: string;
  organizationId: string;
  portalId: string;
  cohortId: string;
  userId: string;
  userName: string;
  userEmail: string;

  joinedAt: string;
  status: 'active' | 'graduated' | 'dropped';
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateEventInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  title: string;
  slug?: string;
  description?: string;
  type: EventType;
  coverImageUrl?: string;

  instructorName: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;

  meetingProvider?: MeetingProvider;
  meetingUrl: string;
  meetingId?: string;
  meetingPasscode?: string;

  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes?: number;
  maxAttendees?: number;
  isPublic?: boolean;
  allowedPlanIds?: string[];

  cohortId?: string;
  courseId?: string;
  lessonId?: string;
}

export interface UpdateEventInput {
  title?: string;
  slug?: string;
  description?: string;
  type?: EventType;
  coverImageUrl?: string;

  instructorName?: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;

  meetingProvider?: MeetingProvider;
  meetingUrl?: string;
  meetingId?: string;
  meetingPasscode?: string;

  scheduledStartTime?: string;
  scheduledEndTime?: string;
  durationMinutes?: number;
  maxAttendees?: number;
  isPublic?: boolean;
  allowedPlanIds?: string[];
  status?: EventStatus;

  cohortId?: string;
  courseId?: string;
  lessonId?: string;

  recordingUrl?: string;
  recordingDurationSeconds?: number;
  aiSummary?: string;
  keyTakeaways?: string[];
  actionItems?: string[];
  slideDeckUrl?: string;
}

export interface RegisterEventInput {
  organizationId: string;
  portalId: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface RecordAttendanceInput {
  portalId: string;
  eventId: string;
  userId: string;
  attendedDurationSeconds?: number;
}

export interface PublishReplayInput {
  portalId: string;
  eventId: string;
  recordingUrl: string;
  recordingDurationSeconds?: number;
  aiSummary?: string;
  keyTakeaways?: string[];
  actionItems?: string[];
  slideDeckUrl?: string;
}

export interface CreateCohortInput {
  organizationId: string;
  portalId: string;
  courseId: string;
  workspaceIds?: string[];
  name: string;
  slug?: string;
  description?: string;
  instructorId?: string;
  instructorName?: string;
  startDate: string;
  endDate: string;
  maxCapacity?: number;
  linkedSpaceId?: string;
}

export interface UpdateCohortInput {
  name?: string;
  slug?: string;
  description?: string;
  instructorId?: string;
  instructorName?: string;
  startDate?: string;
  endDate?: string;
  maxCapacity?: number;
  status?: CohortStatus;
  linkedSpaceId?: string;
}
