/**
 * @fileOverview CompanyBrain 2.0 Phase 6 / Phase 1: Canonical Unified MCP Tool Registry & Adapter
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10, Rule 69 SSOT):
 * 1. Single Source of Truth for Capabilities & Tools (Rule 69 Master Axiom):
 *    - SmartSapp has EXACTLY ONE capability registry: `src/platform/capabilities/registry/capability-registry.ts`.
 *    - This module acts as the canonical MCP compatibility facade over that registry.
 *    - All tools (memory, context, crm, deal, task, and future domain capabilities) route through
 *      the canonical capability store.
 * 2. Strict Zero-`any` Invariant (Rule 1 / Rule 4):
 *    - Handlers, schemas, and descriptors are strictly typed with zero `any` or `any[]`.
 * 3. In-Place Upgradability (Decision D1 / PR-5):
 *    - Legacy tools are registered with `isLegacyCompatibility: true`.
 *    - Native Phase 1 domain capabilities can overwrite compatibility adapters in-place via `{ allowOverride: true }`.
 * 4. Backward Compatibility & Test Isolation:
 *    - `globalMcpRegistry` binds to `canonicalCapabilityRegistryStore` (the production SSOT).
 *    - `new McpRegistry()` creates an isolated instance for unit tests (e.g. `mcp-gateway.test.ts`),
 *      preventing test crosstalk while sharing identical validation and mapping logic.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts` and `src/platform/__tests__/mcp/registry-unification.test.ts`.
 */

