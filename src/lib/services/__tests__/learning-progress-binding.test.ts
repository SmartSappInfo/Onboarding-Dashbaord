// @vitest-environment node
/**
 * @fileOverview Review-fix item 2 (agents_mcp Phase 1 §1.1a, Round 4): progress is bound to the course.
 * - A lesson counts toward a course only if it belongs to that course.
 * - Tracking a non-preview lesson requires an active/completed enrolment; preview lessons stay open.
 * - A quiz result only counts for the assessment's own course and lesson.
 * Legitimate learning (complete in order → 100% → certificate) keeps working.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  seq: 0,
}));

function col(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('@/lib/firebase-admin', () => {
  const docRef = (name: string, id: string) => ({
    id,
    get: async () => ({ exists: col(name).has(id), id, data: () => col(name).get(id) }),
    set: async (d: Doc) => void col(name).set(id, { ...(col(name).get(id) ?? {}), ...d }),
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => d, ref: docRef(name, id) }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  });
  return {
    adminDb: {
      collection: (name: string) => ({ ...query(name, []), doc: (id?: string) => docRef(name, id ?? `auto-${++h.seq}`) }),
    },
  };
});
vi.mock('@/lib/services/portal-membership-service', () => ({ PortalMembershipService: { awardPoints: vi.fn(async () => undefined) } }));
vi.mock('@/lib/services/engagement-service', () => ({ EngagementService: { advanceStepByType: vi.fn(async () => undefined) } }));
vi.mock('@/lib/services/release-schedule-service', () => ({
  ReleaseScheduleService: { evaluateLessonRelease: () => ({ isLocked: false }) },
}));

import { LearningProgressService } from '../learning-progress-service';

beforeEach(() => {
  h.store.clear();
  col('courses').set('course-x', { portalId: 'p1', title: 'X', certificateEnabled: true });
  col('course_lessons').set('x1', { courseId: 'course-x', portalId: 'p1', title: 'X1' });
  col('course_lessons').set('x2', { courseId: 'course-x', portalId: 'p1', title: 'X2', completionRule: { type: 'assessment_pass' } });
  col('course_lessons').set('xp', { courseId: 'course-x', portalId: 'p1', title: 'Preview', isPreview: true });
  col('course_lessons').set('y1', { courseId: 'course-y', portalId: 'p1', title: 'Y1', isPreview: true });
  col('course_assessments').set('quiz-y', {
    courseId: 'course-y',
    lessonId: 'y1',
    passingScore: 0,
    questions: [],
  });
  col('portal_memberships').set('m1', { portalId: 'p1', userId: 'learner' });
});

function enrol(userId = 'learner') {
  col('course_enrollments').set(`e-${userId}`, { courseId: 'course-x', userId, portalId: 'p1', status: 'active' });
}

describe('lesson ↔ course binding', () => {
  it('refuses a lesson from another course (the certificate shortcut)', async () => {
    enrol();
    await expect(LearningProgressService.completeLesson('course-x', 'y1', 'learner', 'p1')).rejects.toThrow('Lesson not found in this course.');
    await expect(LearningProgressService.recordVideoProgress('course-x', 'y1', 'learner', 'p1', 10, 100)).rejects.toThrow('Lesson not found in this course.');
    expect(col('learning_progress').size).toBe(0);
  });

  it('refuses a quiz whose lesson/course differ from the claimed ones', async () => {
    enrol();
    await expect(
      LearningProgressService.evaluateAssessmentSubmission({
        assessmentId: 'quiz-y',
        courseId: 'course-x',
        lessonId: 'x2',
        portalId: 'p1',
        userId: 'learner',
        answers: [],
      })
    ).rejects.toThrow('Assessment not found for this lesson.');
    expect(col('learning_progress').size).toBe(0);
  });
});

describe('enrolment requirement', () => {
  it('refuses tracking a non-preview lesson without an enrolment', async () => {
    await expect(LearningProgressService.completeLesson('course-x', 'x1', 'learner', 'p1')).rejects.toThrow('Enrol in this course to track your progress.');
  });

  it('still lets a non-enrolled member complete a preview lesson (no certificate)', async () => {
    await expect(LearningProgressService.completeLesson('course-x', 'xp', 'learner', 'p1')).resolves.toBeUndefined();
    expect(col('learning_progress').get('course-x_xp_learner')).toMatchObject({ isCompleted: true });
    expect(col('course_certificates').size).toBe(0);
  });
});

describe('legitimate completion', () => {
  it('completes lessons in the course and issues the certificate at 100%', async () => {
    enrol();
    col('course_lessons').delete('x2');
    await LearningProgressService.completeLesson('course-x', 'x1', 'learner', 'p1');
    await LearningProgressService.completeLesson('course-x', 'xp', 'learner', 'p1');
    expect(col('course_enrollments').get('e-learner')).toMatchObject({ progressPercentage: 100, status: 'completed' });
    expect(col('course_certificates').size).toBe(1);
  });
});
