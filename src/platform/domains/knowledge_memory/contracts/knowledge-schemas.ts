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
export type ProposeCandidateInput = z.infer<typeof ProposeCandidateInputSchema>;

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
