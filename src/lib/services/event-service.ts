/**
 * {{Org_name}} Experience Platform — Live Learning, Cohorts & Events Service
 *
 * Server-side domain operations for Live Events, Webinars, Course Cohorts,
 * 1-Click Registration, Attendance Tracking, and AI Replay Publishing.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { EngagementService } from '@/lib/services/engagement-service';
import { LearningProgressService } from '@/lib/services/learning-progress-service';
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
import {
  generateEventIcs as generateEventIcsUtil,
  generateCalendarWebUrls as generateCalendarWebUrlsUtil,
  formatUtcIcsDate as formatUtcIcsDateUtil,
  type CalendarWebUrls,
} from '@/lib/utils/event-calendar-utils';

export class EventService {
  // ── Helpers & URL Sanitization ─────────────────────────────────────────────

  public static sanitizeSlug(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    return slug || 'live-session';
  }

  /**
   * Sanitizes meeting URLs against XSS exploits (javascript:, data:, vbscript: protocols).
   * Strictly permits only valid http/https URLs.
   */
  public static sanitizeMeetingUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Reject dangerous protocol injection immediately
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return '';
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  }

  public static formatUtcIcsDate(isoString: string): string {
    return formatUtcIcsDateUtil(isoString);
  }

  /**
   * Generate RFC 5545 compliant VCALENDAR (.ics) content for Apple iCal, Outlook, and Google.
   */
  public static generateEventIcs(event: LiveEvent): string {
    return generateEventIcsUtil(event);
  }

  /**
   * Generate 1-click web calendar links for Google Calendar, Outlook Web, and Yahoo Calendar.
   */
  public static generateCalendarWebUrls(event: LiveEvent): CalendarWebUrls {
    return generateCalendarWebUrlsUtil(event);
  }

  // ── Live Event CRUD ────────────────────────────────────────────────────────

  public static async createLiveEvent(input: CreateEventInput): Promise<LiveEvent> {
    const docRef = adminDb.collection('live_events').doc();
    const now = new Date().toISOString();

    const slug = input.slug
      ? this.sanitizeSlug(input.slug)
      : this.sanitizeSlug(input.title);

    const start = new Date(input.scheduledStartTime);
    const end = new Date(input.scheduledEndTime);
    const durationMinutes = input.durationMinutes || Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
    const safeMeetingUrl = this.sanitizeMeetingUrl(input.meetingUrl);

    const event: LiveEvent = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['events'],
      title: input.title.trim(),
      slug,
      description: input.description?.trim(),
      type: input.type,
      coverImageUrl: input.coverImageUrl,
      instructorName: input.instructorName.trim(),
      instructorTitle: input.instructorTitle?.trim(),
      instructorAvatarUrl: input.instructorAvatarUrl,
      meetingProvider: input.meetingProvider || 'zoom',
      meetingUrl: safeMeetingUrl,
      meetingId: input.meetingId?.trim(),
      meetingPasscode: input.meetingPasscode?.trim(),
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      durationMinutes,
      maxAttendees: input.maxAttendees,
      registeredCount: 0,
      attendedCount: 0,
      status: 'scheduled',
      isPublic: input.isPublic ?? true,
      allowedPlanIds: input.allowedPlanIds,
      cohortId: input.cohortId,
      courseId: input.courseId,
      lessonId: input.lessonId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(event);
    return event;
  }

  public static async updateLiveEvent(eventId: string, updates: UpdateEventInput): Promise<LiveEvent> {
    const docRef = adminDb.collection('live_events').doc(eventId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Event ${eventId} not found.`);

    const current = snap.data() as LiveEvent;
    const now = new Date().toISOString();

    let durationMinutes = current.durationMinutes;
    if (updates.scheduledStartTime || updates.scheduledEndTime) {
      const start = new Date(updates.scheduledStartTime || current.scheduledStartTime);
      const end = new Date(updates.scheduledEndTime || current.scheduledEndTime);
      durationMinutes = updates.durationMinutes || Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
    }

    const meetingUrl = updates.meetingUrl !== undefined
      ? this.sanitizeMeetingUrl(updates.meetingUrl)
      : current.meetingUrl;

    const updated: LiveEvent = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      slug: updates.slug !== undefined ? this.sanitizeSlug(updates.slug) : current.slug,
      meetingUrl,
      durationMinutes,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deleteLiveEvent(eventId: string): Promise<void> {
    await adminDb.collection('live_events').doc(eventId).delete();
  }

  public static async getLiveEventById(eventId: string): Promise<LiveEvent | null> {
    const snap = await adminDb.collection('live_events').doc(eventId).get();
    if (!snap.exists) return null;
    return snap.data() as LiveEvent;
  }

  public static async getLiveEventBySlug(portalId: string, slug: string): Promise<LiveEvent | null> {
    const snap = await adminDb
      .collection('live_events')
      .where('portalId', '==', portalId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as LiveEvent;
  }

  public static async listPortalEvents(
    portalId: string,
    options?: { status?: string; limitCount?: number }
  ): Promise<LiveEvent[]> {
    let q = adminDb
      .collection('live_events')
      .where('portalId', '==', portalId) as FirebaseFirestore.Query;

    if (options?.status) {
      q = q.where('status', '==', options.status);
    }

    q = q.orderBy('scheduledStartTime', 'asc').limit(options?.limitCount || 50);

    const snap = await q.get();
    return snap.docs.map(d => d.data() as LiveEvent);
  }

  // ── Registration & Attendance ──────────────────────────────────────────────

  public static async registerForEvent(input: RegisterEventInput): Promise<EventRegistration> {
    const regId = `reg_${input.eventId}_${input.userId}`;
    const regRef = adminDb.collection('event_registrations').doc(regId);
    const eventRef = adminDb.collection('live_events').doc(input.eventId);

    const now = new Date().toISOString();

    const registration = await adminDb.runTransaction(async tx => {
      const eventDoc = await tx.get(eventRef);
      if (!eventDoc.exists) throw new Error('Live event not found.');

      const eventData = eventDoc.data() as LiveEvent;
      if (eventData.status === 'cancelled') throw new Error('Cannot register for a cancelled event.');

      if (eventData.maxAttendees && eventData.registeredCount >= eventData.maxAttendees) {
        throw new Error('This event is at full capacity.');
      }

      const existingReg = await tx.get(regRef);
      if (existingReg.exists && existingReg.data()?.status === 'registered') {
        return existingReg.data() as EventRegistration;
      }

      const newReg: EventRegistration = {
        id: regId,
        organizationId: input.organizationId,
        portalId: input.portalId,
        eventId: input.eventId,
        userId: input.userId,
        userName: input.userName.trim(),
        userEmail: input.userEmail.trim(),
        status: 'registered',
        registeredAt: now,
        updatedAt: now,
      };

      tx.set(regRef, newReg);
      tx.update(eventRef, {
        registeredCount: (eventData.registeredCount || 0) + 1,
        updatedAt: now,
      });

      return newReg;
    });

    // Gamification: Award +15 Points for Event Registration
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.userId)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      await PortalMembershipService.awardPoints(
        membershipSnap.docs[0].id,
        15,
        'Registered for Live Masterclass Event 🎟️'
      );
    }

    // Non-blocking Activity Log
    await EngagementService.logMemberActivity({
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: 'event.registered',
      title: `Registered for Live Session`,
      description: `Confirmed seat for event.`,
      metadata: { eventId: input.eventId },
    });

    return registration;
  }

  public static async cancelEventRegistration(eventId: string, userId: string): Promise<void> {
    const regId = `reg_${eventId}_${userId}`;
    const regRef = adminDb.collection('event_registrations').doc(regId);
    const eventRef = adminDb.collection('live_events').doc(eventId);
    const now = new Date().toISOString();

    await adminDb.runTransaction(async tx => {
      const regDoc = await tx.get(regRef);
      if (!regDoc.exists) return;

      const eventDoc = await tx.get(eventRef);
      tx.update(regRef, { status: 'cancelled', updatedAt: now });

      if (eventDoc.exists) {
        const currentCount = eventDoc.data()?.registeredCount || 1;
        tx.update(eventRef, {
          registeredCount: Math.max(0, currentCount - 1),
          updatedAt: now,
        });
      }
    });
  }

  /**
   * Calculate AttendanceStatus based on ratio of attended duration to scheduled duration.
   */
  public static calculateAttendanceStatus(params: {
    attendedDurationSeconds: number;
    scheduledDurationMinutes: number;
    minAttendancePercentage?: number;
  }): AttendanceStatus {
    const duration = params.attendedDurationSeconds || 0;
    if (duration <= 0) return 'no_show';

    const scheduledSeconds = Math.max(1, (params.scheduledDurationMinutes || 60) * 60);
    const thresholdPercent = params.minAttendancePercentage !== undefined ? params.minAttendancePercentage : 70;
    const attendancePercentage = (duration / scheduledSeconds) * 100;

    return attendancePercentage >= thresholdPercent ? 'attended' : 'partial';
  }

  /**
   * Caps client-reported duration to at most 110% of scheduled event duration to prevent spoofing.
   */
  public static capAttendedDuration(
    durationSeconds: number,
    scheduledDurationMinutes: number
  ): number {
    if (durationSeconds <= 0) return 0;
    const maxAllowed = Math.round(Math.max(15, scheduledDurationMinutes || 60) * 60 * 1.1);
    return Math.min(durationSeconds, maxAllowed);
  }

  public static async recordEventAttendance(input: RecordAttendanceInput): Promise<EventRegistration> {
    const regId = `reg_${input.eventId}_${input.userId}`;
    const regRef = adminDb.collection('event_registrations').doc(regId);
    const eventRef = adminDb.collection('live_events').doc(input.eventId);

    const now = new Date().toISOString();
    const snap = await regRef.get();
    const eventSnap = await eventRef.get();
    const eventData = eventSnap.exists ? (eventSnap.data() as LiveEvent) : null;

    const scheduledMins = eventData?.durationMinutes || 60;
    const attendedDurationSeconds = this.capAttendedDuration(
      input.attendedDurationSeconds || 1800,
      scheduledMins
    );
    const status = this.calculateAttendanceStatus({
      attendedDurationSeconds,
      scheduledDurationMinutes: scheduledMins,
    });

    let reg: EventRegistration;
    if (snap.exists) {
      reg = {
        ...(snap.data() as EventRegistration),
        status,
        joinedAt: (snap.data() as EventRegistration).joinedAt || now,
        attendedDurationSeconds,
        updatedAt: now,
      };
      await regRef.set(reg, { merge: true });
    } else {
      reg = {
        id: regId,
        organizationId: eventData?.organizationId || 'smartsapp-hq',
        portalId: input.portalId,
        eventId: input.eventId,
        userId: input.userId,
        userName: 'Member',
        userEmail: '',
        status,
        registeredAt: now,
        joinedAt: now,
        attendedDurationSeconds,
        updatedAt: now,
      };
      await regRef.set(reg);
    }

    if (eventSnap.exists) {
      await eventRef.update({
        attendedCount: (eventData?.attendedCount || 0) + 1,
        updatedAt: now,
      });
    }

    // Award Points for Attendance (+20 pts) asynchronously without blocking
    if (status === 'attended') {
      try {
        const membershipSnap = await adminDb
          .collection('portal_memberships')
          .where('portalId', '==', input.portalId)
          .where('userId', '==', input.userId)
          .limit(1)
          .get();

        if (!membershipSnap.empty) {
          await PortalMembershipService.awardPoints(
            membershipSnap.docs[0].id,
            20,
            `Attended Live Session: ${eventData?.title || 'Masterclass'}`
          );
        }
      } catch (ptsErr: unknown) {
        console.warn('[EventService] Points award non-blocking warning:', ptsErr);
      }
    }

    // If event is linked to a course lesson and status is attended, automatically satisfy lesson completion
    // CAUTION & ARCHITECTURAL NOTE: LearningProgressService.completeLesson takes
    // (courseId, lessonId, userId, portalId). Fixed inverted argument order here.
    if (status === 'attended' && eventData?.courseId && eventData?.lessonId) {
      try {
        await LearningProgressService.completeLesson(
          eventData.courseId,
          eventData.lessonId,
          input.userId,
          input.portalId
        );
      } catch (lmsErr: unknown) {
        console.warn('[EventService] LMS completeLesson non-blocking warning:', lmsErr);
      }
    }

    return reg;
  }

  public static async recordJoinSession(input: {
    eventId: string;
    userId: string;
    portalId: string;
    userName?: string;
    userEmail?: string;
  }): Promise<EventRegistration> {
    const regId = `reg_${input.eventId}_${input.userId}`;
    const regRef = adminDb.collection('event_registrations').doc(regId);
    const eventRef = adminDb.collection('live_events').doc(input.eventId);

    const now = new Date().toISOString();
    const [regSnap, eventSnap] = await Promise.all([regRef.get(), eventRef.get()]);
    const eventData = eventSnap.exists ? (eventSnap.data() as LiveEvent) : null;

    let reg: EventRegistration;
    if (regSnap.exists) {
      const current = regSnap.data() as EventRegistration;
      reg = {
        ...current,
        joinedAt: current.joinedAt || now,
        updatedAt: now,
      };
      await regRef.set(reg, { merge: true });
    } else {
      reg = {
        id: regId,
        organizationId: eventData?.organizationId || 'default-org',
        portalId: input.portalId,
        eventId: input.eventId,
        userId: input.userId,
        userName: input.userName?.trim() || 'Learner',
        userEmail: input.userEmail?.trim() || '',
        status: 'registered',
        registeredAt: now,
        joinedAt: now,
        updatedAt: now,
      };
      await regRef.set(reg);
    }

    if (eventSnap.exists && (!regSnap.exists || !regSnap.data()?.joinedAt)) {
      await eventRef.update({
        attendedCount: (eventData?.attendedCount || 0) + 1,
        updatedAt: now,
      });
    }

    return reg;
  }

  public static async recordLeaveSession(input: {
    eventId: string;
    userId: string;
    portalId: string;
    durationSeconds?: number;
  }): Promise<EventRegistration> {
    const regId = `reg_${input.eventId}_${input.userId}`;
    const regRef = adminDb.collection('event_registrations').doc(regId);
    const eventRef = adminDb.collection('live_events').doc(input.eventId);

    const now = new Date().toISOString();
    const [regSnap, eventSnap] = await Promise.all([regRef.get(), eventRef.get()]);
    const eventData = eventSnap.exists ? (eventSnap.data() as LiveEvent) : null;

    const current = regSnap.exists ? (regSnap.data() as EventRegistration) : null;
    const joinedAt = current?.joinedAt || now;

    let rawDuration = input.durationSeconds;
    if (rawDuration === undefined) {
      const elapsedMs = new Date(now).getTime() - new Date(joinedAt).getTime();
      rawDuration = Math.max(0, Math.round(elapsedMs / 1000));
    }

    const scheduledMins = eventData?.durationMinutes || 60;
    const attendedDurationSeconds = this.capAttendedDuration(rawDuration, scheduledMins);
    const status = this.calculateAttendanceStatus({
      attendedDurationSeconds,
      scheduledDurationMinutes: scheduledMins,
    });

    const updatedReg: EventRegistration = {
      ...(current || {
        id: regId,
        organizationId: eventData?.organizationId || 'default-org',
        portalId: input.portalId,
        eventId: input.eventId,
        userId: input.userId,
        userName: 'Learner',
        userEmail: '',
        registeredAt: now,
      }),
      status,
      joinedAt,
      leftAt: now,
      attendedDurationSeconds,
      updatedAt: now,
    };

    await regRef.set(updatedReg, { merge: true });

    // Non-blocking Points Award (+20 pts)
    if (status === 'attended') {
      try {
        const membershipSnap = await adminDb
          .collection('portal_memberships')
          .where('portalId', '==', input.portalId)
          .where('userId', '==', input.userId)
          .limit(1)
          .get();

        if (!membershipSnap.empty) {
          await PortalMembershipService.awardPoints(
            membershipSnap.docs[0].id,
            20,
            `Attended Live Session: ${eventData?.title || 'Masterclass'}`
          );
        }
      } catch (ptsErr: unknown) {
        console.warn('[EventService] Points award non-blocking warning:', ptsErr);
      }
    }

    // Auto-complete lesson if satisfied
    if (status === 'attended' && eventData?.courseId && eventData?.lessonId) {
      try {
        await LearningProgressService.completeLesson(
          eventData.courseId,
          eventData.lessonId,
          input.userId,
          input.portalId
        );
      } catch (lmsErr: unknown) {
        console.warn('[EventService] LMS completeLesson non-blocking warning:', lmsErr);
      }
    }

    return updatedReg;
  }

  public static async publishEventReplay(input: PublishReplayInput): Promise<LiveEvent> {
    const eventRef = adminDb.collection('live_events').doc(input.eventId);
    const snap = await eventRef.get();
    if (!snap.exists) throw new Error(`Event ${input.eventId} not found.`);

    const now = new Date().toISOString();
    const updates: Partial<LiveEvent> = {
      recordingUrl: input.recordingUrl.trim(),
      recordingDurationSeconds: input.recordingDurationSeconds,
      aiSummary: input.aiSummary?.trim(),
      keyTakeaways: input.keyTakeaways,
      actionItems: input.actionItems,
      slideDeckUrl: input.slideDeckUrl?.trim(),
      status: 'completed',
      updatedAt: now,
    };

    await eventRef.update(updates);
    return { ...(snap.data() as LiveEvent), ...updates };
  }

  /**
   * Helper to format lesson video, summary, and attachment payload from replay assets.
   */
  public static buildCurriculumReplayPayload(params: {
    recordingUrl: string;
    recordingDurationSeconds?: number;
    aiSummary?: string;
    slideDeckUrl?: string;
  }): {
    videoUrl: string;
    videoDurationSeconds?: number;
    summary?: string;
    attachments?: Array<{ id: string; name: string; url: string; mimeType: string }>;
  } {
    const attachments = params.slideDeckUrl
      ? [
          {
            id: 'slides',
            name: 'Session Slide Deck',
            url: params.slideDeckUrl,
            mimeType: 'application/pdf',
          },
        ]
      : undefined;

    return {
      videoUrl: params.recordingUrl,
      videoDurationSeconds: params.recordingDurationSeconds,
      summary: params.aiSummary,
      attachments,
    };
  }

  /**
   * 1-Click attachment of a live event replay into a curriculum lesson.
   * Updates the lesson videoUrl, duration, AI summary, and slide attachments.
   */
  public static async attachReplayToCourseLesson(params: {
    eventId: string;
    courseId: string;
    lessonId: string;
    portalId: string;
  }): Promise<void> {
    const eventSnap = await adminDb.collection('live_events').doc(params.eventId).get();
    if (!eventSnap.exists) {
      throw new Error(`Event ${params.eventId} not found.`);
    }

    const event = eventSnap.data() as LiveEvent;
    if (!event.recordingUrl) {
      throw new Error(`Event "${event.title}" does not have a published recording URL yet.`);
    }

    const lessonRef = adminDb.collection('course_lessons').doc(params.lessonId);
    const lessonSnap = await lessonRef.get();
    if (!lessonSnap.exists) {
      throw new Error(`Lesson ${params.lessonId} not found.`);
    }

    const replayPayload = this.buildCurriculumReplayPayload({
      recordingUrl: event.recordingUrl,
      recordingDurationSeconds: event.recordingDurationSeconds,
      aiSummary: event.aiSummary,
      slideDeckUrl: event.slideDeckUrl,
    });

    const now = new Date().toISOString();
    await lessonRef.set(
      {
        ...replayPayload,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  // ── Course Cohorts CRUD ───────────────────────────────────────────────────

  public static async createCohort(input: CreateCohortInput): Promise<CourseCohort> {
    const docRef = adminDb.collection('course_cohorts').doc();
    const now = new Date().toISOString();

    const slug = input.slug
      ? input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      : input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const cohort: CourseCohort = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      courseId: input.courseId,
      workspaceIds: input.workspaceIds || ['cohorts'],
      name: input.name.trim(),
      slug,
      description: input.description?.trim(),
      instructorId: input.instructorId,
      instructorName: input.instructorName?.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      maxCapacity: input.maxCapacity,
      enrolledCount: 0,
      status: 'upcoming',
      linkedSpaceId: input.linkedSpaceId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(cohort);
    return cohort;
  }

  public static async updateCohort(cohortId: string, updates: UpdateCohortInput): Promise<CourseCohort> {
    const docRef = adminDb.collection('course_cohorts').doc(cohortId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Cohort ${cohortId} not found.`);

    const current = snap.data() as CourseCohort;
    const now = new Date().toISOString();

    const updated: CourseCohort = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      slug: updates.slug !== undefined ? updates.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : current.slug,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deleteCohort(cohortId: string): Promise<void> {
    await adminDb.collection('course_cohorts').doc(cohortId).delete();
  }

  public static async listCourseCohorts(portalId: string, courseId?: string): Promise<CourseCohort[]> {
    let q = adminDb.collection('course_cohorts').where('portalId', '==', portalId) as FirebaseFirestore.Query;
    if (courseId) {
      q = q.where('courseId', '==', courseId);
    }
    const snap = await q.orderBy('startDate', 'asc').get();
    return snap.docs.map(d => d.data() as CourseCohort);
  }
}
