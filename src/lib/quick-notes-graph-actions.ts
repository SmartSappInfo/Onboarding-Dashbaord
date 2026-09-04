'use server';

import { canUser } from './workspace-permissions';
import { KnowledgeRelationRepository } from './knowledge-relation-repository';
import { QuickNoteRepository } from './quick-notes-repository';
import { getAggregatedNotes } from './quick-notes-aggregator';
import { detectKnowledgeLinksFlow } from '@/ai/flows/detect-knowledge-links-flow';
import {
  buildAdjacencyGraph,
  filterKnowledgeGraph,
  extractBacklinks,
  quickNoteToUnified,
} from './quick-notes-domain';
import {
  knowledgeRelationCreateInputSchema,
  KNOWLEDGE_TYPES,
  type KnowledgeRelation,
  type KnowledgeRelationCreateInput,
  type KnowledgeGraphData,
  type KnowledgeGraphFilterOptions,
  type BacklinkItem,
  type AiLinkSuggestion,
  type UnifiedNote,
} from './quick-notes-types';
import { logActivity } from './activity-logger';

/**
 * Company Brain (Knowledge 2.0) — Knowledge Graph & Backlinks Actions (Phase 5).
 *
 * Implements full-graph retrieval, relationship management, AI link discovery,
 * and bi-directional citation queries with multi-tenant isolation.
 */

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: 'rate_limited' | 'unauthenticated' | 'validation_error' };

const RATE_LIMIT_AI_LINKS = 15;
const RATE_WINDOW_MS = 60_000;
const aiLinksCallLog = new Map<string, number[]>();

function checkAiLinkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (aiLinksCallLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_AI_LINKS) {
    aiLinksCallLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  aiLinksCallLog.set(userId, recent);
  return false;
}

async function getNotesForWorkspace(workspaceId: string): Promise<UnifiedNote[]> {
  try {
    return await getAggregatedNotes(workspaceId);
  } catch {
    const fallback = await QuickNoteRepository.listActive(workspaceId);
    return fallback.map(quickNoteToUnified);
  }
}

/**
 * Retrieves the unified Knowledge Graph for a workspace, combining notes, CRM entities,
 * explicit typed relations, and implicit entity links.
 */
export async function getWorkspaceKnowledgeGraphAction(
  workspaceId: string,
  userId: string,
  options?: KnowledgeGraphFilterOptions
): Promise<ActionResult<KnowledgeGraphData>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

    // Fetch notes and explicit relations in parallel
    const [notes, relations] = await Promise.all([
      getNotesForWorkspace(workspaceId),
      KnowledgeRelationRepository.fetchRelationsForWorkspace(workspaceId, {
        limit: options?.limit ? options.limit * 2 : 500,
      }),
    ]);

    // Build base adjacency graph
    const baseGraph = buildAdjacencyGraph(relations, notes);

    // Apply interactive filters if present
    const finalGraph = options ? filterKnowledgeGraph(baseGraph, options) : baseGraph;

    return { success: true, data: finalGraph };
  } catch (err) {
    console.error('[getWorkspaceKnowledgeGraphAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load Knowledge Graph.' };
  }
}

/**
 * Creates a new typed relationship between two knowledge objects or CRM entities.
 */
