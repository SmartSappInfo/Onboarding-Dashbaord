'use server';

import { KnowledgeInboxRepository } from './knowledge-inbox-repository';
import { QuickNotesRepository } from './quick-notes-repository';
import { IdeaRepository } from './idea-repository';
import { KnowledgeRelationRepository } from './knowledge-relation-repository';
import { adminDb } from './firebase-admin';
import {
  type KnowledgeInboxItem,
  type KnowledgeInsight,
  type InboxFilterOptions,
  type InsightFilterOptions,
  type MergeStrategy,
  type SuggestedPatch,
} from './quick-notes-types';
import {
  detectLexicalDuplicates,
  filterInboxItems,
  filterInsights,
  mergeKnowledgeObjects,
  extractPlainText,
} from './quick-notes-domain';
import { generateWorkspaceInsightsFlow } from '@/ai/flows/generate-workspace-insights-flow';
import { detectContradictionsFlow } from '@/ai/flows/detect-contradictions-flow';
import { detectDuplicatesFlow } from '@/ai/flows/detect-duplicates-flow';
import { governanceAuditFlow } from '@/ai/flows/governance-audit-flow';

/**
 * Knowledge Copilot, Insights & Governance Server Actions (Company Brain Phase 7).
 *
 * Implements human-in-the-loop inbox management, autonomous AI scans for duplicates/contradictions,
 * executive insights generation, smart note merging, and 1-click Idea/Task conversions.
 * Enforces strict workspace multi-tenancy and sliding window rate limiting.
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
      reason: `AI Rate limit reached. Please wait ${waitSec}s before running another AI operation.`,
    };
  }

  entry.count += 1;
  return { allowed: true };
}

/* --------------------------------------------------------------------------
 * INBOX SERVER ACTIONS
 * -------------------------------------------------------------------------- */

/**
 * Fetches inbox review items for a workspace.
 */
export async function getWorkspaceInboxAction(
  workspaceId: string,
  options?: InboxFilterOptions
): Promise<{ success: boolean; data?: KnowledgeInboxItem[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, error: 'Missing workspaceId' };

    const raw = await KnowledgeInboxRepository.getWorkspaceInbox(workspaceId, options);
    const filtered = filterInboxItems(raw, options || {});
    return { success: true, data: filtered };
  } catch (err: unknown) {
    console.error('getWorkspaceInboxAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch inbox' };
  }
}

/**
 * Reviews a single inbox item (Accept, Dismiss, Investigate, or Apply Patch).
 */
export async function reviewInboxItemAction(
  workspaceId: string,
  itemId: string,
  resolution: 'accept' | 'dismiss' | 'investigate',
  patch?: SuggestedPatch,
  userId = 'system'
): Promise<{ success: boolean; data?: KnowledgeInboxItem; error?: string }> {
  try {
    if (!workspaceId || !itemId) return { success: false, error: 'Missing parameters' };

    const item = await KnowledgeInboxRepository.getInboxItem(workspaceId, itemId);
    if (!item) return { success: false, error: 'Inbox item not found' };

    const newStatus =
      resolution === 'accept' ? 'accepted' : resolution === 'dismiss' ? 'dismissed' : 'investigating';

    // If accepted and has a suggested relation link, create it in knowledge_relations
    if (resolution === 'accept' && item.type === 'link_suggestion' && item.suggestedPatch?.relationType && item.targetKnowledgeId) {
      await KnowledgeRelationRepository.createRelation({
        workspaceId,
        fromObjectId: item.sourceKnowledgeId,
        toObjectId: item.targetKnowledgeId,
        relationType: item.suggestedPatch.relationType,
        confidence: item.confidence,
        provenance: 'ai_suggested',
        reasoning: item.description,
        createdBy: userId,
      });
    }

    // If accepted and has category/tag patch, apply to quick_notes
    if (resolution === 'accept' && item.type === 'classification' && patch && item.sourceKnowledgeId) {
      await QuickNotesRepository.update(item.sourceKnowledgeId, {
        category: patch.category,
        tags: patch.tags,
      });
    }

    const updated = await KnowledgeInboxRepository.updateInboxItemStatus(workspaceId, itemId, {
      status: newStatus,
      reviewedBy: userId,
      reviewNotes: `Resolved as ${resolution}${patch ? ' with applied patch' : ''}`,
    });

    return { success: true, data: updated };
  } catch (err: unknown) {
    console.error('reviewInboxItemAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to review inbox item' };
  }
}

