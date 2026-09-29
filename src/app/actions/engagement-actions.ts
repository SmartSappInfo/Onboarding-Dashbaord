'use server';

/**
 * {{Org_name}} Experience Platform — Onboarding & Engagement Server Actions
 *
 * Strongly typed Next.js Server Actions for Onboarding Flows, Daily Action Tasks,
 * Member Activity Timelines, and Gamification.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Onboarding flows, task authoring, submission reviews, inactivity runs: staff (`requirePortalAdmin`).
 * - Onboarding progress, task completion/submission, activity: the member's Firebase ID token;
 *   the member is ALWAYS the verified uid (caller-supplied userId is ignored).
 */

import { revalidatePath } from 'next/cache';
import { EngagementService } from '@/lib/services/engagement-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
} from '@/lib/auth/require-portal-access';
import type {
  OnboardingFlow,
  MemberOnboardingProgress,
  MemberTask,
  TaskSubmission,
  MemberActivityEvent,
  SaveOnboardingFlowInput,
  AdvanceOnboardingInput,
  CreateTaskInput,
  UpdateTaskInput,
  CompleteTaskInput,
  SubmitTaskInput,
  ReviewTaskSubmissionInput,
  LogMemberActivityInput,
  ReconcileOnboardingResult,
} from '@/lib/types/engagement';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.engagement-actions', err, undefined, fallback) };
}

// ── Onboarding Actions ───────────────────────────────────────────────────────

export async function saveOnboardingFlowAction(
  input: SaveOnboardingFlowInput,
  portalSlug?: string
): Promise<ActionResponse<OnboardingFlow>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const flow = await EngagementService.saveOnboardingFlow({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: flow };
  } catch (err: unknown) {
    return failure(err, 'Failed to save onboarding flow.');
  }
}

export async function getOnboardingFlowAction(
  portalId: string
): Promise<ActionResponse<OnboardingFlow | null>> {
  try {
    await requirePortalAdmin(portalId);
    const flow = await EngagementService.getOnboardingFlow(portalId);
    return { success: true, data: flow };
  } catch (err: unknown) {
    return failure(err, 'Failed to get onboarding flow.');
  }
}

export async function advanceOnboardingStepAction(
  idToken: string,
  input: Omit<AdvanceOnboardingInput, 'userId'>,
  portalSlug?: string
): Promise<ActionResponse<MemberOnboardingProgress>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const progress = await EngagementService.advanceOnboardingStep({ ...input, userId: uid });
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: progress };
  } catch (err: unknown) {
    return failure(err, 'Failed to advance onboarding step.');
  }
}

/**
 * Reconciles member onboarding checklist against real domain state
 * (learning progress, profile completion, community posts).
 */
export async function reconcileOnboardingAction(
  idToken: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<ReconcileOnboardingResult>> {
  try {
    const { uid: userId } = await requirePortalMember(idToken, portalId);
    const result = await EngagementService.reconcileMemberOnboarding(portalId, userId);
    if (portalSlug && result.updatedStepIds.length > 0) {
      revalidatePath(`/portal/${portalSlug}/dashboard`);
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    return failure(err, 'Failed to reconcile onboarding.');
  }
}

/**
 * Marks orientation video watching complete for the current member.
 */
export async function recordOrientationWatchedAction(
  idToken: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<MemberOnboardingProgress | null>> {
  try {
    const { uid: userId } = await requirePortalMember(idToken, portalId);
    const progress = await EngagementService.advanceStepByType(portalId, userId, 'welcome_video');
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: progress };
  } catch (err: unknown) {
    return failure(err, 'Failed to record orientation completion.');
  }
}

// ── Daily Task Actions ───────────────────────────────────────────────────────

export async function createTaskAction(
  input: CreateTaskInput,
  portalSlug?: string
): Promise<ActionResponse<MemberTask>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const task = await EngagementService.createTask({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: task };
  } catch (err: unknown) {
    return failure(err, 'Failed to create task.');
  }
}

export async function updateTaskAction(
  taskId: string,
  updates: UpdateTaskInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<MemberTask>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('member_tasks', taskId, portalId);
    const task = await EngagementService.updateTask(taskId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: task };
  } catch (err: unknown) {
    return failure(err, 'Failed to update task.');
  }
}

