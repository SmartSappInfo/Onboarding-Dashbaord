/**
 * {{Org_name}} Experience Platform — Cohort Management Engine
 *
 * Server-side domain operations for multi-cohort course management:
 * 1. Synchronous Cohort Scheduling (start/end dates, instructor, capacity).
 * 2. Concurrency-Safe Student Enrollment (`adminDb.runTransaction` guards `maxCapacity`).
 * 3. Anti-Exhaustion Chunked Batch Deletions (<= 400 operations per Firestore batch).
 * 4. Dedicated Private Community Space Binding.
 *
 * Conforms to:
 * - Strict Typing: Zero `any` or `any[]` typing.
 * - Architecture: Scalable under high load with defensive fallbacks.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CourseCohort,
  CohortMember,
  CohortMemberStatus,
  CreateCohortInput,
  UpdateCohortInput,
} from '@/lib/types/events';

export interface EnrollCohortMemberInput {
  organizationId: string;
  portalId: string;
  cohortId: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export class CohortService {
  /**
   * Normalize cohort names into URL-safe kebab-case slugs.
   */
  public static sanitizeSlug(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    return slug || 'cohort';
  }

  /**
   * Evaluate whether a cohort has available seats remaining.
   */
  public static hasAvailableCapacity(cohort: CourseCohort): boolean {
    if (cohort.maxCapacity === undefined || cohort.maxCapacity === null || cohort.maxCapacity <= 0) {
      return true; // Unlimited capacity
    }
    return (cohort.enrolledCount || 0) < cohort.maxCapacity;
  }

  /**
   * Chunks large operations into sub-arrays to stay safely below Firestore's 500-op limit.
   *
   * CAUTION: Always use <= 400 ops to leave headroom for transaction metadata and atomic writes.
   */
  public static chunkBatchOperations<T>(items: T[], chunkSize: number = 400): T[][] {
    if (!items || items.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ── Cohort CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new course cohort with default 'upcoming' status and slug generation.
   */
  public static async createCohort(input: CreateCohortInput): Promise<CourseCohort> {
    const docRef = adminDb.collection('course_cohorts').doc();
    const now = new Date().toISOString();
    const slug = input.slug ? this.sanitizeSlug(input.slug) : this.sanitizeSlug(input.name);

    const cohort: CourseCohort = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      courseId: input.courseId,
      workspaceIds: input.workspaceIds || ['cohorts'],
      name: input.name.trim(),
      slug,
      description: input.description?.trim(),
      instructorId: input.instructorId,
      instructorName: input.instructorName?.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      maxCapacity: input.maxCapacity,
      enrolledCount: 0,
      status: 'upcoming',
      linkedSpaceId: input.linkedSpaceId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(cohort);
    return cohort;
  }

  /**
   * Update an existing cohort.
   */
  public static async updateCohort(
    cohortId: string,
    updates: UpdateCohortInput
  ): Promise<CourseCohort> {
    const docRef = adminDb.collection('course_cohorts').doc(cohortId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Cohort ${cohortId} not found.`);
    }

    const current = snap.data() as CourseCohort;
    const now = new Date().toISOString();

    const updated: CourseCohort = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      slug: updates.slug !== undefined ? this.sanitizeSlug(updates.slug) : current.slug,
      description:
        updates.description !== undefined ? updates.description?.trim() : current.description,
      instructorName:
        updates.instructorName !== undefined
          ? updates.instructorName?.trim()
          : current.instructorName,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  /**
   * Delete a cohort and cascade delete all enrolled cohort member documents safely.
   * Uses chunked batch operations (<= 400 ops) to avoid Firestore quota exhaustion.
   */
  public static async deleteCohort(cohortId: string): Promise<void> {
    // 1. Fetch all cohort member records
    const membersSnap = await adminDb
      .collection('cohort_members')
      .where('cohortId', '==', cohortId)
      .get();

    // 2. Cascade delete in safe chunks of 400 docs
    const memberRefs = membersSnap.docs.map(doc => doc.ref);
    const chunks = this.chunkBatchOperations(memberRefs, 400);

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      chunk.forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // 3. Delete parent cohort document
    await adminDb.collection('course_cohorts').doc(cohortId).delete();
  }

  /**
   * Get cohort by ID.
   */
  public static async getCohortById(cohortId: string): Promise<CourseCohort | null> {
    const snap = await adminDb.collection('course_cohorts').doc(cohortId).get();
    if (!snap.exists) return null;
    return snap.data() as CourseCohort;
  }

  /**
   * List cohorts for a portal, optionally filtered by courseId.
   */
  public static async listCourseCohorts(
    portalId: string,
    courseId?: string
  ): Promise<CourseCohort[]> {
    let q = adminDb
      .collection('course_cohorts')
      .where('portalId', '==', portalId) as FirebaseFirestore.Query;

    if (courseId) {
      q = q.where('courseId', '==', courseId);
    }

    const snap = await q.orderBy('startDate', 'asc').get();
    return snap.docs.map(d => d.data() as CourseCohort);
  }

  // ── Cohort Roster & Member Operations ───────────────────────────────────────

  /**
   * Enroll a member into a cohort with transactional capacity protection.
   *
   * SECURITY & CONCURRENCY: Uses `adminDb.runTransaction` to prevent oversubscription
   * when multiple students register simultaneously.
   */
  public static async enrollMember(input: EnrollCohortMemberInput): Promise<CohortMember> {
    const memberId = `cm_${input.cohortId}_${input.userId}`;
    const memberRef = adminDb.collection('cohort_members').doc(memberId);
    const cohortRef = adminDb.collection('course_cohorts').doc(input.cohortId);

    const now = new Date().toISOString();

    const member = await adminDb.runTransaction(async tx => {
      const cohortDoc = await tx.get(cohortRef);
      if (!cohortDoc.exists) {
        throw new Error(`Cohort ${input.cohortId} does not exist.`);
      }

      const cohortData = cohortDoc.data() as CourseCohort;
      if (cohortData.status === 'archived' || cohortData.status === 'completed') {
        throw new Error(`Cannot enroll in a cohort that is ${cohortData.status}.`);
      }

      const existingMemberDoc = await tx.get(memberRef);
      if (existingMemberDoc.exists) {
        const existingData = existingMemberDoc.data() as CohortMember;
        if (existingData.status === 'active') {
          return existingData;
        }
        // Reactivate dropped/archived member
        const reactivated: CohortMember = {
          ...existingData,
          status: 'active',
          joinedAt: now,
        };
        tx.set(memberRef, reactivated, { merge: true });
        tx.update(cohortRef, {
          enrolledCount: (cohortData.enrolledCount || 0) + 1,
          updatedAt: now,
        });
        return reactivated;
      }

      // Check capacity constraint
      if (!this.hasAvailableCapacity(cohortData)) {
        throw new Error(`This cohort has reached maximum capacity (${cohortData.maxCapacity}).`);
      }

      const newMember: CohortMember = {
        id: memberId,
        organizationId: input.organizationId,
        portalId: input.portalId,
        cohortId: input.cohortId,
        courseId: input.courseId,
        userId: input.userId,
        userName: input.userName.trim(),
        userEmail: input.userEmail.trim(),
        joinedAt: now,
        status: 'active',
        progressPercentage: 0,
        completedLessonCount: 0,
      };

      tx.set(memberRef, newMember);
      tx.update(cohortRef, {
        enrolledCount: (cohortData.enrolledCount || 0) + 1,
        updatedAt: now,
      });

      return newMember;
    });

    return member;
  }

  /**
   * Remove a member from a cohort, updating enrolled count transactionally.
   */
  public static async removeMember(cohortId: string, userId: string): Promise<void> {
    const memberId = `cm_${cohortId}_${userId}`;
    const memberRef = adminDb.collection('cohort_members').doc(memberId);
    const cohortRef = adminDb.collection('course_cohorts').doc(cohortId);

    const now = new Date().toISOString();

    await adminDb.runTransaction(async tx => {
      const memberDoc = await tx.get(memberRef);
      if (!memberDoc.exists) return;

      const cohortDoc = await tx.get(cohortRef);
      tx.delete(memberRef);

      if (cohortDoc.exists) {
        const cohortData = cohortDoc.data() as CourseCohort;
        const currentCount = cohortData.enrolledCount || 1;
        tx.update(cohortRef, {
          enrolledCount: Math.max(0, currentCount - 1),
          updatedAt: now,
        });
      }
    });
  }

  /**
   * List all members enrolled in a cohort.
   */
  public static async listCohortMembers(cohortId: string): Promise<CohortMember[]> {
    const snap = await adminDb
      .collection('cohort_members')
      .where('cohortId', '==', cohortId)
      .orderBy('joinedAt', 'asc')
      .get();

    return snap.docs.map(doc => doc.data() as CohortMember);
  }

  /**
   * Get an individual member's record in a cohort.
   */
  public static async getCohortMember(
    cohortId: string,
    userId: string
  ): Promise<CohortMember | null> {
    const memberId = `cm_${cohortId}_${userId}`;
    const snap = await adminDb.collection('cohort_members').doc(memberId).get();
    if (!snap.exists) return null;
    return snap.data() as CohortMember;
  }

  /**
   * Update student's progress within the cohort.
   */
  public static async updateMemberProgress(
    cohortId: string,
    userId: string,
    progressPercentage: number,
    completedLessonCount: number
  ): Promise<void> {
    const memberId = `cm_${cohortId}_${userId}`;
    const memberRef = adminDb.collection('cohort_members').doc(memberId);

    await memberRef.set(
      {
        progressPercentage: Math.min(100, Math.max(0, Math.round(progressPercentage))),
        completedLessonCount: Math.max(0, completedLessonCount),
      },
      { merge: true }
    );
  }
}