/**
 * Bulk updates multiple inbox items (e.g. Accept All, Dismiss All).
 */
export async function bulkReviewInboxAction(
  workspaceId: string,
  itemIds: string[],
  resolution: 'accept' | 'dismiss',
  userId = 'system'
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!workspaceId || !itemIds || itemIds.length === 0) {
      return { success: false, error: 'No items selected' };
    }

    const status = resolution === 'accept' ? 'accepted' : 'dismissed';
    const count = await KnowledgeInboxRepository.bulkUpdateStatus(workspaceId, itemIds, status, userId);

    return { success: true, count };
  } catch (err: unknown) {
    console.error('bulkReviewInboxAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Bulk review failed' };
  }
}

/* --------------------------------------------------------------------------
 * AI SCANNING & AUTONOMOUS ACTIONS
 * -------------------------------------------------------------------------- */

/**
 * Scans workspace knowledge for duplicate notes and pushes suggestions to Knowledge Inbox.
 */
export async function scanDuplicatesAction(
  workspaceId: string,
  targetNoteId: string,
  userId = 'system'
): Promise<{ success: boolean; duplicatesFound?: number; error?: string }> {
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    const targetNote = await QuickNotesRepository.getById(targetNoteId);
    if (!targetNote || targetNote.workspaceId !== workspaceId) {
      return { success: false, error: 'Target note not found in workspace' };
    }

    const targetText = extractPlainText(targetNote.content);
    if (targetText.length < 30) {
      return { success: true, duplicatesFound: 0 };
    }

    // Pre-fetch candidate notes in same workspace
    const allNotes = await QuickNotesRepository.getByWorkspace(workspaceId);
    const candidateNotes = allNotes.filter((n) => n.id !== targetNoteId && !n.isArchived);

    // Pure lexical pre-filter to narrow candidates
    const lexicalCandidates: Array<{ id: string; title: string; content: string }> = [];
    for (const cand of candidateNotes) {
      const candText = extractPlainText(cand.content);
      if (candText.length >= 20) {
        const lexical = detectLexicalDuplicates(targetText, candText, 0.40);
        if (lexical.similarityScore >= 0.40) {
          lexicalCandidates.push({
            id: cand.id,
            title: cand.title || 'Untitled Note',
            content: candText,
          });
        }
      }
    }

    if (lexicalCandidates.length === 0) {
      return { success: true, duplicatesFound: 0 };
    }

    // Call GenAI Duplicate Flow on top candidates
    const aiResult = await detectDuplicatesFlow({
      targetNote: {
        id: targetNote.id,
        title: targetNote.title || 'Untitled Note',
        content: targetText,
      },
      candidateNotes: lexicalCandidates.slice(0, 10),
      similarityThreshold: 0.70,
    });

    if (!aiResult.duplicates || aiResult.duplicates.length === 0) {
      return { success: true, duplicatesFound: 0 };
    }

    // Push detected duplicates to Knowledge Inbox
    const inboxItems: Array<Omit<KnowledgeInboxItem, 'id' | 'createdAt' | 'updatedAt'>> = aiResult.duplicates.map((d) => ({
      workspaceId,
      type: 'duplicate_detection',
      status: 'pending',
      title: `Potential Duplicate: "${d.candidateTitle}"`,
      description: d.explanation,
      sourceKnowledgeId: targetNote.id,
      sourceKnowledgeTitle: targetNote.title,
      targetKnowledgeId: d.candidateNoteId,
      targetKnowledgeTitle: d.candidateTitle,
      confidence: d.similarityScore,
      evidence: [
        {
          sourceObjectId: targetNote.id,
          sourceTitle: targetNote.title,
          sourceType: targetNote.knowledgeType || 'note',
          textSnippet: targetText.substring(0, 200),
          relevanceScore: d.similarityScore,
        },
      ],
      duplicateDetails: {
        candidateNoteId: d.candidateNoteId,
        candidateTitle: d.candidateTitle,
        candidateSnippet: d.mergedDraftSummary || '',
        similarityScore: d.similarityScore,
        overlappingTopics: d.overlappingTopics,
        recommendedAction: d.recommendedAction,
      },
      createdBy: 'ai_agent:governance',
    }));

    const written = await KnowledgeInboxRepository.batchCreateInboxItems(inboxItems);
    return { success: true, duplicatesFound: written };
  } catch (err: unknown) {
    console.error('scanDuplicatesAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to scan duplicates' };
  }
}

