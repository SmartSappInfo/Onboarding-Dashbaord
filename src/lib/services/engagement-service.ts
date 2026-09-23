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
    await adminDb.collection('member_tasks').doc(taskId).delete();
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
    const submissionId = `sub_${input.taskId}_${input.userId}`;
    const docRef = adminDb.collection('task_submissions').doc(submissionId);
    const taskSnap = await adminDb.collection('member_tasks').doc(input.taskId).get();

    const now = new Date().toISOString();
    const taskData = taskSnap.exists ? (taskSnap.data() as MemberTask) : null;

    const submission: TaskSubmission = {
      id: submissionId,
      organizationId: input.organizationId,
      portalId: input.portalId,
      taskId: input.taskId,
      userId: input.userId,
      status: 'completed',
      notes: input.notes?.trim(),
      submittedFileUrl: input.submittedFileUrl,
      completedAt: now,
      updatedAt: now,
    };

    await docRef.set(submission);

    // Award Points for Task (+15 pts)
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
        `Completed Action Task: ${taskData?.title || 'Daily Task'}`
      );
    }

    // Log Activity
    await EngagementService.logMemberActivity({
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: 'task.completed',
      title: `Completed Task: ${taskData?.title || 'Action Task'}`,
      description: `Earned +${pointsReward} points.`,
      metadata: { taskId: input.taskId, pointsReward },
    });

    return submission;
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
}
