/**
 * @fileOverview Canonical MCP Transport Types, Constants & Error Taxonomy (Phase 5 Milestone 1)
 *
 * Defines the core protocol types, header parsers, serverless Cloud Run constraints,
 * and JSON-RPC 2.0 error taxonomy for the Model Context Protocol (Spec 2026-07-28).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - MCP 2026-07-28 is strictly stateless at the transport layer (Streamable HTTP).
 * - Multi-round-trip requests carry `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id`.
 * - Cloud Run instances scale dynamically and throttle CPU between requests; hence NO in-memory
 *   session state or sticky SSE connections are permitted (Rule 38).
 * - Cloud Run enforces a strict 32MB payload ceiling (`CLOUD_RUN_MAX_REQUEST_BODY_SIZE`).
 *   Rejects oversized payloads with HTTP 413 (Rule 9).
 * - Strict typing policy: Zero `any` or `any[]` (Rule 4).
 */

import { z } from 'zod/v4';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';

/**
 * Cloud Run HTTP request body size limit: 32MB (Rule 9).
 * Payloads larger than this will be rejected before JSON parsing.
 */
export const CLOUD_RUN_MAX_REQUEST_BODY_SIZE = 32 * 1024 * 1024; // 33,554,432 bytes

/**
 * Supported MCP Protocol Revisions.
 * Primary target is 2026-07-28 (stateless streamable HTTP); backward compatibility line is 2025-11-25.
 */
export const MCP_PROTOCOL_VERSIONS = {
  LATEST: '2026-07-28',
  COMPATIBILITY: '2025-11-25',
  SUPPORTED: ['2026-07-28', '2025-11-25'] as const,
} as const;

export type McpProtocolVersion = (typeof MCP_PROTOCOL_VERSIONS.SUPPORTED)[number];

/**
 * Domain-Partitioned MCP Server Identifiers (Roadmap §3.2 & UI §43).
 * Keeps tool sets focused to avoid LLM context bloat.
 */
export const SUPPORTED_MCP_DOMAINS = [
  'crm',
  'knowledge',
  'messaging',
  'sales',
  'portals',
  'system',
] as const;

export type McpDomain = (typeof SUPPORTED_MCP_DOMAINS)[number];

export const McpDomainSchema = z.enum(SUPPORTED_MCP_DOMAINS);

/**
 * Canonical MCP Transport Error Codes.
 */
export const MCP_TRANSPORT_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
  MCP_EXECUTION_PAUSED: 'MCP_EXECUTION_PAUSED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_DOMAIN: 'INVALID_DOMAIN',
  SURFACE_RESTRICTED: 'SURFACE_RESTRICTED',
  DEPRECATED_FEATURE_REJECTED: 'DEPRECATED_FEATURE_REJECTED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type McpTransportErrorCode =
  (typeof MCP_TRANSPORT_ERROR_CODES)[keyof typeof MCP_TRANSPORT_ERROR_CODES];

/**
 * W3C Trace Context Regex (`traceparent` header).
 * Format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
const W3C_TRACEPARENT_REGEX = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * Schema for Incoming MCP Transaction & Distributed Tracing Headers (Rules 11, 20, 39).
 */
export const McpTransactionHeadersSchema = z.object({
  'mcp-transaction-id': z.string().trim().min(1).max(128).optional(),
  'x-smartsapp-correlation-id': z.string().trim().min(1).max(128).optional(),
  traceparent: z
    .string()
    .trim()
    .regex(W3C_TRACEPARENT_REGEX, 'Invalid W3C traceparent format')
    .optional(),
  tracestate: z.string().trim().max(512).optional(),
});

export type McpTransactionHeaders = z.infer<typeof McpTransactionHeadersSchema>;

/**
 * Headers deprecated or banned in modern stateless MCP (Rule 38).
 */
export const DEPRECATED_MCP_HEADERS = ['mcp-session-id'] as const;

/**
 * Checks if any deprecated headers (such as sticky Mcp-Session-Id) are present in the request.
 */
export function isDeprecatedMcpHeaderPresent(headers: Record<string, string | string[] | undefined>): boolean {
  for (const key of Object.keys(headers)) {
    const lowerKey = key.toLowerCase();
    if (DEPRECATED_MCP_HEADERS.some((dep) => dep === lowerKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Structured Inbound MCP Request Context Envelope.
 */
export interface McpRequestContext {
  readonly transactionId: string;
  readonly correlationId: string;
  readonly domain: McpDomain;
  readonly principal: AgentPrincipal;
  readonly protocolVersion: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

/**
 * JSON-RPC 2.0 Error Envelope.
 */
export interface JsonRpcErrorPayload {
  code: number;
  message: string;
  data?: {
    code: McpTransportErrorCode;
    correlationId: string;
    details?: unknown;
  };
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorPayload;
}

/**
 * Standard JSON-RPC 2.0 error codes.
 */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_BASE: -32000,
} as const;

/**
 * Formats a strictly compliant JSON-RPC 2.0 error response object.
 */
export function formatJsonRpcError(
  code: number,
  message: string,
  data?: { code: McpTransportErrorCode; correlationId: string; details?: unknown },
  id: string | number | null = null
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

/**
 * Maps canonical transport error codes to appropriate HTTP status codes (Rule 7, 48).
 */
export function mapMcpErrorToHttpStatus(code: McpTransportErrorCode): number {
  switch (code) {
    case MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED:
      return 401;
    case MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION:
    case MCP_TRANSPORT_ERROR_CODES.SURFACE_RESTRICTED:
      return 403;
    case MCP_TRANSPORT_ERROR_CODES.INVALID_DOMAIN:
      return 404;
    case MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE:
      return 413;
    case MCP_TRANSPORT_ERROR_CODES.DEPRECATED_FEATURE_REJECTED:
    case MCP_TRANSPORT_ERROR_CODES.INVALID_REQUEST:
    case MCP_TRANSPORT_ERROR_CODES.INVALID_PARAMS:
      return 400;
    case MCP_TRANSPORT_ERROR_CODES.METHOD_NOT_FOUND:
      return 404;
    case MCP_TRANSPORT_ERROR_CODES.MCP_EXECUTION_PAUSED:
      return 503;
    case MCP_TRANSPORT_ERROR_CODES.INTERNAL_ERROR:
    default:
      return 500;
  }
}
