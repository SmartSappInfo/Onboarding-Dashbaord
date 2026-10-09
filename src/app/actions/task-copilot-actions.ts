'use server';

/**
 * @fileOverview Task Copilot Server Actions (Phase 4D).
 *
 * Implements:
 * - Authenticated entry point for AI natural-language task parsing.
 * - Authenticated entry point for AI checklist suggestions.
 * - Two-Phase Action Model: Performs ZERO database writes.
 * - Strict typing and workspace authorization.
 */

import { requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  parseTaskPrompt,
  suggestTaskChecklist,
} from '@/ai/flows/task-copilot-flow';
import type {
  TaskCopilotProposal,
  TaskChecklistProposal,
} from '@/ai/schemas/task-copilot-schemas';

export async function parseTaskPromptAction(
  workspaceId: string,
  prompt: string,
  options?: { referenceDate?: string; userTimezone?: string }
): Promise<{ success: boolean; proposal?: TaskCopilotProposal; error?: string }> {
  try {
    await requireWorkspace(workspaceId);

    const proposal = await parseTaskPrompt({
      prompt,
      referenceDate: options?.referenceDate,
      userTimezone: options?.userTimezone,
    });

    return { success: true, proposal };
  } catch (error: unknown) {
    console.error('[TASK_COPILOT] Parsing error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function suggestTaskChecklistAction(
  workspaceId: string,
  taskId: string,
  taskTitle: string
): Promise<{ success: boolean; checklist?: TaskChecklistProposal; error?: string }> {
  try {
    await requireWorkspace(workspaceId);

    const checklist = await suggestTaskChecklist(taskId, taskTitle);

    return { success: true, checklist };
  } catch (error: unknown) {
    console.error('[TASK_COPILOT] Suggest checklist error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
