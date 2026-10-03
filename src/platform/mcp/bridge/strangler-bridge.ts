/**
 * @fileOverview Strangler Fig Bi-Directional Bridge & Registry Harmonization Engine (Phase 5 Milestone 5 Task 4)
 *
 * Implements Rule 4 (Strict Zero any/any[] Policy), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR),
 * Rule 10 (Inline Architectural Documentation), and Rule 69 (Strangler Fig Pattern Single Source of Truth).
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Rule 69 Master Axiom:
 *    SmartSapp has exactly ONE true canonical capability registry:
 *    `src/platform/capabilities/registry/capability-registry.ts`.
 *    Legacy code in `src/lib/mcp/registry.ts` provides a backward-compatibility facade for
 *    preexisting CompanyBrain 2.0 tools.
 * 2. Bi-Directional Interoperability:
 *    - Modern -> Legacy: Capabilities registered in `canonicalCapabilityRegistryStore` are
 *      interchangeably accessible to legacy consumers through `globalMcpRegistry.getTool()`.
 *    - Legacy -> Modern: Legacy tools registered in `globalMcpRegistry` are adapted into
 *      canonical `CapabilityDefinition` records with `isLegacyCompatibility: true` and mounted
 *      into the platform registry, enabling native Genkit and MCP v2 access.
 * 3. In-Place Override Priority:
 *    When a modern Phase 1–5 capability is registered with the same ID as a legacy compatibility tool,
 *    the modern implementation replaces the legacy adapter in-place (`allowOverride: true`).
 * 4. Zero Regression Invariant:
 *    All 21 preexisting legacy tests in `src/lib/mcp/__tests__/` must pass 100% without modification
 *    to existing assertions or contracts.
 */