import { z } from 'zod';
import type {
  McpToolDefinition,
  McpToolDescriptor,
  McpCategory,
  McpRiskLevel,
  McpPayloadValue,
  McpExecutionContext,
} from './types';
import type {
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
  CapabilityDomain,
  CapabilityOperation,
} from '@/platform/capabilities/contracts/capability-definition';
import type { RiskLevel } from '@/platform/capabilities/contracts/risk-levels';
import { invokeGoverned } from '@/platform/capabilities/execution/invoke-governed';
import { resolveLegacyMcpPrincipal } from './legacy-mcp-principal';
import {
  canonicalCapabilityRegistryStore,
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';

/**
 * Internal storage representation for a registered tool.
 */
export interface RegisteredMcpTool {
  name: string;
  version: string;
  category: McpCategory;
  description: string;
  riskLevel: McpRiskLevel;
  parameters: z.ZodType<Record<string, McpPayloadValue>>;
  responseSchema: z.ZodType<Record<string, McpPayloadValue>>;
  requiresApproval: boolean;
  handler: (
    params: Record<string, McpPayloadValue>,
    context: McpExecutionContext
  ) => Promise<Record<string, McpPayloadValue>>;
}

/**
 * Maps legacy MCP categories to canonical Capability Domains.
 */
export function mapCategoryToDomain(category: McpCategory): CapabilityDomain {
  switch (category) {
    case 'memory':
    case 'context':
      return 'knowledge_memory';
    case 'crm':
      return 'crm_contacts';
    case 'deal':
      return 'deals_revenue';
    case 'task':
      return 'tasks_productivity';
    case 'meeting':
      return 'meetings_conversations';
    case 'campaign':
      return 'campaigns_marketing';
    case 'governance':
      return 'ai_governance';
    default:
      return 'ai_governance';
  }
}

/**
 * Maps canonical Capability Domains back to MCP categories.
 */
export function mapDomainToCategory(domain: CapabilityDomain): McpCategory {
  switch (domain) {
    case 'knowledge_memory':
      return 'memory';
    case 'crm_contacts':
      return 'crm';
    case 'deals_revenue':
      return 'deal';
    case 'tasks_productivity':
      return 'task';
    case 'meetings_conversations':
      return 'meeting';
    case 'campaigns_marketing':
      return 'campaign';
    case 'ai_governance':
      return 'governance';
    default:
      return 'governance';
  }
}

/**
 * Maps legacy MCP risk levels to canonical Risk Levels (Rule 12 & Rule 66).
 */
export function mapRiskLevelToCanonical(riskLevel: McpRiskLevel): RiskLevel {
  switch (riskLevel) {
    case 'read_only':
      return 'L0_READ';
    case 'low_risk':
      return 'L2_STATE_MUTATION';
    case 'high_risk':
      return 'L3_EXTERNAL_COMMUNICATION_FINANCE';
    case 'critical':
      return 'L4_PRIVILEGED_DESTRUCTIVE';
    default:
      return 'L2_STATE_MUTATION';
  }
}

/**
 * Maps canonical Risk Levels back to legacy MCP risk levels.
 */
export function mapCanonicalToRiskLevel(level: RiskLevel): McpRiskLevel {
  switch (level) {
    case 'L0_READ':
    case 'L1_INTERNAL_DRAFT':
      return 'read_only';
    case 'L2_STATE_MUTATION':
      return 'low_risk';
    case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
      return 'high_risk';
    case 'L4_PRIVILEGED_DESTRUCTIVE':
      return 'critical';
    default:
      return 'low_risk';
  }
}

/**
 * Infers canonical CapabilityOperation from tool name namespace and action.
 */
export function inferOperationFromName(name: string): CapabilityOperation {
  const lower = name.toLowerCase();
  if (lower.endsWith('.recall') || lower.endsWith('.search') || lower.includes('search')) {
    return 'search';
  }
  if (lower.endsWith('.create') || lower.endsWith('.remember') || lower.includes('create')) {
    return 'create';
  }
  if (lower.endsWith('.update') || lower.endsWith('.update_stage') || lower.includes('update')) {
    return 'update';
  }
  if (lower.endsWith('.delete') || lower.endsWith('.remove') || lower.includes('delete')) {
    return 'delete';
  }
  if (
    lower.endsWith('.get') ||
    lower.endsWith('.get_dossier') ||
    lower.endsWith('.get_health') ||
    lower.endsWith('.list') ||
    lower.includes('list') ||
    lower.includes('get')
  ) {
    return 'read';
  }
  return 'execute';
}

/**
 * Options for configuring McpRegistry instances.
 */
export interface McpRegistryOptions {
  /**
   * If true, binds to canonical singleton store.
   * If false or omitted, creates an isolated instance store (default for `new McpRegistry()`).
   */
  useGlobalStore?: boolean;
  /**
   * Optional custom capability registry store to bind to.
   */
  customStore?: CapabilityRegistryStore;
}

/**
 * Cache mapping capability definitions to their registered MCP tool wrappers.
 * Uses WeakMap so memory is automatically reclaimed when definitions are cleaned up.
 */
const toolWrapperCache = new WeakMap<AnyCapabilityDefinition, RegisteredMcpTool>();

/**
 * Unified Model Context Protocol (MCP) Tool Registry.
 * Acts as a thin facade delegating to the canonical capability store.
 */
export class McpRegistry {
  private readonly store: CapabilityRegistryStore;

  constructor(options?: McpRegistryOptions) {
    if (options?.customStore) {
      this.store = options.customStore;
    } else if (options?.useGlobalStore) {
      this.store = canonicalCapabilityRegistryStore;
    } else {
      this.store = createCapabilityRegistryStore();
    }
  }

  /**
   * Registers a strongly typed tool into the canonical registry.
   * Throws an error if a tool with the same name has already been registered and allowOverride is false.
   */
  public registerTool<
    TInput extends Record<string, McpPayloadValue>,
    TOutput extends Record<string, McpPayloadValue>
  >(tool: McpToolDefinition<TInput, TOutput>, options?: { allowOverride?: boolean }): void {
    if (this.store.has(tool.name) && !options?.allowOverride) {
      throw new Error(
        `[McpRegistry] Tool "${tool.name}" is already registered. Duplicate registrations are prohibited.`
      );
    }

    if (!tool.name.includes('.')) {
      throw new Error(
        `[McpRegistry] Invalid tool name "${tool.name}". Tool names must follow the "namespace.action" format (e.g. "memory.recall").`
      );
    }

    const domain = mapCategoryToDomain(tool.category);
    const operation = inferOperationFromName(tool.name);
    const canonicalRiskLevel = mapRiskLevelToCanonical(tool.riskLevel);
    const requiresApproval =
      tool.requiresApproval ||
      canonicalRiskLevel === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
      canonicalRiskLevel === 'L4_PRIVILEGED_DESTRUCTIVE';

    const registeredToolWrapper: RegisteredMcpTool = {
      name: tool.name,
      version: tool.version,
      category: tool.category,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval,
      parameters: tool.parameters as z.ZodType<Record<string, McpPayloadValue>>,
      responseSchema: tool.responseSchema as z.ZodType<Record<string, McpPayloadValue>>,
      handler: (params, ctx) =>
        tool.handler(params as TInput, ctx) as Promise<Record<string, McpPayloadValue>>,
    };

    // Construct canonical capability definition
    const capDef: AnyCapabilityDefinition = {
      id: tool.name,
      version: tool.version,
      name: tool.name,
      description: tool.description,
      domain,
      operation,
      inputSchema: tool.parameters,
      outputSchema: tool.responseSchema,
      permissions: [`tools:${tool.name}`],
      workspaceScoped: true,
      tenantScoped: true,
      risk: {
        level: canonicalRiskLevel,
        destructive: tool.riskLevel === 'critical',
        idempotent: tool.riskLevel === 'read_only',
        openWorld: false,
        requiresHumanApproval: requiresApproval,
        nonDelegable: tool.riskLevel === 'critical',
      },
      execution: {
        synchronous: true,
        maxDurationMs: 25000,
        supportsDryRun: false,
        supportsCancellation: false,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1024 * 1024,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: true,
      },
      governance: {
        isLegacyCompatibility: true,
        implementationRef: tool.name,
      },
      handler: async (
        input: unknown,
        ctx: CapabilityExecutionContext
      ): Promise<CapabilityExecutionResult<unknown>> => {
        const mcpContext: McpExecutionContext = {
          workspaceId: ctx.principal.workspaceId,
          organizationId: ctx.principal.organizationId,
          callerId: ctx.principal.userId || ctx.principal.agentId || 'unknown_caller',
          callerType: ctx.principal.actorType === 'user' ? 'user' : 'agent',
          userId: ctx.principal.userId,
          requestId: ctx.correlationId,
          callDepth: 0,
          timestamp: ctx.timestamp,
        };

        try {
          const result = await tool.handler(input as TInput, mcpContext);
          return {
            success: true,
            data: result,
            executionId: ctx.correlationId,
            emittedEvents: [],
            durationMs: 0,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            error: {
              code: 'LEGACY_TOOL_ERROR',
              message,
              stateChanged: tool.riskLevel === 'read_only' ? 'no' : 'unknown',
              retryable: false,
              details: err,
            },
            executionId: ctx.correlationId,
          };
        }
      },
    };

    toolWrapperCache.set(capDef, registeredToolWrapper);
    this.store.register(capDef, { allowOverride: options?.allowOverride });
  }

  /**
   * Retrieves a tool definition by name from the canonical registry.
   */
  public getTool(name: string): RegisteredMcpTool | undefined {
    const cap = this.store.get(name);
    if (!cap) {
      return undefined;
    }

    const cached = toolWrapperCache.get(cap);
    if (cached) {
      return cached;
    }

    // Synthesize RegisteredMcpTool for canonical Phase 1 capabilities
    const synthesized: RegisteredMcpTool = {
      name: cap.id,
      version: cap.version,
      category: mapDomainToCategory(cap.domain),
      description: cap.description,
      riskLevel: mapCanonicalToRiskLevel(cap.risk.level),
      requiresApproval: cap.risk.requiresHumanApproval,
      parameters: cap.inputSchema as unknown as z.ZodType<Record<string, McpPayloadValue>>,
      responseSchema: cap.outputSchema as unknown as z.ZodType<Record<string, McpPayloadValue>>,
      // CAUTION (Phase 11 M2 review R1): platform capabilities run through the governed gateway on
      // the `mcp` surface as the verified acting user (or as an agent for that user), never via
      // `cap.handler()` with invented authority. API-key callers are refused (see legacy-mcp-principal).
      handler: async (params, ctx) => {
        const { adminDb } = await import('@/lib/firebase-admin');
        const authority = await resolveLegacyMcpPrincipal(ctx, adminDb);
        if ('refusal' in authority) {
          throw new Error(`[Capability ${cap.id}] ${authority.refusal}`);
        }
        const result = await invokeGoverned({
          capability: cap,
          capabilityId: cap.id,
          surface: 'mcp',
          input: params,
          principal: authority.principal,
          correlationId: ctx.requestId,
        });
        if (!result.success) {
          throw new Error(`[Capability ${cap.id}] ${result.error.message}`);
        }
        return result.data as Record<string, McpPayloadValue>;
      },
    };

    toolWrapperCache.set(cap, synthesized);
    return synthesized;
  }

  /**
   * Checks whether a tool name exists in the canonical registry.
   */
  public hasTool(name: string): boolean {
    return this.store.has(name);
  }

  /**
   * Lists all registered tools, optionally filtered by category.
   */
  public listTools(category?: McpCategory): RegisteredMcpTool[] {
    const caps = this.store.list();
    const tools = caps
      .map((cap) => this.getTool(cap.id))
      .filter((tool): tool is RegisteredMcpTool => Boolean(tool));

    if (!category) {
      return tools;
    }
    return tools.filter((t) => t.category === category);
  }

  /**
   * Returns public descriptors of all registered tools for discovery via JSON-RPC `tools/list`.
   */
  public getToolDescriptors(category?: McpCategory): McpToolDescriptor[] {
    const tools = this.listTools(category);
    return tools.map((tool) => {
      // Basic schema representation for client discovery
      const schemaDef: Record<string, McpPayloadValue> = {
        type: 'object',
        description: tool.description,
      };

      return {
        name: tool.name,
        version: tool.version,
        category: tool.category,
        description: tool.description,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        inputSchema: schemaDef,
      };
    });
  }

  /**
   * Clears the registry. Intended for isolated testing.
   */
  public clear(): void {
    this.store.clear();
  }
}

/**
 * Global canonical singleton instance of the MCP Tool Registry (Rule 69 SSOT).
 * Every production surface imports this instance to interact with capabilities.
 */
export const globalMcpRegistry = new McpRegistry({ useGlobalStore: true });
