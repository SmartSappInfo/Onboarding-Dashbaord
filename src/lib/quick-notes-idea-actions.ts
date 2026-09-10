'use server';

import { IdeaRepository } from './idea-repository';
import { QuickNotesRepository } from './quick-notes-repository';
import {
  type Idea,
  type IdeaCanvasLayout,
  type IdeaFilterOptions,
  type IdeaLifecycleStage,
  type CreateIdeaPayload,
  type UpdateIdeaPayload,
  type IdeaAiDeconstructionResult,
  type IdeaAssumptionChallengeResult,
} from './quick-notes-types';
import {
  calculateIceScore,
  validateLifecycleTransition,
} from './quick-notes-domain';
import { developIdeaFlow } from '@/ai/flows/develop-idea-flow';
import { challengeIdeaAssumptionsFlow } from '@/ai/flows/challenge-idea-assumptions-flow';
import { decomposeIdeaCanvasFlow } from '@/ai/flows/decompose-idea-canvas-flow';
import { adminDb } from './firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';

/**
 * Quick Notes Idea Intelligence Server Actions (Company Brain Phase 6).
 *
 * Provides mutation and AI analysis pipelines for Idea Intelligence & Visual Mapping.
 * Enforces workspace multi-tenancy, zero 'any' typing, and in-memory rate limiting.
 */

// In-memory rate limiting: Max 15 AI actions / 60 seconds per user
const aiActionLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AI_CALLS_PER_WINDOW = 15;

function checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const entry = aiActionLimiter.get(userId);

  if (!entry || now > entry.resetTime) {
    aiActionLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_AI_CALLS_PER_WINDOW) {
    const waitSec = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      reason: `Idea AI rate limit exceeded. Please wait ${waitSec}s before running another AI analysis.`,
    };
  }

  entry.count++;
  return { allowed: true };
}

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetches all ideas for a workspace with optional filtering.
 */
export async function getWorkspaceIdeasAction(
  workspaceId: string,
  options?: IdeaFilterOptions
): Promise<ActionResponse<Idea[]>> {
  if (!workspaceId) {
    return { success: false, error: 'workspaceId is required' };
  }

  try {
    const ideas = await IdeaRepository.listIdeas(workspaceId, options || {});
    return { success: true, data: ideas };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch workspace ideas';
    return { success: false, error: msg };
  }
}

/**
 * Creates a new structured Idea, ensuring bidirectional synchronization with a QuickNote.
 */
export async function createIdeaAction(
  workspaceId: string,
  payload: CreateIdeaPayload,
  authorId: string,
  authorName = 'User'
): Promise<ActionResponse<Idea>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !authorId || !payload.title?.trim()) {
    return { success: false, error: 'workspaceId, authorId, and title are required' };
  }

  try {
    let noteId = payload.knowledgeObjectId;

    // If no underlying note exists, create one with knowledgeType: 'idea'
    if (!noteId) {
      const noteDoc = await QuickNotesRepository.createNote({
        workspaceId,
        createdBy: authorId,
        createdByName: authorName,
        title: payload.title,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: payload.problem
                    ? `Problem: ${payload.problem}\n\nSolution: ${payload.proposedSolution || ''}`
                    : payload.summary || payload.title,
                },
              ],
            },
          ],
        },
        plainText: payload.problem
          ? `Problem: ${payload.problem}\n\nSolution: ${payload.proposedSolution || ''}`
          : payload.summary || payload.title,
        knowledgeType: 'idea',
        tags: payload.tags || [],
        links: payload.targetAudience,
      });
      noteId = noteDoc.id;
    }

    const impact = payload.impact || 7;
    const effort = payload.effort || 4;
    const confidence = payload.confidence || 6;
    const iceScore = calculateIceScore(impact, effort, confidence);

    const formattedAssumptions = (payload.assumptions || []).map((a, idx) => ({
      ...a,
      id: `assump-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
      evidenceIds: a.evidenceIds || [],
    }));

    const formattedHypotheses = (payload.hypotheses || []).map((h, idx) => ({
      ...h,
      id: `hypo-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
      evidenceIds: h.evidenceIds || [],
    }));

    const created = await IdeaRepository.createIdea({
      workspaceId,
      knowledgeObjectId: noteId,
      title: payload.title.trim(),
      summary: payload.summary,
      problem: payload.problem,
      proposedSolution: payload.proposedSolution,
      targetAudience: payload.targetAudience,
      impact,
      effort,
      confidence,
      iceScore,
      validationStatus: 'unvalidated',
      lifecycleStage: payload.lifecycleStage || 'captured',
      priority: payload.priority || 'medium',
      tags: payload.tags || [],
      assumptions: formattedAssumptions,
      hypotheses: formattedHypotheses,
      experiments: [],
      decisions: [],
      evidenceIds: [],
      relatedIdeaIds: [],
      createdBy: authorId,
      createdByName: authorName,
    });

    return { success: true, data: created };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create idea';
    return { success: false, error: msg };
  }
}

