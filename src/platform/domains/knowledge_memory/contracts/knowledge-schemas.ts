/**
 * @fileOverview Canonical Knowledge Domain Schemas & Contracts (Phase 11 M3 · T0)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 10 (Strict Typing),
 * Rule 13 (Untrusted external inputs), Rule 17 (Non-delegable human decider),
 * Rule 29 (Temporal supersession metadata), Rule 55 (Graph ceilings <= 80 nodes).
 */

import { z } from 'zod/v4';

// ============================================================================
// Enums & Primitive Value Objects
// ============================================================================

export const KNOWLEDGE_CANDIDATE_SOURCE_TYPES = [
  'meeting',
  'note',
  'agent',
  'agent_run',
  'document',
  'manual',
] as const;
export type KnowledgeCandidateSourceType = (typeof KNOWLEDGE_CANDIDATE_SOURCE_TYPES)[number];

export const KNOWLEDGE_CANDIDATE_TYPES = [
  'fact',
  'entity',
  'procedure',
  'preference',
  'policy',
  'relationship',
] as const;
export type KnowledgeCandidateType = (typeof KNOWLEDGE_CANDIDATE_TYPES)[number];

export const KNOWLEDGE_CANDIDATE_STATUSES = [
  'pending',
  'accepted',
  'rejected',
] as const;
export type KnowledgeCandidateStatus = (typeof KNOWLEDGE_CANDIDATE_STATUSES)[number];

export const KNOWLEDGE_VERIFICATION_STATES = [
  'unverified',
  'proposed',
  'verified',
  'rejected',
] as const;
export type KnowledgeVerificationState = (typeof KNOWLEDGE_VERIFICATION_STATES)[number];

export const KNOWLEDGE_SENSITIVITY_LEVELS = [
  'public',
  'internal',
  'confidential',
  'restricted',
] as const;
export type KnowledgeSensitivityLevel = (typeof KNOWLEDGE_SENSITIVITY_LEVELS)[number];

export const KNOWLEDGE_CONFLICT_TYPES = [
  'contradiction',
  'outdated',
  'duplicate',
  'policy_divergence',
] as const;
export type KnowledgeConflictType = (typeof KNOWLEDGE_CONFLICT_TYPES)[number];

export const KNOWLEDGE_CONFLICT_RESOLUTIONS = [
  'supersede_existing',
  'reject_candidate',
  'keep_both_distinct',
] as const;
export type KnowledgeConflictResolution = (typeof KNOWLEDGE_CONFLICT_RESOLUTIONS)[number];

export const KNOWLEDGE_DECISIONS = [
  'accept',
  'accept_with_edit',
  'reject',
] as const;
export type KnowledgeDecision = (typeof KNOWLEDGE_DECISIONS)[number];

// ============================================================================
// Source & Span Sub-schemas
// ============================================================================

export const KnowledgeCandidateSourceSchema = z.object({
  type: z.enum(KNOWLEDGE_CANDIDATE_SOURCE_TYPES),
  id: z.string().trim().min(1, 'Source ID is required'),
  span: z
    .object({
      start: z.number().int().min(0).optional(),
      end: z.number().int().min(0).optional(),
      text: z.string().optional(),
    })
    .optional(),
});
export type KnowledgeCandidateSource = z.infer<typeof KnowledgeCandidateSourceSchema>;

export const KnowledgeRelationshipSuggestionSchema = z.object({
  targetId: z.string().trim().min(1, 'Target ID is required'),
  predicate: z.string().trim().min(1, 'Predicate is required'),
  confidence: z.number().min(0).max(1).default(0.8),
});
export type KnowledgeRelationshipSuggestion = z.infer<typeof KnowledgeRelationshipSuggestionSchema>;

// ============================================================================
// 1. KnowledgeCandidateSchema (Stored in knowledge_inbox_candidates/{id})
// ============================================================================

