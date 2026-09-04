import { z } from 'zod';

/**
 * Quick Notes — Unified Notes Workspace
 *
 * Type + schema source of truth for the Quick Notes feature.
 *
 * Design note: the rich note body is a TipTap document, but this module
 * deliberately models it with a *structural* `NoteDocument` type instead of
 * importing `@tiptap/*`. That keeps the domain + repository layers free of any
 * client/editor runtime dependency, so pure functions (e.g. `extractPlainText`)
 * stay trivially unit-testable on the server. The client editor casts its
 * TipTap JSON to `NoteDocument` — the two are structurally compatible.
 */

/** Structural mirror of TipTap's `JSONContent`. */
export interface NoteDocument {
  type?: string;
  text?: string;
  content?: NoteDocument[];
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type QuickNoteAttachmentType = 'link' | 'image' | 'video' | 'file';

export interface QuickNoteAttachment {
  id: string;
  type: QuickNoteAttachmentType;
  /** Same-origin Firebase Storage URL (media) or external URL (links). */
  url: string;
  /** Set for anything we host in Storage, so it can be cleaned up on delete. */
  storagePath?: string;
  title?: string;
  description?: string;
  /** Re-hosted to Storage for `next/image` (see design spec R3). */
  thumbnailUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/** Denormalised cross-object links (mirrors EntityNote.dealName convention). */
export interface QuickNoteLinks {
  entityId?: string;
  entityName?: string;
  contactId?: string;
  contactName?: string;
  leadId?: string;
  leadName?: string;
  dealId?: string;
  dealName?: string;
  taskId?: string;
  taskName?: string;
  campaignId?: string;
  campaignName?: string;
  meetingId?: string;
  meetingTitle?: string;
  callId?: string;
  callTitle?: string;
  // Multi-object association arrays
  schoolIds?: string[];
  schoolNames?: string[];
  contactIds?: string[];
  contactNames?: string[];
  dealIds?: string[];
  dealNames?: string[];
}

export type NoteSentiment = 'positive' | 'neutral' | 'negative' | 'urgent';

/**
 * Timeline event sources federated into the Unified CRM Knowledge Timeline (Phase 3).
 */
export type TimelineItemSource =
  | 'quick_note'
  | 'entity_note'
  | 'call'
  | 'meeting'
  | 'task'
  | 'activity';

/**
 * Normalized item model for the CRM Knowledge Timeline.
 */
export interface CRMKnowledgeTimelineItem {
  /** Globally unique key: `${source}:${sourceId}` */
  id: string;
  source: TimelineItemSource;
  sourceId: string;
  workspaceId: string;
  title: string;
  content: string;
  knowledgeType: KnowledgeType;
  timestamp: string;
  authorId?: string;
  authorName?: string;
  sentiment?: NoteSentiment;
  isPinned: boolean;
  links: QuickNoteLinks;
  tags: string[];
  actionItems?: string[];
  replyCount?: number;
  originHref: string | null;
  editable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Filter state for CRM Knowledge Timeline.
 */
export interface TimelineFilterState {
  type: 'all' | KnowledgeType | TimelineItemSource;
  searchQuery: string;
  sentiment?: NoteSentiment | 'all';
  onlyPinned?: boolean;
}

/**
 * Entity Resolution AI prediction match.
 */
export interface EntityResolutionMatch {
  entityId: string;
  entityName: string;
  entityType: 'contact' | 'school' | 'lead' | 'deal';
  confidenceScore: number;
  matchReason: string;
}

export interface EntityResolutionResult {
  detectedEntities: EntityResolutionMatch[];
  suggestedPrimaryLink?: EntityResolutionMatch;
}

export interface TimelineAiBrief {
  executiveSummary: string;
  keyThemes: string[];
  actionItems: string[];
  buyingSignals?: string[];
  objections?: string[];
  recentSentiment: NoteSentiment;
  itemCount: number;
  generatedAt: string;
}

/**
 * Knowledge Chunk (Phase 4 Search & RAG).
 *
 * Granular semantic chunk extracted from long-form notes, call transcripts,
 * or documents for high-precision vector and keyword retrieval.
 */
export interface KnowledgeChunk {
  chunkId: string;
  objectId: string;
  objectType: KnowledgeType;
  title?: string;
  sectionTitle?: string;
  text: string;
  authorId?: string;
  authorName?: string;
  workspaceId: string;
  links?: QuickNoteLinks;
  tags?: string[];
  source: UnifiedNoteSource;
  createdAt: string;
  updatedAt?: string;
  visibility: KnowledgeVisibility;
}

export interface SearchScoreBreakdown {
  lexicalScore: number;
  semanticScore: number;
  recencyScore: number;
  entityBonus: number;
}

/**
 * Scored result from the multi-channel hybrid search engine.
 */
export interface HybridSearchResult {
  id: string;
  source: UnifiedNoteSource;
  title: string;
  plainText: string;
  knowledgeType: KnowledgeType;
  score: number;
  scoreBreakdown: SearchScoreBreakdown;
  matchedSnippets: string[];
  matchedEntities: string[];
  originHref: string | null;
  createdAt: string;
  authorName?: string;
  tags: string[];
  links: QuickNoteLinks;
}

export interface HybridSearchOptions {
  workspaceId: string;
  query: string;
  userId: string;
  limit?: number;
  knowledgeTypes?: KnowledgeType[];
  sources?: UnifiedNoteSource[];
  entityId?: string;
  alpha?: number; // 0.0 (pure lexical) to 1.0 (pure vector). Default 0.65.
}

export type RagConfidence = 'high' | 'medium' | 'low';

export type RagState =
  | 'thinking'
  | 'answered'
  | 'partial_evidence'
  | 'no_evidence'
  | 'restricted_evidence';

export interface TimelinePeriodGroup {
  period: string;
  items: CRMKnowledgeTimelineItem[];
}

/**
 * Traceable evidence citation connecting RAG syntheses to original source records.
 */
export interface RagEvidenceCitation {
  citationId: string;
  objectId: string;
  sourceType: TimelineItemSource;
  title: string;
  authorName?: string;
  timestamp?: string;
  excerpt: string;
  relevanceScore: number;
  originHref: string | null;
  links?: QuickNoteLinks;
}

/**
 * Action item suggested by RAG synthesis, convertible to native Tasks in 1-click.
 */
export interface RagActionSuggestion {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  rationale?: string;
  assigneeSuggestion?: string;
  entityLink?: {
    entityId?: string;
    entityName?: string;
    contactId?: string;
    contactName?: string;
    dealId?: string;
    dealName?: string;
  };
}

/**
 * Structured output response returned by the "Ask SmartSapp Knowledge" engine.
 */
export interface AskKnowledgeResponse {
  answer: string;
  confidence: RagConfidence;
  confidenceScore: number; // 0 to 100
  state: RagState;
  keyFindings: string[];
  citations: RagEvidenceCitation[];
  recommendedActions: RagActionSuggestion[];
  unresolvedQuestions: string[];
  generatedAt: string;
  modelUsed?: string;
}

/**
 * Configurable Backoffice Brain Search & RAG Governance settings.
 */
export interface BrainSearchSettings {
  hybridAlpha: number; // 0.0 to 1.0 (default 0.65)
  minCitationRelevance: number; // 0.0 to 1.0 (default 0.60)
  maxEvidenceSources: number; // 3 to 12 (default 6)
  customGroundingDirectives?: string;
  enableAutoReindex?: boolean;
}

/**
 * Company Brain (Knowledge 2.0) semantic types.
 *
 * Distinct classification for human and AI-authored knowledge objects.
 * Every note/idea created in the system has an explicit semantic type.
 */
export const KNOWLEDGE_TYPES = [
  'note',
  'idea',
  'insight',
  'decision',
  'feedback',
  'observation',
  'action',
  'research',
  'strategy',
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export type KnowledgeVisibility = 'workspace' | 'private' | 'restricted';
export type KnowledgeStatus = 'draft' | 'active' | 'archived';

/**
 * Knowledge Space — high-level workspace grouping (e.g. "Strategy", "Sales", "Product").
 */
export interface KnowledgeSpace {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  order: number;
  isArchived?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge Collection — thematic sub-collection inside a space (e.g. "Q3 OKRs", "Customer Objections").
 */
export interface KnowledgeCollection {
  id: string;
  organizationId: string;
  workspaceId: string;
  spaceId?: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  order: number;
  isArchived?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge Template — structured boilerplate for rapid note capture (Phase 2).
 */
export interface KnowledgeTemplate {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description: string;
  knowledgeType: KnowledgeType;
  icon: string;
  color: string;
  content: NoteDocument;
  order: number;
  isSystem: boolean;
  isArchived?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result structure produced by the AI Capture Agent (Genkit flow).
 */
export interface KnowledgeClassificationResult {
  suggestedType: KnowledgeType;
  suggestedTitle: string;
  suggestedTags: string[];
  confidenceScore: number;
  sentiment: NoteSentiment;
  extractedActions: string[];
  keyTakeaway: string;
  suggestedLinks?: {
    entityName?: string;
    dealName?: string;
    contactName?: string;
  };
}

export interface QuickNoteAiMeta {
  summary?: string;
  suggestedTags?: string[];
  sentiment?: NoteSentiment;
  actionItems?: string[];
  generatedAt?: string;
  model?: string;
}

export interface QuickNote {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  content: NoteDocument;
  /** Derived from `content` at write-time — powers search, AI, and embeddings. */
  plainText: string;
  /** Schema/version guard for future editor migrations. */
  contentVersion: number;
  /** Semantic knowledge classification (Company Brain 2.0). Defaults to 'note'. */
  knowledgeType?: KnowledgeType;
  /** Optional space association. */
  spaceId?: string;
  /** Optional collection association. */
  collectionId?: string;
  /** Status lifecycle (draft, active, archived). */
  status?: KnowledgeStatus;
  /** Access visibility control. */
  visibility?: KnowledgeVisibility;
  /** Confidence score for AI-generated/inferred knowledge objects (0-1). */
  confidenceScore?: number;
  categoryId?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  pinnedAt?: string;
  ai?: QuickNoteAiMeta;
  /** Bumped when `plainText` changes; drives re-embedding (Phase 7). */
  embeddingVersion?: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteCategory {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  /** Design token key, never a raw hex value. */
  color: string;
  icon?: string;
  order: number;
  createdBy: string;
  createdAt: string;
}

export type UnifiedNoteSource = 'quick_note' | 'entity_note' | 'task_note' | 'call_note';

/** The board's render model. Native + legacy notes normalise to this shape. */
export interface UnifiedNote {
  /** Globally unique: `${source}:${sourceId}`. */
  id: string;
  source: UnifiedNoteSource;
  sourceId: string;
  workspaceId: string;
  title?: string;
  plainText: string;
  noteType?: string;
  knowledgeType?: KnowledgeType;
  sentiment?: NoteSentiment;
  visibility?: KnowledgeVisibility;
  spaceId?: string;
  collectionId?: string;
  status?: KnowledgeStatus;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  /** Deep-link to the source record's native UI. Null for native quick notes. */
  originHref: string | null;
  editable: boolean;
}

/** Projection row stored in `note_index` (server-only writes). */
export interface NoteIndexRow extends Omit<UnifiedNote, 'attachments'> {
  attachmentCount: number;
  embedding?: number[];
  embeddingVersion?: number;
  indexedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod input schemas (validated at the server-action boundary)
// ─────────────────────────────────────────────────────────────────────────────

/** Lenient structural validation for a TipTap document. */
export const noteDocumentSchema: z.ZodType<NoteDocument> = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      text: z.string().optional(),
      content: z.array(noteDocumentSchema).optional(),
      attrs: z.record(z.unknown()).optional(),
      marks: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough()
);

export const quickNoteAttachmentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['link', 'image', 'video', 'file']),
  url: z.string().url(),
  storagePath: z.string().optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const quickNoteLinksSchema = z.object({
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  leadId: z.string().optional(),
  leadName: z.string().optional(),
  dealId: z.string().optional(),
  dealName: z.string().optional(),
  taskId: z.string().optional(),
  taskName: z.string().optional(),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  meetingId: z.string().optional(),
  meetingTitle: z.string().optional(),
  callId: z.string().optional(),
  callTitle: z.string().optional(),
});

export const quickNoteCreateInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: noteDocumentSchema,
  knowledgeType: z.enum(KNOWLEDGE_TYPES).optional().default('note'),
  spaceId: z.string().optional(),
  collectionId: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional().default('active'),
  visibility: z.enum(['workspace', 'private', 'restricted']).optional().default('workspace'),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).max(30).default([]),
  attachments: z.array(quickNoteAttachmentSchema).max(50).default([]),
  links: quickNoteLinksSchema.default({}),
});

export const quickNoteUpdateInputSchema = quickNoteCreateInputSchema
  .partial()
  .extend({
    /** Optimistic-concurrency guard (design spec R12). */
    expectedUpdatedAt: z.string().optional(),
  });

export type QuickNoteCreateInput = z.infer<typeof quickNoteCreateInputSchema>;
export type QuickNoteUpdateInput = z.infer<typeof quickNoteUpdateInputSchema>;

export const knowledgeTemplateCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).default(''),
  knowledgeType: z.enum(KNOWLEDGE_TYPES).default('note'),
  icon: z.string().default('Notebook'),
  color: z.string().default('blue'),
  content: noteDocumentSchema,
  order: z.number().int().nonnegative().default(0),
  isSystem: z.boolean().default(false),
});

export const knowledgeTemplateUpdateInputSchema = knowledgeTemplateCreateInputSchema
  .partial()
  .extend({
    isArchived: z.boolean().optional(),
  });

export type KnowledgeTemplateCreateInput = z.infer<typeof knowledgeTemplateCreateInputSchema>;
export type KnowledgeTemplateUpdateInput = z.infer<typeof knowledgeTemplateUpdateInputSchema>;

export const QUICK_NOTES_COLLECTION = 'quick_notes';
export const QUICK_NOTE_CATEGORIES_COLLECTION = 'quick_note_categories';
export const KNOWLEDGE_SPACES_COLLECTION = 'knowledge_spaces';
export const KNOWLEDGE_COLLECTIONS_COLLECTION = 'knowledge_collections';
export const KNOWLEDGE_TEMPLATES_COLLECTION = 'knowledge_templates';
export const NOTE_INDEX_COLLECTION = 'note_index';
export const KNOWLEDGE_RELATIONS_COLLECTION = 'knowledge_relations';
export const IDEAS_COLLECTION = 'ideas';
export const KNOWLEDGE_INBOX_COLLECTION = 'knowledge_inbox';
export const KNOWLEDGE_INSIGHTS_COLLECTION = 'knowledge_insights';
export const CAMPAIGN_CONCEPTS_COLLECTION = 'campaign_concepts';
export const OBJECTION_BATTLECARDS_COLLECTION = 'objection_battlecards';

/** Stored TipTap content schema version; bump on a breaking content-shape change. */
export const NOTE_CONTENT_VERSION = 1;

// ============================================================================
// Phase 5: Knowledge Graph & Bi-directional Backlinks Types
// ============================================================================

/**
 * Standard typed semantic relationship categories.
 */
export const KNOWLEDGE_RELATION_TYPES = [
  // Core Knowledge Relations
  'related_to',
  'supports',
  'contradicts',
  'depends_on',
  'derived_from',
  'inspired_by',
  'duplicates',
  'supersedes',
  'blocks',
  'solves',
  'causes',
  'affects',
  'requires',
  'implements',
  'validates',
  'invalidates',
  'expands',
  'summarizes',
  'responds_to',
  'references',
  'evidences',
  'belongs_to',
  // CRM & Operational Entity Relations
  'mentioned_by_contact',
  'about_contact',
  'about_school',
  'about_deal',
  'about_campaign',
  'about_product',
  'about_segment',
  'targets',
  'addresses',
] as const;

export type KnowledgeRelationType = (typeof KNOWLEDGE_RELATION_TYPES)[number];

export type KnowledgeRelationSource = 'user' | 'ai' | 'system';

export type GraphNodeType =
  | KnowledgeType
  | 'contact'
  | 'school'
  | 'lead'
  | 'deal'
  | 'campaign'
  | 'task'
  | 'meeting'
  | 'call'
  | 'document';

/**
 * First-class typed connection between two knowledge objects or CRM entities.
 */
export interface KnowledgeRelation {
  id: string;
  organizationId?: string;
  workspaceId: string;
  fromObjectId: string;
  fromObjectType: GraphNodeType;
  toObjectId: string;
  toObjectType: GraphNodeType;
  relationType: KnowledgeRelationType;
  confidence: number; // 0.0 to 1.0 (1.0 for user-authored)
  source: KnowledgeRelationSource;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export const knowledgeRelationCreateInputSchema = z.object({
  fromObjectId: z.string().min(1, 'Source object ID is required'),
  fromObjectType: z.string().default('note'),
  toObjectId: z.string().min(1, 'Target object ID is required'),
  toObjectType: z.string().default('note'),
  relationType: z.enum(KNOWLEDGE_RELATION_TYPES).default('related_to'),
  confidence: z.number().min(0).max(1).default(1.0),
  source: z.enum(['user', 'ai', 'system']).default('user'),
  metadata: z.record(z.unknown()).optional(),
});

export type KnowledgeRelationCreateInput = z.infer<typeof knowledgeRelationCreateInputSchema>;

/**
 * Visual Node in the Knowledge Graph.
 */
export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  status?: string;
  sentiment?: NoteSentiment;
  authorName?: string;
  createdAt: string;
  originHref: string | null;
  connectionsCount: number;
  isHub: boolean;
  clusterId: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Visual Directed Edge in the Knowledge Graph.
 */
export interface GraphEdge {
  id: string;
  source: string; // fromObjectId
  target: string; // toObjectId
  relationType: KnowledgeRelationType;
  label: string;
  confidence: number;
  sourceKind: KnowledgeRelationSource;
  bidirectional: boolean;
}

/**
 * Overall Graph Summary & Metrics.
 */
export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  density: number; // 0.0 to 1.0
  clustersCount: number;
  isolatedCount: number;
  hubNodeId?: string;
  hubNodeLabel?: string;
}

/**
 * Complete Graph Dataset for rendering.
 */
export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: GraphMetrics;
  generatedAt: string;
}