/**
 * Updates an Idea entity and syncs the title/tags with the underlying note.
 */
export async function updateIdeaAction(
  workspaceId: string,
  ideaId: string,
  updates: UpdateIdeaPayload,
  userId: string
): Promise<ActionResponse<Idea>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  try {
    const updated = await IdeaRepository.updateIdea(workspaceId, ideaId, updates);

    // Sync title/tags to underlying note if changed
    if (updated.knowledgeObjectId && (updates.title || updates.tags)) {
      await QuickNotesRepository.updateNote(updated.knowledgeObjectId, {
        ...(updates.title ? { title: updates.title } : {}),
        ...(updates.tags ? { tags: updates.tags } : {}),
      });
    }

    return { success: true, data: updated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update idea';
    return { success: false, error: msg };
  }
}

/**
 * Deletes an Idea safely.
 */
export async function deleteIdeaAction(
  workspaceId: string,
  ideaId: string,
  userId: string
): Promise<ActionResponse<boolean>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  try {
    await IdeaRepository.deleteIdea(workspaceId, ideaId);
    return { success: true, data: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete idea';
    return { success: false, error: msg };
  }
}

/**
 * Transitions an Idea across lifecycle stages with state machine guard verification.
 */
export async function transitionIdeaStageAction(
  workspaceId: string,
  ideaId: string,
  nextStage: IdeaLifecycleStage,
  userId: string,
  options: { strictValidationGate?: boolean; minEvidenceForApproval?: number } = {}
): Promise<ActionResponse<Idea>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !nextStage) {
    return { success: false, error: 'workspaceId, ideaId, and nextStage are required' };
  }

  try {
    const idea = await IdeaRepository.getIdea(workspaceId, ideaId);
    if (!idea) {
      return { success: false, error: 'Idea not found' };
    }

    const validation = validateLifecycleTransition(
      idea.lifecycleStage,
      nextStage,
      idea,
      options.strictValidationGate ?? false,
      options.minEvidenceForApproval ?? 2
    );

    if (!validation.allowed) {
      return { success: false, error: validation.reason || 'Invalid state transition' };
    }

    const updated = await IdeaRepository.updateIdea(workspaceId, ideaId, {
      lifecycleStage: nextStage,
      ...(nextStage === 'validated' ? { validationStatus: 'validated' } : {}),
    });

    return { success: true, data: updated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to transition idea stage';
    return { success: false, error: msg };
  }
}

/**
 * AI Action: Deconstructs raw user thought into structured Idea fields.
 */
export async function developRawIdeaAiAction(
  workspaceId: string,
  rawText: string,
  userId: string,
  options: {
    existingTitle?: string;
    crmContext?: Array<{ name: string; type: string; contextSummary?: string }>;
    customDirectives?: string;
  } = {}
): Promise<ActionResponse<IdeaAiDeconstructionResult>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !rawText?.trim() || !userId) {
    return { success: false, error: 'workspaceId, rawText, and userId are required' };
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  try {
    const output = await developIdeaFlow({
      rawInput: rawText,
      existingTitle: options.existingTitle,
      crmContext: options.crmContext,
      customDirectives: options.customDirectives,
    });

    return { success: true, data: output };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'AI Idea deconstruction failed';
    return { success: false, error: msg };
  }
}

/**
 * AI Action: Devil's Advocate critical analysis challenging idea assumptions.
 */
