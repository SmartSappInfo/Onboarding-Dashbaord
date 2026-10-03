/**
 * @fileOverview Unit tests for MCP Transport Types, Constants & Error Taxonomy (Phase 5 Milestone 1 Task 1)
 */

import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_MCP_DOMAINS,
  McpDomainSchema,
  CLOUD_RUN_MAX_REQUEST_BODY_SIZE,
  MCP_TRANSPORT_ERROR_CODES,
  McpTransactionHeadersSchema,
  formatJsonRpcError,
  mapMcpErrorToHttpStatus,
  isDeprecatedMcpHeaderPresent,
} from '../../mcp/transport/transport-types';

describe('MCP Transport Types & Constants (Phase 5 Milestone 1)', () => {
  describe('Domain Definitions & Schema', () => {
    it('defines canonical MCP domains including crm, knowledge, messaging, sales, portals, and system', () => {
      expect(SUPPORTED_MCP_DOMAINS).toEqual([
        'crm',
        'knowledge',
        'messaging',
        'sales',
        'portals',
        'system',
      ]);
    });

    it('validates supported domains and rejects invalid domains', () => {
      expect(McpDomainSchema.safeParse('crm').success).toBe(true);
      expect(McpDomainSchema.safeParse('knowledge').success).toBe(true);
      expect(McpDomainSchema.safeParse('portals').success).toBe(true);
      expect(McpDomainSchema.safeParse('invalid_domain').success).toBe(false);
      expect(McpDomainSchema.safeParse('').success).toBe(false);
    });
  });

  describe('Cloud Run Serverless Constraints (Rule 9)', () => {
    it('strictly enforces the 32MB payload limit constant', () => {
      expect(CLOUD_RUN_MAX_REQUEST_BODY_SIZE).toBe(32 * 1024 * 1024);
      expect(CLOUD_RUN_MAX_REQUEST_BODY_SIZE).toBe(33554432);
    });
  });

  describe('Transaction & Tracing Headers (Rules 11, 20, 39)', () => {
    it('parses valid MCP transaction and distributed tracing headers', () => {
      const headers = {
        'mcp-transaction-id': 'tx-12345-abcde',
        'x-smartsapp-correlation-id': 'corr-67890-xyz',
        'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        'tracestate': 'rojo=1,congo=2',
      };

      const result = McpTransactionHeadersSchema.safeParse(headers);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['mcp-transaction-id']).toBe('tx-12345-abcde');
        expect(result.data['x-smartsapp-correlation-id']).toBe('corr-67890-xyz');
        expect(result.data.traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
      }
    });

    it('normalizes missing headers with safe defaults', () => {
      const result = McpTransactionHeadersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['mcp-transaction-id']).toBeUndefined();
        expect(result.data['x-smartsapp-correlation-id']).toBeUndefined();
      }
    });

    it('rejects oversized transaction headers (> 128 characters)', () => {
      const oversized = 'a'.repeat(129);
      const result = McpTransactionHeadersSchema.safeParse({
        'mcp-transaction-id': oversized,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Deprecated Header Detection (Rule 38)', () => {
    it('detects banned legacy session headers like Mcp-Session-Id', () => {
      expect(isDeprecatedMcpHeaderPresent({ 'mcp-session-id': 'session-123' })).toBe(true);
      expect(isDeprecatedMcpHeaderPresent({ 'Mcp-Session-Id': 'session-123' })).toBe(true);
      expect(isDeprecatedMcpHeaderPresent({ 'mcp-transaction-id': 'tx-123' })).toBe(false);
      expect(isDeprecatedMcpHeaderPresent({})).toBe(false);
    });
  });

  describe('JSON-RPC Error Formatting & HTTP Status Mapping (Rule 7, 48)', () => {
    it('formats compliant JSON-RPC 2.0 error response with correlation details', () => {
      const errorResponse = formatJsonRpcError(
        -32000,
        'Authentication required',
        { correlationId: 'corr-123', code: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED },
        'req-1'
      );

      expect(errorResponse).toEqual({
        jsonrpc: '2.0',
        id: 'req-1',
        error: {
          code: -32000,
          message: 'Authentication required',
          data: { correlationId: 'corr-123', code: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED },
        },
      });
    });

    it('maps canonical transport error codes to appropriate HTTP status codes', () => {
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED)).toBe(401);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION)).toBe(403);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.SURFACE_RESTRICTED)).toBe(403);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.INVALID_DOMAIN)).toBe(404);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE)).toBe(413);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.DEPRECATED_FEATURE_REJECTED)).toBe(400);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.MCP_EXECUTION_PAUSED)).toBe(503);
      expect(mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.INTERNAL_ERROR)).toBe(500);
    });
  });
});
