'use server';

import { summarizeQuickNoteFlow, type QuickNoteInsight } from '@/ai/flows/summarize-quick-note-flow';
import { quickNotesDigestFlow, type QuickNotesDigest } from '@/ai/flows/quick-notes-digest-flow';
import { createTaskAction } from './task-server-actions';
import { canUser } from './workspace-permissions';
import { QuickNoteRepository } from './quick-notes-repository';
import { buildAiInput } from './quick-notes-domain';
import type { QuickNoteLinks } from './quick-notes-types';
import type { Task } from './types';

/**
 * Quick Notes — AI server actions (Phase 6).
 *
 * All model calls run server-side via Genkit. Inputs are length-capped before
 * the call (R8), results are cached on the note, and a lightweight per-user
 * rate limit guards against runaway cost. The note text is the user's own
 * content, so prompt-injection risk is low; we still bound length.
 */

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ── Lightweight in-memory rate limit (best-effort; per server instance) ──────
const RATE_LIMIT = 20; // calls
const RATE_WINDOW_MS = 60_000; // per minute
const callLog = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (callLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    callLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  callLog.set(userId, recent);
  return false;
}

export interface GenerateInsightParams {
  noteId: string;
  workspaceId: string;
  title?: string;
  plainText: string;
  userId: string;
  model?: string;
}

/** Generates and caches a per-note AI insight. */
export async function generateQuickNoteInsight(
  params: GenerateInsightParams
): Promise<ActionResult<QuickNoteInsight>> {
  const { noteId, workspaceId, title, plainText, userId } = params;
  if (!userId) return { success: false, error: 'Not authenticated.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.' };

  if (rateLimited(userId)) {
    return { success: false, error: 'Too many AI requests. Please wait a moment and try again.' };
  }

  const content = buildAiInput(plainText);
  if (!content) return { success: false, error: 'There is no note text to analyse yet.' };

  try {
    const insight = await summarizeQuickNoteFlow({ title, content });

    // Best-effort cache — only when the note exists in the authorised workspace
    // (prevents writing AI meta onto an arbitrary note id).
    if (noteId) {
      void QuickNoteRepository.getById(noteId)
        .then((note) => {
          if (!note || note.workspaceId !== workspaceId) return;
          return QuickNoteRepository.setAiMeta(noteId, {
            summary: insight.summary,
            suggestedTags: insight.suggestedTags,
            sentiment: insight.sentiment,
            actionItems: insight.actionItems,
            generatedAt: new Date().toISOString(),
            model: params.model || 'anthropic/claude-sonnet-4-6',
          });
        })
        .catch(() => {});
    }

    return { success: true, data: insight };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return { success: false, error: message };
  }
}

export interface GenerateDigestParams {
  notes: Array<{ title?: string; plainText: string; createdAt?: string }>;
  scopeLabel?: string;
  workspaceId: string;
  userId: string;
}

/** Generates a digest across a set of notes (e.g. the current board view). */
export async function generateQuickNotesDigest(
  params: GenerateDigestParams
): Promise<ActionResult<QuickNotesDigest>> {
  const { notes, scopeLabel, workspaceId, userId } = params;
  if (!userId) return { success: false, error: 'Not authenticated.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.' };

  if (rateLimited(userId)) {
    return { success: false, error: 'Too many AI requests. Please wait a moment and try again.' };
  }

  // Cap both the count and per-note length to bound cost.
  const capped = notes
    .slice(0, 50)
    .map((n) => ({ title: n.title, plainText: buildAiInput(n.plainText, 1500), createdAt: n.createdAt }))
    .filter((n) => n.plainText);

  if (capped.length === 0) return { success: false, error: 'No notes with text to summarise.' };

  try {
    const digest = await quickNotesDigestFlow({ notes: capped, scopeLabel });
    return { success: true, data: digest };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return { success: false, error: message };
  }
}

export interface CreateTaskFromActionItemParams {
  text: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  links?: QuickNoteLinks;
}

/**
 * Turns an AI-suggested action item into a Task with sensible defaults
 * (medium / todo / follow-up, assigned to the requester, due in 3 days),
 * pre-linking the originating note's entity when present.
 */
export async function createTaskFromActionItem(
  params: CreateTaskFromActionItemParams
): Promise<ActionResult<{ id: string }>> {
  const { text, workspaceId, organizationId, userId, links } = params;
  if (!userId) return { success: false, error: 'Not authenticated.' };
  const title = text.trim();
  if (!title || !workspaceId) return { success: false, error: 'A task title and workspace are required.' };

  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
    workspaceId,
    organizationId,
    title,
    description: 'Created from a Quick Notes action item.',
    priority: 'medium',
    status: 'todo',
    category: 'follow_up',
    assignedTo: userId,
    entityId: links?.entityId ?? null,
    entityName: links?.entityName ?? null,
    dueDate,
    reminders: [],
    reminderSent: false,
  };

  const result = await createTaskAction(taskData, userId);
  if (!result.success || !result.id) {
    return { success: false, error: result.error || 'Failed to create task.' };
  }
  return { success: true, data: { id: result.id } };
}
