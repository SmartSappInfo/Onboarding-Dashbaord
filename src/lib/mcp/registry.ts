/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Thread-Safe MCP Tool Registry & Schema Catalog
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Tools:
 *    - All SmartSapp agent capabilities (memory, context, crm, deal, task) must register here.
 *    - Tools declare their risk level, Zod validation schemas, and execution handlers.
 * 2. Strict Zero-`any` Invariant (Rule 1):
 *    - Handlers, schemas, and descriptors are strictly typed with zero wildcards.
 * 3. Immutable Tool Definitions:
 *    - Tools registered in this registry cannot be overwritten at runtime to prevent spoofing.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import {
  McpToolDefinition,
  McpToolDescriptor,
  McpCategory,
  McpRiskLevel,
  McpPayloadValue,
  McpExecutionContext,
} from './types';

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
 * Thread-safe registry for Model Context Protocol (MCP) tools.
 */
export class McpRegistry {
  private readonly tools = new Map<string, RegisteredMcpTool>();

  /**
   * Registers a strongly typed tool into the registry.
   * Throws an error if a tool with the same name has already been registered.
   */
  public registerTool<
    TInput extends Record<string, McpPayloadValue>,
    TOutput extends Record<string, McpPayloadValue>
  >(tool: McpToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`[McpRegistry] Tool "${tool.name}" is already registered. Duplicate registrations are prohibited.`);
    }

    if (!tool.name.includes('.')) {
      throw new Error(`[McpRegistry] Invalid tool name "${tool.name}". Tool names must follow the "namespace.action" format (e.g. "memory.recall").`);
    }

    const registered: RegisteredMcpTool = {
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

    this.tools.set(tool.name, registered);
  }

  /**
   * Retrieves a tool definition by name.
   */
  public getTool(name: string): RegisteredMcpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Checks whether a tool name exists in the registry.
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Lists all registered tools, optionally filtered by category.
   */
  public listTools(category?: McpCategory): RegisteredMcpTool[] {
    const all = Array.from(this.tools.values());
    if (!category) {
      return all;
    }
    return all.filter((t) => t.category === category);
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
    this.tools.clear();
  }
}

/**
 * Global singleton instance of the MCP Tool Registry.
 */
export const globalMcpRegistry = new McpRegistry();