export const KnowledgeCandidateSchema = z.object({
  id: z.string().trim().min(1, 'Candidate ID is required'),
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  source: KnowledgeCandidateSourceSchema,
  type: z.enum(KNOWLEDGE_CANDIDATE_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(300),
  content: z.string().trim().min(1, 'Content is required').max(10000),
  subjectRefs: z.array(z.string().trim().min(1)).default([]),
  suggestedRelationships: z.array(KnowledgeRelationshipSuggestionSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
  verificationState: z.enum(KNOWLEDGE_VERIFICATION_STATES).default('unverified'),
  sensitivity: z.enum(KNOWLEDGE_SENSITIVITY_LEVELS).default('internal'),
  status: z.enum(KNOWLEDGE_CANDIDATE_STATUSES).default('pending'),
  duplicateOfMemoryId: z.string().trim().min(1).optional(),
  conflictId: z.string().trim().min(1).optional(),
  version: z.number().int().min(1).default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decidedAt: z.string().datetime().optional(),
  decidedBy: z.string().trim().min(1).optional(),
  decisionReason: z.string().trim().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  supersededBy: z.string().optional(),
});
export type KnowledgeCandidate = z.infer<typeof KnowledgeCandidateSchema>;

// ============================================================================
// 2. ProposeCandidateInputSchema (Input for knowledge.propose_candidate)
// ============================================================================

export const ProposeCandidateInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  source: KnowledgeCandidateSourceSchema,
  type: z.enum(KNOWLEDGE_CANDIDATE_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(300),
  content: z.string().trim().min(1, 'Content is required').max(10000),
  subjectRefs: z.array(z.string().trim().min(1)).optional().default([]),
  suggestedRelationships: z.array(KnowledgeRelationshipSuggestionSchema).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  sensitivity: z.enum(KNOWLEDGE_SENSITIVITY_LEVELS).optional().default('internal'),
});
export type ProposeCandidateInput = z.input<typeof ProposeCandidateInputSchema>;

// ============================================================================
// 3. ReviewQueueDecideInputSchema (Human-only Rule 17 gate)
// ============================================================================

export const ReviewQueueDecideInputSchema = z.object({
  candidateId: z.string().trim().min(1, 'Candidate ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  decision: z.enum(KNOWLEDGE_DECISIONS),
  editedTitle: z.string().trim().min(1).max(300).optional(),
  editedContent: z.string().trim().min(1).max(10000).optional(),
  reason: z.string().trim().max(1000).optional(),
  version: z.number().int().min(1, 'Expected version is required for concurrency control'),
});
export type ReviewQueueDecideInput = z.infer<typeof ReviewQueueDecideInputSchema>;

// ============================================================================
// 4. KnowledgeConflictSchema (Stored in memory_conflicts/{id})
// ============================================================================

export const KnowledgeConflictResolutionSchema = z.object({
  resolutionType: z.enum(KNOWLEDGE_CONFLICT_RESOLUTIONS),
  resolvedBy: z.string().trim().min(1),
  resolvedAt: z.string().datetime(),
  notes: z.string().trim().max(1000).optional(),
});
export type KnowledgeConflictResolutionData = z.infer<typeof KnowledgeConflictResolutionSchema>;

export const KnowledgeConflictSchema = z.object({
  id: z.string().trim().min(1, 'Conflict ID is required'),
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  candidateId: z.string().trim().min(1, 'Candidate ID is required'),
  existingMemoryId: z.string().trim().min(1, 'Existing Memory ID is required'),
  conflictType: z.enum(KNOWLEDGE_CONFLICT_TYPES),
  status: z.enum(['open', 'resolved']).default('open'),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolution: KnowledgeConflictResolutionSchema.optional(),
  version: z.number().int().min(1).default(1),
});
export type KnowledgeConflict = z.infer<typeof KnowledgeConflictSchema>;

export const ResolveConflictInputSchema = z.object({
  conflictId: z.string().trim().min(1, 'Conflict ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  resolution: z.enum(KNOWLEDGE_CONFLICT_RESOLUTIONS),
  notes: z.string().trim().max(1000).optional(),
  version: z.number().int().min(1, 'Expected version is required for concurrency control'),
});
export type ResolveConflictInput = z.infer<typeof ResolveConflictInputSchema>;

// ============================================================================
// 5. Graph Query Schemas (Rule 55: maxNodes <= 80, maxDepth <= 2 or 3)
// ============================================================================

export const GraphNeighborQuerySchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  nodeId: z.string().trim().min(1, 'Node ID is required'),
  maxNodes: z.number().int().min(1).max(80, 'Graph query cannot exceed 80 nodes (Rule 55)').default(50),
  maxDepth: z.number().int().min(1).max(2, 'Neighbor query depth cannot exceed 2 (Rule 55)').default(1),
});
export type GraphNeighborQuery = z.infer<typeof GraphNeighborQuerySchema>;

export const GraphFindPathQuerySchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  sourceNodeId: z.string().trim().min(1, 'Source Node ID is required'),
  targetNodeId: z.string().trim().min(1, 'Target Node ID is required'),
  maxDepth: z.number().int().min(1).max(3, 'Path query depth cannot exceed 3 (Rule 55)').default(2),
  maxNodes: z.number().int().min(1).max(80, 'Graph query cannot exceed 80 nodes (Rule 55)').default(80),
});
export type GraphFindPathQuery = z.infer<typeof GraphFindPathQuerySchema>;