export async function createKnowledgeRelationAction(
  workspaceId: string,
  userId: string,
  authorName: string,
  input: KnowledgeRelationCreateInput
): Promise<ActionResult<KnowledgeRelation>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'edit', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Permission denied.', code: 'unauthenticated' };

    const parseRes = knowledgeRelationCreateInputSchema.safeParse(input);
    if (!parseRes.success) {
      return {
        success: false,
        error: parseRes.error.errors[0]?.message || 'Invalid relationship payload.',
        code: 'validation_error',
      };
    }

    const validated = parseRes.data;

    // Self-link prevention
    if (validated.fromObjectId === validated.toObjectId) {
      return {
        success: false,
        error: 'Cannot create a relationship between a knowledge object and itself.',
        code: 'validation_error',
      };
    }

    // Cross-tenant boundary verification for all note-backed knowledge types
    const isNoteBacked = (t: string) => (KNOWLEDGE_TYPES as readonly string[]).includes(t) || t === 'note';

    if (isNoteBacked(validated.fromObjectType)) {
      const fromNote = await QuickNoteRepository.getById(validated.fromObjectId);
      if (!fromNote || fromNote.workspaceId !== workspaceId) {
        return {
          success: false,
          error: 'The source note does not exist in the active workspace.',
          code: 'validation_error',
        };
      }
    }
    if (isNoteBacked(validated.toObjectType)) {
      const toNote = await QuickNoteRepository.getById(validated.toObjectId);
      if (!toNote || toNote.workspaceId !== workspaceId) {
        return {
          success: false,
          error: 'The target note does not exist in the active workspace.',
          code: 'validation_error',
        };
      }
    }

    const relation = await KnowledgeRelationRepository.createRelation({
      workspaceId,
      fromObjectId: validated.fromObjectId,
      fromObjectType: validated.fromObjectType as KnowledgeRelation['fromObjectType'],
      toObjectId: validated.toObjectId,
      toObjectType: validated.toObjectType as KnowledgeRelation['toObjectType'],
      relationType: validated.relationType,
      confidence: validated.confidence,
      source: validated.source,
      createdBy: userId,
      createdByName: authorName,
      metadata: validated.metadata,
    });

    // Log activity
    await logActivity({
      organizationId: 'org_default',
      workspaceId,
      userId,
      displayName: authorName,
      type: 'knowledge_relation_created',
      source: 'quick_notes',
      entityId: relation.id,
      description: `Linked ${validated.fromObjectType} to ${validated.toObjectType} as "${validated.relationType}"`,
      metadata: {
        relationId: relation.id,
        relationType: validated.relationType,
        fromObjectId: validated.fromObjectId,
        toObjectId: validated.toObjectId,
      },
    }).catch((e) => console.warn('[createKnowledgeRelationAction] Activity log failed:', e));

    return { success: true, data: relation };
  } catch (err) {
    console.error('[createKnowledgeRelationAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create relationship.' };
  }
}

/**
 * Deletes an existing knowledge relationship.
 */
export async function deleteKnowledgeRelationAction(
  workspaceId: string,
  userId: string,
  relationId: string
): Promise<ActionResult<{ deletedId: string }>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'edit', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Permission denied.', code: 'unauthenticated' };

    await KnowledgeRelationRepository.deleteRelation(workspaceId, relationId);

    return { success: true, data: { deletedId: relationId } };
  } catch (err) {
    console.error('[deleteKnowledgeRelationAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete relationship.' };
  }
}

/**
 * Discovers potential semantic relationships and backlinks for a target note/idea using the AI Linking Agent.
 */
export async function suggestKnowledgeLinksAction(
  workspaceId: string,
  userId: string,
  targetObjectId: string,
  minConfidence = 0.65
): Promise<ActionResult<AiLinkSuggestion[]>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

    if (checkAiLinkRateLimit(userId)) {
      return {
        success: false,
        error: 'Rate limit exceeded: Too many AI link requests. Please wait a moment.',
        code: 'rate_limited',
      };
    }

    const allNotes = await getNotesForWorkspace(workspaceId);

    const targetNote = allNotes.find((n: UnifiedNote) => n.id === targetObjectId);
    if (!targetNote) {
      return { success: false, error: 'Target knowledge object not found.' };
    }

    // Prepare candidate objects (excluding target note itself)
    const candidates = allNotes
      .filter((n: UnifiedNote) => n.id !== targetObjectId)
      .slice(0, 15)
      .map((n: UnifiedNote) => ({
        id: n.id,
        title: n.title || 'Untitled Note',
        content: n.plainText || '',
        knowledgeType: n.knowledgeType || 'note',
        authorName: n.createdByName || undefined,
      }));

    const result = await detectKnowledgeLinksFlow({
      targetObject: {
        id: targetNote.id,
        title: targetNote.title || 'Untitled Note',
        content: targetNote.plainText || '',
        knowledgeType: targetNote.knowledgeType || 'note',
        authorName: targetNote.createdByName || undefined,
      },
      candidateObjects: candidates,
      minConfidence,
    });

    return {
      success: true,
      data: (result.suggestions || []).map((s) => ({
        fromObjectId: s.fromObjectId,
        fromObjectTitle: s.fromObjectTitle || targetNote.title,
        toObjectId: s.toObjectId,
        toObjectTitle: s.toObjectTitle,
        relationType: s.relationType,
        confidenceScore: s.confidenceScore,
        reasoning: s.reasoning,
        evidenceQuotes: s.evidenceQuotes,
      })),
    };
  } catch (err) {
    console.error('[suggestKnowledgeLinksAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'AI Link Discovery failed.' };
  }
}

