import type { CourseStatus } from '../types/learning';
/**
 * {{Org_name}} Experience Platform — Course Domain Service
 *
 * Server-side domain operations for Programs, Courses, Modules, and Lessons.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Course,
  CourseModule,
  CourseLesson,
  CourseAssessment,
  CourseAssignment,
  CreateCourseInput,
  UpdateCourseInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  CourseCurriculumTree,
  AggregatedModule,
  AggregatedLesson,
  LearningProgress,
  CourseEnrollment,
} from '@/lib/types/learning';

export class CourseService {
  /**
   * Helper to clean slugs
   */
  public static sanitizeSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ── Course Operations ──────────────────────────────────────────────────────

  public static async createCourse(input: CreateCourseInput, actorId?: string): Promise<Course> {
    const slug = input.slug?.trim() ? CourseService.sanitizeSlug(input.slug) : CourseService.sanitizeSlug(input.title);
    const now = new Date().toISOString();
    const docRef = adminDb.collection('courses').doc();

    const course: Course = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['onboarding'],
      title: input.title.trim(),
      slug,
      description: input.description?.trim(),
      summary: input.summary?.trim(),
      thumbnailUrl: input.thumbnailUrl,
      coverImageUrl: input.coverImageUrl,
      instructorName: input.instructorName?.trim() || 'Academy Instructor',
      instructorTitle: input.instructorTitle?.trim(),
      instructorAvatarUrl: input.instructorAvatarUrl,
      instructorBio: input.instructorBio?.trim(),
      level: input.level || 'all_levels',
      category: input.category?.trim() || 'General',
      tags: input.tags || [],
      estimatedDurationMinutes: input.estimatedDurationMinutes || 60,
      status: input.status || 'draft',
      defaultReleaseType: input.defaultReleaseType || 'immediate',
      learningObjectives: input.learningObjectives || [],
      certificateEnabled: input.certificateEnabled ?? true,
      order: input.order ?? 1,
      featured: input.featured ?? false,
      totalModuleCount: 0,
      totalLessonCount: 0,
      totalDurationSeconds: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === 'published' ? now : undefined,
      createdBy: actorId,
    };

    await docRef.set(course);
    return course;
  }

  public static async updateCourse(
    courseId: string,
    updates: UpdateCourseInput,
    _actorId?: string
  ): Promise<Course> {
    const docRef = adminDb.collection('courses').doc(courseId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Course with ID ${courseId} not found.`);
    }

    const current = snap.data() as Course;
    const now = new Date().toISOString();

    const updatedCourse: Course = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      slug: updates.slug ? CourseService.sanitizeSlug(updates.slug) : current.slug,
      status: updates.status || current.status,
      publishedAt:
        updates.status === 'published' && !current.publishedAt ? now : current.publishedAt,
      updatedAt: now,
    };

    await docRef.set(updatedCourse, { merge: true });
    return updatedCourse;
  }

  public static async deleteCourse(courseId: string): Promise<void> {
    const batch = adminDb.batch();

    // 1. Delete course
    batch.delete(adminDb.collection('courses').doc(courseId));

    // 2. Cascade delete modules
    const modulesSnap = await adminDb
      .collection('course_modules')
      .where('courseId', '==', courseId)
      .get();
    modulesSnap.docs.forEach(d => batch.delete(d.ref));

    // 3. Delete lessons
    const lessonsSnap = await adminDb
      .collection('course_lessons')
      .where('courseId', '==', courseId)
      .get();
    lessonsSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
  }

  public static async listCourses(
    portalId: string,
    status?: CourseStatus
  ): Promise<Course[]> {
    let q = adminDb.collection('courses').where('portalId', '==', portalId);
    if (status) {
      q = q.where('status', '==', status);
    }
    const snap = await q.get();
    return snap.docs.map(d => d.data() as Course);
  }

  public static async getCourseById(courseId: string): Promise<Course | null> {
    const snap = await adminDb.collection('courses').doc(courseId).get();
    if (!snap.exists) return null;
    return snap.data() as Course;
  }

  public static async getCourseBySlug(portalId: string, slug: string): Promise<Course | null> {
    const snap = await adminDb
      .collection('courses')
      .where('portalId', '==', portalId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as Course;
  }

  public static async listPortalCourses(
    portalId: string,
    statusFilter?: 'published' | 'all'
  ): Promise<Course[]> {
    let q = adminDb.collection('courses').where('portalId', '==', portalId);
    if (statusFilter === 'published') {
      q = q.where('status', '==', 'published');
    }

    const snap = await q.orderBy('order', 'asc').get();
    return snap.docs.map(d => d.data() as Course);
  }

  // ── Module Operations ──────────────────────────────────────────────────────

  public static async createModule(input: CreateModuleInput): Promise<CourseModule> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('course_modules').doc();

    const newModule: CourseModule = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      courseId: input.courseId,
      title: input.title.trim(),
      description: input.description?.trim(),
      order: input.order ?? 1,
      releaseRule: input.releaseRule || { type: 'immediate' },
      lessonCount: 0,
      durationSeconds: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newModule);

    // Increment module count on course
    await adminDb.collection('courses').doc(input.courseId).set(
      {
        totalModuleCount: (await adminDb.collection('course_modules').where('courseId', '==', input.courseId).get()).size,
        updatedAt: now,
      },
      { merge: true }
    );

    return newModule;
  }

  public static async updateModule(moduleId: string, updates: UpdateModuleInput): Promise<CourseModule> {
    const docRef = adminDb.collection('course_modules').doc(moduleId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Module ${moduleId} not found.`);

    const current = snap.data() as CourseModule;
    const now = new Date().toISOString();

    const updatedModule: CourseModule = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      updatedAt: now,
    };

    await docRef.set(updatedModule, { merge: true });
    return updatedModule;
  }

  public static async deleteModule(moduleId: string): Promise<void> {
    const docRef = adminDb.collection('course_modules').doc(moduleId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const moduleData = snap.data() as CourseModule;
    const batch = adminDb.batch();

    // 1. Delete module
    batch.delete(docRef);

    // 2. Delete child lessons
    const lessonsSnap = await adminDb
      .collection('course_lessons')
      .where('moduleId', '==', moduleId)
      .get();
    lessonsSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();

    // Recalculate module count
    const remainingCount = (
      await adminDb.collection('course_modules').where('courseId', '==', moduleData.courseId).get()
    ).size;
    await adminDb.collection('courses').doc(moduleData.courseId).set(
      { totalModuleCount: remainingCount, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  // ── Lesson Operations ──────────────────────────────────────────────────────

  public static async createLesson(input: CreateLessonInput): Promise<CourseLesson> {
    const slug = input.slug?.trim() ? CourseService.sanitizeSlug(input.slug) : CourseService.sanitizeSlug(input.title);
    const now = new Date().toISOString();
    const docRef = adminDb.collection('course_lessons').doc();

    const lesson: CourseLesson = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      courseId: input.courseId,
      moduleId: input.moduleId,
      title: input.title.trim(),
      slug,
      summary: input.summary?.trim(),
      contentType: input.contentType || 'video',
      content: input.content || '',
      videoUrl: input.videoUrl,
      videoDurationSeconds: input.videoDurationSeconds || 0,
      thumbnailUrl: input.thumbnailUrl,
      attachments: input.attachments || [],
      completionRule: input.completionRule || { type: 'manual_button' },
      releaseRule: input.releaseRule || { type: 'immediate' },
      order: input.order ?? 1,
      isPreview: input.isPreview ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(lesson);

    // Update totalLessonCount on course and module
    const lessonsInCourse = await adminDb.collection('course_lessons').where('courseId', '==', input.courseId).get();
    const lessonsInModule = await adminDb.collection('course_lessons').where('moduleId', '==', input.moduleId).get();

    await adminDb.collection('courses').doc(input.courseId).set(
      { totalLessonCount: lessonsInCourse.size, updatedAt: now },
      { merge: true }
    );
    await adminDb.collection('course_modules').doc(input.moduleId).set(
      { lessonCount: lessonsInModule.size, updatedAt: now },
      { merge: true }
    );

    return lesson;
  }

  public static async updateLesson(lessonId: string, updates: UpdateLessonInput): Promise<CourseLesson> {
    const docRef = adminDb.collection('course_lessons').doc(lessonId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Lesson ${lessonId} not found.`);

    const current = snap.data() as CourseLesson;
    const now = new Date().toISOString();

    const updatedLesson: CourseLesson = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      slug: updates.slug ? CourseService.sanitizeSlug(updates.slug) : current.slug,
      updatedAt: now,
    };

    await docRef.set(updatedLesson, { merge: true });
    return updatedLesson;
  }

  public static async deleteLesson(lessonId: string): Promise<void> {
    const docRef = adminDb.collection('course_lessons').doc(lessonId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const lessonData = snap.data() as CourseLesson;
    await docRef.delete();

    // Recalculate totals
    const lessonsInCourse = await adminDb.collection('course_lessons').where('courseId', '==', lessonData.courseId).get();
    const lessonsInModule = await adminDb.collection('course_lessons').where('moduleId', '==', lessonData.moduleId).get();

    await adminDb.collection('courses').doc(lessonData.courseId).set(
      { totalLessonCount: lessonsInCourse.size, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    await adminDb.collection('course_modules').doc(lessonData.moduleId).set(
      { lessonCount: lessonsInModule.size, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  public static async getLessonById(lessonId: string): Promise<CourseLesson | null> {
    const snap = await adminDb.collection('course_lessons').doc(lessonId).get();
    if (!snap.exists) return null;
    return snap.data() as CourseLesson;
  }

  public static async getLessonBySlug(courseId: string, slug: string): Promise<CourseLesson | null> {
    const snap = await adminDb
      .collection('course_lessons')
      .where('courseId', '==', courseId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as CourseLesson;
  }

  // ── Curriculum Aggregated Tree View ────────────────────────────────────────

  public static async getCourseCurriculum(
    courseId: string,
    userId?: string
  ): Promise<CourseCurriculumTree | null> {
    const course = await CourseService.getCourseById(courseId);
    if (!course) return null;

    // 1. Fetch modules
    const modulesSnap = await adminDb
      .collection('course_modules')
      .where('courseId', '==', courseId)
      .orderBy('order', 'asc')
      .get();
    const modules = modulesSnap.docs.map(d => d.data() as CourseModule);

    // 2. Fetch all lessons
    const lessonsSnap = await adminDb
      .collection('course_lessons')
      .where('courseId', '==', courseId)
      .orderBy('order', 'asc')
      .get();
    const allLessons = lessonsSnap.docs.map(d => d.data() as CourseLesson);

    // 3. Fetch user enrollment & progress if logged in
    let enrollment: CourseEnrollment | undefined = undefined;
    const progressMap = new Map<string, LearningProgress>();

    if (userId) {
      const enrollSnap = await adminDb
        .collection('course_enrollments')
        .where('courseId', '==', courseId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (!enrollSnap.empty) {
        enrollment = enrollSnap.docs[0].data() as CourseEnrollment;
      }

      const progSnap = await adminDb
        .collection('learning_progress')
        .where('courseId', '==', courseId)
        .where('userId', '==', userId)
        .get();
      progSnap.docs.forEach(d => {
        const p = d.data() as LearningProgress;
        progressMap.set(p.lessonId, p);
      });
    }

    // 4. Assemble aggregated hierarchy
    const aggregatedModules: AggregatedModule[] = modules.map(mod => {
      const moduleLessons: AggregatedLesson[] = allLessons
        .filter(l => l.moduleId === mod.id)
        .map(lesson => {
          const prog = progressMap.get(lesson.id);
          return {
            ...lesson,
            progress: prog,
            isUnlocked: true, // evaluated dynamically by DripEngine
          };
        });

      return {
        ...mod,
        lessons: moduleLessons,
        isUnlocked: true,
      };
    });

    return {
      course,
      modules: aggregatedModules,
      enrollment,
    };
  }
}
