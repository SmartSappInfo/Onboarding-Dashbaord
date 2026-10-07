/**
 * @fileOverview Governed Knowledge Domain Capabilities (Phase 11 M3 · T1 & T2)
 *
 * Implements Rule 11, Rule 12, Rule 16, Rule 17, Rule 18, Rule 19, Rule 31, Rule 69.
 *
 * Capabilities defined:
 * 1. knowledge.propose_candidate (L1_INTERNAL_DRAFT)
 * 2. knowledge.candidate.get (L0_READ)
 * 3. knowledge.candidate.list (L0_READ)
 * 4. knowledge.review_queue.decide (L2_STATE_MUTATION, Non-Delegable human-only decider)
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '@/platform/capabilities/contracts/capability-definition';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  KnowledgeCandidateSchema,
  ProposeCandidateInputSchema,
  ReviewQueueDecideInputSchema,
  KnowledgeConflictSchema,
  ResolveConflictInputSchema,
  GraphNeighborQuerySchema,
  GraphFindPathQuerySchema,
  KnowledgeSearchHybridInputSchema,
  KnowledgeSearchHybridOutputSchema,
  KnowledgeGetEvidenceInputSchema,
  KnowledgeGetEvidenceOutputSchema,
  KnowledgeGetCitationsInputSchema,
  KnowledgeGetCitationsOutputSchema,
  ExplainContextInclusionInputSchema,
  ExplainContextInclusionOutputSchema,
  type KnowledgeCandidate,
  type ProposeCandidateInput,
  type ReviewQueueDecideInput,
  type KnowledgeConflict,
  type ResolveConflictInput,
  type GraphNeighborQuery,
  type GraphFindPathQuery,
  type KnowledgeSearchHybridInput,
  type KnowledgeSearchHybridOutput,
  type KnowledgeGetEvidenceInput,
  type KnowledgeGetEvidenceOutput,
  type KnowledgeGetCitationsInput,
  type KnowledgeGetCitationsOutput,
  type ExplainContextInclusionInput,
  type ExplainContextInclusionOutput,
} from './knowledge-schemas';
import { getKnowledgeCandidateService } from '../services/knowledge-candidate-service';
import { getKnowledgeDeduplicationService } from '../services/knowledge-deduplication-service';
import { getKnowledgeConflictService } from '../services/knowledge-conflict-service';
import { getKnowledgeGraphProjectionService } from '../services/knowledge-graph-projection-service';
import { getKnowledgeAdaptiveRetriever } from '../services/knowledge-adaptive-retriever';
import { getKnowledgeAgentService } from '../services/knowledge-agent-service';

function ok<T>(data: T, context: CapabilityExecutionContext, startMs: number): CapabilityExecutionResult<T> {
  return {
    success: true,
    data,
    executionId: context.correlationId,
    emittedEvents: [],
    durationMs: Math.max(0, Date.now() - startMs),
  };
}

// ============================================================================
// 1. knowledge.propose_candidate (L1_INTERNAL_DRAFT)
// ============================================================================

export const knowledgeProposeCandidateCapability: CapabilityDefinition<
  ProposeCandidateInput,
  KnowledgeCandidate
> = {
  id: 'knowledge.propose_candidate',
  version: '1.0.0',
  name: 'Propose Knowledge Candidate',
  description: 'Proposes an extracted fact or insight into the knowledge review queue with untrusted XML isolation.',
  domain: 'knowledge_memory',
  operation: 'draft',
  inputSchema: ProposeCandidateInputSchema,
  outputSchema: KnowledgeCandidateSchema,
  permissions: ['knowledge:review'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['knowledge.candidate.proposed'],
    breakingChangePolicy: 'additive_only',
  },
  async handler(
    rawInput: ProposeCandidateInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidate>> {
    const startTime = Date.now();
    const input = ProposeCandidateInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const candidate = await service.proposeCandidate(input, {
      actorId: context.principal.userId,
      actorType: context.principal.actorType === 'agent' ? 'agent' : 'user',
    });

    return ok(candidate, context, startTime);
  },
};

// ============================================================================
// 2. knowledge.candidate.get (L0_READ)
// ============================================================================

export const KnowledgeCandidateGetInputSchema = z.object({
  candidateId: z.string().trim().min(1, 'Candidate ID is required'),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
});
export type KnowledgeCandidateGetInput = z.infer<typeof KnowledgeCandidateGetInputSchema>;

export const knowledgeCandidateGetCapability: CapabilityDefinition<
  KnowledgeCandidateGetInput,
  KnowledgeCandidate
> = {
  id: 'knowledge.candidate.get',
  version: '1.0.0',
  name: 'Get Knowledge Candidate',
  description: 'Retrieves a candidate by ID within tenant workspace boundary.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeCandidateGetInputSchema,
  outputSchema: KnowledgeCandidateSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeCandidateGetInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidate>> {
    const startTime = Date.now();
    const input = KnowledgeCandidateGetInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const candidate = await service.getCandidate(input.candidateId, input.workspaceId);

    return ok(candidate, context, startTime);
  },
};

// ============================================================================
// 3. knowledge.candidate.list (L0_READ)
// ============================================================================

export const KnowledgeCandidateListInputSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
export const KnowledgeCandidateListOutputSchema = z.object({
  candidates: z.array(KnowledgeCandidateSchema),
  totalCount: z.number().int(),
});
export type KnowledgeCandidateListInput = z.infer<typeof KnowledgeCandidateListInputSchema>;
export type KnowledgeCandidateListOutput = z.infer<typeof KnowledgeCandidateListOutputSchema>;

export const knowledgeCandidateListCapability: CapabilityDefinition<
  KnowledgeCandidateListInput,
  KnowledgeCandidateListOutput
> = {
  id: 'knowledge.candidate.list',
  version: '1.0.0',
  name: 'List Knowledge Candidates',
  description: 'Lists review queue candidates for a workspace.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeCandidateListInputSchema,
  outputSchema: KnowledgeCandidateListOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeCandidateListInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidateListOutput>> {
    const startTime = Date.now();
    const input = KnowledgeCandidateListInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const candidates = await service.listCandidates({
      workspaceId: input.workspaceId,
      status: input.status,
      limit: input.limit,
    });

    return ok(
      {
        candidates,
        totalCount: candidates.length,
      },
      context,
      startTime
    );
  },
};

// ============================================================================
// 4. knowledge.review_queue.decide (L2_STATE_MUTATION, Non-Delegable human-only)
// ============================================================================

export const knowledgeReviewQueueDecideCapability: CapabilityDefinition<
  ReviewQueueDecideInput,
  KnowledgeCandidate
> = {
  id: 'knowledge.review_queue.decide',
  version: '1.0.0',
  name: 'Decide Knowledge Candidate',
  description: 'Reviews, edits, accepts or rejects a candidate in the knowledge review queue. Strictly non-delegable to AI agents (Rule 17).',
  domain: 'knowledge_memory',
  operation: 'update',
  inputSchema: ReviewQueueDecideInputSchema,
  outputSchema: KnowledgeCandidateSchema,
  permissions: ['knowledge:review'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: false,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: true,
    auditRequired: true,
    defaultEnabled: true,
  },
  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['knowledge.candidate.decided'],
    breakingChangePolicy: 'additive_only',
  },
  async handler(
    rawInput: ReviewQueueDecideInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidate>> {
    const startTime = Date.now();
    const input = ReviewQueueDecideInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const decided = await service.decideCandidate(input, {
      id: context.principal.userId,
      type: context.principal.actorType === 'agent' ? 'agent' : 'user',
    });

    return ok(decided, context, startTime);
  },
};

// ============================================================================
// 5. knowledge.deduplicate_candidate (L0_READ)
// ============================================================================

export const KnowledgeDeduplicateInputSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  title: z.string().trim().min(1, 'Title is required'),
  content: z.string().trim().min(1, 'Content is required'),
});
export const KnowledgeDeduplicateOutputSchema = z.object({
  isDuplicate: z.boolean(),
  similarity: z.number(),
  duplicateOfMemoryId: z.string().optional(),
  reason: z.string().optional(),
});
export type KnowledgeDeduplicateInput = z.infer<typeof KnowledgeDeduplicateInputSchema>;
export type KnowledgeDeduplicateOutput = z.infer<typeof KnowledgeDeduplicateOutputSchema>;

export const knowledgeDeduplicateCandidateCapability: CapabilityDefinition<
  KnowledgeDeduplicateInput,
  KnowledgeDeduplicateOutput
> = {
  id: 'knowledge.deduplicate_candidate',
  version: '1.0.0',
  name: 'Deduplicate Knowledge Candidate',
  description: 'Checks candidate content against existing memory objects for exact and high-similarity duplicates.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeDeduplicateInputSchema,
  outputSchema: KnowledgeDeduplicateOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeDeduplicateInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeDeduplicateOutput>> {
    const startTime = Date.now();
    const input = KnowledgeDeduplicateInputSchema.parse(rawInput);
    const dedupService = getKnowledgeDeduplicationService();
    const result = await dedupService.deduplicateCandidate(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 6. knowledge.conflict.list (L0_READ)
// ============================================================================

export const KnowledgeConflictListInputSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  status: z.enum(['open', 'resolved']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
export const KnowledgeConflictListOutputSchema = z.object({
  conflicts: z.array(KnowledgeConflictSchema),
  totalCount: z.number().int(),
});
export type KnowledgeConflictListInput = z.infer<typeof KnowledgeConflictListInputSchema>;
export type KnowledgeConflictListOutput = z.infer<typeof KnowledgeConflictListOutputSchema>;

export const knowledgeConflictListCapability: CapabilityDefinition<
  KnowledgeConflictListInput,
  KnowledgeConflictListOutput
> = {
  id: 'knowledge.conflict.list',
  version: '1.0.0',
  name: 'List Knowledge Conflicts',
  description: 'Lists open or resolved memory conflicts for a workspace.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeConflictListInputSchema,
  outputSchema: KnowledgeConflictListOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeConflictListInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeConflictListOutput>> {
    const startTime = Date.now();
    const input = KnowledgeConflictListInputSchema.parse(rawInput);
    const conflictService = getKnowledgeConflictService();
    const conflicts = await conflictService.listConflicts(input);

    return ok(
      {
        conflicts,
        totalCount: conflicts.length,
      },
      context,
      startTime
    );
  },
};

// ============================================================================
// 7. knowledge.conflict.resolve (L2_STATE_MUTATION, Non-Delegable human-only)
// ============================================================================

export const knowledgeConflictResolveCapability: CapabilityDefinition<
  ResolveConflictInput,
  KnowledgeConflict
> = {
  id: 'knowledge.conflict.resolve',
  version: '1.0.0',
  name: 'Resolve Knowledge Conflict',
  description: 'Resolves an open memory contradiction. Strictly non-delegable to AI agents (Rule 17).',
  domain: 'knowledge_memory',
  operation: 'update',
  inputSchema: ResolveConflictInputSchema,
  outputSchema: KnowledgeConflictSchema,
  permissions: ['knowledge:review'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: false,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: true,
    auditRequired: true,
    defaultEnabled: true,
  },
  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['knowledge.conflict.resolved'],
    breakingChangePolicy: 'additive_only',
  },
  async handler(
    rawInput: ResolveConflictInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeConflict>> {
    const startTime = Date.now();
    const input = ResolveConflictInputSchema.parse(rawInput);
    const conflictService = getKnowledgeConflictService();
    const resolved = await conflictService.resolveConflict(input, {
      id: context.principal.userId,
      type: context.principal.actorType === 'agent' ? 'agent' : 'user',
    });

    return ok(resolved, context, startTime);
  },
};

// ============================================================================
// 8. knowledge.graph.get_neighbors (L0_READ, Rule 55 Clamped)
// ============================================================================

export const KnowledgeGraphGetNeighborsOutputSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      relationship: z.string(),
    })
  ),
});
export type KnowledgeGraphGetNeighborsOutput = z.infer<typeof KnowledgeGraphGetNeighborsOutputSchema>;

export const knowledgeGraphGetNeighborsCapability: CapabilityDefinition<
  GraphNeighborQuery,
  KnowledgeGraphGetNeighborsOutput
> = {
  id: 'knowledge.graph.get_neighbors',
  version: '1.0.0',
  name: 'Get Knowledge Graph Neighbors',
  description: 'Traverses neighboring nodes in the knowledge graph. Clamped to <= 80 nodes, <= 150 edges, depth <= 2 (Rule 55).',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: GraphNeighborQuerySchema,
  outputSchema: KnowledgeGraphGetNeighborsOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: GraphNeighborQuery,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeGraphGetNeighborsOutput>> {
    const startTime = Date.now();
    const input = GraphNeighborQuerySchema.parse(rawInput);
    const graphService = getKnowledgeGraphProjectionService();
    const result = await graphService.getNeighbors(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 9. knowledge.graph.find_path (L0_READ, Rule 55 Clamped)
// ============================================================================

export const KnowledgeGraphFindPathOutputSchema = z.object({
  pathFound: z.boolean(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      relationship: z.string(),
    })
  ),
});
export type KnowledgeGraphFindPathOutput = z.infer<typeof KnowledgeGraphFindPathOutputSchema>;

export const knowledgeGraphFindPathCapability: CapabilityDefinition<
  GraphFindPathQuery,
  KnowledgeGraphFindPathOutput
> = {
  id: 'knowledge.graph.find_path',
  version: '1.0.0',
  name: 'Find Path in Knowledge Graph',
  description: 'Finds connection path between two graph nodes. MaxDepth <= 3, MaxNodes <= 80 (Rule 55).',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: GraphFindPathQuerySchema,
  outputSchema: KnowledgeGraphFindPathOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 8_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: GraphFindPathQuery,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeGraphFindPathOutput>> {
    const startTime = Date.now();
    const input = GraphFindPathQuerySchema.parse(rawInput);
    const graphService = getKnowledgeGraphProjectionService();
    const result = await graphService.findPath(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 10. knowledge.search_hybrid (L0_READ)
// ============================================================================

export const knowledgeSearchHybridCapability: CapabilityDefinition<
  KnowledgeSearchHybridInput,
  KnowledgeSearchHybridOutput
> = {
  id: 'knowledge.search_hybrid',
  version: '1.0.0',
  name: 'Search Knowledge Hybrid',
  description: 'Adaptive tri-modal retrieval fusing dense vector similarity, sparse BM25, and relational graph.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeSearchHybridInputSchema,
  outputSchema: KnowledgeSearchHybridOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15_000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeSearchHybridInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeSearchHybridOutput>> {
    const startTime = Date.now();
    const input = KnowledgeSearchHybridInputSchema.parse(rawInput);
    const retriever = getKnowledgeAdaptiveRetriever();
    const result = await retriever.searchHybrid(input, {
      callerPermissions: context.callerPermissions,
    });

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 11. knowledge.get_evidence (L0_READ)
// ============================================================================

export const knowledgeGetEvidenceCapability: CapabilityDefinition<
  KnowledgeGetEvidenceInput,
  KnowledgeGetEvidenceOutput
> = {
  id: 'knowledge.get_evidence',
  version: '1.0.0',
  name: 'Get Knowledge Evidence',
  description: 'Retrieves specific evidence items by their IDs, enforcing multi-tenant boundaries.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeGetEvidenceInputSchema,
  outputSchema: KnowledgeGetEvidenceOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeGetEvidenceInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeGetEvidenceOutput>> {
    const startTime = Date.now();
    const input = KnowledgeGetEvidenceInputSchema.parse(rawInput);
    const service = getKnowledgeAgentService();
    const result = await service.getEvidence(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 12. knowledge.get_citations (L0_READ)
// ============================================================================

export const knowledgeGetCitationsCapability: CapabilityDefinition<
  KnowledgeGetCitationsInput,
  KnowledgeGetCitationsOutput
> = {
  id: 'knowledge.get_citations',
  version: '1.0.0',
  name: 'Get Knowledge Citations',
  description: 'Retrieves verified citation spans for a query.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: KnowledgeGetCitationsInputSchema,
  outputSchema: KnowledgeGetCitationsOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: KnowledgeGetCitationsInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeGetCitationsOutput>> {
    const startTime = Date.now();
    const input = KnowledgeGetCitationsInputSchema.parse(rawInput);
    const service = getKnowledgeAgentService();
    const result = await service.getCitations(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// 13. context.explain_inclusion (L0_READ)
// ============================================================================

export const contextExplainInclusionCapability: CapabilityDefinition<
  ExplainContextInclusionInput,
  ExplainContextInclusionOutput
> = {
  id: 'context.explain_inclusion',
  version: '1.0.0',
  name: 'Explain Context Inclusion',
  description: 'Provides mathematical explainability (RRF score, ranks, recency, verification) for context inclusion.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: ExplainContextInclusionInputSchema,
  outputSchema: ExplainContextInclusionOutputSchema,
  permissions: ['knowledge:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10_000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 512 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  async handler(
    rawInput: ExplainContextInclusionInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ExplainContextInclusionOutput>> {
    const startTime = Date.now();
    const input = ExplainContextInclusionInputSchema.parse(rawInput);
    const retriever = getKnowledgeAdaptiveRetriever();
    const result = await retriever.explainInclusion(input);

    return ok(result, context, startTime);
  },
};

// ============================================================================
// Auto-registration on module load (Rule 69)
// ============================================================================

registerCapability(knowledgeProposeCandidateCapability, { allowOverride: true });
registerCapability(knowledgeCandidateGetCapability, { allowOverride: true });
registerCapability(knowledgeCandidateListCapability, { allowOverride: true });
registerCapability(knowledgeReviewQueueDecideCapability, { allowOverride: true });
registerCapability(knowledgeDeduplicateCandidateCapability, { allowOverride: true });
registerCapability(knowledgeConflictListCapability, { allowOverride: true });
registerCapability(knowledgeConflictResolveCapability, { allowOverride: true });
registerCapability(knowledgeGraphGetNeighborsCapability, { allowOverride: true });
registerCapability(knowledgeGraphFindPathCapability, { allowOverride: true });
registerCapability(knowledgeSearchHybridCapability, { allowOverride: true });
registerCapability(knowledgeGetEvidenceCapability, { allowOverride: true });
registerCapability(knowledgeGetCitationsCapability, { allowOverride: true });
registerCapability(contextExplainInclusionCapability, { allowOverride: true });