import type {
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
  SchemaParser,
} from '../../capabilities/contracts/capability-definition';
import {
  canonicalCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '../../capabilities/registry/capability-registry';
import {
  globalMcpRegistry,
  McpRegistry,
  mapCategoryToDomain,
  mapRiskLevelToCanonical,
  inferOperationFromName,
  type RegisteredMcpTool,
} from '@/lib/mcp/registry';
import type { McpPayloadValue, McpExecutionContext } from '@/lib/mcp/types';
import { defaultEventBus, type EventBus } from '../../events/event-bus';
import { createDomainEvent } from '../../capabilities/events/domain-event';

export interface StranglerBridgeOptions {
  platformStore?: CapabilityRegistryStore;
  legacyRegistry?: McpRegistry;
  eventBus?: EventBus;
}

export interface RegistryHarmonizationReport {
  platformCapabilityCount: number;
  legacyToolCount: number;
  synchronizedCount: number;
  overriddenLegacyCount: number;
  timestamp: string;
}

/**
 * Checks whether a capability is a legacy compatibility adapter.
 */
export function isLegacyCompatibilityCapability(cap: AnyCapabilityDefinition): boolean {
  return Boolean(cap.governance?.isLegacyCompatibility);
}

/**
 * Adapts a legacy `RegisteredMcpTool` into a canonical `AnyCapabilityDefinition`.
 */
export function adaptLegacyToolToCapability(
  legacyTool: RegisteredMcpTool
): AnyCapabilityDefinition {
  const domain = mapCategoryToDomain(legacyTool.category);
  const operation = inferOperationFromName(legacyTool.name);
  const canonicalRiskLevel = mapRiskLevelToCanonical(legacyTool.riskLevel);

  const isL3OrL4 =
    canonicalRiskLevel === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
    canonicalRiskLevel === 'L4_PRIVILEGED_DESTRUCTIVE';

  const inputSchemaParser: SchemaParser<unknown> = {
    safeParse(data: unknown) {
      const res = legacyTool.parameters.safeParse(data);
      if (res.success) {
        return { success: true, data: res.data };
      }
      return {
        success: false,
        error: {
          issues: res.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      };
    },
  };

  const outputSchemaParser: SchemaParser<unknown> = {
    safeParse(data: unknown) {
      const res = legacyTool.responseSchema.safeParse(data);
      if (res.success) {
        return { success: true, data: res.data };
      }
      return {
        success: false,
        error: {
          issues: res.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      };
    },
  };

  return {
    id: legacyTool.name,
    version: legacyTool.version || '1.0.0',
    name: legacyTool.name,
    description: legacyTool.description,
    domain,
    operation,
    inputSchema: inputSchemaParser,
    outputSchema: outputSchemaParser,
    permissions: ['app:contacts_view'], // Default platform baseline permission
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: canonicalRiskLevel,
      destructive: canonicalRiskLevel === 'L4_PRIVILEGED_DESTRUCTIVE',
      idempotent: operation === 'read' || operation === 'search',
      openWorld: false,
      requiresHumanApproval: legacyTool.requiresApproval || isL3OrL4,
      nonDelegable: canonicalRiskLevel === 'L4_PRIVILEGED_DESTRUCTIVE',
    },
    execution: {
      synchronous: true,
      maxDurationMs: 10000,
      supportsDryRun: operation === 'read' || operation === 'search',
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    governance: {
      isLegacyCompatibility: true,
      implementationRef: 'src/lib/mcp/registry.ts',
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: true,
      defaultEnabled: true,
    },
    handler: async (
      input: unknown,
      context: CapabilityExecutionContext
    ): Promise<CapabilityExecutionResult<unknown>> => {
      const startTime = performance.now();
      try {
        const legacyCtx: McpExecutionContext = {
          userId: context.principal.userId,
          organizationId: context.principal.organizationId,
          workspaceId: context.principal.workspaceId,
          callerId: context.principal.userId,
          callerType: context.principal.actorType,
          requestId: context.correlationId,
          callDepth: 1,
          timestamp: context.timestamp,
        };

        const result = await legacyTool.handler(
          (input ?? {}) as Record<string, McpPayloadValue>,
          legacyCtx
        );
        const durationMs = Math.round(performance.now() - startTime);

        return {
          success: true,
          data: result,
          executionId: context.correlationId,
          emittedEvents: [],
          durationMs,
        };
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - startTime);
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: {
            code: 'LEGACY_TOOL_EXECUTION_FAILED',
            message,
            retryable: false,
            details: err,
          },
          executionId: context.correlationId,
          durationMs,
        };
      }
    },
  };
}

/**
 * Strangler Fig Bi-Directional Bridge managing synchronization between
 * the legacy MCP registry and the canonical capability store.
 */
export class StranglerBridge {
  private readonly platformStore: CapabilityRegistryStore;
  private readonly legacyRegistry: McpRegistry;
  private readonly eventBus: EventBus;

  constructor(options: StranglerBridgeOptions = {}) {
    this.platformStore = options.platformStore || canonicalCapabilityRegistryStore;
    this.legacyRegistry = options.legacyRegistry || globalMcpRegistry;
    this.eventBus = options.eventBus || defaultEventBus;
  }

  /**
   * Harmonizes the platform capability store and the legacy MCP registry.
   * Ensures all tools and capabilities are bidirectionally discoverable without circular duplication.
   */
  public async harmonize(): Promise<RegistryHarmonizationReport> {
    let synchronizedCount = 0;
    let overriddenLegacyCount = 0;

    // 1. Synchronize legacy tools into canonical capability store if not already registered natively
    const legacyTools = this.legacyRegistry.listTools();

    for (const tool of legacyTools) {
      const existing = this.platformStore.get(tool.name);

      if (!existing) {
        // Adapt legacy tool and register in platform store as compatibility capability
        const adapted = adaptLegacyToolToCapability(tool);
        this.platformStore.register(adapted, { allowOverride: true });
        synchronizedCount += 1;
      } else if (existing.governance?.isLegacyCompatibility) {
        // Already a compatibility adapter
        synchronizedCount += 1;
      } else {
        // Modern capability has superseded legacy tool in-place (Rule 69)
        overriddenLegacyCount += 1;
      }
    }

    const platformCaps = this.platformStore.list();
    const report: RegistryHarmonizationReport = {
      platformCapabilityCount: platformCaps.length,
      legacyToolCount: legacyTools.length,
      synchronizedCount,
      overriddenLegacyCount,
      timestamp: new Date().toISOString(),
    };

    // Emit harmonization event for operational monitoring (Rule 40)
    try {
      await this.eventBus.publish(
        createDomainEvent({
          type: 'mcp.registry.harmonized',
          organizationId: 'system',
          workspaceId: null,
          actor: { type: 'system', id: 'strangler_bridge' },
          entity: { type: 'registry', id: 'canonical_capability_registry' },
          correlationId: crypto.randomUUID(),
          source: 'mcp.strangler_bridge',
          payload: {
            platformCapabilities: report.platformCapabilityCount,
            legacyTools: report.legacyToolCount,
            synchronized: report.synchronizedCount,
            overriddenLegacy: report.overriddenLegacyCount,
          },
        })
      );
    } catch {
      // Non-blocking telemetry
    }

    return report;
  }

  /**
   * Resolves a capability through either modern or legacy adapters.
   */
  public resolveCapability(toolId: string): AnyCapabilityDefinition | undefined {
    // 1. Check canonical store first
    const fromPlatform = this.platformStore.get(toolId);
    if (fromPlatform) return fromPlatform;

    // 2. Check legacy registry fallback
    const fromLegacy = this.legacyRegistry.getTool(toolId);
    if (fromLegacy) {
      const adapted = adaptLegacyToolToCapability(fromLegacy);
      this.platformStore.register(adapted, { allowOverride: true });
      return adapted;
    }

    return undefined;
  }

  /**
   * Resolves a legacy RegisteredMcpTool wrapper for a given tool name.
   */
  public resolveLegacyTool(toolId: string): RegisteredMcpTool | null {
    return this.legacyRegistry.getTool(toolId) ?? null;
  }
}

/**
 * Global singleton instance of the Strangler Bridge.
 */
export const globalStranglerBridge = new StranglerBridge();

/**
 * Public harmonization helper function.
 */
export async function harmonizeMcpRegistries(
  options?: StranglerBridgeOptions
): Promise<RegistryHarmonizationReport> {
  const bridge = options ? new StranglerBridge(options) : globalStranglerBridge;
  return bridge.harmonize();
}
