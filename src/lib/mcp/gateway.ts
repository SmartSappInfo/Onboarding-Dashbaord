/**
 * @fileOverview CompanyBrain 2.0 Phase 6: JSON-RPC 2.0 MCP Gateway Dispatcher
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Model Context Protocol Specification Compliance:
 *    - JSON-RPC 2.0 wire format (`initialize`, `tools/list`, `tools/call`, `ping`).
 *    - Standardized error codes conforming to JSON-RPC 2.0 and MCP extensions.
 * 2. Risk-Gated Interception:
 *    - Intercepts mutating and high-risk tools through `McpApprovalEngine`.
 * 3. Asynchronous Audit Logging:
 *    - Non-blocking execution telemetry logged via `McpAuditLogger`.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Fully typed input, output, and execution context.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { globalMcpRegistry, McpRegistry } from './registry';
import { registerAllCoreTools } from './tools';
import { McpApprovalEngine } from './approval-engine';
import { McpAuditLogger } from './audit-logger';
import {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpExecutionContext,
  McpPayloadValue,
  MCP_ERROR_CODES,
} from './types';

// Ensure all core tools are loaded into the global registry
registerAllCoreTools(globalMcpRegistry);

export class McpGateway {
  private static readonly EXECUTION_TIMEOUT_MS = 25000; // 25 seconds
  private static readonly MAX_CALL_DEPTH = 5;

  /**
   * Processes a single JSON-RPC 2.0 request.
   */
  public static async handleRequest(
    request: McpJsonRpcRequest,
    context: McpExecutionContext,
    registry: McpRegistry = globalMcpRegistry
  ): Promise<McpJsonRpcResponse> {
    const startTime = Date.now();
    const id = request.id ?? null;

    // Check JSON-RPC version
    if (request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_REQUEST,
          message: 'Invalid JSON-RPC version. Expected "2.0".',
        },
      };
    }

    // Call depth protection
    if (context.callDepth > this.MAX_CALL_DEPTH) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.MAX_DEPTH_EXCEEDED,
          message: `Maximum tool call recursion depth (${this.MAX_CALL_DEPTH}) exceeded.`,
        },
      };
    }

    try {
      switch (request.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'smartsapp-companybrain-mcp',
                version: '2.0.0',
              },
            },
          };
        }

        case 'ping': {
          return {
            jsonrpc: '2.0',
            id,
            result: { status: 'pong' },
          };
        }

        case 'tools/list': {
          const descriptors = registry.getToolDescriptors();
          // Transform descriptors into McpPayloadValue structure
          const toolsPayload = descriptors.map((d) => ({
            name: d.name,
            version: d.version,
            category: d.category,
            description: d.description,
            riskLevel: d.riskLevel,
            requiresApproval: d.requiresApproval,
            inputSchema: d.inputSchema,
          }));

          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: toolsPayload,
            },
          };
        }

        case 'tools/call': {
          return await this.handleToolCall(request, context, registry, startTime);
        }

        default: {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
              message: `Method "${request.method}" not recognized by MCP Gateway.`,
            },
          };
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Internal gateway failure.';
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INTERNAL_ERROR,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Dispatches a specific tool call with validation, approval gating, timeout, and telemetry.
   */
  private static async handleToolCall(
    request: McpJsonRpcRequest,
    context: McpExecutionContext,
    registry: McpRegistry,
    startTime: number
  ): Promise<McpJsonRpcResponse> {
    const id = request.id ?? null;
    const params = request.params;

    if (!params || typeof params !== 'object') {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: 'Missing params object in tools/call request.',
        },
      };
    }

    const toolName = typeof params.name === 'string' ? params.name : '';
    const rawArguments = (params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments))
      ? (params.arguments as Record<string, McpPayloadValue>)
      : {};

    const tool = registry.getTool(toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
          message: `Tool "${toolName}" is not registered in the MCP catalog.`,
        },
      };
    }

    // Validate parameters against tool's Zod schema
    const parseResult = tool.parameters.safeParse(rawArguments);
    if (!parseResult.success) {
      const validationIssues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: `Parameter validation failed: ${validationIssues}`,
        },
      };
    }

    const validatedInput = parseResult.data;

    // Evaluate Risk & Approval Gate
    const evaluation = await McpApprovalEngine.evaluateToolExecution(tool, validatedInput, context);

    if (!evaluation.allowedToExecute) {
      if (evaluation.requiresApproval && evaluation.pendingApproval) {
        // Asynchronously record pending approval telemetry
        void McpAuditLogger.logExecution({
          toolName: tool.name,
          version: tool.version,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          callerId: context.callerId,
          callerType: context.callerType,
          durationMs: Date.now() - startTime,
          status: 'pending_approval',
          inputPayload: validatedInput,
          outputSummary: `Queued in pending approvals (ID: ${evaluation.pendingApproval.id})`,
        });

        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: MCP_ERROR_CODES.APPROVAL_REQUIRED,
            message: `Tool "${tool.name}" requires administrator approval before executing.`,
            data: {
              pendingApprovalId: evaluation.pendingApproval.id,
              toolName: tool.name,
              reason: evaluation.pendingApproval.reason,
              reviewPath: '/admin/companybrain/tools?tab=approvals',
            },
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.FORBIDDEN,
          message: evaluation.rejectionReason || 'Execution blocked by security policy.',
        },
      };
    }

    // Execute tool handler with timeout
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timed out after ${this.EXECUTION_TIMEOUT_MS / 1000} seconds.`));
        }, this.EXECUTION_TIMEOUT_MS);
      });

      const output = await Promise.race([
        tool.handler(validatedInput, context),
        timeoutPromise,
      ]);

      const durationMs = Date.now() - startTime;

      // Log success telemetry asynchronously
      void McpAuditLogger.logExecution({
        toolName: tool.name,
        version: tool.version,
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        callerId: context.callerId,
        callerType: context.callerType,
        durationMs,
        status: 'success',
        inputPayload: validatedInput,
        outputSummary: `Executed successfully in ${durationMs}ms`,
      });

      // Format MCP content payload
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output),
            },
          ],
          structured: output,
        },
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown tool handler execution failure.';

      // Log error telemetry asynchronously
      void McpAuditLogger.logExecution({
        toolName: tool.name,
        version: tool.version,
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        callerId: context.callerId,
        callerType: context.callerType,
        durationMs,
        status: 'error',
        inputPayload: validatedInput,
        outputSummary: 'Execution encountered error',
        errorMessage,
      });

      const isTimeout = errorMessage.includes('timed out');
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: isTimeout ? MCP_ERROR_CODES.EXECUTION_TIMEOUT : MCP_ERROR_CODES.INTERNAL_ERROR,
          message: errorMessage,
        },
      };
    }
  }
}
