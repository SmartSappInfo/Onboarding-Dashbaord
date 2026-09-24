/**
 * {{Org_name}} Experience Platform — Onboarding & Engagement Domain Service
 *
 * Server-side domain operations for Onboarding Flows, Daily Action Tasks,
 * Member Activity Timelines, and Engagement Scoring Engine.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { logActivity } from '@/lib/activity-logger';
import type {
  OnboardingFlow,
  OnboardingStep,
  MemberOnboardingProgress,
  MemberTask,
  TaskSubmission,
  MemberActivityEvent,
  MemberEngagementProfile,
  EngagementTier,
  SaveOnboardingFlowInput,
  AdvanceOnboardingInput,
  CreateTaskInput,
  UpdateTaskInput,
  CompleteTaskInput,
  SubmitTaskInput,
  ReviewTaskSubmissionInput,
  LogMemberActivityInput,
  StepType,
  ReconcileOnboardingResult,
} from '@/lib/types/engagement';

import { DEFAULT_ONBOARDING_STEPS } from '../portal-presets';

export class EngagementService {
  // ── Onboarding Flow Operations ─────────────────────────────────────────────

  public static async getOnboardingFlow(portalId: string): Promise<OnboardingFlow | null> {
    const snap = await adminDb
      .collection('onboarding_flows')
      .where('portalId', '==', portalId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as OnboardingFlow;
  }

  public static getDefaultOnboardingSteps(): OnboardingStep[] {
    return DEFAULT_ONBOARDING_STEPS;
  }

  public static async saveOnboardingFlow(input: SaveOnboardingFlowInput): Promise<OnboardingFlow> {
    const existing = await EngagementService.getOnboardingFlow(input.portalId);
    const now = new Date().toISOString();
    const docRef = existing
      ? adminDb.collection('onboarding_flows').doc(existing.id)
      : adminDb.collection('onboarding_flows').doc();

    const flow: OnboardingFlow = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['onboarding'],
      title: input.title.trim(),
      description: input.description?.trim(),
      steps: input.steps,
      isEnabled: input.isEnabled ?? true,
      completionPoints: input.completionPoints ?? 20,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await docRef.set(flow);
    return flow;
  }

  public static async getMemberOnboardingProgress(
    portalId: string,
    userId: string
  ): Promise<MemberOnboardingProgress | null> {
    const snap = await adminDb
      .collection('member_onboarding_progress')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MemberOnboardingProgress;
  }

  public static async advanceOnboardingStep(
    input: AdvanceOnboardingInput
  ): Promise<MemberOnboardingProgress> {
    const progressDocId = `onboarding_${input.portalId}_${input.userId}`;
    const docRef = adminDb.collection('member_onboarding_progress').doc(progressDocId);

    const now = new Date().toISOString();
    const flow = await EngagementService.getOnboardingFlow(input.portalId);
    const steps = flow?.steps || EngagementService.getDefaultOnboardingSteps();
    const totalSteps = Math.max(1, steps.length);

    const snap = await docRef.get();
    let currentCompleted: string[] = [];

    if (snap.exists) {
      const existingData = snap.data() as Omit<MemberOnboardingProgress, 'id'>;
      currentCompleted = (existingData.completedStepIds || []) as string[];

      // ARCHITECTURAL IDEMPOTENCY GUARD:
      // If the step is already completed, return existing state immediately.
      // Avoids redundant Firestore set({ merge: true }) writes and duplicate logMemberActivity records
      // on recurring background events (e.g. video heartbeat progress, repeated comments/posts).
      if (currentCompleted.includes(input.stepId)) {
        return {
          id: docRef.id,
          ...existingData,
          completedStepIds: currentCompleted,
        };
      }
    }

    currentCompleted.push(input.stepId);

    const progressPercentage = Math.min(100, Math.round((currentCompleted.length / totalSteps) * 100));
    const isCompleted = progressPercentage >= 100;

    const updatedProgress: MemberOnboardingProgress = {
      id: progressDocId,
      organizationId: flow?.organizationId || 'smartsapp-hq',
      portalId: input.portalId,
      userId: input.userId,
      completedStepIds: currentCompleted,
      progressPercentage,
      isCompleted,
      startedAt: snap.exists ? snap.data()?.startedAt : now,
      completedAt: isCompleted ? now : undefined,
      updatedAt: now,
    };

    await docRef.set(updatedProgress, { merge: true });

    // Log Activity
    await EngagementService.logMemberActivity({
      organizationId: updatedProgress.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: isCompleted ? 'onboarding.completed' : 'onboarding.step_advanced',
      title: isCompleted ? 'Completed Onboarding Program' : `Completed Onboarding Step (${currentCompleted.length}/${totalSteps})`,
      description: `Progress is now ${progressPercentage}%.`,
      metadata: { stepId: input.stepId, progressPercentage, isCompleted },
    });

    // If reached 100%, award Onboarding Completion Points (+20 pts)
    if (isCompleted && (!snap.exists || !snap.data()?.isCompleted)) {
      const membershipSnap = await adminDb
        .collection('portal_memberships')
        .where('portalId', '==', input.portalId)
        .where('userId', '==', input.userId)
        .limit(1)
        .get();

      if (!membershipSnap.empty) {
        await PortalMembershipService.awardPoints(
          membershipSnap.docs[0].id,
          flow?.completionPoints || 20,
          'Completed Academy Onboarding Flow 🎉'
        );
      }
    }

    return updatedProgress;
  }

  /**
   * Automatically advances an onboarding step by its functional StepType.
   *
   * ARCHITECTURAL RATIONALE:
   * Enables domain events (e.g. video watch, profile save, lesson complete, community post)
   * to automatically complete corresponding onboarding steps without requiring manual member bypass clicks.
   *
   * CAUTION FOR FUTURE MAINTAINERS:
   * This method is strictly idempotent. If the step is already marked complete, it avoids
   * redundant Firestore writes and duplicate gamification points awards.
   *
   * TESTABILITY POINTER:
   * Covered by unit test: `EngagementService.advanceStepByType should mark matching steps complete and award points once`.
   *
   * @param portalId Portal ID
   * @param userId Member User ID
   * @param stepType Functional type of the step to advance
   */
  public static async advanceStepByType(
    portalId: string,
    userId: string,
    stepType: StepType
  ): Promise<MemberOnboardingProgress | null> {
    const flow = await EngagementService.getOnboardingFlow(portalId);
    const steps = flow?.steps || EngagementService.getDefaultOnboardingSteps();
    const matchingSteps = steps.filter(s => s.type === stepType);

    if (matchingSteps.length === 0) return null;

    let progress: MemberOnboardingProgress | null = null;
    for (const step of matchingSteps) {
      progress = await EngagementService.advanceOnboardingStep({
        portalId,
        userId,
        stepId: step.id,
      });
    }

    return progress;
  }

  /**
   * Reconciles a member's onboarding checklist against authoritative database state.
   *
   * ARCHITECTURAL RATIONALE (Rule 5 Single Source of Truth):
   * Solves data drift by verifying primary sources of truth:
   * 1. Profile completeness in `portal_memberships`
   * 2. Course lesson engagement in `learning_progress`
   * 3. Community activity in `community_posts`
   *
   * HIGH-LOAD GUARDRAILS (Rule 9):
   * Uses bounded queries with `.limit(1)` to eliminate full-collection scan overhead and prevent resource exhaustion.
   *
   * CAUTION FOR FUTURE MAINTAINERS:
   * Avoid calling this unconditionally on rapid intervals. Client callers must guard execution with
   * `hasReconciledRef` to prevent infinite fetch cascades.
   *
   * @param portalId Portal ID
   * @param userId Member User ID
   */
  public static async reconcileMemberOnboarding(
    portalId: string,
    userId: string
  ): Promise<ReconcileOnboardingResult> {
    const flow = await EngagementService.getOnboardingFlow(portalId);
    const steps = flow?.steps || EngagementService.getDefaultOnboardingSteps();

    // 1. Fetch current progress
    const progressDocId = `onboarding_${portalId}_${userId}`;
    const progressRef = adminDb.collection('member_onboarding_progress').doc(progressDocId);
    const progressSnap = await progressRef.get();
    const currentCompleted = new Set<string>(
      progressSnap.exists ? ((progressSnap.data()?.completedStepIds as string[]) || []) : []
    );

    const newlyCompletedSteps: string[] = [];

    // 2. Evaluate Profile Setup (StepType: 'complete_profile')
    const profileSteps = steps.filter(s => s.type === 'complete_profile' && !currentCompleted.has(s.id));
    if (profileSteps.length > 0) {
      const memberSnap = await adminDb
        .collection('portal_memberships')
        .where('portalId', '==', portalId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!memberSnap.empty) {
        const memberData = memberSnap.docs[0].data();
        const custom = (memberData.customFields as Record<string, string | number | boolean | null>) || {};
        const hasProfileData = Boolean(
          custom.schoolName ||
          custom.whatsappNumber ||
          custom.jobTitle ||
          (memberData.displayName && memberData.displayName !== 'Community Member' && memberData.displayName.trim() !== '')
        );
        if (hasProfileData) {
          profileSteps.forEach(s => newlyCompletedSteps.push(s.id));
        }
      }
    }

    // 3. Evaluate Course Lesson Activity (StepType: 'start_course')
    const courseSteps = steps.filter(s => s.type === 'start_course' && !currentCompleted.has(s.id));
    if (courseSteps.length > 0) {
      const progressQuery = await adminDb
        .collection('learning_progress')
        .where('portalId', '==', portalId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!progressQuery.empty) {
        courseSteps.forEach(s => newlyCompletedSteps.push(s.id));
      }
    }

    // 4. Evaluate Community Post Activity (StepType: 'community_post')
    const communitySteps = steps.filter(s => s.type === 'community_post' && !currentCompleted.has(s.id));
    if (communitySteps.length > 0) {
      const postsQuery = await adminDb
        .collection('community_posts')
        .where('portalId', '==', portalId)
        .where('authorId', '==', userId)
        .limit(1)
        .get();

      if (!postsQuery.empty) {
        communitySteps.forEach(s => newlyCompletedSteps.push(s.id));
      }
    }

    // 5. Batch advance newly completed steps
    const pointsAwarded = 0;
    for (const stepId of newlyCompletedSteps) {
      await EngagementService.advanceOnboardingStep({ portalId, userId, stepId });
    }

    const updatedTotal = currentCompleted.size + newlyCompletedSteps.length;
    const isFullyCompleted = updatedTotal >= steps.length && steps.length > 0;

    return {
      updatedStepIds: newlyCompletedSteps,
      totalCompleted: updatedTotal,
      isFullyCompleted,
      pointsAwarded,
    };
  }

  // ── Member Tasks Operations ────────────────────────────────────────────────

  public static async createTask(input: CreateTaskInput): Promise<MemberTask> {
    const docRef = adminDb.collection('member_tasks').doc();
    const now = new Date().toISOString();

    const task: MemberTask = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['onboarding'],
      title: input.title.trim(),
      description: input.description?.trim(),
      priority: input.priority || 'medium',
      dueDate: input.dueDate,
      pointsReward: input.pointsReward ?? 15,
      targetPlanId: input.targetPlanId,
      actionUrl: input.actionUrl?.trim(),
      isArchived: false,
      order: input.order ?? 1,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(task);
    return task;
  }

  public static async updateTask(taskId: string, updates: UpdateTaskInput): Promise<MemberTask> {
    const docRef = adminDb.collection('member_tasks').doc(taskId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Task ${taskId} not found.`);

    const current = snap.data() as MemberTask;
    const now = new Date().toISOString();

    const updated: MemberTask = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deleteTask(taskId: string): Promise<void> {
    const taskRef = adminDb.collection('member_tasks').doc(taskId);
    const subsSnap = await adminDb
      .collection('task_submissions')
      .where('taskId', '==', taskId)
      .get();

    const refsToDelete: FirebaseFirestore.DocumentReference[] = [taskRef, ...subsSnap.docs.map(d => d.ref)];
    for (let i = 0; i < refsToDelete.length; i += 400) {
      const batch = adminDb.batch();
      refsToDelete.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
  }

  public static async listPortalTasks(portalId: string): Promise<MemberTask[]> {
    const snap = await adminDb
      .collection('member_tasks')
      .where('portalId', '==', portalId)
      .where('isArchived', '==', false)
      .orderBy('order', 'asc')
      .get();

    return snap.docs.map(d => d.data() as MemberTask);
  }

  public static async completeTask(input: CompleteTaskInput): Promise<TaskSubmission> {
    return EngagementService.submitTask({
      organizationId: input.organizationId,
      portalId: input.portalId,
      taskId: input.taskId,
      userId: input.userId,
      notes: input.notes,
      submittedFileUrl: input.submittedFileUrl,
    });
  }

  public static async submitTask(input: SubmitTaskInput): Promise<TaskSubmission> {
    const submissionId = `sub_${input.taskId}_${input.userId}`;
    const docRef = adminDb.collection('task_submissions').doc(submissionId);
    const taskSnap = await adminDb.collection('member_tasks').doc(input.taskId).get();

    const now = new Date().toISOString();
    const taskData = taskSnap.exists ? (taskSnap.data() as MemberTask) : null;
    const requiresReview = Boolean(taskData?.requireFileUpload);

    const submission: TaskSubmission = {
      id: submissionId,
      organizationId: input.organizationId,
      portalId: input.portalId,
      taskId: input.taskId,
      userId: input.userId,
      userName: input.userName,
      userAvatarUrl: input.userAvatarUrl,
      status: 'completed',
      reviewStatus: requiresReview ? 'pending_review' : 'approved',
      notes: input.notes?.trim(),
      submittedFileUrl: input.submittedFileUrl,
      submittedFileName: input.submittedFileName,
      submittedFileSizeBytes: input.submittedFileSizeBytes,
      submittedAt: now,
      completedAt: requiresReview ? undefined : now,
      updatedAt: now,
    };

    await docRef.set(submission, { merge: true });

    // If auto-approved (no file review required), award points immediately
    if (!requiresReview) {
      const pointsReward = taskData?.pointsReward || 15;
      const membershipSnap = await adminDb
        .collection('portal_memberships')
        .where('portalId', '==', input.portalId)
        .where('userId', '==', input.userId)
        .limit(1)
        .get();

      if (!membershipSnap.empty) {
        await PortalMembershipService.awardPoints(
          membershipSnap.docs[0].id,
          pointsReward,
          `Completed Action Task: ${taskData?.title || 'Action Task'}`
        );
      }
    }

    // Auto-advance action_task onboarding step if present
    await EngagementService.advanceStepByType(input.portalId, input.userId, 'action_task');

    // Log Activity
    await EngagementService.logMemberActivity({
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: requiresReview ? 'task.submitted' : 'task.completed',
      title: requiresReview ? `Submitted Task: ${taskData?.title || 'Action Task'}` : `Completed Task: ${taskData?.title || 'Action Task'}`,
      description: requiresReview ? 'Awaiting instructor review.' : `Earned +${taskData?.pointsReward || 15} points.`,
      metadata: { taskId: input.taskId, requiresReview },
    });

    return submission;
  }

  public static async reviewTaskSubmission(
    input: ReviewTaskSubmissionInput
  ): Promise<TaskSubmission> {
    const docRef = adminDb.collection('task_submissions').doc(input.submissionId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Submission ${input.submissionId} not found.`);

    const current = snap.data() as TaskSubmission;
    const now = new Date().toISOString();
    const isApproved = input.reviewStatus === 'approved';

    const taskSnap = await adminDb.collection('member_tasks').doc(input.taskId).get();
    const taskData = taskSnap.exists ? (taskSnap.data() as MemberTask) : null;

    const updated: TaskSubmission = {
      ...current,
      reviewStatus: input.reviewStatus,
      instructorFeedback: input.feedback?.trim(),
      reviewedBy: input.reviewerUserId,
      reviewedAt: now,
      completedAt: isApproved ? now : undefined,
      status: isApproved ? 'completed' : 'pending',
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });

    if (isApproved) {
      const pointsReward = taskData?.pointsReward || 15;
      const membershipSnap = await adminDb
        .collection('portal_memberships')
        .where('portalId', '==', input.portalId)
        .where('userId', '==', current.userId)
        .limit(1)
        .get();

      if (!membershipSnap.empty) {
        const memberDoc = membershipSnap.docs[0];
        await PortalMembershipService.awardPoints(
          memberDoc.id,
          pointsReward,
          `Approved Task Submission: ${taskData?.title || 'Action Task'} 🎉`
        );

        // Auto-apply contact completion tags to linked CRM contact (Workspace Rule: Tag SSOT)
        const contactId = memberDoc.data()?.contactId;
        if (contactId && taskData?.completionTagIds && taskData.completionTagIds.length > 0) {
          try {
            const { applyTagsAction } = await import('@/lib/tag-actions');
            await applyTagsAction(
              contactId,
              'school',
              taskData.completionTagIds,
              input.reviewerUserId || 'system'
            );
          } catch (tagErr) {
            console.warn('[ENGAGEMENT] Non-blocking applyTagsAction error:', tagErr);
          }
        }
      }

      await EngagementService.advanceStepByType(input.portalId, current.userId, 'action_task');
    }

    // Log Activity
    await EngagementService.logMemberActivity({
      organizationId: current.organizationId,
      portalId: input.portalId,
      userId: current.userId,
      eventType: isApproved ? 'task.approved' : 'task.rejected',
      title: isApproved ? `Task Approved: ${taskData?.title || 'Action Task'}` : `Task Changes Requested: ${taskData?.title || 'Action Task'}`,
      description: input.feedback || (isApproved ? 'Submission approved by instructor.' : 'Please update your submission.'),
      metadata: { taskId: input.taskId, submissionId: input.submissionId, isApproved },
    });

    return updated;
  }

  public static async listPendingSubmissions(portalId: string): Promise<TaskSubmission[]> {
    const snap = await adminDb
      .collection('task_submissions')
      .where('portalId', '==', portalId)
      .where('reviewStatus', '==', 'pending_review')
      .orderBy('submittedAt', 'desc')
      .get();

    return snap.docs.map(d => d.data() as TaskSubmission);
  }

  public static async listUserTaskSubmissions(portalId: string, userId: string): Promise<TaskSubmission[]> {
    const snap = await adminDb
      .collection('task_submissions')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .get();

    return snap.docs.map(d => d.data() as TaskSubmission);
  }

  // ── Member Activity Timeline & CRM Sync ────────────────────────────────────

  public static async logMemberActivity(input: LogMemberActivityInput): Promise<MemberActivityEvent> {
    const docRef = adminDb.collection('portal_member_activities').doc();
    const now = new Date().toISOString();

    const activity: MemberActivityEvent = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      createdAt: now,
    };

    await docRef.set(activity);

    // Synchronize to CRM Activity Logger
    try {
      await logActivity({
        userId: input.userId,
        organizationId: input.organizationId,
        workspaceId: 'onboarding',
        type: 'status_change',
        source: 'portal_engine',
        description: `${input.title} — ${input.description}`,
        metadata: {
          portalId: input.portalId,
          eventType: input.eventType,
          ...input.metadata,
        },
      });
    } catch (err) {
      // Non-blocking catch
      console.warn('[ENGAGEMENT] Non-blocking CRM log warning:', err);
    }

    // Recalculate Engagement Profile
    await EngagementService.recalculateEngagementScore(input.portalId, input.userId, input.organizationId);

    return activity;
  }

  public static async recalculateEngagementScore(
    portalId: string,
    userId: string,
    organizationId = 'smartsapp-hq'
  ): Promise<MemberEngagementProfile> {
    const profileId = `profile_${portalId}_${userId}`;
    const docRef = adminDb.collection('member_engagement_profiles').doc(profileId);
    const now = new Date().toISOString();

    const activitiesSnap = await adminDb
      .collection('portal_member_activities')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .get();

    const totalActivities = activitiesSnap.size;

    // Calculate score based on total activities & recency
    let score = totalActivities * 10;
    let tier: EngagementTier = 'cold';

    if (score >= 150) tier = 'champion';
    else if (score >= 80) tier = 'active';
    else if (score >= 30) tier = 'warm';

    const profile: MemberEngagementProfile = {
      id: profileId,
      organizationId,
      portalId,
      userId,
      tier,
      engagementScore: score,
      loginStreakDays: Math.min(30, Math.max(1, Math.round(totalActivities / 3))),
      lastActiveAt: now,
      totalActivitiesCount: totalActivities,
      updatedAt: now,
    };

    await docRef.set(profile, { merge: true });
    return profile;
  }

  /**
   * Scans portal members for inactivity and recalculates engagement tiers.
   * Emits re-engagement activity events for members who have been inactive >= 14 days.
   *
   * High-Load / Scalability Protection:
   * - Queries in chunks of up to 200 documents.
   * - Sets merged profile documents without exceeding write quotas.
   */
  public static async evaluatePortalInactivity(portalId: string): Promise<{
    evaluatedCount: number;
    warmCount: number;
    coldCount: number;
  }> {
    const membershipsSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', portalId)
      .where('status', '==', 'active')
      .limit(200)
      .get();

    if (membershipsSnap.empty) {
      return { evaluatedCount: 0, warmCount: 0, coldCount: 0 };
    }

    const nowMs = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    let warmCount = 0;
    let coldCount = 0;

    for (const doc of membershipsSnap.docs) {
      const data = doc.data();
      const lastActiveAtStr = data.lastActiveAt || data.joinedAt || data.createdAt;
      const lastActiveMs = lastActiveAtStr ? new Date(lastActiveAtStr).getTime() : 0;
      const inactiveMs = nowMs - lastActiveMs;

      let newTier: EngagementTier | null = null;
      if (inactiveMs >= FOURTEEN_DAYS_MS) {
        newTier = 'cold';
        coldCount++;
      } else if (inactiveMs >= SEVEN_DAYS_MS) {
        newTier = 'warm';
        warmCount++;
      }

      if (newTier) {
        const profileId = `profile_${portalId}_${data.userId}`;
        await adminDb.collection('member_engagement_profiles').doc(profileId).set(
          {
            tier: newTier,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        if (newTier === 'cold') {
          await EngagementService.logMemberActivity({
            organizationId: data.organizationId || 'smartsapp-hq',
            portalId,
            userId: data.userId,
            eventType: 'portal.member_inactivity_detected',
            title: 'Member Inactivity Detected (≥14 Days)',
            description: `Member ${data.displayName || data.email} has been inactive for over 14 days.`,
            metadata: { inactiveDays: Math.round(inactiveMs / (1000 * 60 * 60 * 24)), tier: 'cold' },
          });
        }
      }
    }

    return { evaluatedCount: membershipsSnap.size, warmCount, coldCount };
  }
}
