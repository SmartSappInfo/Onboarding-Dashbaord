/**
 * {{Org_name}} Experience Platform — Learning Progress & Completion Service
 *
 * Tracks granular video watch times, lesson completions, quiz evaluations,
 * assignment submissions, drip release schedules, and course certifications.
 *
 * Conforms to:
 * - Strict typing: Zero `any` or `any[]` typing.
 * - Assessment Gating: Enforces quiz passing score before lesson completion.
 * - Video Percentage Automated Milestone: Auto-completes lesson upon reaching watch threshold.
 * - Certificate Issuance: Auto-generates verified CourseCertificate on 100% course completion.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { ReleaseScheduleService } from '@/lib/services/release-schedule-service';
import type {
  Course,
  CourseModule,
  CourseLesson,
  CourseEnrollment,
  LearningProgress,
  CourseAssessment,
  AssignmentSubmission,
  SubmitAssessmentInput,
  AssessmentResult,
  SubmitAssignmentInput,
  ReleaseRule,
  CourseCertificate,
} from '@/lib/types/learning';

/** Fields that bind a lesson/assessment to its course (validated; the rest stays as stored). */
const LessonBindingSchema = z.object({ courseId: z.string(), isPreview: z.boolean().optional() });
const AssessmentBindingSchema = z.object({ courseId: z.string(), lessonId: z.string() });
const EnrollmentStatusSchema = z.object({ status: z.string() });

/** Enrolment statuses under which a learner may record progress (completed = revisiting). */
const TRACKABLE_ENROLLMENT_STATUSES = new Set(['active', 'completed']);

