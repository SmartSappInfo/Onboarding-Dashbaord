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
  type KnowledgeCandidate,
  type ProposeCandidateInput,
  type ReviewQueueDecideInput,
  type KnowledgeConflict,
  type ResolveConflictInput,
} from './knowledge-schemas';
import { getKnowledgeCandidateService } from '../services/knowledge-candidate-service';
import { getKnowledgeDeduplicationService } from '../services/knowledge-deduplication-service';
import { getKnowledgeConflictService } from '../services/knowledge-conflict-service';

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
      actorId: context.principal.id,
      actorType: context.principal.type === 'agent' ? 'agent' : 'user',
    });

    return {
      success: true,
      output: candidate,
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidate>> {
    const startTime = Date.now();
    const input = KnowledgeCandidateGetInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const candidate = await service.getCandidate(input.candidateId, input.workspaceId);

    return {
      success: true,
      output: candidate,
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeCandidateListOutput>> {
    const startTime = Date.now();
    const input = KnowledgeCandidateListInputSchema.parse(rawInput);
    const service = getKnowledgeCandidateService();
    const candidates = await service.listCandidates({
      workspaceId: input.workspaceId,
      status: input.status,
      limit: input.limit,
    });

    return {
      success: true,
      output: {
        candidates,
        totalCount: candidates.length,
      },
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
      id: context.principal.id,
      type: context.principal.type === 'agent' ? 'agent' : 'user',
    });

    return {
      success: true,
      output: decided,
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeDeduplicateOutput>> {
    const startTime = Date.now();
    const input = KnowledgeDeduplicateInputSchema.parse(rawInput);
    const dedupService = getKnowledgeDeduplicationService();
    const result = await dedupService.deduplicateCandidate(input);

    return {
      success: true,
      output: result,
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<KnowledgeConflictListOutput>> {
    const startTime = Date.now();
    const input = KnowledgeConflictListInputSchema.parse(rawInput);
    const conflictService = getKnowledgeConflictService();
    const conflicts = await conflictService.listConflicts(input);

    return {
      success: true,
      output: {
        conflicts,
        totalCount: conflicts.length,
      },
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
      id: context.principal.id,
      type: context.principal.type === 'agent' ? 'agent' : 'user',
    });

    return {
      success: true,
      output: resolved,
      metadata: {
        durationMs: Date.now() - startTime,
      },
    };
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
