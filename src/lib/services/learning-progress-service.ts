/**
 * {{Org_name}} Experience Platform — Learning Progress & Completion Service
 *
 * Tracks granular video watch times, lesson completions, quiz evaluations,
 * assignment submissions, drip release schedules, and course certifications.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type {
  CourseLesson,
  CourseEnrollment,
  LearningProgress,
  CourseAssessment,
  CourseAssignment,
  AssignmentSubmission,
  SubmitAssessmentInput,
  AssessmentResult,
  SubmitAssignmentInput,
  ReleaseRule,
} from '@/lib/types/learning';

export class LearningProgressService {
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
    const progressId = `${courseId}_${lessonId}_${userId}`;
    const docRef = adminDb.collection('learning_progress').doc(progressId);
    const snap = await docRef.get();

    const lessonSnap = await adminDb.collection('course_lessons').doc(lessonId).get();
    const lesson = lessonSnap.data() as CourseLesson | undefined;
    const moduleId = lesson?.moduleId || 'default-module';
    const organizationId = lesson?.organizationId || 'default-org';

    const now = new Date().toISOString();
    let current = snap.exists ? (snap.data() as LearningProgress) : null;

    const shouldAutoCheckVideo =
      lesson?.completionRule?.type === 'video_percentage' &&
      watchPercentage >= (lesson.completionRule.minVideoPercentage || 80);

    const isCompleted = current?.isCompleted || shouldAutoCheckVideo;

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
    const progressId = `${courseId}_${lessonId}_${userId}`;
    const now = new Date().toISOString();

    const lessonSnap = await adminDb.collection('course_lessons').doc(lessonId).get();
    const lesson = lessonSnap.data() as CourseLesson | undefined;
    const moduleId = lesson?.moduleId || 'default-module';
    const organizationId = lesson?.organizationId || 'default-org';

    // 1. Mark lesson progress completed
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

    // 2. Add to PortalMembership completedLessonIds
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

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

    // 3. Recalculate CourseEnrollment Progress
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

    const progressPct = totalLessons > 0 ? Math.min(100, Math.round((completedCount / totalLessons) * 100)) : 100;
    const isCourseCompleted = progressPct >= 100;

    const enrollSnap = await adminDb
      .collection('course_enrollments')
      .where('courseId', '==', courseId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!enrollSnap.empty) {
      const enrollDoc = enrollSnap.docs[0];
      const prevData = enrollDoc.data() as CourseEnrollment;
      await enrollDoc.ref.set(
        {
          progressPercentage: progressPct,
          completedLessonCount: completedCount,
          totalLessonCount: totalLessons,
          currentLessonId: lessonId,
          lastAccessedAt: now,
          status: isCourseCompleted ? 'completed' : prevData.status,
          completedAt: isCourseCompleted && !prevData.completedAt ? now : prevData.completedAt,
        },
        { merge: true }
      );

      // 4. Award Gamification Points (+25 pts for Course Completion)
      if (isCourseCompleted && !prevData.completedAt && membershipId) {
        await PortalMembershipService.awardPoints(membershipId, 25, `Completed Course: ${courseId}`);
      }
    }
  }

  /**
   * Evaluate Drip Release Locks
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

    const now = Date.now();

    if (rule.type === 'specific_date' && rule.releaseDate) {
      const unlockTime = new Date(rule.releaseDate).getTime();
      if (now < unlockTime) {
        return {
          isUnlocked: false,
          reason: `Unlocks on ${new Date(rule.releaseDate).toLocaleDateString()}`,
        };
      }
    }

    if (rule.type === 'days_after_enrollment' && enrollmentDate && rule.daysDelay) {
      const unlockTime = new Date(enrollmentDate).getTime() + rule.daysDelay * 24 * 60 * 60 * 1000;
      if (now < unlockTime) {
        const daysLeft = Math.ceil((unlockTime - now) / (24 * 60 * 60 * 1000));
        return {
          isUnlocked: false,
          reason: `Unlocks in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        };
      }
    }

    if (rule.type === 'days_after_join' && memberJoinDate && rule.daysDelay) {
      const unlockTime = new Date(memberJoinDate).getTime() + rule.daysDelay * 24 * 60 * 60 * 1000;
      if (now < unlockTime) {
        const daysLeft = Math.ceil((unlockTime - now) / (24 * 60 * 60 * 1000));
        return {
          isUnlocked: false,
          reason: `Unlocks in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        };
      }
    }

    if (rule.type === 'sequential_prerequisite' && rule.requiredLessonId) {
      if (!completedLessonIds.includes(rule.requiredLessonId)) {
        return {
          isUnlocked: false,
          reason: 'Complete previous required lesson to unlock.',
        };
      }
    }

    return { isUnlocked: true };
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

    // If passed and completion rule requires assessment, complete lesson
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
