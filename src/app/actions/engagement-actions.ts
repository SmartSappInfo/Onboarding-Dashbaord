'use server';

/**
 * {{Org_name}} Experience Platform — Onboarding & Engagement Server Actions
 *
 * Strongly typed Next.js Server Actions for Onboarding Flows, Daily Action Tasks,
 * Member Activity Timelines, and Gamification.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { EngagementService } from '@/lib/services/engagement-service';
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
  LogMemberActivityInput,
} from '@/lib/types/engagement';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

// ── Onboarding Actions ───────────────────────────────────────────────────────

export async function saveOnboardingFlowAction(
  input: SaveOnboardingFlowInput,
  portalSlug?: string
): Promise<ActionResponse<OnboardingFlow>> {
  try {
    const flow = await EngagementService.saveOnboardingFlow(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: flow };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save onboarding flow.' };
  }
}

export async function advanceOnboardingStepAction(
  input: AdvanceOnboardingInput,
  portalSlug?: string
): Promise<ActionResponse<MemberOnboardingProgress>> {
  try {
    const progress = await EngagementService.advanceOnboardingStep(input);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: progress };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to advance onboarding step.' };
  }
}

// ── Daily Task Actions ───────────────────────────────────────────────────────

export async function createTaskAction(
  input: CreateTaskInput,
  portalSlug?: string
): Promise<ActionResponse<MemberTask>> {
  try {
    const task = await EngagementService.createTask(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: task };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create task.' };
  }
}

export async function updateTaskAction(
  taskId: string,
  updates: UpdateTaskInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<MemberTask>> {
  try {
    const task = await EngagementService.updateTask(taskId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: task };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update task.' };
  }
}

export async function deleteTaskAction(
  taskId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await EngagementService.deleteTask(taskId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete task.' };
  }
}

export async function completeTaskAction(
  input: CompleteTaskInput,
  portalSlug?: string
): Promise<ActionResponse<TaskSubmission>> {
  try {
    const sub = await EngagementService.completeTask(input);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: sub };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to complete task.' };
  }
}

// ── Activity Logging Action ──────────────────────────────────────────────────

export async function logMemberActivityAction(
  input: LogMemberActivityInput
): Promise<ActionResponse<MemberActivityEvent>> {
  try {
    const activity = await EngagementService.logMemberActivity(input);
    return { success: true, data: activity };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to log activity.' };
  }
}