export class LearningProgressService {
  /**
   * SECURITY (Round 4 item 2): progress is keyed by `courseId`, and course completion / certificates
   * count progress rows per course. A lesson may therefore only count toward ITS OWN course, and a
   * non-preview lesson may only be tracked by an enrolled learner. Preview lessons stay open to any
   * member (the player shows them before enrolment); they never issue a certificate on their own
   * because certificates require an enrolment record.
   */
  private static async assertLessonTrackable(courseId: string, lessonId: string, userId: string): Promise<void> {
    const lessonSnap = await adminDb.collection('course_lessons').doc(lessonId).get();
    const lesson = LessonBindingSchema.safeParse(lessonSnap.exists ? lessonSnap.data() : undefined);
    if (!lesson.success || lesson.data.courseId !== courseId) {
      throw new Error('Lesson not found in this course.');
    }
    if (lesson.data.isPreview) return;

    const enrollSnap = await adminDb
      .collection('course_enrollments')
      .where('courseId', '==', courseId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    const enrollment = enrollSnap.empty ? null : EnrollmentStatusSchema.safeParse(enrollSnap.docs[0].data());
    if (!enrollment?.success || !TRACKABLE_ENROLLMENT_STATUSES.has(enrollment.data.status)) {
      throw new Error('Enrol in this course to track your progress.');
    }
  }

  /**
   * Record video watch progress (Throttled/Debounced from client)
   */
  public static async recordVideoProgress(
    courseId: string,
    lessonId: string,
    userId: string,
    portalId: string,
    watchSeconds: number,
    watchPercentage: number
  ): Promise<LearningProgress> {
    await LearningProgressService.assertLessonTrackable(courseId, lessonId, userId);
    const progressId = `${courseId}_${lessonId}_${userId}`;
    const docRef = adminDb.collection('learning_progress').doc(progressId);
    const snap = await docRef.get();

    const lessonSnap = await adminDb.collection('course_lessons').doc(lessonId).get();
    const lesson = lessonSnap.data() as CourseLesson | undefined;
    const moduleId = lesson?.moduleId || 'default-module';
    const organizationId = lesson?.organizationId || 'default-org';

    const now = new Date().toISOString();
    const current = snap.exists ? (snap.data() as LearningProgress) : null;

    // Automated completion threshold: explicit rule or default 85% for pure video lessons
    const shouldAutoCheckVideo =
      (lesson?.completionRule?.type === 'video_percentage' &&
        watchPercentage >= (lesson.completionRule.minVideoPercentage || 80)) ||
      (!lesson?.completionRule && lesson?.contentType === 'video' && watchPercentage >= 85);

    const isCompleted = Boolean(current?.isCompleted || shouldAutoCheckVideo);

    const progress: LearningProgress = {
      id: progressId,
      organizationId,
      portalId,
      courseId,
      moduleId,
      lessonId,
      userId,
      isCompleted,
      watchSeconds: Math.max(watchSeconds, current?.watchSeconds || 0),
      watchPercentage: Math.max(watchPercentage, current?.watchPercentage || 0),
      completedAt: isCompleted && !current?.completedAt ? now : current?.completedAt,
      lastInteractedAt: now,
    };

    await docRef.set(progress, { merge: true });

    if (shouldAutoCheckVideo && !current?.isCompleted) {
      await LearningProgressService.completeLesson(courseId, lessonId, userId, portalId);
    }

    // Automatically trigger 'start_course' onboarding step advancement
    // CAUTION: Executed safely so onboarding sync failures never block video progress persistence.
    try {
      const { EngagementService } = await import('@/lib/services/engagement-service');
      await EngagementService.advanceStepByType(portalId, userId, 'start_course');
    } catch (e: unknown) {
      console.warn(
        '[LearningProgressService] advanceStepByType warning:',
        e instanceof Error ? e.message : 'Unknown'
      );
    }

    return progress;
  }

  /**
   * Mark a lesson as completed & recalculate enrollment percentage
   */
  public static async completeLesson(
    courseId: string,
    lessonId: string,
    userId: string,
    portalId: string
  ): Promise<void> {
    await LearningProgressService.assertLessonTrackable(courseId, lessonId, userId);
    const progressId = `${courseId}_${lessonId}_${userId}`;
    const now = new Date().toISOString();

    const lessonSnap = await adminDb.collection('course_lessons').doc(lessonId).get();
    const lesson = lessonSnap.data() as CourseLesson | undefined;
    const moduleId = lesson?.moduleId || 'default-module';
    const organizationId = lesson?.organizationId || 'default-org';

    // 1. Fetch enrollment, parent module, and membership to evaluate release schedule
    const [enrollSnap, moduleSnap, membershipSnap] = await Promise.all([
      adminDb
        .collection('course_enrollments')
        .where('courseId', '==', courseId)
        .where('userId', '==', userId)
        .limit(1)
        .get(),
      lesson?.moduleId ? adminDb.collection('course_modules').doc(lesson.moduleId).get() : null,
      adminDb
        .collection('portal_memberships')
        .where('portalId', '==', portalId)
        .where('userId', '==', userId)
        .limit(1)
        .get(),
    ]);

    const enrollment = !enrollSnap.empty ? (enrollSnap.docs[0].data() as CourseEnrollment) : null;
    const parentModule = moduleSnap?.exists ? (moduleSnap.data() as CourseModule) : null;

    const memberJoinedAt = !membershipSnap.empty
      ? membershipSnap.docs[0].data().joinedAt || membershipSnap.docs[0].data().createdAt
      : null;
    const completedLessonIds: string[] = !membershipSnap.empty
      ? membershipSnap.docs[0].data().completedLessonIds || []
      : [];

    // 2. Server-Side Drip Schedule Gate: Disallow completing lessons that are drip-locked
    if (lesson && !lesson.isPreview) {
      const releaseResult = ReleaseScheduleService.evaluateLessonRelease({
        lesson,
        module: parentModule,
        enrollment,
        memberJoinedAt,
        completedLessonIds,
      });

      if (releaseResult.isLocked) {
        throw new Error(
          `Lesson "${lesson.title}" is locked and cannot be completed yet. ${releaseResult.lockReason || ''}`
        );
      }
    }

    // 3. Assessment Pass Gate: if lesson requires a passing quiz, verify it was passed
    if (lesson?.completionRule?.type === 'assessment_pass') {
      const currentProgressSnap = await adminDb.collection('learning_progress').doc(progressId).get();
      const currentProgress = currentProgressSnap.exists
        ? (currentProgressSnap.data() as LearningProgress)
        : null;

      if (!currentProgress?.assessmentPassed) {
        throw new Error(
          `Lesson "${lesson.title}" requires passing the knowledge quiz before it can be marked as complete.`
        );
      }
    }

    // 4. Mark lesson progress completed
    await adminDb.collection('learning_progress').doc(progressId).set(
      {
        id: progressId,
        organizationId,
        portalId,
        courseId,
        moduleId,
        lessonId,
        userId,
        isCompleted: true,
        completedAt: now,
        lastInteractedAt: now,
      },
      { merge: true }
    );

    // 5. Add to PortalMembership completedLessonIds
    let membershipId: string | undefined = undefined;
    if (!membershipSnap.empty) {
      const mem = membershipSnap.docs[0];
      membershipId = mem.id;
      const completed: string[] = mem.data().completedLessonIds || [];
      if (!completed.includes(lessonId)) {
        await mem.ref.set(
          {
            completedLessonIds: [...completed, lessonId],
            updatedAt: now,
          },
          { merge: true }
        );
      }
    }

    // 4. Recalculate CourseEnrollment Progress
    const totalLessonsSnap = await adminDb
      .collection('course_lessons')
      .where('courseId', '==', courseId)
      .get();
    const totalLessons = totalLessonsSnap.size;

    const completedProgressSnap = await adminDb
      .collection('learning_progress')
      .where('courseId', '==', courseId)
      .where('userId', '==', userId)
      .where('isCompleted', '==', true)
      .get();
    const completedCount = completedProgressSnap.size;

    const progressPct =
      totalLessons > 0 ? Math.min(100, Math.round((completedCount / totalLessons) * 100)) : 100;
    const isCourseCompleted = progressPct >= 100;

    if (!enrollSnap.empty) {
      const enrollDoc = enrollSnap.docs[0];
      const prevData = enrollDoc.data() as CourseEnrollment;

      let certificateId: string | undefined = prevData.certificateId;

      // 5. Course Completion: Generate verified certificate if enabled
      if (isCourseCompleted) {
        const courseSnap = await adminDb.collection('courses').doc(courseId).get();
        const courseData = courseSnap.exists ? (courseSnap.data() as Course) : null;

        if (courseData?.certificateEnabled && !certificateId) {
          const certQuery = await adminDb
            .collection('course_certificates')
            .where('courseId', '==', courseId)
            .where('userId', '==', userId)
            .limit(1)
            .get();

          if (!certQuery.empty) {
            certificateId = certQuery.docs[0].id;
          } else {
            const certRef = adminDb.collection('course_certificates').doc();
            certificateId = certRef.id;

            let recipientName = 'Learner';
            if (!membershipSnap.empty) {
              const mData = membershipSnap.docs[0].data();
              recipientName = mData.memberName || mData.name || mData.email || 'Learner';
            }

            const verificationCode = `CERT-${courseId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            const certificate: CourseCertificate = {
              id: certificateId,
              organizationId,
              portalId,
              courseId,
              userId,
              membershipId,
              courseTitle: courseData.title,
              recipientName,
              issuedAt: now,
              verificationCode,
            };

            await certRef.set(certificate);
          }
        }
      }

      await enrollDoc.ref.set(
        {
          progressPercentage: progressPct,
          completedLessonCount: completedCount,
          totalLessonCount: totalLessons,
          currentLessonId: lessonId,
          lastAccessedAt: now,
          status: isCourseCompleted ? 'completed' : prevData.status,
          completedAt: isCourseCompleted && !prevData.completedAt ? now : prevData.completedAt,
          certificateId: certificateId || prevData.certificateId,
        },
        { merge: true }
      );

      // 6. Award Gamification Points (+25 pts for Course Completion)
      if (isCourseCompleted && !prevData.completedAt && membershipId) {
        await PortalMembershipService.awardPoints(
          membershipId,
          25,
          `Completed Course: ${courseId}`
        );
      }
    }

    // 7. Automatically trigger 'start_course' onboarding step advancement
    try {
      const { EngagementService } = await import('@/lib/services/engagement-service');
      await EngagementService.advanceStepByType(portalId, userId, 'start_course');
    } catch (e: unknown) {
      console.warn(
        '[LearningProgressService] advanceStepByType warning:',
        e instanceof Error ? e.message : 'Unknown'
      );
    }
  }

  /**
   * Evaluate Drip Release Locks (Delegates to ReleaseScheduleService)
   */
  public static evaluateLessonDripLock(
    rule: ReleaseRule | undefined,
    enrollmentDate: string | null | undefined,
    memberJoinDate: string | null | undefined,
    completedLessonIds: string[]
  ): { isUnlocked: boolean; reason?: string } {
    if (!rule || rule.type === 'immediate') {
      return { isUnlocked: true };
    }

    const mockEnrollment: CourseEnrollment | null = enrollmentDate
      ? {
          id: 'mock-enrollment',
          organizationId: 'mock-org',
          portalId: 'mock-portal',
          workspaceIds: [],
          courseId: 'mock-course',
          userId: 'mock-user',
          source: 'membership_plan',
          status: 'active',
          progressPercentage: 0,
          completedLessonCount: 0,
          totalLessonCount: 1,
          enrolledAt: enrollmentDate,
          lastAccessedAt: enrollmentDate,
        }
      : null;

    const mockLesson: CourseLesson = {
      id: 'mock-lesson',
      organizationId: 'mock-org',
      portalId: 'mock-portal',
      courseId: 'mock-course',
      moduleId: 'mock-module',
      title: 'Mock Lesson',
      slug: 'mock-lesson',
      contentType: 'video',
      content: '',
      completionRule: { type: 'manual_button' },
      order: 1,
      releaseRule: rule,
      createdAt: '',
      updatedAt: '',
    };

    const res = ReleaseScheduleService.evaluateLessonRelease({
      lesson: mockLesson,
      enrollment: mockEnrollment,
      memberJoinedAt: memberJoinDate,
      completedLessonIds,
    });

    return {
      isUnlocked: !res.isLocked,
      reason: res.lockReason,
    };
  }

  /**
   * Evaluate Assessment Submission Server-Side
   */
  public static async evaluateAssessmentSubmission(
    input: SubmitAssessmentInput
  ): Promise<AssessmentResult> {
    const snap = await adminDb.collection('course_assessments').doc(input.assessmentId).get();
    if (!snap.exists) {
      throw new Error(`Assessment ${input.assessmentId} not found.`);
    }

    // SECURITY (Round 4 item 2): a quiz result only counts for the assessment's own course and lesson;
    // otherwise an easy quiz could unlock an `assessment_pass` lesson elsewhere.
    const binding = AssessmentBindingSchema.safeParse(snap.data());
    if (!binding.success || binding.data.courseId !== input.courseId || binding.data.lessonId !== input.lessonId) {
      throw new Error('Assessment not found for this lesson.');
    }
    await LearningProgressService.assertLessonTrackable(input.courseId, input.lessonId, input.userId);

    const assessment = snap.data() as CourseAssessment;
    let totalPointsPossible = 0;
    let totalPointsEarned = 0;
    let correctAnswersCount = 0;

    const questionResults = assessment.questions.map(q => {
      const questionPoints = q.points || 1;
      totalPointsPossible += questionPoints;

      const userAns = input.answers.find(a => a.questionId === q.id);
      const correctOptionIds = q.options.filter(o => o.isCorrect).map(o => o.id);

      let isCorrect = false;
      if (userAns) {
        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          isCorrect =
            userAns.selectedOptionIds.length === 1 &&
            correctOptionIds.includes(userAns.selectedOptionIds[0]);
        } else if (q.type === 'multiple_answer') {
          const selected = new Set(userAns.selectedOptionIds);
          isCorrect =
            correctOptionIds.length === selected.size &&
            correctOptionIds.every(id => selected.has(id));
        } else if (q.type === 'short_answer') {
          // Compare trimmed case-insensitive
          const validAnswers = q.options.map(o => o.text.trim().toLowerCase());
          isCorrect = validAnswers.includes((userAns.textAnswer || '').trim().toLowerCase());
        }
      }

      const pointsEarned = isCorrect ? questionPoints : 0;
      if (isCorrect) {
        totalPointsEarned += pointsEarned;
        correctAnswersCount++;
      }

      return {
        questionId: q.id,
        isCorrect,
        explanation: q.explanation,
        pointsEarned,
      };
    });

    const scorePercentage =
      totalPointsPossible > 0 ? Math.round((totalPointsEarned / totalPointsPossible) * 100) : 100;
    const passed = scorePercentage >= (assessment.passingScore || 70);

    // Record assessment result in LearningProgress
    const progressId = `${input.courseId}_${input.lessonId}_${input.userId}`;
    await adminDb.collection('learning_progress').doc(progressId).set(
      {
        assessmentScore: scorePercentage,
        assessmentPassed: passed,
        lastInteractedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // If passed, complete lesson
    if (passed) {
      await LearningProgressService.completeLesson(
        input.courseId,
        input.lessonId,
        input.userId,
        input.portalId
      );
    }

    return {
      passed,
      score: scorePercentage,
      totalPointsEarned,
      totalPointsPossible,
      correctAnswersCount,
      totalQuestionsCount: assessment.questions.length,
      questionResults,
    };
  }

  /**
   * Submit an Assignment
   */
  public static async submitAssignment(input: SubmitAssignmentInput): Promise<AssignmentSubmission> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('assignment_submissions').doc();

    const submission: AssignmentSubmission = {
      id: docRef.id,
      organizationId: 'default-org',
      portalId: input.portalId,
      courseId: input.courseId,
      lessonId: input.lessonId,
      assignmentId: input.assignmentId,
      userId: input.userId,
      membershipId: input.membershipId,
      textContent: input.textContent,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    };

    await docRef.set(submission);
    return submission;
  }
}