/**
 * Scans for contradictions between a note and existing customer notes / idea hypotheses.
 */
export async function detectWorkspaceContradictionsAction(
  workspaceId: string,
  targetNoteId: string,
  userId = 'system'
): Promise<{ success: boolean; contradictionsFound?: number; error?: string }> {
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    const targetNote = await QuickNotesRepository.getById(targetNoteId);
    if (!targetNote || targetNote.workspaceId !== workspaceId) {
      return { success: false, error: 'Target note not found' };
    }

    const targetText = extractPlainText(targetNote.content);
    if (targetText.length < 30) {
      return { success: true, contradictionsFound: 0 };
    }

    const allNotes = await QuickNotesRepository.getByWorkspace(workspaceId);
    const candidateNotes = allNotes
      .filter((n) => n.id !== targetNoteId && !n.isArchived)
      .slice(0, 20)
      .map((n) => ({
        id: n.id,
        title: n.title || 'Untitled Note',
        type: n.knowledgeType || 'note',
        content: extractPlainText(n.content),
        date: n.createdAt,
      }));

    const aiResult = await detectContradictionsFlow({
      targetNote: {
        id: targetNote.id,
        title: targetNote.title || 'Untitled Note',
        type: targetNote.knowledgeType || 'note',
        content: targetText,
      },
      candidateNotes,
      sensitivity: 'balanced',
    });

    if (!aiResult.contradictions || aiResult.contradictions.length === 0) {
      return { success: true, contradictionsFound: 0 };
    }

    const inboxItems: Array<Omit<KnowledgeInboxItem, 'id' | 'createdAt' | 'updatedAt'>> = aiResult.contradictions.map((c) => ({
      workspaceId,
      type: 'contradiction_detection',
      status: 'pending',
      title: `Contradiction: ${c.thesis.claim.substring(0, 60)}...`,
      description: c.explanation,
      sourceKnowledgeId: targetNote.id,
      sourceKnowledgeTitle: targetNote.title,
      targetKnowledgeId: c.antithesis.sourceId,
      targetKnowledgeTitle: c.antithesis.sourceTitle,
      confidence: c.confidence,
      evidence: [
        {
          sourceObjectId: targetNote.id,
          sourceTitle: targetNote.title,
          sourceType: targetNote.knowledgeType || 'note',
          textSnippet: c.thesis.quote,
          relevanceScore: c.confidence,
        },
        {
          sourceObjectId: c.antithesis.sourceId,
          sourceTitle: c.antithesis.sourceTitle || 'Conflicting Record',
          sourceType: 'note',
          textSnippet: c.antithesis.quote,
          relevanceScore: c.confidence,
        },
      ],
      contradictionDetails: {
        thesis: {
          claim: c.thesis.claim,
          sourceId: targetNote.id,
          sourceTitle: targetNote.title,
          quote: c.thesis.quote,
        },
        antithesis: {
          claim: c.antithesis.claim,
          sourceId: c.antithesis.sourceId,
          sourceTitle: c.antithesis.sourceTitle,
          quote: c.antithesis.quote,
        },
        severity: c.severity,
        explanation: c.explanation,
        suggestedResolution: c.suggestedResolution,
      },
      createdBy: 'ai_agent:governance',
    }));

    const written = await KnowledgeInboxRepository.batchCreateInboxItems(inboxItems);
    return { success: true, contradictionsFound: written };
  } catch (err: unknown) {
    console.error('detectWorkspaceContradictionsAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to detect contradictions' };
  }
}

/**
 * Runs full executive AI synthesis across workspace knowledge to generate Insight Center insights.
 */