/**
 * Fetches incoming backlinks and reverse citations for any note or CRM entity.
 */
export async function getBacklinksAction(
  workspaceId: string,
  userId: string,
  targetObjectId: string
): Promise<ActionResult<BacklinkItem[]>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

    const [relations, notes] = await Promise.all([
      KnowledgeRelationRepository.fetchBacklinks(workspaceId, targetObjectId),
      getNotesForWorkspace(workspaceId),
    ]);

    const notesMap = new Map<string, UnifiedNote>(notes.map((n: UnifiedNote) => [n.id, n]));
    const backlinks = extractBacklinks(targetObjectId, relations, notesMap);

    return { success: true, data: backlinks };
  } catch (err) {
    console.error('[getBacklinksAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch backlinks.' };
  }
}

/**
 * Admin Action: Backfills implicit CRM entity links into explicit knowledge_relations.
 */
export async function backfillCrmRelationsAction(
  workspaceId: string,
  userId: string,
  authorName: string
): Promise<ActionResult<{ backfilledCount: number }>> {
  try {
    if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
    if (!workspaceId) return { success: false, error: 'No workspace selected.' };

    const perm = await canUser(userId, 'operations', 'quickNotes', 'edit', workspaceId);
    if (!perm.granted) return { success: false, error: perm.reason || 'Permission denied.', code: 'unauthenticated' };

    const notes = await QuickNoteRepository.listActive(workspaceId);
    const existingRelations = await KnowledgeRelationRepository.fetchRelationsForWorkspace(workspaceId);
    const existingSet = new Set(existingRelations.map((r) => `${r.fromObjectId}->${r.toObjectId}:${r.relationType}`));

    const toCreate: Array<Omit<KnowledgeRelation, 'id' | 'createdAt'>> = [];

    for (const note of notes) {
      if (!note.links) continue;

      const candidates: Array<{ targetId?: string; relType: KnowledgeRelation['relationType']; targetType: KnowledgeRelation['toObjectType'] }> = [
        { targetId: note.links.entityId, relType: 'about_school', targetType: 'school' },
        { targetId: note.links.contactId, relType: 'about_contact', targetType: 'contact' },
        { targetId: note.links.dealId, relType: 'about_deal', targetType: 'deal' },
        { targetId: note.links.taskId, relType: 'depends_on', targetType: 'task' },
      ];

      for (const cand of candidates) {
        if (cand.targetId) {
          const key = `${note.id}->${cand.targetId}:${cand.relType}`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            toCreate.push({
              workspaceId,
              fromObjectId: note.id,
              fromObjectType: (note.knowledgeType as KnowledgeRelation['fromObjectType']) || 'note',
              toObjectId: cand.targetId,
              toObjectType: cand.targetType,
              relationType: cand.relType,
              confidence: 1.0,
              source: 'system',
              createdBy: userId,
              createdByName: authorName,
              metadata: { backfilled: true },
            });
          }
        }
      }
    }

    if (toCreate.length > 0) {
      await KnowledgeRelationRepository.batchCreateRelations(workspaceId, toCreate);
    }

    return { success: true, data: { backfilledCount: toCreate.length } };
  } catch (err) {
    console.error('[backfillCrmRelationsAction] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Backfill failed.' };
  }
}
