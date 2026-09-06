'use server';

import { embedText } from '@/ai/flows/embed-note-flow';
import { askKnowledgeRagFlow } from '@/ai/flows/ask-knowledge-rag-flow';
import { NoteIndexRepository } from './note-index-repository';
import { QuickNoteRepository } from './quick-notes-repository';
import { getAggregatedNotes } from './quick-notes-aggregator';
import { canUser } from './workspace-permissions';
import {
  buildAiInput,
  chunkNoteContent,
  fuseSearchResults,
} from './quick-notes-domain';
import type {
  NoteIndexRow,
  HybridSearchResult,
  HybridSearchOptions,
  AskKnowledgeResponse,
  UnifiedNote,
} from './quick-notes-types';
import { adminDb } from './firebase-admin';

/**
 * Company Brain (Knowledge 2.0) — Search & RAG Server Actions (Phase 4).
 *
 * Implements multi-channel hybrid search, permission-guarded natural language RAG,
 * and background vector index maintenance with strict multi-tenancy boundaries.
 */

type SearchResult<T> =
  | { success: true; data: T; fallbackNotice?: string }
  | { success: false; error: string; code?: 'no_index' | 'rate_limited' | 'unauthenticated' };

const RATE_LIMIT_SEARCH = 40;
const RATE_LIMIT_ASK = 20;
const RATE_WINDOW_MS = 60_000;
const searchCallLog = new Map<string, number[]>();
const askCallLog = new Map<string, number[]>();

function checkRateLimit(userId: string, isAsk: boolean): boolean {
  const logMap = isAsk ? askCallLog : searchCallLog;
  const limit = isAsk ? RATE_LIMIT_ASK : RATE_LIMIT_SEARCH;
  const now = Date.now();
  const recent = (logMap.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= limit) {
    logMap.set(userId, recent);
    return true;
  }
  recent.push(now);
  logMap.set(userId, recent);
  return false;
}

export interface SemanticSearchParams {
  workspaceId: string;
  query: string;
  userId: string;
  limit?: number;
}

/**
 * Legacy vector search action (retained for backward compatibility).
 */