export async function generateWorkspaceInsightsAction(
  workspaceId: string,
  userId = 'system'
): Promise<{ success: boolean; insightsCount?: number; error?: string }> {
  const rate = checkRateLimit(userId);
  if (!rate.allowed) return { success: false, error: rate.reason };

  try {
    const allNotes = await QuickNotesRepository.getByWorkspace(workspaceId);
    const validNotes = allNotes.filter((n) => !n.isArchived).slice(0, 40);

    if (validNotes.length === 0) {
      return { success: true, insightsCount: 0 };
    }

    const payload = validNotes.map((n) => ({
      id: n.id,
      title: n.title || 'Untitled Note',
      type: n.knowledgeType || 'note',
      content: extractPlainText(n.content),
      date: n.createdAt,
      entityNames: [
        ...(n.links?.schoolNames || []),
        ...(n.links?.contactNames || []),
        ...(n.links?.dealNames || []),
      ],
    }));

    const aiResult = await generateWorkspaceInsightsFlow({
      knowledgeItems: payload,
    });

    if (!aiResult.insights || aiResult.insights.length === 0) {
      return { success: true, insightsCount: 0 };
    }

    const insightRecords: Array<Omit<KnowledgeInsight, 'id' | 'createdAt' | 'updatedAt'>> = aiResult.insights.map((ins) => ({
      workspaceId,
      type: ins.type,
      severity: ins.severity,
      title: ins.title,
      summary: ins.summary,
      evidenceCount: ins.evidenceSources.length,
      evidenceSources: ins.evidenceSources,
      suggestedActions: ins.suggestedActions.map((a) => ({
        id: a.id,
        label: a.label,
        actionType: a.actionType,
      })),
      status: 'active',
      createdBy: 'ai_agent:insight',
    }));

    const written = await KnowledgeInboxRepository.batchCreateInsights(insightRecords);
    return { success: true, insightsCount: written };
  } catch (err: unknown) {
    console.error('generateWorkspaceInsightsAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate insights' };
  }
}

/**
 * Merges two duplicate notes non-destructively: Unifies content, links, tags, and soft-archives source.
 */
export async function mergeDuplicateNotesAction(
  workspaceId: string,
  sourceNoteId: string,
  targetNoteId: string,
  strategy: MergeStrategy = 'concatenate',
  _userId = 'system'
): Promise<{ success: boolean; targetNoteId?: string; error?: string }> {
  try {
    if (!workspaceId || !sourceNoteId || !targetNoteId) {
      return { success: false, error: 'Missing merge parameters' };
    }

    const sourceNote = await QuickNotesRepository.getById(sourceNoteId);
    const targetNote = await QuickNotesRepository.getById(targetNoteId);

    if (!sourceNote || !targetNote) {
      return { success: false, error: 'One or both notes not found' };
    }

    if (sourceNote.workspaceId !== workspaceId || targetNote.workspaceId !== workspaceId) {
      return { success: false, error: 'Cross-tenant merge forbidden' };
    }

    // Merge TipTap documents
    const mergedContent = mergeKnowledgeObjects(sourceNote.content, targetNote.content, strategy);

    // Merge tags
    const combinedTags = Array.from(new Set([...(targetNote.tags || []), ...(sourceNote.tags || [])]));

    // Merge CRM links
    const combinedLinks = {
      ...targetNote.links,
      schoolIds: Array.from(new Set([...(targetNote.links?.schoolIds || []), ...(sourceNote.links?.schoolIds || [])])),
      contactIds: Array.from(new Set([...(targetNote.links?.contactIds || []), ...(sourceNote.links?.contactIds || [])])),
      dealIds: Array.from(new Set([...(targetNote.links?.dealIds || []), ...(sourceNote.links?.dealIds || [])])),
      schoolNames: Array.from(new Set([...(targetNote.links?.schoolNames || []), ...(sourceNote.links?.schoolNames || [])])),
      contactNames: Array.from(new Set([...(targetNote.links?.contactNames || []), ...(sourceNote.links?.contactNames || [])])),
      dealNames: Array.from(new Set([...(targetNote.links?.dealNames || []), ...(sourceNote.links?.dealNames || [])])),
    };

    // Update target note with combined payload
    await QuickNotesRepository.update(targetNoteId, {
      content: mergedContent,
      tags: combinedTags,
      links: combinedLinks,
    });

    // Soft-archive source note with merge reference
    await QuickNotesRepository.update(sourceNoteId, {
      isArchived: true,
    });

    return { success: true, targetNoteId };
  } catch (err: unknown) {
    console.error('mergeDuplicateNotesAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Merge failed' };
  }
}

