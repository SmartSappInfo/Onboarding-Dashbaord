'use server';

/**
 * {{Org_name}} Experience Platform — AI Experience & Intelligence Server Actions
 *
 * Strongly typed Next.js Server Actions for AI Portal Generation, Curriculum Scaffolding,
 * AI Tutor RAG Chats, Assessment Question Generation, and Pedagogy Diagnostics.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { AiExperienceService } from '@/lib/services/ai-experience-service';
import type { AssessmentQuestion } from '@/lib/types/learning';
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

// ── 1. AI Portal Scaffold Action ─────────────────────────────────────────────

export async function generatePortalScaffoldAction(
  input: GeneratePortalScaffoldInput
): Promise<ActionResponse<GeneratedPortalScaffold>> {
  try {
    const scaffold = await AiExperienceService.generatePortalScaffold(input);
    return { success: true, data: scaffold };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate portal scaffold.' };
  }
}

// ── 2. AI Curriculum Generator Action ────────────────────────────────────────

export async function generateCurriculumAction(
  input: GenerateCurriculumInput
): Promise<ActionResponse<GeneratedCurriculum>> {
  try {
    const curriculum = await AiExperienceService.generateCurriculumStructure(input);
    return { success: true, data: curriculum };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate course curriculum.' };
  }
}

// ── 3. AI Quiz Generator Action ──────────────────────────────────────────────

export async function generateQuizAction(
  input: GenerateQuizInput
): Promise<ActionResponse<AssessmentQuestion[]>> {
  try {
    const questions = await AiExperienceService.generateQuizQuestions(input);
    return { success: true, data: questions };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate assessment questions.' };
  }
}

// ── 4. AI Tutor RAG Chat Action ──────────────────────────────────────────────

export async function askAiTutorAction(
  input: AskAiTutorInput,
  portalSlug?: string,
  courseSlug?: string,
  lessonSlug?: string
): Promise<ActionResponse<{ session: AiTutorSession; aiResponse: string; suggestedActions: string[] }>> {
  try {
    const result = await AiExperienceService.askAiTutor(input);
    if (portalSlug && courseSlug && lessonSlug) {
      revalidatePath(`/portal/${portalSlug}/learn/${courseSlug}/${lessonSlug}`);
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to communicate with AI Tutor.' };
  }
}

// ── 5. AI Pedagogy Diagnostic Action ─────────────────────────────────────────

export async function getCoursePedagogyDiagnosticAction(
  portalId: string,
  courseId: string,
  courseTitle: string
): Promise<ActionResponse<AiPedagogyDiagnostic>> {
  try {
    const diagnostic = await AiExperienceService.diagnoseCoursePedagogy(portalId, courseId, courseTitle);
    return { success: true, data: diagnostic };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate course pedagogy diagnostic.' };
  }
}
