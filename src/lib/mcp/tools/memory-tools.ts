/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed Memory MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Organization Memory:
 *    - Delegates exclusively to `OrganizationMemoryService` and `ConflictRepository`.
 * 2. Risk Tiers:
 *    - `memory.recall`: read_only (Zero mutation, automatic execution).
 *    - `memory.remember`: low_risk (Durable knowledge capture, automatic with audit).
 *    - `memory.resolve_conflict`: high_risk (Adjudicates truth, requires human approval).
 *    - `memory.get_health`: read_only (Telemetry metrics).
 * 3. Strict Zero-`any` Invariant:
 *    - Fully typed input and output schemas via Zod and `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition, McpPayloadValue } from '../types';
import { OrganizationMemoryService } from '@/lib/memory/services/organization-memory-service';
import { ConflictRepository } from '@/lib/memory/conflict-repository';
import { ContextBuilderService } from '@/lib/memory/services/context-builder-service';
import { MemoryRepository } from '@/lib/memory/memory-repository';
import type { MemoryType } from '@/lib/memory/types';

// ==========================================
// 1. memory.recall (Read-Only)
// ==========================================

const recallInputSchema = z.object({
  query: z.string().min(1).describe('The search query or objective to recall memory for.'),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum memory results to return (default 10).'),
  entityId: z.string().optional().describe('Filter memories linked to a specific CRM entity.'),
});

const recallOutputSchema = z.object({
  totalFound: z.number(),
  executionTimeMs: z.number(),
  routingStrategy: z.string(),
  hits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      type: z.string(),
      relevanceScore: z.number(),
      freshnessScore: z.number(),
      isStale: z.boolean(),
      whyMatched: z.string(),
    })
  ),
});

export const memoryRecallTool: McpToolDefinition<
  z.infer<typeof recallInputSchema>,
  z.infer<typeof recallOutputSchema>
> = {
  name: 'memory.recall',
  version: '1.0.0',
  category: 'memory',
  description: 'Searches and recalls institutional memories across vector, graph, and exact stores using multi-strategy routing.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: recallInputSchema,
  responseSchema: recallOutputSchema,
  handler: async (params, context) => {
    const result = await OrganizationMemoryService.recall({
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      query: params.query,
      limit: params.limit ?? 10,
      filters: params.entityId ? { entityId: params.entityId } : undefined,
    });

    return {
      totalFound: result.totalFound,
      executionTimeMs: result.executionTimeMs,
      routingStrategy: result.routingDecision.strategy || result.routingDecision.intent,
      hits: result.hits.map((h) => ({
        id: h.memory.id,
        title: h.memory.title || `${h.memory.type.toUpperCase()} Memory`,
        content: h.memory.content,
        type: h.memory.type,
        relevanceScore: h.effectiveScore,
        freshnessScore: h.freshness.freshnessScore,
        isStale: h.freshness.isStale,
        whyMatched: h.matchedReason,
      })),
    };
  },
};

// ==========================================
// 2. memory.remember (Low-Risk Mutation)
// ==========================================

const rememberInputSchema = z.object({
  content: z.string().min(3).describe('The memory or fact content to remember.'),
  title: z.string().optional().describe('Brief descriptive title.'),
  type: z.enum([
    'fact',
    'decision',
    'insight',
    'problem',
    'opportunity',
    'risk',
    'preference',
    'instruction',
    'action_item',
  ]).optional().describe('Category classification of this memory.'),
  importance: z.number().min(0).max(1).optional().describe('Subjective importance weight (0.0 to 1.0).'),
  entityId: z.string().optional().describe('CRM entity ID to bind this memory to.'),
});

const rememberOutputSchema = z.object({
  memoryId: z.string(),
  status: z.string(),
  activeConflictsCount: z.number(),
  conflictWarnings: z.array(z.string()),
});

export const memoryRememberTool: McpToolDefinition<
  z.infer<typeof rememberInputSchema>,
  z.infer<typeof rememberOutputSchema>
> = {
  name: 'memory.remember',
  version: '1.0.0',
  category: 'memory',
  description: 'Persists and indexes a new verified institutional fact or decision into the organization memory mesh.',
  riskLevel: 'low_risk',
  requiresApproval: false,
  parameters: rememberInputSchema,
  responseSchema: rememberOutputSchema,
  handler: async (params, context) => {
    const memoryType: MemoryType = (params.type as MemoryType) || 'fact';

    const result = await OrganizationMemoryService.remember({
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      type: memoryType,
      title: params.title,
      content: params.content,
      importance: params.importance ?? 0.8,
      source: {
        type: 'agent',
        sourceId: `agent_${context.callerId}`,
      },
      entities: params.entityId
        ? [{ entityId: params.entityId, entityType: 'unknown', entityName: 'Associated Account', confidenceScore: 1.0 }]
        : undefined,
      userId: context.callerId,
    });

    // Invalidate context cache to ensure new memory appears immediately
    ContextBuilderService.clearCache();

    return {
      memoryId: result.memory.id,
      status: 'remembered',
      activeConflictsCount: result.conflicts.length,
      conflictWarnings: result.conflicts.map((c) => c.summary),
    };
  },
};

// ==========================================
// 3. memory.resolve_conflict (High-Risk Mutation)
// ==========================================

const resolveConflictInputSchema = z.object({
  conflictId: z.string().describe('The ID of the detected contradiction conflict.'),
  resolution: z.enum(['confirm_a', 'confirm_b', 'keep_both']).describe('Adjudication choice.'),
  notes: z.string().optional().describe('Audit explanation justifying the decision.'),
});

const resolveConflictOutputSchema = z.object({
  conflictId: z.string(),
  status: z.string(),
  resolution: z.string(),
  resolvedAt: z.string(),
});

export const memoryResolveConflictTool: McpToolDefinition<
  z.infer<typeof resolveConflictInputSchema>,
  z.infer<typeof resolveConflictOutputSchema>
> = {
  name: 'memory.resolve_conflict',
  version: '1.0.0',
  category: 'memory',
  description: 'Adjudicates a detected contradiction between conflicting claims, superseding the obsolete memory.',
  riskLevel: 'high_risk',
  requiresApproval: true,
  parameters: resolveConflictInputSchema,
  responseSchema: resolveConflictOutputSchema,
  handler: async (params, context) => {
    const conflict = await ConflictRepository.getConflictById(params.conflictId);
    if (!conflict || conflict.workspaceId !== context.workspaceId) {
      throw new Error(`[memory.resolve_conflict] Conflict ${params.conflictId} not found in this workspace.`);
    }

    if (params.resolution === 'confirm_a') {
      await MemoryRepository.invalidateMemory(
        conflict.memoryIdB,
        `Superseded by memory ${conflict.memoryIdA} via MCP tool`,
        context.callerId
      );
      await MemoryRepository.confirmMemory(conflict.memoryIdA, context.callerId);
    } else if (params.resolution === 'confirm_b') {
      await MemoryRepository.invalidateMemory(
        conflict.memoryIdA,
        `Superseded by memory ${conflict.memoryIdB} via MCP tool`,
        context.callerId
      );
      await MemoryRepository.confirmMemory(conflict.memoryIdB, context.callerId);
    }

    await ConflictRepository.resolveConflict({
      conflictId: params.conflictId,
      resolution: params.resolution,
      resolvedByUserId: context.callerId,
      resolutionNotes: params.notes,
    });

    ContextBuilderService.clearCache();

    return {
      conflictId: params.conflictId,
      status: 'resolved',
      resolution: params.resolution,
      resolvedAt: new Date().toISOString(),
    };
  },
};

// ==========================================
// 4. memory.get_health (Read-Only)
// ==========================================

const getHealthInputSchema = z.object({});

const getHealthOutputSchema = z.object({
  totalMemories: z.number(),
  verifiedTruthCount: z.number(),
  staleCount: z.number(),
  activeConflictsCount: z.number(),
  storeStatus: z.string(),
});

export const memoryGetHealthTool: McpToolDefinition<
  z.infer<typeof getHealthInputSchema>,
  z.infer<typeof getHealthOutputSchema>
> = {
  name: 'memory.get_health',
  version: '1.0.0',
  category: 'memory',
  description: 'Returns real-time health telemetry across Firestore documents, Qdrant vectors, and Graph mesh.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: getHealthInputSchema,
  responseSchema: getHealthOutputSchema,
  handler: async (_params, context) => {
    const health = await OrganizationMemoryService.getHealth(
      context.workspaceId,
      context.organizationId
    );

    return {
      totalMemories: health.totalMemories,
      verifiedTruthCount: health.verifiedTruthCount,
      staleCount: health.staleCount ?? health.staleMemoryCount,
      activeConflictsCount: health.activeConflictsCount ?? health.unresolvedConflictCount,
      storeStatus: health.stores?.qdrant?.connected ?? (health.syncHealthPercentage >= 70 ? true : false) ? 'healthy' : 'degraded',
    };
  },
};
