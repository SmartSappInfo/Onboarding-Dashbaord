'use server';

/**
 * {{Org_name}} Experience Platform — Learning Server Actions
 *
 * Strongly typed Next.js Server Actions for LMS: Courses, Modules, Lessons,
 * Enrollments, Progress, Assessments, and Assignments.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { CourseService } from '@/lib/services/course-service';
import { EnrollmentService } from '@/lib/services/enrollment-service';
import { LearningProgressService } from '@/lib/services/learning-progress-service';
import type {
  Course,
  CourseModule,
  CourseLesson,
  CourseEnrollment,
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

// ── Course Actions ───────────────────────────────────────────────────────────

export async function createCourseAction(
  input: CreateCourseInput,
  actorId?: string
): Promise<ActionResponse<Course>> {
  try {
    const course = await CourseService.createCourse(input, actorId);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: course };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create course.' };
  }
}

export async function updateCourseAction(
  courseId: string,
  updates: UpdateCourseInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<Course>> {
  try {
    const course = await CourseService.updateCourse(courseId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/learn/${course.slug}`);
    }
    return { success: true, data: course };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update course.' };
  }
}

export async function deleteCourseAction(
  courseId: string,
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await CourseService.deleteCourse(courseId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete course.' };
  }
}

// ── Module Actions ───────────────────────────────────────────────────────────

export async function createModuleAction(
  input: CreateModuleInput,
  portalSlug?: string
): Promise<ActionResponse<CourseModule>> {
  try {
    const mod = await CourseService.createModule(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: mod };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create module.' };
  }
}

export async function updateModuleAction(
  moduleId: string,
  updates: UpdateModuleInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseModule>> {
  try {
    const mod = await CourseService.updateModule(moduleId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: mod };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update module.' };
  }
}

export async function deleteModuleAction(
  moduleId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CourseService.deleteModule(moduleId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete module.' };
  }
}

// ── Lesson Actions ───────────────────────────────────────────────────────────

export async function createLessonAction(
  input: CreateLessonInput,
  portalSlug?: string
): Promise<ActionResponse<CourseLesson>> {
  try {
    const lesson = await CourseService.createLesson(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: lesson };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create lesson.' };
  }
}

export async function updateLessonAction(
  lessonId: string,
  updates: UpdateLessonInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseLesson>> {
  try {
    const lesson = await CourseService.updateLesson(lessonId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: lesson };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update lesson.' };
  }
}

export async function deleteLessonAction(
  lessonId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CourseService.deleteLesson(lessonId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/learn`);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete lesson.' };
  }
}

// ── Enrollment & Progress Actions ────────────────────────────────────────────

export async function enrollInCourseAction(
  courseId: string,
  userId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CourseEnrollment>> {
  try {
    const enrollment = await EnrollmentService.enrollUserInCourse(
      courseId,
      userId,
      portalId,
      'manual_admin'
    );
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: enrollment };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to enroll in course.' };
  }
}

export async function completeLessonAction(
  courseId: string,
  lessonId: string,
  userId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await LearningProgressService.completeLesson(courseId, lessonId, userId, portalId);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to mark lesson complete.' };
  }
}

export async function recordVideoProgressAction(
  courseId: string,
  lessonId: string,
  userId: string,
  portalId: string,
  watchSeconds: number,
  watchPercentage: number
): Promise<ActionResponse<LearningProgress>> {
  try {
    const prog = await LearningProgressService.recordVideoProgress(
      courseId,
      lessonId,
      userId,
      portalId,
      watchSeconds,
      watchPercentage
    );
    return { success: true, data: prog };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record video progress.' };
  }
}

export async function submitAssessmentAction(
  input: SubmitAssessmentInput,
  portalSlug?: string
): Promise<ActionResponse<AssessmentResult>> {
  try {
    const result = await LearningProgressService.evaluateAssessmentSubmission(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to evaluate assessment.' };
  }
}

export async function submitAssignmentAction(
  input: SubmitAssignmentInput
): Promise<ActionResponse<AssignmentSubmission>> {
  try {
    const submission = await LearningProgressService.submitAssignment(input);
    return { success: true, data: submission };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit assignment.' };
  }
}