export async function challengeIdeaAssumptionsAiAction(
  workspaceId: string,
  ideaId: string,
  userId: string
): Promise<ActionResponse<IdeaAssumptionChallengeResult>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  try {
    const idea = await IdeaRepository.getIdea(workspaceId, ideaId);
    if (!idea) {
      return { success: false, error: 'Idea not found' };
    }

    const output = await challengeIdeaAssumptionsFlow({
      title: idea.title,
      problem: idea.problem,
      proposedSolution: idea.proposedSolution,
      existingAssumptions: idea.assumptions?.map((a) => ({
        statement: a.statement,
        riskLevel: a.riskLevel,
      })),
      existingHypotheses: idea.hypotheses?.map((h) => ({
        statement: h.statement,
      })),
    });

    return { success: true, data: output };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Assumption challenger failed';
    return { success: false, error: msg };
  }
}

/**
 * AI Action: Decomposes a canvas node into child branches.
 */
export async function decomposeIdeaCanvasAiAction(
  workspaceId: string,
  ideaId: string,
  nodePayload: {
    nodeType: 'core_idea' | 'problem' | 'solution' | 'assumption' | 'hypothesis' | 'evidence' | 'experiment' | 'crm_entity';
    nodeTitle: string;
    nodeDescription?: string;
    connectedTitles?: string[];
  },
  userId: string
): Promise<ActionResponse<{ suggestedNodes: Array<{ type: string; title: string; description: string; relationLabel: string; color?: string }>; explanation: string }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  try {
    const idea = await IdeaRepository.getIdea(workspaceId, ideaId);
    if (!idea) {
      return { success: false, error: 'Idea not found' };
    }

    const output = await decomposeIdeaCanvasFlow({
      nodeType: nodePayload.nodeType,
      nodeTitle: nodePayload.nodeTitle,
      nodeDescription: nodePayload.nodeDescription,
      ideaTitle: idea.title,
      existingConnectedNodes: nodePayload.connectedTitles,
    });

    return { success: true, data: output };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Canvas decomposition failed';
    return { success: false, error: msg };
  }
}

/**
 * Saves canvas layout.
 */
export async function saveIdeaCanvasLayoutAction(
  workspaceId: string,
  ideaId: string,
  layout: IdeaCanvasLayout,
  userId: string
): Promise<ActionResponse<boolean>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  try {
    await IdeaRepository.saveCanvasLayout(workspaceId, ideaId, layout);
    return { success: true, data: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to save canvas layout';
    return { success: false, error: msg };
  }
}

/**
 * Operational Converter: Converts an Idea into a Task.
 */
export async function convertIdeaToTaskAction(
  workspaceId: string,
  ideaId: string,
  userId: string,
  taskOptions: {
    title?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;
  }
): Promise<ActionResponse<{ taskId: string }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  if (!workspaceId || !ideaId || !userId) {
    return { success: false, error: 'workspaceId, ideaId, and userId are required' };
  }

  try {
    const idea = await IdeaRepository.getIdea(workspaceId, ideaId);
    if (!idea) {
      return { success: false, error: 'Idea not found' };
    }

    const taskRef = adminDb.collection('tasks').doc();
    const taskData = {
      id: taskRef.id,
      workspaceId,
      title: taskOptions.title || `Implement Idea: ${idea.title}`,
      description: `Originating Idea: ${idea.title}\n\nProblem: ${idea.problem || 'N/A'}\n\nSolution: ${idea.proposedSolution || 'N/A'}`,
      priority: taskOptions.priority || idea.priority || 'medium',
      status: 'pending',
      dueDate: taskOptions.dueDate || null,
      assignedTo: taskOptions.assignedTo || userId,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceIdeaId: ideaId,
      sourceKnowledgeObjectId: idea.knowledgeObjectId,
    };

    await taskRef.set(taskData);

    // Update Idea with convertedTaskId
    await IdeaRepository.updateIdea(workspaceId, ideaId, {
      convertedTaskId: taskRef.id,
      lifecycleStage: 'implemented',
    });

    return { success: true, data: { taskId: taskRef.id } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to convert idea to task';
    return { success: false, error: msg };
  }
}
