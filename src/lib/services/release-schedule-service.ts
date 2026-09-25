/**
 * {{Org_name}} Experience Platform — Release Schedule Service
 *
 * Central engine evaluating LMS drip schedules and prerequisite milestone locks:
 * 1. Immediate: always accessible.
 * 2. Specific Date: unlocks on or after a calendar timestamp.
 * 3. Days After Enrollment: relative unlock milestone from enrollment timestamp.
 * 4. Days After Join: relative unlock milestone from portal membership joined timestamp.
 * 5. Sequential Prerequisite: requires prior completion of a specified prerequisite lesson.
 *
 * Architectural Safeguards:
 * - Module Drip Cascade: child lessons inherit parent module locks unless `lesson.isPreview` is true.
 * - Free Preview Bypass: lessons with `isPreview: true` bypass all locks for public lead generation.
 * - Strict Typing: Zero `any`, zero `any[]`.
 * - Defensive Edge Case Handling: Missing enrollment, missing dates, or negative delays fail safe.
 */

import type {
  CourseLesson,
  CourseModule,
  CourseEnrollment,
  ReleaseRule,
} from '@/lib/types/learning';

export interface ReleaseEvaluationResult {
  isLocked: boolean;
  lockReason?: string;
  unlockDate?: string;
  daysRemaining?: number;
  prerequisiteLessonId?: string;
}

export class ReleaseScheduleService {
  /**
   * Evaluate release availability for an individual lesson within a course module.
   */
  public static evaluateLessonRelease(params: {
    lesson: CourseLesson;
    module?: CourseModule | null;
    enrollment?: CourseEnrollment | null;
    memberJoinedAt?: string | null;
    completedLessonIds?: string[];
    cohortStartDate?: string | null;
  }): ReleaseEvaluationResult {
    // 1. Free preview bypasses all schedule locks
    if (params.lesson.isPreview) {
      return { isLocked: false };
    }

    // 2. Evaluate parent module lock cascade first
    if (params.module?.releaseRule && params.module.releaseRule.type !== 'immediate') {
      const moduleResult = this.evaluateRule(
        params.module.releaseRule,
        params.enrollment,
        params.memberJoinedAt,
        params.completedLessonIds,
        params.cohortStartDate
      );
      if (moduleResult.isLocked) {
        return {
          ...moduleResult,
          lockReason: `Module is locked: ${moduleResult.lockReason}`,
        };
      }
    }

    // 3. Evaluate lesson-specific release rule
    const rule = params.lesson.releaseRule || { type: 'immediate' };
    return this.evaluateRule(
      rule,
      params.enrollment,
      params.memberJoinedAt,
      params.completedLessonIds,
      params.cohortStartDate
    );
  }

  /**
   * Evaluate release availability for an entire course module.
   */
  public static evaluateModuleRelease(params: {
    module: CourseModule;
    enrollment?: CourseEnrollment | null;
    memberJoinedAt?: string | null;
    completedLessonIds?: string[];
    cohortStartDate?: string | null;
  }): ReleaseEvaluationResult {
    const rule = params.module.releaseRule || { type: 'immediate' };
    return this.evaluateRule(
      rule,
      params.enrollment,
      params.memberJoinedAt,
      params.completedLessonIds,
      params.cohortStartDate
    );
  }

