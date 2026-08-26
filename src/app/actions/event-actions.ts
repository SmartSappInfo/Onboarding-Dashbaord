'use server';

/**
 * {{Org_name}} Experience Platform — Live Learning, Cohorts & Events Server Actions
 *
 * Strongly typed Next.js Server Actions for Scheduling Live Events, 1-Click Registration,
 * Attendance Logging, Cohorts Management, and Replay Publishing.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { EventService } from '@/lib/services/event-service';
import type {
  LiveEvent,
  EventRegistration,
  CourseCohort,
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

// ── Live Event Actions ───────────────────────────────────────────────────────

export async function createLiveEventAction(
  input: CreateEventInput,
  portalSlug?: string
): Promise<ActionResponse<LiveEvent>> {
  try {
    const event = await EventService.createLiveEvent(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: event };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create live event.' };
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
    const event = await EventService.updateLiveEvent(eventId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: event };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update live event.' };
  }
}

export async function deleteLiveEventAction(
  eventId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await EventService.deleteLiveEvent(eventId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete live event.' };
  }
}

export async function listLiveEventsByPortalAction(
  portalId: string,
  options?: { status?: string; limitCount?: number }
): Promise<ActionResponse<LiveEvent[]>> {
  try {
    const events = await EventService.listPortalEvents(portalId, options);
    return { success: true, data: events };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list live events.' };
  }
}

export async function listCohortsByPortalAction(
  portalId: string,
  courseId?: string
): Promise<ActionResponse<CourseCohort[]>> {
  try {
    const cohorts = await EventService.listCourseCohorts(portalId, courseId);
    return { success: true, data: cohorts };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list course cohorts.' };
  }
}

// ── Registration & Attendance Actions ────────────────────────────────────────

export async function registerForEventAction(
  input: RegisterEventInput,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    const reg = await EventService.registerForEvent(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to register for event.' };
  }
}

export async function cancelEventRegistrationAction(
  eventId: string,
  userId: string,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await EventService.cancelEventRegistration(eventId, userId);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel registration.' };
  }
}

export async function recordEventAttendanceAction(
  input: RecordAttendanceInput,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<EventRegistration>> {
  try {
    const reg = await EventService.recordEventAttendance(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/events`);
      if (eventSlug) revalidatePath(`/portal/${portalSlug}/events/${eventSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: reg };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to record attendance.' };
  }
}

export async function publishEventReplayAction(
  input: PublishReplayInput,
  portalSlug?: string,
  eventSlug?: string
): Promise<ActionResponse<LiveEvent>> {
  try {
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish event replay.' };
  }
}

// ── Course Cohort Actions ───────────────────────────────────────────────────

export async function createCohortAction(
  input: CreateCohortInput,
  portalSlug?: string
): Promise<ActionResponse<CourseCohort>> {
  try {
    const cohort = await EventService.createCohort(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: cohort };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create cohort.' };
  }
}

export async function updateCohortAction(
  cohortId: string,
  updates: UpdateCohortInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseCohort>> {
  try {
    const cohort = await EventService.updateCohort(cohortId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: cohort };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update cohort.' };
  }
}

export async function deleteCohortAction(
  cohortId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await EventService.deleteCohort(cohortId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete cohort.' };
  }
}
