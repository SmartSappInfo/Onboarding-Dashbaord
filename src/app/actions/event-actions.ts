'use server';

/**
 * {{Org_name}} Experience Platform — Live Learning, Cohorts & Events Server Actions
 *
 * Strongly typed Next.js Server Actions for Scheduling Live Events, 1-Click Registration,
 * Attendance Logging, Cohorts Management, and Replay Publishing.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Event/cohort authoring, replays, rosters, listings: staff (`requirePortalAdmin`); records must
 *   belong to that portal and the organization is always the portal's.
 * - Registration, cancellation, join/leave and self check-in: the member's Firebase ID token; the
 *   member is ALWAYS the verified uid. Staff may record attendance for anyone (no token → session).
 */

import { revalidatePath } from 'next/cache';
import { EventService } from '@/lib/services/event-service';
import { CohortService } from '@/lib/services/cohort-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  portalIdOfRecord,
  requirePortalAdmin,
  requirePortalMember,
} from '@/lib/auth/require-portal-access';
import type {
  LiveEvent,
  EventRegistration,
  CourseCohort,
  CohortMember,
  CreateEventInput,
  UpdateEventInput,
  RegisterEventInput,
  RecordAttendanceInput,
  PublishReplayInput,
  CreateCohortInput,
  UpdateCohortInput,
} from '@/lib/types/events';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.event-actions', err, undefined, fallback) };
}

/** Member acting on an event of their portal. */
async function requireEventMember(idToken: string, portalId: string, eventId: string) {
  const member = await requirePortalMember(idToken, portalId);
  await assertRecordInPortal('live_events', eventId, portalId);
  return member;
}

// ── Live Event Actions ───────────────────────────────────────────────────────

export async function createLiveEventAction(
  input: CreateEventInput,
  portalSlug?: string
): Promise<ActionResponse<LiveEvent>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const event = await EventService.createLiveEvent({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: event };
  } catch (err: unknown) {
    return failure(err, 'Failed to create live event.');
  }
}

export async function updateLiveEventAction(
  eventId: string,
  updates: UpdateEventInput,
  portalId: string,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<LiveEvent>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('live_events', eventId, portalId);
    const event = await EventService.updateLiveEvent(eventId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: event };
  } catch (err: unknown) {
    return failure(err, 'Failed to update live event.');
  }
}

export async function deleteLiveEventAction(
  eventId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('live_events', eventId, portalId);
    await EventService.deleteLiveEvent(eventId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete live event.');
  }
}

export async function listLiveEventsByPortalAction(
  portalId: string,
  options?: { status?: string; limitCount?: number }
): Promise<ActionResponse<LiveEvent[]>> {
  try {
    // Staff view (all statuses); the member catalog reads published events directly.
    await requirePortalAdmin(portalId);
    const events = await EventService.listPortalEvents(portalId, options);
    return { success: true, data: events };
  } catch (err: unknown) {
    return failure(err, 'Failed to list live events.');
  }
}

export async function listCohortsByPortalAction(
  portalId: string,
  courseId?: string
): Promise<ActionResponse<CourseCohort[]>> {
  try {
    await requirePortalAdmin(portalId);
    const cohorts = await CohortService.listCourseCohorts(portalId, courseId);
    return { success: true, data: cohorts };
  } catch (err: unknown) {
    return failure(err, 'Failed to list course cohorts.');
  }
}

// ── Registration & Attendance Actions ────────────────────────────────────────

export async function registerForEventAction(
  idToken: string,
  input: Omit<RegisterEventInput, 'userId' | 'organizationId' | 'userEmail'>,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    const member = await requireEventMember(idToken, input.portalId, input.eventId);
    const organizationId = member.membership?.organizationId ?? (await requirePortalOrganizationId(input.portalId));
    const reg = await EventService.registerForEvent({
      ...input,
      organizationId,
      userId: member.uid,
      userEmail: member.email ?? '',
    });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return failure(err, 'Failed to register for event.');
  }
}

export async function cancelEventRegistrationAction(
  idToken: string,
  eventId: string,
  portalId: string,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    const member = await requireEventMember(idToken, portalId, eventId);
    await EventService.cancelEventRegistration(eventId, member.uid);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to cancel registration.');
  }
}

/**
 * @param idToken Member self check-in (attendance is recorded for the verified uid only), or null for
 *   staff marking any registrant's attendance via their session.
 */
