'use server';

/**
 * {{Org_name}} Experience Platform — AI Experience & Intelligence Server Actions
 *
 * Strongly typed Next.js Server Actions for AI Portal Generation, Curriculum Scaffolding,
 * AI Tutor RAG Chats, Assessment Question Generation, and Pedagogy Diagnostics.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a): these spend AI credits and read course data.
 * Authoring generators and diagnostics: staff. AI Tutor: verified portal member (ID token); the
 * session belongs to the token's uid and the portal's organization.
 */

import { revalidatePath } from 'next/cache';
import { AiExperienceService } from '@/lib/services/ai-experience-service';
import type { AssessmentQuestion } from '@/lib/types/learning';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
  requirePortalOrganizationAdmin,
} from '@/lib/auth/require-portal-access';
import type {
  GeneratedPortalScaffold,
  GeneratedCurriculum,
  AiTutorSession,
  AiPedagogyDiagnostic,
  GeneratePortalScaffoldInput,
  GenerateCurriculumInput,
  AskAiTutorInput,
  GenerateQuizInput,
} from '@/lib/types/ai-experience';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.ai-experience-actions', err, undefined, fallback) };
}

// ── 1. AI Portal Scaffold Action ─────────────────────────────────────────────

export async function generatePortalScaffoldAction(
  input: GeneratePortalScaffoldInput
): Promise<ActionResponse<GeneratedPortalScaffold>> {
  try {
    await requirePortalOrganizationAdmin(input.organizationId);
    const scaffold = await AiExperienceService.generatePortalScaffold(input);
    return { success: true, data: scaffold };
  } catch (err: unknown) {
    return failure(err, 'Failed to generate portal scaffold.');
  }
}

// ── 2. AI Curriculum Generator Action ────────────────────────────────────────

export async function generateCurriculumAction(
  input: GenerateCurriculumInput
): Promise<ActionResponse<GeneratedCurriculum>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const curriculum = await AiExperienceService.generateCurriculumStructure({ ...input, organizationId: portal.organizationId });
    return { success: true, data: curriculum };
  } catch (err: unknown) {
    return failure(err, 'Failed to generate course curriculum.');
  }
}

// ── 3. AI Quiz Generator Action ──────────────────────────────────────────────

export async function generateQuizAction(
  input: GenerateQuizInput
): Promise<ActionResponse<AssessmentQuestion[]>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('course_lessons', input.lessonId, input.portalId);
    const questions = await AiExperienceService.generateQuizQuestions({ ...input, organizationId: portal.organizationId });
    return { success: true, data: questions };
  } catch (err: unknown) {
    return failure(err, 'Failed to generate assessment questions.');
  }
}

// ── 4. AI Tutor RAG Chat Action ──────────────────────────────────────────────

export async function askAiTutorAction(
  idToken: string,
  input: Omit<AskAiTutorInput, 'userId' | 'organizationId'>,
  portalSlug?: string,
  courseSlug?: string,
  lessonSlug?: string
): Promise<ActionResponse<{ session: AiTutorSession; aiResponse: string; suggestedActions: string[] }>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    await assertRecordInPortal('course_lessons', input.lessonId, input.portalId);
    const { PortalService } = await import('@/lib/services/portal-service');
    const portal = await PortalService.getPortalById(input.portalId);
    if (!portal) return { success: false, error: 'Portal not found.' };
    const result = await AiExperienceService.askAiTutor({ ...input, userId: uid, organizationId: portal.organizationId });
    if (portalSlug && courseSlug && lessonSlug) {
      revalidatePath(`/portal/${portalSlug}/learn/${courseSlug}/${lessonSlug}`);
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    return failure(err, 'Failed to communicate with AI Tutor.');
  }
}

// ── 5. AI Pedagogy Diagnostic Action ─────────────────────────────────────────

export async function getCoursePedagogyDiagnosticAction(
  portalId: string,
  courseId: string,
  courseTitle: string
): Promise<ActionResponse<AiPedagogyDiagnostic>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('courses', courseId, portalId);
    const diagnostic = await AiExperienceService.diagnoseCoursePedagogy(portalId, courseId, courseTitle);
    return { success: true, data: diagnostic };
  } catch (err: unknown) {
    return failure(err, 'Failed to generate course pedagogy diagnostic.');
  }
}