export async function deleteTaskAction(
  taskId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('member_tasks', taskId, portalId);
    await EngagementService.deleteTask(taskId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete task.');
  }
}

/** Staff (session) or a member of the portal (ID token) may list its tasks. */
export async function listTasksByPortalAction(
  portalId: string,
  idToken?: string
): Promise<ActionResponse<MemberTask[]>> {
  try {
    const isStaff = await requirePortalAdmin(portalId).then(() => true, () => false);
    if (!isStaff) await requirePortalMember(idToken ?? '', portalId);
    const tasks = await EngagementService.listPortalTasks(portalId);
    return { success: true, data: tasks };
  } catch (err: unknown) {
    return failure(err, 'Failed to list tasks.');
  }
}

export async function completeTaskAction(
  idToken: string,
  input: Omit<CompleteTaskInput, 'userId' | 'organizationId'>,
  portalSlug?: string
): Promise<ActionResponse<TaskSubmission>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const { portal } = await portalOf(input.portalId);
    await assertRecordInPortal('member_tasks', input.taskId, input.portalId);
    const sub = await EngagementService.completeTask({ ...input, userId: uid, organizationId: portal.organizationId });
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: sub };
  } catch (err: unknown) {
    return failure(err, 'Failed to complete task.');
  }
}

export async function submitTaskAction(
  idToken: string,
  input: Omit<SubmitTaskInput, 'userId' | 'organizationId'>,
  portalSlug?: string
): Promise<ActionResponse<TaskSubmission>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const { portal } = await portalOf(input.portalId);
    await assertRecordInPortal('member_tasks', input.taskId, input.portalId);
    const sub = await EngagementService.submitTask({ ...input, userId: uid, organizationId: portal.organizationId });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/dashboard`);
      revalidatePath(`/portal/${portalSlug}/tasks`);
    }
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: sub };
  } catch (err: unknown) {
    return failure(err, 'Failed to submit task.');
  }
}

export async function reviewTaskSubmissionAction(
  input: Omit<ReviewTaskSubmissionInput, 'reviewerUserId'>,
  portalSlug?: string
): Promise<ActionResponse<TaskSubmission>> {
  try {
    // The reviewer is the verified staff member (was caller-supplied reviewerUserId).
    const { auth } = await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('task_submissions', input.submissionId, input.portalId);
    const sub = await EngagementService.reviewTaskSubmission({ ...input, reviewerUserId: auth.uid });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/dashboard`);
      revalidatePath(`/portal/${portalSlug}/tasks`);
    }
    return { success: true, data: sub };
  } catch (err: unknown) {
    return failure(err, 'Failed to review task submission.');
  }
}

export async function listPendingSubmissionsAction(
  portalId: string
): Promise<ActionResponse<TaskSubmission[]>> {
  try {
    await requirePortalAdmin(portalId);
    const subs = await EngagementService.listPendingSubmissions(portalId);
    return { success: true, data: subs };
  } catch (err: unknown) {
    return failure(err, 'Failed to list pending submissions.');
  }
}

// ── Activity Logging Action ──────────────────────────────────────────────────

export async function logMemberActivityAction(
  idToken: string,
  input: Omit<LogMemberActivityInput, 'userId' | 'organizationId'>
): Promise<ActionResponse<MemberActivityEvent>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const { portal } = await portalOf(input.portalId);
    const activity = await EngagementService.logMemberActivity({ ...input, userId: uid, organizationId: portal.organizationId });
    return { success: true, data: activity };
  } catch (err: unknown) {
    return failure(err, 'Failed to log activity.');
  }
}

export async function evaluatePortalInactivityAction(
  portalId: string
): Promise<ActionResponse<{ evaluatedCount: number; warmCount: number; coldCount: number }>> {
  try {
    await requirePortalAdmin(portalId);
    const result = await EngagementService.evaluatePortalInactivity(portalId);
    return { success: true, data: result };
  } catch (err: unknown) {
    return failure(err, 'Failed to evaluate portal inactivity.');
  }
}

async function portalOf(portalId: string) {
  const { PortalService } = await import('@/lib/services/portal-service');
  const portal = await PortalService.getPortalById(portalId);
  if (!portal) throw new Error('Portal not found.');
  return { portal };
}
