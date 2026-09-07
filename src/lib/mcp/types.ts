/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP Platform Domain Models & Protocol Contracts
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Typing Invariant (Rule 1):
 *    - Absolutely NO `any`, `any[]`, or `unknown` is permitted in this file or throughout MCP.
 *    - Use bounded recursive unions (`McpPayloadValue`) and typed Zod schemas (`z.infer<T>`).
 * 2. Model Context Protocol (MCP) Standards:
 *    - JSON-RPC 2.0 wire format compliant (`initialize`, `tools/list`, `tools/call`, `ping`).
 *    - Standardized error codes conforming to JSON-RPC specification.
 * 3. Risk-Tiered Governance Invariant:
 *    - `read_only`: Pure information retrieval, zero mutations, automatic execution.
 *    - `low_risk`: Reversible or benign mutations (e.g. task creation), automatic execution with audit logging.
 *    - `high_risk`: Commercial mutations, conflict overrides, stage changes; requires human approval.
 *    - `critical`: Irreversible structural/data purges; strictly gated.
 * 4. Multi-Tenant Isolation:
 *    - All execution contexts, API keys, and audit logs are scoped by `workspaceId` and `organizationId`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';

/**
 * Standardized risk tiers governing tool execution permissions and human-in-the-loop approval.
 */
export type McpRiskLevel = 'read_only' | 'low_risk' | 'high_risk' | 'critical';

/**
 * Tool capability categories across SmartSapp CompanyBrain.
 */
export type McpCategory =
  | 'memory'
  | 'context'
  | 'crm'
  | 'deal'
  | 'task'
  | 'meeting'
  | 'campaign'
  | 'governance';

/**
 * Bounded JSON payload primitive values. Zero `unknown` or `any`.
 */
export type McpPayloadPrimitive = string | number | boolean | null;

/**
 * Bounded recursive payload value for tool arguments, results, and audit traces.
 */
export type McpPayloadValue =
  | McpPayloadPrimitive
  | McpPayloadValue[]
  | { [key: string]: McpPayloadValue };

/**
 * Recursive Zod validator for McpPayloadValue with zero any/unknown.
 */
export const zMcpPayloadValue: z.ZodType<McpPayloadValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(zMcpPayloadValue),
    z.record(zMcpPayloadValue),
  ])
);

/**
 * Execution context provided to every tool handler.
 */
export interface McpExecutionContext {
  workspaceId: string;
  organizationId: string;
  callerId: string;
  callerType: 'user' | 'agent' | 'api_key';
  userId?: string;
  apiKeyId?: string;
  requestId: string;
  callDepth: number;
  timestamp: string;
}

/**
 * Strictly typed Model Context Protocol (MCP) Tool Definition.
 */
export interface McpToolDefinition<
  TInput extends Record<string, McpPayloadValue> = Record<string, McpPayloadValue>,
  TOutput extends Record<string, McpPayloadValue> = Record<string, McpPayloadValue>
> {
  name: string; // e.g. "memory.recall", "context.build"
  version: string; // e.g. "1.0.0"
  category: McpCategory;
  description: string;
  riskLevel: McpRiskLevel;
  parameters: z.ZodType<TInput>;
  responseSchema: z.ZodType<TOutput>;
  requiresApproval: boolean;
  handler: (params: TInput, context: McpExecutionContext) => Promise<TOutput>;
}

/**
 * Serialized public descriptor returned via JSON-RPC `tools/list`.
 */
export interface McpToolDescriptor {
  name: string;
  version: string;
  category: McpCategory;
  description: string;
  riskLevel: McpRiskLevel;
  requiresApproval: boolean;
  inputSchema: Record<string, McpPayloadValue>;
}

/**
 * Zod schema validating incoming JSON-RPC 2.0 requests.
 */
export const zMcpJsonRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string().min(1),
  params: z.record(zMcpPayloadValue).optional(),
});

/**
 * JSON-RPC 2.0 Request format for MCP Gateway over HTTP POST.
 */
export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, McpPayloadValue>;
}

/**
 * Standard JSON-RPC 2.0 Error Object.
 */
export interface McpJsonRpcError {
  code: number;
  message: string;
  data?: Record<string, McpPayloadValue>;
}

/**
 * JSON-RPC 2.0 Response format for MCP Gateway.
 */
export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, McpPayloadValue>;
  error?: McpJsonRpcError;
}

/**
 * Standardized JSON-RPC 2.0 error codes and MCP application codes.
 */
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  APPROVAL_REQUIRED: -32003,
  RATE_LIMITED: -32004,
  EXECUTION_TIMEOUT: -32005,
  MAX_DEPTH_EXCEEDED: -32006,
} as const;

/**
 * Workspace-scoped MCP API Key record stored in Firestore collection `/mcp_keys`.
 */
export interface McpApiKey {
  id: string;
  keyPrefix: string; // e.g. "sk_mcp_a1b2..." (first 10 chars for visual identification)
  keyHash: string; // Salted SHA-256 hash (plaintext key is never stored)
  workspaceId: string;
  organizationId: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  allowedCategories?: McpCategory[];
  rateLimitPerMinute: number;
  createdAt: string;
  expiresAt?: string;
  revoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
}

/**
 * Telemetry and audit log record stored in Firestore collection `/mcp_audit_logs`.
 */
export interface McpAuditLog {
  id: string;
  toolName: string;
  version: string;
  workspaceId: string;
  organizationId: string;
  callerId: string;
  callerType: 'user' | 'agent' | 'api_key';
  durationMs: number;
  status: 'success' | 'error' | 'pending_approval' | 'rejected';
  inputPayload: Record<string, McpPayloadValue>;
  outputSummary: string;
  errorMessage?: string;
  timestamp: string;
}

/**
 * Queued tool execution awaiting human approval in `/mcp_pending_approvals`.
 */
export interface McpPendingApproval {
  id: string;
  toolName: string;
  workspaceId: string;
  organizationId: string;
  callerId: string;
  callerType: 'user' | 'agent' | 'api_key';
  inputPayload: Record<string, McpPayloadValue>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  adjudicatedAt?: string;
  adjudicatedBy?: string;
  adjudicationNotes?: string;
  executionResult?: Record<string, McpPayloadValue>;
  executionError?: string;
}

/**
 * Configurable workspace tool policy override in `/mcp_approval_policies`.
 */
export interface McpApprovalPolicy {
  id: string;
  toolName: string;
  workspaceId: string;
  organizationId: string;
  requiresApproval: boolean;
  customRiskLevel?: McpRiskLevel;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}