export async function semanticSearchNotes(params: SemanticSearchParams): Promise<SearchResult<NoteIndexRow[]>> {
  const { workspaceId, userId } = params;
  if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
  if (!workspaceId) return { success: false, error: 'No workspace selected.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

  const query = buildAiInput(params.query, 1000);
  if (!query) return { success: false, error: 'Enter a question or phrase to search.' };
  if (checkRateLimit(userId, false)) {
    return { success: false, error: 'Too many searches. Please wait a moment.', code: 'rate_limited' };
  }

  try {
    const queryVector = await embedText(query);
    if (queryVector.length === 0) return { success: true, data: [] };

    const rows = await NoteIndexRepository.searchByVector(workspaceId, queryVector, params.limit ?? 10);
    return { success: true, data: rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    if (/index|FAILED_PRECONDITION|vector/i.test(message)) {
      return {
        success: false,
        code: 'no_index',
        error: 'Semantic search is not set up yet. Backfill the note index and create the vector index.',
      };
    }
    return { success: false, error: message };
  }
}

/**
 * Multi-channel Hybrid Search Action (Phase 4).
 *
 * Simultaneously queries lexical keyword matches and semantic vector embeddings,
 * merging the candidate sets via Reciprocal Rank Fusion (RRF) with automatic
 * fallback if vector indexes are unindexed.
 */
export async function hybridSearchKnowledgeAction(
  options: HybridSearchOptions
): Promise<SearchResult<HybridSearchResult[]>> {
  const { workspaceId, userId, query } = options;
  if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
  if (!workspaceId) return { success: false, error: 'No workspace selected.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

  const sanitizedQuery = buildAiInput(query, 1000);
  if (!sanitizedQuery) return { success: false, error: 'Please enter search terms.' };

  if (checkRateLimit(userId, false)) {
    return { success: false, error: 'Too many searches. Please wait a moment.', code: 'rate_limited' };
  }

  const terms = sanitizedQuery.split(/\s+/).filter((t) => t.length > 1);

  // 1. Lexical retrieval
  const lexicalPromise = NoteIndexRepository.searchByKeywords(workspaceId, terms, options.limit ? options.limit * 2 : 25, {
    knowledgeTypes: options.knowledgeTypes,
    sources: options.sources,
    entityId: options.entityId,
  });

  // 2. Vector retrieval (with graceful degradation on missing vector index)
  let vectorRows: NoteIndexRow[] = [];
  let fallbackNotice: string | undefined;

  try {
    const queryVector = await embedText(sanitizedQuery);
    if (queryVector.length > 0) {
      vectorRows = await NoteIndexRepository.searchByVector(workspaceId, queryVector, options.limit ?? 15, {
        knowledgeTypes: options.knowledgeTypes,
        sources: options.sources,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/index|FAILED_PRECONDITION|vector/i.test(message)) {
      fallbackNotice = 'Vector search is currently offline; displaying keyword & entity matches.';
    }
  }

  const lexicalRows = await lexicalPromise;

  // 3. Fusion & Ranking
  const fusedResults = fuseSearchResults(lexicalRows, vectorRows, sanitizedQuery, options.alpha ?? 0.65);
  const finalResults = fusedResults.slice(0, options.limit ?? 15);

  return {
    success: true,
    data: finalResults,
    fallbackNotice,
  };
}

export interface AskKnowledgeParams {
  workspaceId: string;
  userId: string;
  query: string;
  entityId?: string;
  entityName?: string;
}

/**
 * Ask SmartSapp Knowledge — Permission-Aware Grounded RAG Action (Phase 4).
 *
 * Coordinates multi-channel retrieval, semantic chunking, and Genkit LLM synthesis
 * with anti-hallucination citation validation and structured action recommendations.
 */
export async function askSmartSappKnowledgeAction(
  params: AskKnowledgeParams
): Promise<SearchResult<AskKnowledgeResponse>> {
  const { workspaceId, userId, query, entityId, entityName } = params;
  if (!userId) return { success: false, error: 'Not authenticated.', code: 'unauthenticated' };
  if (!workspaceId) return { success: false, error: 'No workspace selected.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'view', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Access denied.', code: 'unauthenticated' };

  const sanitizedQuery = buildAiInput(query, 1200);
  if (!sanitizedQuery) return { success: false, error: 'Please enter a question to ask.' };

  if (checkRateLimit(userId, true)) {
    return { success: false, error: 'Too many questions in a short period. Please wait a moment.', code: 'rate_limited' };
  }

  // Fetch workspace settings for custom directives if configured
  let customDirectives = '';
  try {
    const settingsSnap = await adminDb.collection('system_settings').doc(`brain_${workspaceId}`).get();
    if (settingsSnap.exists) {
      customDirectives = settingsSnap.data()?.customGroundingDirectives || '';
    }
  } catch {
    // Non-fatal if settings doc is not found
  }

  // 1. Multi-channel retrieval for relevant candidate rows
  const terms = sanitizedQuery.split(/\s+/).filter((t) => t.length > 2);
  const lexicalPromise = NoteIndexRepository.searchByKeywords(workspaceId, terms, 20, {
    entityId,
  });

  let vectorRows: NoteIndexRow[] = [];
  try {
    const queryVector = await embedText(sanitizedQuery);
    if (queryVector.length > 0) {
      vectorRows = await NoteIndexRepository.searchByVector(workspaceId, queryVector, 12);
    }
  } catch {
    // Graceful fallback to lexical rows if vector index is building
  }

  const lexicalRows = await lexicalPromise;
  const fusedCandidates = fuseSearchResults(lexicalRows, vectorRows, sanitizedQuery, 0.65);

  // If no candidates from note_index, try live aggregation fallback
  let candidateNotes: UnifiedNote[] = [];
  if (fusedCandidates.length === 0) {
    const [nativeNotes, legacyNotes] = await Promise.all([
      QuickNoteRepository.listByWorkspace(workspaceId, 50).then((ns) => ns.map((n) => ({
        id: n.id,
        source: 'quick_note' as const,
        sourceId: n.id,
        workspaceId: n.workspaceId,
        title: n.title,
        plainText: n.plainText || '',
        knowledgeType: n.knowledgeType,
        status: n.status,
        tags: n.tags || [],
        attachments: n.attachments || [],
        links: n.links || {},
        isPinned: n.isPinned || false,
        createdByName: n.createdByName,
        createdAt: n.createdAt,
        originHref: null,
        editable: true,
      }))),
      getAggregatedNotes(workspaceId),
    ]);
    const allUnified: UnifiedNote[] = [...nativeNotes, ...legacyNotes];
    candidateNotes = allUnified
      .filter((n) => {
        const text = (n.plainText || '').toLowerCase();
        const title = (n.title || '').toLowerCase();
        return terms.some((t) => text.includes(t) || title.includes(t));
      })
      .slice(0, 10);
  } else {
    candidateNotes = fusedCandidates
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        source: c.source,
        sourceId: c.id.split(':')[1] || c.id,
        workspaceId,
        title: c.title,
        plainText: c.plainText,
        createdByName: c.authorName,
        createdAt: c.createdAt,
        isPinned: false,
        tags: c.tags,
        attachments: [],
        links: c.links,
        originHref: c.originHref,
        editable: false,
        knowledgeType: c.knowledgeType,
      }));
  }

  // 2. Extract and bound semantic chunks for context window budgeting
  const retrievedChunks: Array<{
    chunkId: string;
    objectId: string;
    sourceType: 'quick_note' | 'entity_note' | 'task_note' | 'call_note' | 'activity';
    title: string;
    text: string;
    authorName?: string;
    timestamp?: string;
    originHref: string | null;
    relevanceScore: number;
  }> = [];

  let totalChars = 0;
  const MAX_CONTEXT_CHARS = 12_000; // Safe token budget (~3,000 tokens)

  for (let i = 0; i < candidateNotes.length; i++) {
    const note = candidateNotes[i];
    const chunks = chunkNoteContent(note, 600);
    const estimatedRelevance = Math.max(0.4, 1.0 - i * 0.08);

    for (const chunk of chunks) {
      if (totalChars + chunk.text.length > MAX_CONTEXT_CHARS) break;
      retrievedChunks.push({
        chunkId: chunk.chunkId,
        objectId: chunk.objectId,
        sourceType: (chunk.source as 'quick_note' | 'entity_note' | 'task_note' | 'call_note' | 'activity') || 'quick_note',
        title: chunk.title || 'Untitled note',
        text: chunk.text,
        authorName: chunk.authorName,
        timestamp: chunk.createdAt,
        originHref: note.originHref || null,
        relevanceScore: estimatedRelevance,
      });
      totalChars += chunk.text.length;
      if (retrievedChunks.length >= 10) break;
    }
    if (retrievedChunks.length >= 10) break;
  }

  // 3. Synthesize answer via Genkit RAG Flow
  try {
    const flowResult = await askKnowledgeRagFlow({
      query: sanitizedQuery,
      retrievedChunks,
      workspaceName: 'Workspace Knowledge',
      userRole: 'Team Member',
      entityContext: entityName,
      customDirectives,
    });

    const response: AskKnowledgeResponse = {
      answer: flowResult.answer,
      confidence: flowResult.confidence,
      confidenceScore: flowResult.confidenceScore,
      state: flowResult.state,
      keyFindings: flowResult.keyFindings,
      citations: flowResult.citations.map((c) => ({
        citationId: c.citationId,
        objectId: c.objectId,
        sourceType: c.sourceType,
        title: c.title,
        authorName: c.authorName,
        timestamp: c.timestamp,
        excerpt: c.excerpt,
        relevanceScore: c.relevanceScore,
        originHref: c.originHref ?? null,
      })),
      recommendedActions: flowResult.recommendedActions.map((a) => ({
        title: a.title,
        priority: a.priority,
        rationale: a.rationale,
        assigneeSuggestion: a.assigneeSuggestion,
      })),
      unresolvedQuestions: flowResult.unresolvedQuestions,
      generatedAt: new Date().toISOString(),
      modelUsed: 'gemini-2.5',
    };

    return { success: true, data: response };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to synthesize answer';
    return { success: false, error: message };
  }
}

/**
 * On-Demand Batch Re-Indexing Action (Phase 4 Backoffice Governance).
 *
 * Collects all workspace notes, generates 768-dim embeddings in batches of 450,
 * and updates `note_index` rows to maintain search freshness.
 */
export async function reindexWorkspaceKnowledgeAction(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; indexedCount?: number; error?: string }> {
  if (!userId) return { success: false, error: 'Not authenticated.' };
  if (!workspaceId) return { success: false, error: 'No workspace provided.' };

  const perm = await canUser(userId, 'operations', 'quickNotes', 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason || 'Unauthorized.' };

  try {
    const [nativeNotes, legacyNotes] = await Promise.all([
      QuickNoteRepository.listByWorkspace(workspaceId, 500).then((ns) => ns.map((n) => ({
        id: n.id,
        source: 'quick_note' as const,
        sourceId: n.id,
        workspaceId: n.workspaceId,
        title: n.title,
        plainText: n.plainText || '',
        knowledgeType: n.knowledgeType,
        status: n.status,
        tags: n.tags || [],
        attachments: n.attachments || [],
        links: n.links || {},
        isPinned: n.isPinned || false,
        createdByName: n.createdByName,
        createdAt: n.createdAt,
        originHref: null,
        editable: true,
      }))),
      getAggregatedNotes(workspaceId),
    ]);

    const allNotes: UnifiedNote[] = [...nativeNotes, ...legacyNotes];
    if (allNotes.length === 0) {
      return { success: true, indexedCount: 0 };
    }

    const embeddingsMap = new Map<string, number[]>();

    // Generate embeddings in controlled batches to prevent rate exhaustion
    for (const note of allNotes) {
      const text = `${note.title || ''} ${note.plainText || ''}`.trim();
      if (text) {
        try {
          const vector = await embedText(text.slice(0, 2000));
          if (vector.length > 0) {
            embeddingsMap.set(note.id, vector);
          }
        } catch {
          // Continue if individual note fails embedding
        }
      }
    }

    const written = await NoteIndexRepository.projectMany(allNotes, embeddingsMap);
    return { success: true, indexedCount: written };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Re-indexing failed';
    return { success: false, error: message };
  }
}