export type GraphMode = 'explore' | 'focus' | 'path' | 'evidence';

/**
 * Pathfinding result in Path Mode.
 */
export interface PathFindingResult {
  found: boolean;
  path: string[]; // array of node IDs
  edges: GraphEdge[];
  distance: number;
  explanation: string;
}

/**
 * Bi-directional backlink reference.
 */
export interface BacklinkItem {
  relationId: string;
  sourceNodeId: string;
  sourceNodeType: GraphNodeType;
  sourceTitle: string;
  relationType: KnowledgeRelationType;
  confidence: number;
  originHref: string | null;
  createdAt: string;
  authorName?: string;
}

/**
 * AI-generated link suggestion.
 */
export interface AiLinkSuggestion {
  fromObjectId: string;
  fromObjectTitle?: string;
  toObjectId: string;
  toObjectTitle?: string;
  relationType: KnowledgeRelationType;
  confidenceScore: number; // 0.0 to 1.0
  reasoning: string;
  evidenceQuotes?: string[];
}

/**
 * Interactive filter state for Knowledge Graph.
 */
export interface KnowledgeGraphFilterOptions {
  nodeTypes?: GraphNodeType[];
  relationTypes?: KnowledgeRelationType[];
  searchQuery?: string;
  minConfidence?: number;
  clusterId?: string;
  showIsolated?: boolean;
  limit?: number;
}