// ============================================================================
// 6. Citations & Claims Schemas (Phase 11 M4 · T0; Rule 47)
// ============================================================================

export const KNOWLEDGE_SOURCE_TYPES = [
  'memory',
  'meeting',
  'crm_note',
  'document',
] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KnowledgeCitationSchema = z.object({
  citationId: z.string().trim().min(1, 'Citation ID is required'),
  sourceId: z.string().trim().min(1, 'Source ID is required'),
  sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES),
  textSpan: z.string().trim().min(1, 'Citation text span is required'),
  relevanceScore: z.number().min(0).max(1).default(1.0),
});
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;

export const KnowledgeClaimSchema = z.object({
  claimText: z.string().trim().min(1, 'Claim text is required'),
  citationIds: z.array(z.string().trim().min(1)).min(1, 'Claim must have at least one citation span (Rule 47)'),
  confidence: z.number().min(0).max(1).default(0.9),
});
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;

// ============================================================================
// 7. Adaptive Retrieval Schemas (Phase 11 M4 · T0; Rules 8, 28, 29, 55, 56)
// ============================================================================

export const KnowledgeSearchHybridInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  query: z.string().trim().min(1, 'Search query is required').max(1000),
  vector: z.array(z.number()).optional(),
  entityId: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
  includeGraphNeighbors: z.boolean().optional().default(true),
  applyRecencyDecay: z.boolean().optional().default(true),
  halfLifeDays: z.number().positive().optional().default(30),
});
export type KnowledgeSearchHybridInput = z.infer<typeof KnowledgeSearchHybridInputSchema>;

export const AdaptiveRetrievalHitSchema = z.object({
  id: z.string().trim().min(1),
  sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES),
  title: z.string().trim().min(1),
  content: z.string(),
  denseRank: z.number().int().nullable().default(null),
  sparseRank: z.number().int().nullable().default(null),
  graphDistance: z.number().int().nullable().default(null),
  rrfScore: z.number(),
  temporalDecayMultiplier: z.number().min(0).max(1),
  verificationMultiplier: z.number(),
  finalScore: z.number(),
  sensitivity: z.enum(KNOWLEDGE_SENSITIVITY_LEVELS).default('internal'),
  verificationState: z.enum(KNOWLEDGE_VERIFICATION_STATES).default('unverified'),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AdaptiveRetrievalHit = z.infer<typeof AdaptiveRetrievalHitSchema>;

export const KnowledgeSearchHybridOutputSchema = z.object({
  hits: z.array(AdaptiveRetrievalHitSchema),
  totalFound: z.number().int(),
  includedCount: z.number().int(),
  omittedCount: z.number().int(),
  tokenCount: z.number().int(),
  durationMs: z.number(),
});
export type KnowledgeSearchHybridOutput = z.infer<typeof KnowledgeSearchHybridOutputSchema>;

// ============================================================================
// 8. Evidence Retrieval Schemas (Phase 11 M4 · T0; Rule 47)
// ============================================================================

export const KnowledgeGetEvidenceInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  memoryIds: z.array(z.string().trim().min(1)).min(1, 'At least one memory ID is required'),
});
export type KnowledgeGetEvidenceInput = z.infer<typeof KnowledgeGetEvidenceInputSchema>;