export async function recordEventAttendanceAction(
  idToken: string | null,
  input: RecordAttendanceInput,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    let userId = input.userId;
    if (idToken) {
      userId = (await requireEventMember(idToken, input.portalId, input.eventId)).uid;
    } else {
      await requirePortalAdmin(input.portalId);
      await assertRecordInPortal('live_events', input.eventId, input.portalId);
    }
    const reg = await EventService.recordEventAttendance({ ...input, userId });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return failure(err, 'Failed to record attendance.');
  }
}

export async function recordJoinSessionAction(
  idToken: string,
  input: {
    eventId: string;
    portalId: string;
    userName?: string;
  },
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    const member = await requireEventMember(idToken, input.portalId, input.eventId);
    const reg = await EventService.recordJoinSession({ ...input, userId: member.uid, userEmail: member.email ?? undefined });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return failure(err, 'Failed to record session join.');
  }
}

export async function recordLeaveSessionAction(
  idToken: string,
  input: {
    eventId: string;
    portalId: string;
    durationSeconds?: number;
  },
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    const member = await requireEventMember(idToken, input.portalId, input.eventId);
    const reg = await EventService.recordLeaveSession({ ...input, userId: member.uid });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return failure(err, 'Failed to record session leave.');
  }
}

export async function publishEventReplayAction(
  input: PublishReplayInput,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<LiveEvent>> {
  try {
    await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('live_events', input.eventId, input.portalId);
    const event = await EventService.publishEventReplay(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) {
        revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
        revalidatePath(`/portal/${portalSlug}/events/${eventSlug}/replay`);
      }
    }
    return { success: true, data: event };
  } catch (err: unknown) {
    return failure(err, 'Failed to publish event replay.');
  }
}

export async function attachReplayToCourseLessonAction(
  params: {
    eventId: string;
    courseId: string;
    lessonId: string;
    portalId: string;
  },
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(params.portalId);
    await assertRecordInPortal('live_events', params.eventId, params.portalId);
    await assertRecordInPortal('courses', params.courseId, params.portalId);
    await assertRecordInPortal('course_lessons', params.lessonId, params.portalId);
    await EventService.attachReplayToCourseLesson(params);
    revalidatePath(`/admin/portals/${params.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/courses/${params.courseId}`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to attach replay to lesson.');
  }
}

// ── Course Cohort Actions ───────────────────────────────────────────────────

export async function createCohortAction(
  input: CreateCohortInput,
  portalSlug?: string
): Promise<ActionResponse<CourseCohort>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const cohort = await CohortService.createCohort({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: cohort };
  } catch (err: unknown) {
    return failure(err, 'Failed to create cohort.');
  }
}

export async function updateCohortAction(
  cohortId: string,
  updates: UpdateCohortInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseCohort>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_cohorts', cohortId, portalId);
    const cohort = await CohortService.updateCohort(cohortId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: cohort };
  } catch (err: unknown) {
    return failure(err, 'Failed to update cohort.');
  }
}

export async function deleteCohortAction(
  cohortId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_cohorts', cohortId, portalId);
    await CohortService.deleteCohort(cohortId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete cohort.');
  }
}

export async function enrollCohortMemberAction(
  input: {
    organizationId: string;
    portalId: string;
    cohortId: string;
    courseId: string;
    userId: string;
    userName: string;
    userEmail: string;
  },
  portalSlug?: string
): Promise<ActionResponse<CohortMember>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('course_cohorts', input.cohortId, input.portalId);
    const member = await CohortService.enrollMember({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: member };
  } catch (err: unknown) {
    return failure(err, 'Failed to enroll member in cohort.');
  }
}

export async function removeCohortMemberAction(
  cohortId: string,
  userId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_cohorts', cohortId, portalId);
    await CohortService.removeMember(cohortId, userId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to remove member from cohort.');
  }
}

export async function listCohortMembersAction(
  cohortId: string
): Promise<ActionResponse<CohortMember[]>> {
  try {
    await requirePortalAdmin(await portalIdOfRecord('course_cohorts', cohortId));
    const members = await CohortService.listCohortMembers(cohortId);
    return { success: true, data: members };
  } catch (err: unknown) {
    return failure(err, 'Failed to list cohort members.');
  }
}

async function requirePortalOrganizationId(portalId: string): Promise<string> {
  const { PortalService } = await import('@/lib/services/portal-service');
  const portal = await PortalService.getPortalById(portalId);
  if (!portal) throw new Error('Portal not found.');
  return portal.organizationId;
}