/**
 * 1-Click Converts an Insight into a structured Idea in Idea Studio.
 */
export async function convertInsightToIdeaAction(
  workspaceId: string,
  insightId: string,
  userId = 'system'
): Promise<{ success: boolean; ideaId?: string; error?: string }> {
  try {
    const insights = await KnowledgeInboxRepository.getWorkspaceInsights(workspaceId);
    const insight = insights.find((i) => i.id === insightId);
    if (!insight) return { success: false, error: 'Insight not found' };

    const newIdea = await IdeaRepository.createIdea({
      workspaceId,
      organizationId: 'org-default',
      title: insight.title,
      summary: insight.summary,
      problem: insight.summary,
      proposedSolution: insight.suggestedActions.map((a) => a.label).join('; ') || 'Investigate and implement solution.',
      impact: insight.severity === 'critical' ? 9 : insight.severity === 'high' ? 8 : 6,
      effort: 5,
      confidence: 7,
      priority: insight.severity === 'critical' ? 'urgent' : insight.severity === 'high' ? 'high' : 'medium',
      lifecycleStage: 'captured',
      validationStatus: 'unvalidated',
      tags: ['ai-insight', insight.type],
      assumptions: [],
      hypotheses: [],
      experiments: [],
      decisions: [],
      evidenceIds: insight.evidenceSources.map((e) => e.id),
      relatedIdeaIds: [],
      createdBy: userId,
    });

    // Update insight status to promoted
    await KnowledgeInboxRepository.updateInsight(workspaceId, insightId, {
      status: 'promoted_to_idea',
      promotedIdeaId: newIdea.id,
    });

    return { success: true, ideaId: newIdea.id };
  } catch (err: unknown) {
    console.error('convertInsightToIdeaAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to promote insight to idea' };
  }
}

/**
 * 1-Click Converts an Insight into an operational task.
 */
export async function convertInsightToTaskAction(
  workspaceId: string,
  insightId: string,
  userId: string,
  payload: { title: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const taskRef = adminDb.collection('tasks').doc();
    const now = new Date().toISOString();

    const taskDoc = {
      id: taskRef.id,
      workspaceId,
      title: payload.title,
      description: `Task created from Company Brain Insight (ID: ${insightId})`,
      priority: payload.priority || 'medium',
      status: 'pending',
      assignedTo: userId,
      createdBy: userId,
      sourceInsightId: insightId,
      createdAt: now,
      updatedAt: now,
    };

    await taskRef.set(taskDoc);

    await KnowledgeInboxRepository.updateInsight(workspaceId, insightId, {
      promotedTaskId: taskRef.id,
    });

    return { success: true, taskId: taskRef.id };
  } catch (err: unknown) {
    console.error('convertInsightToTaskAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
  }
}

/**
 * Fetches all insights for Insight Center.
 */
export async function getWorkspaceInsightsAction(
  workspaceId: string,
  options?: InsightFilterOptions
): Promise<{ success: boolean; data?: KnowledgeInsight[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, error: 'Missing workspaceId' };

    const raw = await KnowledgeInboxRepository.getWorkspaceInsights(workspaceId, options);
    const filtered = filterInsights(raw, options || {});
    return { success: true, data: filtered };
  } catch (err: unknown) {
    console.error('getWorkspaceInsightsAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch insights' };
  }
}

/**
 * Deletes an insight entity.
 */
export async function deleteInsightAction(
  workspaceId: string,
  insightId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = await KnowledgeInboxRepository.deleteInsight(workspaceId, insightId);
    return { success: deleted };
  } catch (err: unknown) {
    console.error('deleteInsightAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete insight' };
  }
}

/**
 * Runs a governance audit on a note.
 */
export async function auditNoteGovernanceAction(
  workspaceId: string,
  noteId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const note = await QuickNotesRepository.getById(noteId);
    if (!note || note.workspaceId !== workspaceId) {
      return { success: false, error: 'Note not found' };
    }

    const contentText = extractPlainText(note.content);
    const result = await governanceAuditFlow({
      noteId,
      title: note.title || 'Untitled',
      content: contentText,
      checkPii: true,
      checkUnsupportedClaims: true,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    console.error('auditNoteGovernanceAction error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Governance audit failed' };
  }
}
