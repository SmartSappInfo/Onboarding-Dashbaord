'use server';

/**
 * {{Org_name}} Experience Platform — Learning Server Actions
 *
 * Strongly typed Next.js Server Actions for LMS: Courses, Modules, Lessons,
 * Enrollments, Progress, Assessments, and Assignments.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Authoring (courses/modules/lessons): staff via `requirePortalAdmin` + `assertRecordInPortal`.
 * - Learner actions: Firebase ID token → `requirePortalMember`; the learner is the token's uid.
 * - `listCoursesByPortalAction`: staff see every status; everyone else sees published courses only.
 * - `getSanitizedAssessmentAction` stays public (answer keys are stripped).
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import { CourseService } from '@/lib/services/course-service';
import { EnrollmentService } from '@/lib/services/enrollment-service';
import { LearningProgressService } from '@/lib/services/learning-progress-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
  portalIdOfRecord,
  isPortalAdminCaller,
} from '@/lib/auth/require-portal-access';
import type {
  Course,
  CourseStatus,
  CourseModule,
  CourseLesson,
  CourseEnrollment,
  CourseAssessment,
  LearningProgress,
  AssessmentResult,
  AssignmentSubmission,
  CreateCourseInput,
  UpdateCourseInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  SubmitAssessmentInput,
  SubmitAssignmentInput,
} from '@/lib/types/learning';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.learning-actions', err, undefined, fallback) };
}

// ── Course Actions ───────────────────────────────────────────────────────────

export async function createCourseAction(
  input: CreateCourseInput
): Promise<ActionResponse<Course>> {
  try {
    const { auth } = await requirePortalAdmin(input.portalId);
    const course = await CourseService.createCourse(input, auth.uid);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: course };
  } catch (err: unknown) {
    return failure(err, 'Action failed.');
  }
}

export async function updateCourseAction(
  courseId: string,
  updates: UpdateCourseInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<Course>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    const course = await CourseService.updateCourse(courseId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/learn/${course.slug}`);
    }
    return { success: true, data: course };
  } catch (err: unknown) {
    return failure(err, 'Failed to update course.');
  }
}

export async function deleteCourseAction(
  courseId: string,
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    await CourseService.deleteCourse(courseId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete course.');
  }
}

export async function listCoursesByPortalAction(
  portalId: string,
  status?: CourseStatus
): Promise<ActionResponse<Course[]>> {
  try {
    // Staff (session + portal org) may list drafts; everyone else only sees the published catalog.
    const isStaff = await isPortalAdminCaller(portalId);
    const courses = await CourseService.listCourses(portalId, isStaff ? status : 'published');
    return { success: true, data: courses };
  } catch (err: unknown) {
    return failure(err, 'Failed to list courses.');
  }
}

// ── Module Actions ───────────────────────────────────────────────────────────

export async function createModuleAction(
  input: CreateModuleInput,
  portalSlug?: string
): Promise<ActionResponse<CourseModule>> {
  try {
    await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('courses', input.courseId, input.portalId);
    const mod = await CourseService.createModule(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: mod };
  } catch (err: unknown) {
    return failure(err, 'Failed to create module.');
  }
}

export async function updateModuleAction(
  moduleId: string,
  updates: UpdateModuleInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseModule>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_modules', moduleId, portalId);
    const mod = await CourseService.updateModule(moduleId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: mod };
  } catch (err: unknown) {
    return failure(err, 'Failed to update module.');
  }
}

export async function deleteModuleAction(
  moduleId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_modules', moduleId, portalId);
    await CourseService.deleteModule(moduleId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete module.');
  }
}

// ── Lesson Actions ───────────────────────────────────────────────────────────

export async function createLessonAction(
  input: CreateLessonInput,
  portalSlug?: string
): Promise<ActionResponse<CourseLesson>> {
  try {
    await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('courses', input.courseId, input.portalId);
    await assertRecordInPortal('course_modules', input.moduleId, input.portalId);
    const lesson = await CourseService.createLesson(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: lesson };
  } catch (err: unknown) {
    return failure(err, 'Failed to create lesson.');
  }
}

export async function updateLessonAction(
  lessonId: string,
  updates: UpdateLessonInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseLesson>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_lessons', lessonId, portalId);
    const lesson = await CourseService.updateLesson(lessonId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: lesson };
  } catch (err: unknown) {
    return failure(err, 'Failed to update lesson.');
  }
}

export async function deleteLessonAction(
  lessonId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('course_lessons', lessonId, portalId);
    await CourseService.deleteLesson(lessonId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete lesson.');
  }
}

export async function listLessonsByCourseAction(
  courseId: string
): Promise<ActionResponse<CourseLesson[]>> {
  try {
    // Studio view: the full lesson list (drafts included) is staff-only.
    await requirePortalAdmin(await portalIdOfRecord('courses', courseId));
    const lessons = await CourseService.listLessonsByCourse(courseId);
    return { success: true, data: lessons };
  } catch (err: unknown) {
    return failure(err, 'Failed to list lessons.');
  }
}

// ── Enrollment & Progress Actions ────────────────────────────────────────────

export async function enrollInCourseAction(
  idToken: string,
  courseId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseEnrollment>> {
  try {
    const { uid: userId, isPortalStaff } = await requirePortalMember(idToken, portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    // Members self-enrol under plan gating (was hard-coded 'manual_admin', which skipped it).
    // Portal staff previewing as a learner keep the staff override.
    const enrollment = await EnrollmentService.enrollUserInCourse(
      courseId,
      userId,
      portalId,
      isPortalStaff ? 'manual_admin' : 'self_enroll'
    );
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: enrollment };
  } catch (err: unknown) {
    return failure(err, 'Failed to enroll in course.');
  }
}

export async function completeLessonAction(
  idToken: string,
  courseId: string,
  lessonId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    const { uid: userId } = await requirePortalMember(idToken, portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    await assertRecordInPortal('course_lessons', lessonId, portalId);
    // The service additionally binds the lesson to `courseId` and requires an enrolment (item 2).
    await LearningProgressService.completeLesson(courseId, lessonId, userId, portalId);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to mark lesson complete.');
  }
}

export async function recordVideoProgressAction(
  idToken: string,
  courseId: string,
  lessonId: string,
  portalId: string,
  watchSeconds: number,
  watchPercentage: number
): Promise<ActionResponse<LearningProgress>> {
  try {
    const { uid: userId } = await requirePortalMember(idToken, portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    await assertRecordInPortal('course_lessons', lessonId, portalId);
    const prog = await LearningProgressService.recordVideoProgress(
      courseId,
      lessonId,
      userId,
      portalId,
      watchSeconds,
      watchPercentage
    );
    return { success: true, data: prog };
  } catch (err: unknown) {
    return failure(err, 'Failed to record video progress.');
  }
}

export async function submitAssessmentAction(
  idToken: string,
  input: Omit<SubmitAssessmentInput, 'userId'>,
  portalSlug?: string
): Promise<ActionResponse<AssessmentResult>> {
  try {
    // Results are recorded against the verified learner, never a caller-chosen userId.
    const { uid } = await requirePortalMember(idToken, input.portalId);
    await assertRecordInPortal('courses', input.courseId, input.portalId);
    const result = await LearningProgressService.evaluateAssessmentSubmission({ ...input, userId: uid });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    return failure(err, 'Failed to evaluate assessment.');
  }
}

export async function submitAssignmentAction(
  idToken: string,
  input: Omit<SubmitAssignmentInput, 'userId'>
): Promise<ActionResponse<AssignmentSubmission>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    await assertRecordInPortal('courses', input.courseId, input.portalId);
    const submission = await LearningProgressService.submitAssignment({ ...input, userId: uid });
    return { success: true, data: submission };
  } catch (err: unknown) {
    return failure(err, 'Failed to submit assignment.');
  }
}

/**
 * Fetch assessment with answer keys and explanations stripped for client learner rendering.
 * Security: Prevents quiz answer leakage to student browsers via DevTools or network snooping.
 */
export async function getSanitizedAssessmentAction(
  lessonId: string
): Promise<ActionResponse<CourseAssessment | null>> {
  try {
    const snap = await adminDb
      .collection('course_assessments')
      .where('lessonId', '==', lessonId)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: true, data: null };
    }

    const docData = snap.docs[0].data() as CourseAssessment;
    const sanitizedQuestions = (docData.questions || []).map(q => ({
      ...q,
      explanation: undefined, // Never reveal question explanations before grading
      options: (q.options || []).map(opt => ({
        id: opt.id,
        text: opt.text,
        isCorrect: false, // Security: zero answer key leakage to student client
      })),
    }));

    const sanitizedAssessment: CourseAssessment = {
      ...docData,
      id: snap.docs[0].id,
      questions: sanitizedQuestions,
    };

    return { success: true, data: sanitizedAssessment };
  } catch (err: unknown) {
    return {
      success: false,
      error: toClientErrorMessage('actions.learning-actions', err, undefined, 'Failed to fetch assessment.'),
    };
  }
}

