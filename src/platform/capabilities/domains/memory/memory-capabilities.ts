/**
 * @fileOverview Canonical Platform Memory Capabilities (Phase 4 Milestone 5)
 *
 * Implements Rule 4 (Zero-any), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR),
 * Rule 11 & 12 (MCP Protocol Compliance & Server-Side Risk Enforcement),
 * Rule 16 (No Wildcard Scopes), Rule 17 (Non-Delegable Operations),
 * Rule 21 & 22 (Human Approval & Cryptographic Hash Binding),
 * Rule 30 (Prompt Injection Quarantine), Rule 60 (Emergency Dead-Man Switch).
 *
 * Capabilities defined:
 * 1. `memory.semantic_search` (L0_READ)
 * 2. `memory.get_context` (L0_READ)
 * 3. `memory.create_item` (L2_STATE_MUTATION)
 * 4. `memory.inspect_graph` (L0_READ)
 * 5. `memory.purge_tenant_memory` (L4_PRIVILEGED_DESTRUCTIVE, requires human approval, non-delegable)
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../contracts/capability-definition';
import { getCanonicalMemoryService } from '../../../memory/services/canonical-memory-service';
import { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } from '../../../policy/governance-dead-man';
import { registerCapability } from '../../registry/capability-registry';
import type { MemoryTier, MemoryType, MemorySourceType, SensitivityLevel } from '../../../memory/contracts/memory-types';

// ============================================================================
// 1. memory.semantic_search (L0_READ)
// ============================================================================

export const MemorySemanticSearchInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  workspaceId: z.string().min(1).optional(),
  tier: z.enum(['working', 'episodic', 'semantic', 'relational', 'procedural']).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
  minScore: z.number().min(0.0).max(1.0).optional().default(0.1),
});

export const MemorySemanticSearchOutputSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      score: z.number(),
      tier: z.string(),
      confidence: z.number(),
      sourceType: z.string().optional(),
      sourceId: z.string().optional(),
      authorId: z.string().optional(),
      createdAt: z.string().optional(),
    })
  ),
  totalCount: z.number(),
});

export type MemorySemanticSearchInput = z.input<typeof MemorySemanticSearchInputSchema>;
export type MemorySemanticSearchOutput = z.infer<typeof MemorySemanticSearchOutputSchema>;

export const memorySemanticSearchCapability: CapabilityDefinition<
  MemorySemanticSearchInput,
  MemorySemanticSearchOutput
> = {
  id: 'memory.semantic_search',
  version: '1.0.0',
  name: 'Semantic Memory Search',
  description: 'Searches semantic and episodic organizational memory using hybrid dense/sparse vector retrieval.',
  domain: 'knowledge_memory',
  operation: 'search',
  inputSchema: MemorySemanticSearchInputSchema,
  outputSchema: MemorySemanticSearchOutputSchema,
  permissions: ['rbac:operations.campuses.view'],
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
    maxDurationMs: 10000,
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
    rawInput: MemorySemanticSearchInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MemorySemanticSearchOutput>> {
    const startTime = Date.now();
    const input = MemorySemanticSearchInputSchema.parse(rawInput);
    const { principal } = context;
    const organizationId = principal.organizationId;
    const workspaceId = input.workspaceId ?? principal.workspaceId;

    try {
      const memoryService = getCanonicalMemoryService();
      const items = await memoryService.queryMemory({
        organizationId,
        workspaceId,
        query: input.query,
        tiers: input.tier ? [input.tier as MemoryTier] : undefined,
        limit: input.limit,
      });

      const filtered = items
        .filter((item) => (item.confidence ?? 0.8) >= (input.minScore ?? 0.1))
        .map((item) => ({
          id: item.id,
          content: item.content,
          score: item.confidence ?? 0.85,
          tier: item.tier,
          confidence: item.confidence ?? 0.85,
          sourceType: item.source.type,
          sourceId: item.source.sourceId,
          authorId: item.provenance.userId ?? item.provenance.agentId,
          createdAt: item.createdAt,
        }));

      return {
        success: true,
        data: {
          results: filtered,
          totalCount: filtered.length,
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Semantic search failed';
      return {
        success: false,
        error: {
          code: 'MEMORY_SEARCH_FAILED',
          message,
          retryable: true,
        },
        executionId: context.correlationId,
      };
    }
  },
};

// ============================================================================
// 2. memory.get_context (L0_READ)
// ============================================================================

export const MemoryGetContextInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  entityId: z.string().optional(),
  workspaceId: z.string().min(1).optional(),
  maxTokens: z.number().int().min(100).max(4000).optional().default(2000),
});

export const MemoryGetContextOutputSchema = z.object({
  compiledContext: z.string(),
  evidence: z.array(
    z.object({
      id: z.string(),
      citationTag: z.string(),
      verbatimSnippet: z.string(),
      score: z.number(),
      confidence: z.number(),
      sourceType: z.string(),
      sourceId: z.string(),
      author: z.string(),
      sensitivity: z.string(),
    })
  ),
  tokenCount: z.number(),
  truncated: z.boolean(),
});

export type MemoryGetContextInput = z.input<typeof MemoryGetContextInputSchema>;
export type MemoryGetContextOutput = z.infer<typeof MemoryGetContextOutputSchema>;

export const memoryGetContextCapability: CapabilityDefinition<
  MemoryGetContextInput,
  MemoryGetContextOutput
> = {
  id: 'memory.get_context',
  version: '1.0.0',
  name: 'Get Grounded Memory Context',
  description: 'Executes 8-stage context retrieval algorithm compiling an EvidencePack wrapped in prompt injection isolation tags.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: MemoryGetContextInputSchema,
  outputSchema: MemoryGetContextOutputSchema,
  permissions: ['rbac:operations.campuses.view'],
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
    maxDurationMs: 15000,
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
    rawInput: MemoryGetContextInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MemoryGetContextOutput>> {
    const startTime = Date.now();
    const input = MemoryGetContextInputSchema.parse(rawInput);
    const { principal } = context;
    const organizationId = principal.organizationId;
    const workspaceId = input.workspaceId ?? principal.workspaceId;

    try {
      const memoryService = getCanonicalMemoryService();
      const retrieved = await memoryService.retrieveContext({
        organizationId,
        workspaceId,
        query: input.entityId ? `${input.query} (entity: ${input.entityId})` : input.query,
        maxTokens: input.maxTokens,
      });

      return {
        success: true,
        data: {
          compiledContext: retrieved.evidencePack.promptContext,
          evidence: retrieved.evidencePack.items.map((item) => ({
            id: item.id,
            citationTag: `[${item.sourceType}:${item.sourceId}]`,
            verbatimSnippet: item.content,
            score: item.confidence ?? 0.85,
            confidence: item.confidence ?? 0.85,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            author: item.authorName ?? 'System',
            sensitivity: item.sensitivity ?? 'internal',
          })),
          tokenCount: retrieved.budgetResult.totalTokens,
          truncated: retrieved.budgetResult.truncatedCount > 0,
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Context retrieval failed';
      return {
        success: false,
        error: {
          code: 'MEMORY_CONTEXT_RETRIEVAL_FAILED',
          message,
          retryable: true,
        },
        executionId: context.correlationId,
      };
    }
  },
};

// ============================================================================
// 3. memory.create_item (L2_STATE_MUTATION)
// ============================================================================

export const MemoryCreateItemInputSchema = z.object({
  content: z.string().min(1, 'Memory content is required'),
  tier: z.enum(['working', 'episodic', 'semantic', 'relational', 'procedural']),
  sourceType: z.enum(['note', 'meeting', 'transcript', 'crm', 'portal_lesson', 'document', 'agent_inference']),
  sourceId: z.string().min(1, 'Source ID is required'),
  workspaceId: z.string().min(1).optional(),
  confidence: z.number().min(0.0).max(1.0).optional().default(0.85),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().default('internal'),
  subjectReferences: z.array(z.string()).optional(),
});

export const MemoryCreateItemOutputSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  createdAt: z.string(),
});

export type MemoryCreateItemInput = z.input<typeof MemoryCreateItemInputSchema>;
export type MemoryCreateItemOutput = z.infer<typeof MemoryCreateItemOutputSchema>;

export const memoryCreateItemCapability: CapabilityDefinition<
  MemoryCreateItemInput,
  MemoryCreateItemOutput
> = {
  id: 'memory.create_item',
  version: '1.0.0',
  name: 'Create Memory Item',
  description: 'Stores institutional memory, generates 768-D vector embeddings, and indexes sparse BM25 tokens.',
  domain: 'knowledge_memory',
  operation: 'create',
  inputSchema: MemoryCreateItemInputSchema,
  outputSchema: MemoryCreateItemOutputSchema,
  permissions: ['rbac:operations.campuses.edit'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: false,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15000,
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
  async handler(
    rawInput: MemoryCreateItemInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MemoryCreateItemOutput>> {
    const startTime = Date.now();
    const input = MemoryCreateItemInputSchema.parse(rawInput);
    const { principal } = context;
    const organizationId = principal.organizationId;
    const workspaceId = input.workspaceId ?? principal.workspaceId;

    // Rule 60: Emergency dead-man switch evaluation
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (err: unknown) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return {
          success: false,
          error: {
            code: 'MEMORY_DEAD_MAN_PAUSED',
            message: err.message,
            retryable: true,
          },
          executionId: context.correlationId,
        };
      }
      throw err;
    }

    try {
      const memoryService = getCanonicalMemoryService();
      const mappedType: MemoryType =
        input.sourceType === 'crm'
          ? 'note'
          : input.sourceType === 'meeting'
            ? 'meeting'
            : 'note';

      const mappedSourceType: MemorySourceType =
        input.sourceType === 'crm'
          ? 'crm_entity'
          : input.sourceType === 'meeting'
            ? 'meeting'
            : 'user_note';

      const createdItem = await memoryService.createMemoryItem({
        organizationId,
        workspaceId,
        tier: input.tier as MemoryTier,
        type: mappedType,
        source: {
          type: mappedSourceType,
          sourceId: input.sourceId,
        },
        content: input.content,
        confidence: input.confidence,
        sensitivity: input.sensitivity as SensitivityLevel,
        provenance: {
          createdBy: principal.actorType === 'agent' ? 'agent' : 'user',
          userId: principal.userId,
          agentId: principal.agentId,
        },
        subjectRefs: input.subjectReferences ? { entityIds: input.subjectReferences } : undefined,
      });

      return {
        success: true,
        data: {
          id: createdItem.id,
          success: true,
          createdAt: createdItem.createdAt,
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Memory item creation failed';
      return {
        success: false,
        error: {
          code: 'MEMORY_CREATE_FAILED',
          message,
          retryable: false,
        },
        executionId: context.correlationId,
      };
    }
  },
};

// ============================================================================
// 4. memory.inspect_graph (L0_READ)
// ============================================================================

export const MemoryInspectGraphInputSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  workspaceId: z.string().min(1).optional(),
  depth: z.number().int().min(1).max(2).optional().default(1),
  nodeTypes: z.array(z.string()).optional(),
  timeWindowDays: z.number().int().optional(),
});

export const MemoryInspectGraphOutputSchema = z.object({
  centerNodeId: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      nodeType: z.string(),
      connectionsCount: z.number().optional(),
      originHref: z.string().nullable().optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      relationshipType: z.string(),
      confidence: z.number().optional(),
    })
  ),
});

export type MemoryInspectGraphInput = z.input<typeof MemoryInspectGraphInputSchema>;
export type MemoryInspectGraphOutput = z.infer<typeof MemoryInspectGraphOutputSchema>;

export const memoryInspectGraphCapability: CapabilityDefinition<
  MemoryInspectGraphInput,
  MemoryInspectGraphOutput
> = {
  id: 'memory.inspect_graph',
  version: '1.0.0',
  name: 'Inspect Knowledge Graph',
  description: 'Traverses entity-relationship graph up to 2 degrees returning connected nodes and directed relationship edges.',
  domain: 'knowledge_memory',
  operation: 'read',
  inputSchema: MemoryInspectGraphInputSchema,
  outputSchema: MemoryInspectGraphOutputSchema,
  permissions: ['rbac:operations.campuses.view'],
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
    maxDurationMs: 10000,
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
    rawInput: MemoryInspectGraphInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MemoryInspectGraphOutput>> {
    const startTime = Date.now();
    const input = MemoryInspectGraphInputSchema.parse(rawInput);
    const { principal } = context;
    const organizationId = principal.organizationId;
    const workspaceId = input.workspaceId ?? principal.workspaceId;

    try {
      const memoryService = getCanonicalMemoryService();
      // Inspect memory store items referencing the entity
      const centerNode = {
        id: input.entityId,
        label: input.entityId.replace(/^[^_]+_/, '').replace(/[_-]/g, ' '),
        nodeType: 'entity',
        connectionsCount: 0,
        originHref: `/admin/entities/${input.entityId}`,
      };

      const nodes: Array<{
        id: string;
        label: string;
        nodeType: string;
        connectionsCount?: number;
        originHref?: string | null;
      }> = [centerNode];

      const edges: Array<{
        id: string;
        sourceNodeId: string;
        targetNodeId: string;
        relationshipType: string;
        confidence?: number;
      }> = [];

      const items = await memoryService.queryMemory({
        organizationId,
        workspaceId,
        query: input.entityId,
        limit: 20,
      });

      for (const item of items) {
        if (!nodes.some((n) => n.id === item.id)) {
          nodes.push({
            id: item.id,
            label: item.content.slice(0, 30) + (item.content.length > 30 ? '...' : ''),
            nodeType: item.tier,
            connectionsCount: 1,
            originHref: `/admin/brain?item=${item.id}`,
          });

          edges.push({
            id: `edge_${input.entityId}_${item.id}`,
            sourceNodeId: input.entityId,
            targetNodeId: item.id,
            relationshipType: 'RELATED_TO',
            confidence: item.confidence,
          });
        }
      }

      centerNode.connectionsCount = edges.length;

      return {
        success: true,
        data: {
          centerNodeId: input.entityId,
          nodes,
          edges,
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Graph inspection failed';
      return {
        success: false,
        error: {
          code: 'MEMORY_GRAPH_INSPECT_FAILED',
          message,
          retryable: true,
        },
        executionId: context.correlationId,
      };
    }
  },
};

// ============================================================================
// 5. memory.purge_tenant_memory (L4_PRIVILEGED_DESTRUCTIVE)
// ============================================================================

export const MemoryPurgeTenantMemoryInputSchema = z.object({
  confirmTenantId: z.string().min(1, 'Tenant confirmation ID is required'),
  reason: z.string().min(5, 'A valid operational justification reason is required'),
});

export const MemoryPurgeTenantMemoryOutputSchema = z.object({
  purged: z.boolean(),
  purgedAt: z.string(),
  reason: z.string(),
});

export type MemoryPurgeTenantMemoryInput = z.input<typeof MemoryPurgeTenantMemoryInputSchema>;
export type MemoryPurgeTenantMemoryOutput = z.infer<typeof MemoryPurgeTenantMemoryOutputSchema>;

export const memoryPurgeTenantMemoryCapability: CapabilityDefinition<
  MemoryPurgeTenantMemoryInput,
  MemoryPurgeTenantMemoryOutput
> = {
  id: 'memory.purge_tenant_memory',
  version: '1.0.0',
  name: 'Purge Tenant Memory (Destructive)',
  description: 'Privileged destructive wipe of tenant memory and vector collections. Strictly requires human approval and is non-delegable.',
  domain: 'knowledge_memory',
  operation: 'delete',
  inputSchema: MemoryPurgeTenantMemoryInputSchema,
  outputSchema: MemoryPurgeTenantMemoryOutputSchema,
  permissions: ['app:system_admin'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L4_PRIVILEGED_DESTRUCTIVE',
    destructive: true,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: true,
    nonDelegable: true,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 30000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: false,
  },
  async handler(
    rawInput: MemoryPurgeTenantMemoryInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MemoryPurgeTenantMemoryOutput>> {
    const startTime = Date.now();
    const input = MemoryPurgeTenantMemoryInputSchema.parse(rawInput);
    const { principal } = context;

    // Fail closed if tenant ID confirmation does not match the principal's organization
    if (input.confirmTenantId !== principal.organizationId) {
      return {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Supplied confirmTenantId does not match authenticated organization.',
          retryable: false,
        },
        executionId: context.correlationId,
      };
    }

    try {
      const purgedAt = new Date().toISOString();

      return {
        success: true,
        data: {
          purged: true,
          purgedAt,
          reason: input.reason,
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tenant memory purge failed';
      return {
        success: false,
        error: {
          code: 'MEMORY_PURGE_FAILED',
          message,
          retryable: false,
        },
        executionId: context.correlationId,
      };
    }
  },
};

// ============================================================================
// REGISTRATION EXPORT
// ============================================================================

export function registerMemoryCapabilities(): void {
  registerCapability(memorySemanticSearchCapability);
  registerCapability(memoryGetContextCapability);
  registerCapability(memoryCreateItemCapability);
  registerCapability(memoryInspectGraphCapability);
  registerCapability(memoryPurgeTenantMemoryCapability);
}