  /**
   * Internal rule evaluator with deterministic date math and error safety.
   */
  private static evaluateRule(
    rule: ReleaseRule,
    enrollment?: CourseEnrollment | null,
    memberJoinedAt?: string | null,
    completedLessonIds: string[] = [],
    cohortStartDate?: string | null
  ): ReleaseEvaluationResult {
    const now = Date.now();

    switch (rule.type) {
      case 'immediate':
        return { isLocked: false };

      case 'specific_date': {
        if (!rule.releaseDate) return { isLocked: false };
        const unlockTime = new Date(rule.releaseDate).getTime();
        if (isNaN(unlockTime)) return { isLocked: false };
        if (now >= unlockTime) return { isLocked: false };

        const msDiff = unlockTime - now;
        const daysRemaining = Math.max(1, Math.ceil(msDiff / 86400000));
        return {
          isLocked: true,
          lockReason: `Unlocks on ${new Date(rule.releaseDate).toLocaleDateString()}`,
          unlockDate: rule.releaseDate,
          daysRemaining,
        };
      }

      case 'days_after_enrollment': {
        const daysDelay = rule.daysDelay || 0;
        if (daysDelay <= 0) return { isLocked: false };

        if (!enrollment?.enrolledAt) {
          return {
            isLocked: true,
            lockReason: 'Requires course enrollment',
            daysRemaining: daysDelay,
          };
        }

        const enrolledTime = new Date(enrollment.enrolledAt).getTime();
        if (isNaN(enrolledTime)) return { isLocked: false };

        const unlockTime = enrolledTime + daysDelay * 86400000;
        if (now >= unlockTime) return { isLocked: false };

        const daysRemaining = Math.max(1, Math.ceil((unlockTime - now) / 86400000));
        return {
          isLocked: true,
          lockReason: `Unlocks ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} after enrollment`,
          daysRemaining,
        };
      }

      case 'days_after_join': {
        const daysDelay = rule.daysDelay || 0;
        if (daysDelay <= 0) return { isLocked: false };

        if (!memberJoinedAt) {
          return {
            isLocked: true,
            lockReason: 'Requires active membership',
            daysRemaining: daysDelay,
          };
        }

        const joinTime = new Date(memberJoinedAt).getTime();
        if (isNaN(joinTime)) return { isLocked: false };

        const unlockTime = joinTime + daysDelay * 86400000;
        if (now >= unlockTime) return { isLocked: false };

        const daysRemaining = Math.max(1, Math.ceil((unlockTime - now) / 86400000));
        return {
          isLocked: true,
          lockReason: `Unlocks ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} after joining`,
          daysRemaining,
        };
      }

      case 'sequential_prerequisite': {
        if (!rule.requiredLessonId) return { isLocked: false };
        const isSatisfied = completedLessonIds.includes(rule.requiredLessonId);
        if (isSatisfied) return { isLocked: false };

        return {
          isLocked: true,
          lockReason: 'Complete the prerequisite lesson to unlock',
          prerequisiteLessonId: rule.requiredLessonId,
        };
      }

      case 'days_after_cohort_start': {
        const effectiveCohortStart = cohortStartDate || rule.cohortStartDate;
        const daysDelay = rule.daysDelay || 0;

        if (!effectiveCohortStart) {
          return {
            isLocked: true,
            lockReason: 'Requires active cohort schedule',
            daysRemaining: daysDelay || 1,
          };
        }

        const cohortStartTime = new Date(effectiveCohortStart).getTime();
        if (isNaN(cohortStartTime)) return { isLocked: false };

        const unlockTime = cohortStartTime + daysDelay * 86400000;
        if (now >= unlockTime) return { isLocked: false };

        const daysRemaining = Math.max(1, Math.ceil((unlockTime - now) / 86400000));
        return {
          isLocked: true,
          lockReason: `Unlocks ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} after cohort begins`,
          unlockDate: new Date(unlockTime).toISOString(),
          daysRemaining,
        };
      }

      case 'cohort_start_date': {
        const effectiveCohortStart = cohortStartDate || rule.cohortStartDate || rule.releaseDate;
        if (!effectiveCohortStart) {
          return {
            isLocked: true,
            lockReason: 'Requires active cohort schedule',
          };
        }

        const cohortStartTime = new Date(effectiveCohortStart).getTime();
        if (isNaN(cohortStartTime)) return { isLocked: false };
        if (now >= cohortStartTime) return { isLocked: false };

        const msDiff = cohortStartTime - now;
        const daysRemaining = Math.max(1, Math.ceil(msDiff / 86400000));
        return {
          isLocked: true,
          lockReason: `Unlocks when cohort starts on ${new Date(effectiveCohortStart).toLocaleDateString()}`,
          unlockDate: effectiveCohortStart,
          daysRemaining,
        };
      }

      default:
        return { isLocked: false };
    }
  }
}
