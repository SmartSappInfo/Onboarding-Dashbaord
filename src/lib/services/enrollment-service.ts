/**
 * {{Org_name}} Experience Platform — Course Enrollment Service
 *
 * Handles student enrollment lifecycle across all channels: manual,
 * membership tier unlock, purchase, invitation link, and automations.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type { CourseEnrollment, EnrollmentSource } from '@/lib/types/learning';

export class EnrollmentService {
  /**
   * Enroll a user into a course (Idempotent)
   */
  public static async enrollUserInCourse(
    courseId: string,
    userId: string,
    portalId: string,
    source: EnrollmentSource = 'manual_admin',
    actorId?: string
  ): Promise<CourseEnrollment> {
    const existingSnap = await adminDb
      .collection('course_enrollments')
      .where('courseId', '==', courseId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return existingSnap.docs[0].data() as CourseEnrollment;
    }

    // 1. Get Course and total lessons
    const courseSnap = await adminDb.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) {
      throw new Error(`Course ${courseId} not found.`);
    }
    const courseData = courseSnap.data();
    const totalLessonCount = courseData?.totalLessonCount || 0;
    const organizationId = courseData?.organizationId || 'default-org';
    const workspaceIds = courseData?.workspaceIds || ['onboarding'];

    // 2. Fetch membership if exists
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    const membershipId = !membershipSnap.empty ? membershipSnap.docs[0].id : undefined;

    const now = new Date().toISOString();
    const docRef = adminDb.collection('course_enrollments').doc();

    const enrollment: CourseEnrollment = {
      id: docRef.id,
      organizationId,
      portalId,
      workspaceIds,
      courseId,
      userId,
      membershipId,
      source,
      status: 'active',
      progressPercentage: 0,
      completedLessonCount: 0,
      totalLessonCount,
      enrolledAt: now,
      lastAccessedAt: now,
    };

    await docRef.set(enrollment);

    // 3. Link enrolled course in PortalMembership and award points (+10 for enrolling)
    if (membershipId) {
      const currentMembership = membershipSnap.docs[0].data();
      const currentCourses: string[] = currentMembership.enrolledCourseIds || [];
      if (!currentCourses.includes(courseId)) {
        await adminDb.collection('portal_memberships').doc(membershipId).set(
          {
            enrolledCourseIds: [...currentCourses, courseId],
            updatedAt: now,
          },
          { merge: true }
        );
        // Award points
        await PortalMembershipService.awardPoints(membershipId, 10, `Enrolled in course: ${courseData?.title}`);
      }
    }

    return enrollment;
  }

  /**
   * Get user's enrollment in a course
   */
  public static async getUserCourseEnrollment(
    courseId: string,
    userId: string
  ): Promise<CourseEnrollment | null> {
    const snap = await adminDb
      .collection('course_enrollments')
      .where('courseId', '==', courseId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as CourseEnrollment;
  }

  /**
   * List all enrolled courses for a user in a portal
   */
  public static async listUserEnrolledCourses(
    portalId: string,
    userId: string
  ): Promise<CourseEnrollment[]> {
    const snap = await adminDb
      .collection('course_enrollments')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .orderBy('lastAccessedAt', 'desc')
      .get();

    return snap.docs.map(d => d.data() as CourseEnrollment);
  }

  /**
   * List student roster for a course
   */
  public static async listCourseStudents(courseId: string, limitCount = 50): Promise<CourseEnrollment[]> {
    const snap = await adminDb
      .collection('course_enrollments')
      .where('courseId', '==', courseId)
      .limit(limitCount)
      .get();

    return snap.docs.map(d => d.data() as CourseEnrollment);
  }
}
