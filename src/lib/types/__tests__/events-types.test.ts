/**
 * {{Org_name}} Experience Platform — Phase 7 Type Contracts Test Suite
 *
 * Validates that all extended TypeScript contracts for Live Events, Webinars,
 * Cohorts, Attendance Records, Release Rules, and Completion Rules compile,
 * enforce strict type safety (0 any), and provide comprehensive domain coverage.
 */

import { describe, it, expect } from 'vitest';
import type {
  LiveEvent,
  EventRegistration,
  CourseCohort,
  CohortMember,
  AttendanceStatus,
  CohortMemberStatus,
} from '@/lib/types/events';
import type {
  LessonContentType,
  CompletionRuleType,
  ReleaseScheduleType,
  ReleaseRule,
  CompletionRule,
} from '@/lib/types/learning';

describe('Phase 7 Domain Types & Contract Coverage', () => {
  it('should accept valid LiveEvent with live_session and zoom metadata', () => {
    const event: LiveEvent = {
      id: 'event-101',
      organizationId: 'org-abc',
      portalId: 'portal-xyz',
      workspaceIds: ['events'],
      title: 'Advanced System Architecture Masterclass',
      slug: 'advanced-system-architecture-masterclass',
      description: 'Deep dive into microservices and distributed transactions.',
      type: 'masterclass',
      instructorName: 'Chief Architect',
      instructorTitle: 'Principal Staff Engineer',
      meetingProvider: 'zoom',
      meetingUrl: 'https://zoom.us/j/1234567890',
      meetingId: '1234567890',
      meetingPasscode: 'securePass123',
      scheduledStartTime: '2026-10-01T14:00:00.000Z',
      scheduledEndTime: '2026-10-01T15:30:00.000Z',
      durationMinutes: 90,
      maxAttendees: 150,
      registeredCount: 45,
      attendedCount: 0,
      status: 'scheduled',
      isPublic: true,
      cohortId: 'cohort-spring-2026',
      courseId: 'course-arch-101',
      lessonId: 'lesson-live-1',
      recordingUrl: 'https://cdn.example.com/recordings/arch-masterclass.mp4',
      recordingDurationSeconds: 5400,
      aiSummary: 'Summary of distributed transactions and event sourcing patterns.',
      keyTakeaways: ['Use outbox pattern for atomic publishing', 'Prefer idempotency keys'],
      actionItems: ['Review repository architecture', 'Implement outbox listener'],
      createdAt: '2026-09-25T12:00:00.000Z',
      updatedAt: '2026-09-25T12:00:00.000Z',
    };

    expect(event.type).toBe('masterclass');
    expect(event.meetingProvider).toBe('zoom');
    expect(event.durationMinutes).toBe(90);
    expect(event.registeredCount).toBe(45);
    expect(event.cohortId).toBe('cohort-spring-2026');
  });

  it('should enforce all valid AttendanceStatus values on EventRegistration', () => {
    const statuses: AttendanceStatus[] = ['registered', 'attended', 'partial', 'no_show', 'cancelled'];

    statuses.forEach((status, idx) => {
      const reg: EventRegistration = {
        id: `reg-${idx}`,
        organizationId: 'org-abc',
        portalId: 'portal-xyz',
        eventId: 'event-101',
        userId: `user-${idx}`,
        userName: `Student ${idx}`,
        userEmail: `student${idx}@example.com`,
        status,
        calendarIcsUrl: `https://portal.example.com/events/101/calendar.ics`,
        registeredAt: '2026-09-25T12:00:00.000Z',
        joinedAt: status === 'attended' || status === 'partial' ? '2026-10-01T14:05:00.000Z' : undefined,
        leftAt: status === 'attended' || status === 'partial' ? '2026-10-01T15:30:00.000Z' : undefined,
        attendedDurationSeconds: status === 'attended' ? 5100 : status === 'partial' ? 1200 : 0,
        updatedAt: '2026-09-25T12:00:00.000Z',
      };
      expect(reg.status).toBe(status);
    });
  });

  it('should accept CourseCohort and CohortMember with progress tracking', () => {
    const cohort: CourseCohort = {
      id: 'cohort-spring-2026',
      organizationId: 'org-abc',
      portalId: 'portal-xyz',
      courseId: 'course-arch-101',
      workspaceIds: ['cohorts'],
      name: 'Spring 2026 Architecture Cohort',
      slug: 'spring-2026-architecture-cohort',
      description: 'Intensive 8-week engineering accelerator.',
      instructorId: 'inst-1',
      instructorName: 'Chief Architect',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-11-26T23:59:59.000Z',
      maxCapacity: 50,
      enrolledCount: 1,
      status: 'upcoming',
      linkedSpaceId: 'space-spring-2026',
      createdAt: '2026-09-25T12:00:00.000Z',
      updatedAt: '2026-09-25T12:00:00.000Z',
    };

    const member: CohortMember = {
      id: 'member-1',
      organizationId: 'org-abc',
      portalId: 'portal-xyz',
      cohortId: cohort.id,
      courseId: cohort.courseId,
      userId: 'user-42',
      userName: 'Alice Dev',
      userEmail: 'alice@example.com',
      joinedAt: '2026-09-25T12:00:00.000Z',
      status: 'active' as CohortMemberStatus,
      progressPercentage: 40,
      completedLessonCount: 4,
    };

    expect(cohort.status).toBe('upcoming');
    expect(cohort.maxCapacity).toBe(50);
    expect(member.status).toBe('active');
    expect(member.progressPercentage).toBe(40);
  });

  it('should support live_session as LessonContentType and attendance as CompletionRuleType', () => {
    const contentType: LessonContentType = 'live_session';
    const completionRule: CompletionRule = {
      type: 'attendance' as CompletionRuleType,
      minAttendancePercentage: 75,
    };

    expect(contentType).toBe('live_session');
    expect(completionRule.type).toBe('attendance');
    expect(completionRule.minAttendancePercentage).toBe(75);
  });

  it('should support cohort-anchored drip release rules in ReleaseScheduleType', () => {
    const rule1: ReleaseRule = {
      type: 'days_after_cohort_start' as ReleaseScheduleType,
      daysDelay: 7,
      cohortStartDate: '2026-10-01T00:00:00.000Z',
    };

    const rule2: ReleaseRule = {
      type: 'cohort_start_date' as ReleaseScheduleType,
      releaseDate: '2026-10-01T00:00:00.000Z',
    };

    expect(rule1.type).toBe('days_after_cohort_start');
    expect(rule1.daysDelay).toBe(7);
    expect(rule2.type).toBe('cohort_start_date');
  });
});
