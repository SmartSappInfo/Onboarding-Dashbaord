// @vitest-environment node
/**
 * @fileOverview Review-fix items 1–2 (agents_mcp Phase 1 §1.1a, Round 4): learning actions wiring.
 * The member enrols under `self_enroll` (plan gating applies); only verified portal staff get the
 * `manual_admin` override. Identity always comes from the ID token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ staff: false }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ adminDb: {} }));
vi.mock('@/lib/services/course-service', () => ({ CourseService: {} }));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, f: string) => f }));

const enrollUserInCourse = vi.hoisted(() => vi.fn(async (courseId: string, userId: string, portalId: string, source: string) => ({ courseId, userId, portalId, source })));
vi.mock('@/lib/services/enrollment-service', () => ({ EnrollmentService: { enrollUserInCourse } }));

const progress = vi.hoisted(() => ({
  completeLesson: vi.fn(async () => undefined),
  recordVideoProgress: vi.fn(async () => ({})),
}));
vi.mock('@/lib/services/learning-progress-service', () => ({ LearningProgressService: progress }));

const assertRecordInPortal = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/auth/require-portal-access', () => ({
  assertRecordInPortal,
  isPortalAdminCaller: vi.fn(async () => false),
  portalAuthErrorMessage: () => null,
  portalIdOfRecord: vi.fn(async () => 'p1'),
  requirePortalAdmin: vi.fn(async () => {
    throw new Error('not staff');
  }),
  requirePortalMember: vi.fn(async () => ({ uid: 'learner-1', email: 'l@x.com', membership: null, isPortalStaff: h.staff })),
}));

import { completeLessonAction, enrollInCourseAction } from '../learning-actions';

beforeEach(() => {
  h.staff = false;
  enrollUserInCourse.mockClear();
  assertRecordInPortal.mockClear();
  progress.completeLesson.mockClear();
});

describe('enrollInCourseAction', () => {
  it('enrols members as self_enroll so plan gating applies', async () => {
    await enrollInCourseAction('token', 'course-1', 'p1');
    expect(enrollUserInCourse).toHaveBeenCalledWith('course-1', 'learner-1', 'p1', 'self_enroll');
  });

  it('keeps the manual_admin override for verified portal staff only', async () => {
    h.staff = true;
    await enrollInCourseAction('token', 'course-1', 'p1');
    expect(enrollUserInCourse).toHaveBeenCalledWith('course-1', 'learner-1', 'p1', 'manual_admin');
  });
});

describe('completeLessonAction', () => {
  it('checks both the course and the lesson against the portal before recording progress', async () => {
    await completeLessonAction('token', 'course-1', 'lesson-1', 'p1');
    expect(assertRecordInPortal).toHaveBeenCalledWith('courses', 'course-1', 'p1');
    expect(assertRecordInPortal).toHaveBeenCalledWith('course_lessons', 'lesson-1', 'p1');
    expect(progress.completeLesson).toHaveBeenCalledWith('course-1', 'lesson-1', 'learner-1', 'p1');
  });
});