export const KnowledgeGetEvidenceOutputSchema = z.object({
  items: z.array(AdaptiveRetrievalHitSchema),
  missingIds: z.array(z.string()),
});
export type KnowledgeGetEvidenceOutput = z.infer<typeof KnowledgeGetEvidenceOutputSchema>;

export const KnowledgeGetCitationsInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  query: z.string().trim().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(20).optional().default(10),
});
export type KnowledgeGetCitationsInput = z.infer<typeof KnowledgeGetCitationsInputSchema>;

export const KnowledgeGetCitationsOutputSchema = z.object({
  citations: z.array(KnowledgeCitationSchema),
});
export type KnowledgeGetCitationsOutput = z.infer<typeof KnowledgeGetCitationsOutputSchema>;

// ============================================================================
// 9. Context Inclusion Explanation Schemas (Phase 11 M4 · T0; Rule 41)
// ============================================================================

export const ExplainContextInclusionInputSchema = z.object({
  organizationId: z.string().trim().min(1, 'Organization ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  query: z.string().trim().min(1, 'Query is required'),
  itemId: z.string().trim().min(1, 'Item ID is required'),
});
export type ExplainContextInclusionInput = z.infer<typeof ExplainContextInclusionInputSchema>;

export const ExplainContextInclusionOutputSchema = z.object({
  itemId: z.string().trim().min(1),
  included: z.boolean(),
  reason: z.string(),
  metrics: z.object({
    denseRank: z.number().int().nullable().optional(),
    sparseRank: z.number().int().nullable().optional(),
    graphHops: z.number().int().nullable().optional(),
    rrfScore: z.number(),
    recencyWeight: z.number(),
    verificationWeight: z.number(),
  }),
});
export type ExplainContextInclusionOutput = z.infer<typeof ExplainContextInclusionOutputSchema>;

// ============================================================================
// 10. Rule 47 Grounded Answer Contract Schema
// ============================================================================

export const KnowledgeAnswerCoverageSchema = z.enum([
  'complete',
  'partial',
  'no_evidence',
]);
export type KnowledgeAnswerCoverage = z.infer<typeof KnowledgeAnswerCoverageSchema>;

export const KnowledgeAnswerConflictSchema = z.object({
  factA: z.string(),
  factB: z.string(),
  reason: z.string(),
});
export type KnowledgeAnswerConflict = z.infer<typeof KnowledgeAnswerConflictSchema>;

export const KnowledgeAnswerContractSchema = z.object({
  query: z.string(),
  answer: z.string(),
  coverage: KnowledgeAnswerCoverageSchema,
  claims: z.array(KnowledgeClaimSchema),
  citations: z.array(KnowledgeCitationSchema),
  conflictsDetected: z.array(KnowledgeAnswerConflictSchema).default([]),
  contextSummary: z.object({
    totalFound: z.number().int(),
    includedCount: z.number().int(),
    omittedCount: z.number().int(),
    tokenCount: z.number().int(),
  }),
  citationPrecision: z.number().min(0).max(1),
});
export type KnowledgeAnswerContract = z.infer<typeof KnowledgeAnswerContractSchema>;