/**
 * Backoffice Knowledge Graph Governance Configuration.
 */
export interface KnowledgeGraphGovernanceConfig {
  workspaceId: string;
  enabledRelationTypes: KnowledgeRelationType[];
  minAiConfidence: number;
  maxCandidatePool: number;
  allowUserCreatedRelations: boolean;
  autoBackfillCrmLinks: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_KNOWLEDGE_GRAPH_GOVERNANCE: Omit<
  KnowledgeGraphGovernanceConfig,
  'workspaceId' | 'updatedAt'
> = {
  enabledRelationTypes: [...KNOWLEDGE_RELATION_TYPES],
  minAiConfidence: 0.65,
  maxCandidatePool: 15,
  allowUserCreatedRelations: true,
  autoBackfillCrmLinks: true,
};


/* ==========================================================================
 * PHASE 6: IDEA INTELLIGENCE STUDIO & VISUAL IDEA MAPPING
 * ========================================================================== */

/**
 * 12-stage disciplined lifecycle state machine for Idea Intelligence.
 *
 * Directives:
 * - captured: Raw initial thought or suggestion.
 * - exploring: Active brainstorming and problem-solution fit formulation.
 * - structured: Problem, proposed solution, assumptions & hypotheses drafted.
 * - gathering_evidence: Collecting CRM call quotes, customer feedback, and telemetry.
 * - validating: Active experiment execution / hypothesis testing.
 * - validated: Sufficient empirical evidence proving hypotheses.
 * - approved: Formally greenlit by leadership/decision owner.
 * - implemented: Converted into live Tasks / Deals / Campaigns.
 * - measured: Post-launch impact analyzed against metric targets.
 * - archived: Retained for organizational memory.
 * - rejected: Formally disqualified with rationale preserved.
 * - superseded: Replaced by a newer idea iteration.
 */
export type IdeaLifecycleStage =
  | 'captured'
  | 'exploring'
  | 'structured'
  | 'gathering_evidence'
  | 'validating'
  | 'validated'
  | 'approved'
  | 'implemented'
  | 'measured'
  | 'archived'
  | 'rejected'
  | 'superseded';

export type IdeaValidationStatus =
  | 'unvalidated'
  | 'testing'
  | 'supported'
  | 'validated'
  | 'invalidated';

export type IdeaPriority = 'low' | 'medium' | 'high' | 'urgent';

export type IdeaAssumptionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IdeaAssumptionStatus = 'untested' | 'validating' | 'supported' | 'invalidated';

/**
 * An underlying premise or assumption required for an Idea to succeed.
 */
export interface IdeaAssumption {
  id: string;
  statement: string;
  riskLevel: IdeaAssumptionRiskLevel;
  status: IdeaAssumptionStatus;
  evidenceIds: string[]; // References to KnowledgeRelation or QuickNote IDs
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type IdeaHypothesisStatus = 'draft' | 'testing' | 'proven' | 'disproven';

/**
 * A testable scientific hypothesis: "If we [action], then [metric change], because [rationale]".
 */
export interface IdeaHypothesis {
  id: string;
  statement: string;
  action: string;
  expectedOutcome: string;
  metricTarget?: string;
  status: IdeaHypothesisStatus;
  evidenceIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type IdeaExperimentStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

/**
 * An empirical test or validation sprint designed to test hypotheses.
 */
export interface IdeaExperiment {
  id: string;
  name: string;
  description?: string;
  hypothesisId?: string;
  startDate?: string;
  endDate?: string;
  status: IdeaExperimentStatus;
  metricsTracked?: string;
  resultsSummary?: string;
  createdAt: string;
}

export type IdeaDecisionStatus = 'proposed' | 'approved' | 'superseded';

/**
 * An authoritative governance decision made regarding an Idea.
 */
export interface IdeaDecision {
  id: string;
  title: string;
  rationale?: string;
  decisionMakerId: string;
  decisionMakerName?: string;
  decidedAt: string;
  status: IdeaDecisionStatus;
  alternativesConsidered?: string[];
}

/**
 * Node types for the visual Idea Canvas graph editor.
 */
export type IdeaCanvasNodeType =
  | 'core_idea'
  | 'problem'
  | 'solution'
  | 'assumption'
  | 'hypothesis'
  | 'evidence'
  | 'experiment'
  | 'crm_entity';

export interface IdeaCanvasNode {
  id: string;
  type: IdeaCanvasNodeType;
  title: string;
  description?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status?: string;
  riskLevel?: string;
  color?: string;
  referenceId?: string; // Links to underlying assumption/hypothesis/entity ID
  confidence?: number;
}

export interface IdeaCanvasEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string; // e.g. 'solves', 'requires', 'tested_by', 'supported_by', 'about'
  type?: 'default' | 'dashed' | 'strong';
  color?: string;
}

export interface IdeaCanvasLayout {
  nodes: IdeaCanvasNode[];
  edges: IdeaCanvasEdge[];
  zoomLevel: number;
  panOffset: { x: number; y: number };
  lastSavedAt: string;
}

/**
 * First-Class Idea Entity in Company Brain 2.0.
 */
export interface Idea {
  id: string;
  organizationId?: string;
  workspaceId: string;
  /** 1:1 linked QuickNote / Knowledge Object ID */
  knowledgeObjectId: string;
  title: string;
  summary?: string;
  problem?: string;
  proposedSolution?: string;
  targetAudience?: QuickNoteLinks;
  assumptions: IdeaAssumption[];
  hypotheses: IdeaHypothesis[];
  experiments: IdeaExperiment[];
  decisions: IdeaDecision[];
  evidenceIds: string[];
  impact: number; // 1 to 10
  effort: number; // 1 to 10
  confidence: number; // 1 to 10
  /** Computed prioritization score */
  iceScore: number;
  validationStatus: IdeaValidationStatus;
  lifecycleStage: IdeaLifecycleStage;
  priority: IdeaPriority;
  tags: string[];
  relatedIdeaIds: string[];
  canvasLayout?: IdeaCanvasLayout;
  convertedTaskId?: string;
  convertedDealId?: string;
  convertedCampaignId?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 4 Quadrants of the 2D Impact vs Effort Matrix.
 */
export type IceQuadrantType =
  | 'quick_wins' // High Impact (>=6), Low Effort (<=5)
  | 'strategic_bets' // High Impact (>=6), High Effort (>=6)
  | 'fill_ins' // Low Impact (<=5), Low Effort (<=5)
  | 'hard_slogs'; // Low Impact (<=5), High Effort (>=6)

export type PrioritizationFormula = 'standard_ice' | 'weighted_ice' | 'value_effort';

export interface IdeaFilterOptions {
  lifecycleStage?: IdeaLifecycleStage | 'all';
  validationStatus?: IdeaValidationStatus | 'all';
  priority?: IdeaPriority | 'all';
  quadrant?: IceQuadrantType | 'all';
  searchQuery?: string;
  tags?: string[];
  entityId?: string;
  minIceScore?: number;
  createdBy?: string;
}

export interface IdeaValidationSummary {
  totalAssumptions: number;
  supportedAssumptions: number;
  invalidatedAssumptions: number;
  totalHypotheses: number;
  provenHypotheses: number;
  totalEvidenceCount: number;
  validationPercentage: number;
}

export interface CreateIdeaPayload {
  title: string;
  summary?: string;
  problem?: string;
  proposedSolution?: string;
  targetAudience?: QuickNoteLinks;
  impact?: number;
  effort?: number;
  confidence?: number;
  priority?: IdeaPriority;
  tags?: string[];
  lifecycleStage?: IdeaLifecycleStage;
  assumptions?: Array<Omit<IdeaAssumption, 'id' | 'createdAt'>>;
  hypotheses?: Array<Omit<IdeaHypothesis, 'id' | 'createdAt'>>;
  knowledgeObjectId?: string;
}

export interface UpdateIdeaPayload {
  title?: string;
  summary?: string;
  problem?: string;
  proposedSolution?: string;
  targetAudience?: QuickNoteLinks;
  impact?: number;
  effort?: number;
  confidence?: number;
  priority?: IdeaPriority;
  lifecycleStage?: IdeaLifecycleStage;
  validationStatus?: IdeaValidationStatus;
  tags?: string[];
  assumptions?: IdeaAssumption[];
  hypotheses?: IdeaHypothesis[];
  experiments?: IdeaExperiment[];
  decisions?: IdeaDecision[];
  evidenceIds?: string[];
  canvasLayout?: IdeaCanvasLayout;
  convertedTaskId?: string;
  convertedDealId?: string;
  convertedCampaignId?: string;
}

export interface IdeaAiDeconstructionResult {
  title: string;
  problem: string;
  proposedSolution: string;
  assumptions: Array<{
    statement: string;
    riskLevel: IdeaAssumptionRiskLevel;
    notes?: string;
  }>;
  hypotheses: Array<{
    statement: string;
    action: string;
    expectedOutcome: string;
    metricTarget?: string;
  }>;
  estimatedImpact: number;
  estimatedEffort: number;
  estimatedConfidence: number;
  reasoning: string;
  targetAudienceHints?: string[];
}

export interface IdeaAssumptionChallengeResult {
  unstatedAssumptions: Array<{
    statement: string;
    riskLevel: IdeaAssumptionRiskLevel;
    potentialFailureMode: string;
  }>;
  criticalFlaws: string[];
  suggestedValidationExperiments: Array<{
    name: string;
    hypothesis: string;
    metricsToTrack: string;
  }>;
  overallRiskRating: 'low' | 'moderate' | 'high' | 'fatal';
}

/* ==========================================================================
 * PHASE 7: CONTEXT-AWARE AUTONOMOUS KNOWLEDGE COPILOT, INSIGHTS & GOVERNANCE
 * ========================================================================== */

/**
 * Categories of items entering the human-in-the-loop Knowledge Inbox review queue.
 */
export type KnowledgeInboxType =
  | 'classification'
  | 'link_suggestion'
  | 'duplicate_detection'
  | 'contradiction_detection'
  | 'ai_insight'
  | 'action_suggestion'
  | 'idea_suggestion';

/**
 * Review status of an item in the Knowledge Inbox.
 */
export type KnowledgeInboxStatus =
  | 'pending'
  | 'accepted'
  | 'dismissed'
  | 'merged'
  | 'investigating';

/**
 * Granular breakdown of a contradiction detected between two assertions or documents.
 */
export interface ContradictionDetails {
  thesis: {
    claim: string;
    sourceId: string;
    sourceTitle?: string;
    quote: string;
    sourceType?: string;
  };
  antithesis: {
    claim: string;
    sourceId: string;
    sourceTitle?: string;
    quote: string;
    sourceType?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  suggestedResolution?: string;
}

/**
 * Granular breakdown of a potential duplicate note detection.
 */
export interface DuplicateDetails {
  candidateNoteId: string;
  candidateTitle: string;
  candidateSnippet: string;
  similarityScore: number; // 0.0 to 1.0 (e.g. 0.94 = 94% similarity)
  overlappingTopics: string[];
  recommendedAction: 'merge' | 'link' | 'keep_separate';
}

/**
 * Proposed modification or metadata patch generated by AI.
 */
export interface SuggestedPatch {
  category?: string;
  tags?: string[];
  links?: QuickNoteLinks;
  relationType?: KnowledgeRelationType;
  targetObjectId?: string;
  targetObjectTitle?: string;
  actionTitle?: string;
  actionPriority?: 'low' | 'medium' | 'high' | 'urgent';
  proposedText?: string;
}

/**
 * Citation representing grounding evidence from a note or CRM artifact.
 */
export interface KnowledgeEvidenceCitation {
  sourceObjectId: string;
  sourceTitle?: string;
  sourceType?: string;
  textSnippet: string;
  relevanceScore?: number;
}

/**
 * A single item in the human-in-the-loop Knowledge Inbox queue.
 */
export interface KnowledgeInboxItem {
  id: string;
  workspaceId: string;
  type: KnowledgeInboxType;
  status: KnowledgeInboxStatus;
  title: string;
  description: string;
  sourceKnowledgeId: string;
  sourceKnowledgeTitle?: string;
  targetKnowledgeId?: string;
  targetKnowledgeTitle?: string;
  confidence: number; // 0.0 to 1.0
  evidence: KnowledgeEvidenceCitation[];
  suggestedPatch?: SuggestedPatch;
  contradictionDetails?: ContradictionDetails;
  duplicateDetails?: DuplicateDetails;
  createdBy: string; // e.g. 'ai_agent:insight' | 'ai_agent:governance' | userId
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * High-level executive categories of organizational knowledge insights.
 */
export type KnowledgeInsightType =
  | 'trend'
  | 'recurring_problem'
  | 'risk'
  | 'opportunity'
  | 'emerging_theme'
  | 'pattern';

/**
 * Severity level of an organizational insight.
 */
export type KnowledgeInsightSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Lifecycle status of an organizational insight.
 */
export type KnowledgeInsightStatus =
  | 'active'
  | 'resolved'
  | 'dismissed'
  | 'promoted_to_idea';

/**
 * Actionable 1-click execution suggested from an insight.
 */
export interface SuggestedInsightAction {
  id: string;
  label: string;
  actionType: 'create_task' | 'create_idea' | 'create_campaign_concept' | 'link_entities';
  payload?: Record<string, unknown>;
}

/**
 * An authoritative organizational intelligence insight displayed in the Insight Center.
 */
export interface KnowledgeInsight {
  id: string;
  workspaceId: string;
  type: KnowledgeInsightType;
  severity: KnowledgeInsightSeverity;
  title: string;
  summary: string;
  evidenceCount: number;
  evidenceSources: Array<{
    id: string;
    title: string;
    type: string;
    quote: string;
    date: string;
  }>;
  suggestedActions: SuggestedInsightAction[];
  status: KnowledgeInsightStatus;
  promotedIdeaId?: string;
  promotedTaskId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter options for the Knowledge Inbox queue.
 */
export interface InboxFilterOptions {
  type?: KnowledgeInboxType | 'all';
  status?: KnowledgeInboxStatus | 'all';
  searchQuery?: string;
  minConfidence?: number;
  sourceKnowledgeId?: string;
  limit?: number;
}

/**
 * Filter options for the Insight Center executive view.
 */
export interface InsightFilterOptions {
  type?: KnowledgeInsightType | 'all';
  severity?: KnowledgeInsightSeverity | 'all';
  status?: KnowledgeInsightStatus | 'all';
  searchQuery?: string;
  minEvidenceCount?: number;
  limit?: number;
}

/**
 * Strategy for merging duplicate notes into a unified document.
 */
export type MergeStrategy = 'concatenate' | 'append_summary' | 'keep_target_enrich_metadata';

/**
 * Governance and compliance check result for PII or sensitive disclosures.
 */
export interface GovernanceAuditResult {
  hasPiiRisk: boolean;
  piiItemsFound: string[];
  hasUnsupportedAssertions: boolean;
  unsupportedStatements: string[];
  complianceScore: number; // 0 to 100
  recommendations: string[];
}

/**
 * Section 8 Governance & Copilot settings configuration.
 */
export interface KnowledgeInsightGovernanceSettings {
  enableAutoScanner: boolean; // default true
  contradictionSensitivity: 'strict' | 'balanced' | 'permissive'; // default 'balanced'
  duplicateSimilarityThreshold: number; // 0.70 to 0.95 (default 0.80)
  autoDismissLowConfidence: boolean; // default true (< 0.60)
  enablePiiRedaction: boolean; // default true
  requiredReviewerRole: 'admin' | 'manager' | 'editor'; // default 'editor'
  scanFrequencyHours: number; // 1 to 72 (default 24)
}

// ============================================================================
// Phase 8: Campaign & Deal Intelligence Integration Types
// ============================================================================

/** Supported delivery channels for marketing campaign concepts. */
export type CampaignChannel = 'whatsapp' | 'sms' | 'email' | 'call_center';

/** Lifecycle status of a campaign concept entity. */
export type CampaignConceptStatus = 'draft' | 'approved' | 'deployed_to_campaign' | 'archived';

/** Categorization for sales & marketing customer objections. */
export type ObjectionCategory = 'pricing' | 'feature' | 'trust' | 'competitor' | 'timing' | 'general';

/**
 * Structured objection and verified rebuttal script grounded in customer notes.
 */
export interface ObjectionRebuttal {
  id: string;
  objection: string;
  rebuttal: string;
  counterProofPoints: string[];
  frequencyCount: number;
  sourceQuotes: string[];
  confidence: number;
}

/**
 * Campaign Concept entity generated from validated Ideas or customer feedback clusters.
 */
export interface CampaignConcept {
  id: string;
  workspaceId: string;
  title: string;
  targetAudience: string;
  targetPersonaSummary: string;
  valueProposition: string;
  valuePillars: string[];
  coreMessageHook: string;
  objectionRebuttals: ObjectionRebuttal[];
  recommendedChannels: CampaignChannel[];
  callToAction: string;
  sourceIdeaId?: string;
  sourceIdeaTitle?: string;
  sourceInsightIds?: string[];
  sourceKnowledgeIds: string[];
  status: CampaignConceptStatus;
  deployedCampaignId?: string;
  deployedAt?: string;
  relevanceScore?: number; // 0 to 100
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tactical objection battlecard used by sales reps on calls and marketers designing copy.
 */
export interface ObjectionBattlecard {
  id: string;
  workspaceId: string;
  topic: string;
  category: ObjectionCategory;
  objection: string;
  rebuttalScript: string;
  killerQuestion: string;
  proofPoints: string[];
  frequencyScore: number;
  sourceNoteIds: string[];
  sourceQuotes?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * In-memory cluster of recurring customer objections.
 */
export interface ObjectionCluster {
  topic: string;
  category: ObjectionCategory;
  quotes: string[];
  sourceNoteIds: string[];
  count: number;
}

/**
 * Filtering options for Campaign Intelligence views.
 */
export interface CampaignConceptFilterOptions {
  status?: CampaignConceptStatus | 'all';
  channel?: CampaignChannel | 'all';
  searchQuery?: string;
  sourceIdeaId?: string;
  sortBy?: 'createdAt' | 'relevanceScore' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Section 9 Campaign & Deal Intelligence settings configuration.
 */
export interface CampaignIntelligenceGovernanceSettings {
  enableAutoConceptGeneration: boolean;
  defaultChannelMix: CampaignChannel[];
  minObjectionConfidence: number;
  minCorroboratingNotes: number;
  aiBattlecardTemperature: number;
  autoSyncCampaignLearnings: boolean;
}




