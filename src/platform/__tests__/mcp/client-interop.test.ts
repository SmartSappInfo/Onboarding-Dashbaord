/**
 * @fileOverview External Client Interoperability Test Harness (Phase 5 Milestone 5 Task 2)
 *
 * Implements Rule 9 (Cloud Run 32MB Ceiling), Rule 11 (MCP Spec 2026-07-28), Rule 20 & 39 (Distributed Tracing),
 * Rule 28 & 54 (Context Budgeting), Rule 35 & 50 (ETag & Cache Isolation), Rule 37 (Spec Compatibility),
 * Rule 38 (Banned Deprecated Features), and Rule 48 (Sanitized Error Codes).
 *
 * Simulates external MCP clients (Cursor IDE, Claude Desktop, and raw HTTP clients) connecting
 * to SmartSapp's stateless Streamable HTTP transport endpoint (`POST /api/mcp/v2/[domain]`).
 *
 * Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/mcp/v2/[domain]/route';
import { MCP_TRANSPORT_ERROR_CODES } from '@/platform/mcp/transport/transport-types';
import * as authGateway from '@/platform/mcp/auth/mcp-auth-gateway';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { z } from 'zod/v4';

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: {
      code: string;
      correlationId?: string;
    };
  };
}

interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

interface ToolsListResult {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
  }>;
}

describe('External Client Interoperability Test Harness (Cursor & Claude Desktop Simulator)', () => {
  const testTenant = {
    organizationId: 'org_enterprise_001',
    workspaceId: 'ws_sales_emea',
  };

  const authenticatedPrincipal = {
    actorType: 'agent' as const,
    userId: 'api_key:sms_live_cursor_secret',
    organizationId: testTenant.organizationId,
    workspaceId: testTenant.workspaceId,
    agentId: 'cursor_agent',
    agentVersion: '0.42.0',
    grantedScopes: [
      'app:contacts_view',
      'app:contacts_create',
      'app:contacts_edit',
      'crm:entities:read',
      'operations:campuses:view',
      'operations:campuses:create',
      'rbac:operations.campuses.create',
      'knowledge:read',
    ],
    effectiveRole: 'developer',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    ensureCapabilitiesRegistered();

    // Mock successful authentication for the test agent
    vi.spyOn(authGateway, 'authenticateMcpRequest').mockResolvedValue({
      success: true,
      principal: authenticatedPrincipal,
    });
  });

  /**
   * Helper to construct and dispatch an HTTP JSON-RPC request to the MCP endpoint.
   */
  async function simulateMcpRequest(
    domain: string,
    payload: { jsonrpc: '2.0'; id: string | number; method: string; params?: unknown },
    customHeaders: Record<string, string> = {}
  ): Promise<Response> {
    const defaultHeaders: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer sms_live_cursor_secret',
      'mcp-transaction-id': 'tx-client-sim-001',
      'x-smartsapp-correlation-id': 'corr-client-sim-001',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    };

    const headers = new Headers({
      ...defaultHeaders,
      ...customHeaders,
    });

    const req = new Request(`http://localhost:3000/api/mcp/v2/${domain}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    return POST(req, {
      params: Promise.resolve({ domain }),
    });
  }

  it('Test Case 1: Cursor IDE completes protocol initialize handshake (Spec 2026-07-28)', async () => {
    const res = await simulateMcpRequest('crm', {
      jsonrpc: '2.0',
      id: 'cursor-init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2026-07-28',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'Cursor',
          version: '0.42.0',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-transaction-id')).toBe('tx-client-sim-001');
    expect(res.headers.get('x-smartsapp-correlation-id')).toBe('corr-client-sim-001');

    const text = await res.text();
    expect(text).toContain('smartsapp-crm-mcp');

    // Parse SSE or JSON response
    if (text.startsWith('event: message') || text.includes('data:')) {
      const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
      expect(dataLine).toBeDefined();
      const parsed = JSON.parse(dataLine!.replace('data: ', '')) as JsonRpcResponse<InitializeResult>;
      expect(parsed.result?.serverInfo.name).toBe('smartsapp-crm-mcp');
      expect(parsed.result?.serverInfo.version).toBe('2.0.0');
    } else {
      const parsed = JSON.parse(text) as JsonRpcResponse<InitializeResult>;
      expect(parsed.result?.serverInfo.name).toBe('smartsapp-crm-mcp');
      expect(parsed.result?.serverInfo.version).toBe('2.0.0');
    }
  });

  it('Test Case 2: Claude Desktop completes initialize handshake and negotiates capabilities', async () => {
    const res = await simulateMcpRequest('knowledge', {
      jsonrpc: '2.0',
      id: 'claude-init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2026-07-28',
        capabilities: {},
        clientInfo: {
          name: 'Claude Desktop',
          version: '1.0.0',
        },
      },
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('smartsapp-knowledge-mcp');
  });

  it('Test Case 3: tools/list returns Draft-2020-12 input schemas and ETag header (Rule 35)', async () => {
    const res = await simulateMcpRequest('crm', {
      jsonrpc: '2.0',
      id: 'cursor-list-1',
      method: 'tools/list',
      params: {},
    });

    expect(res.status).toBe(200);
    const etag = res.headers.get('etag');
    expect(etag).toBeTruthy();
    expect(etag!.length).toBe(64);

    const text = await res.text();
    let tools: Array<{ name: string; inputSchema: { type: string } }> = [];

    if (text.includes('data:')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
      if (dataLine) {
        const parsed = JSON.parse(dataLine.replace('data: ', '')) as JsonRpcResponse<ToolsListResult>;
        tools = parsed.result?.tools || [];
      }
    } else {
      const parsed = JSON.parse(text) as JsonRpcResponse<ToolsListResult>;
      tools = parsed.result?.tools || [];
    }

    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t.name).toBeTruthy();
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('Test Case 4: HTTP 304 Not Modified when client sends matching If-None-Match (Rule 35)', async () => {
    // 1. Initial tools/list to acquire ETag
    const firstRes = await simulateMcpRequest('crm', {
      jsonrpc: '2.0',
      id: 'cursor-list-initial',
      method: 'tools/list',
      params: {},
    });

    expect(firstRes.status).toBe(200);
    const etag = firstRes.headers.get('etag')!;
    expect(etag).toBeTruthy();

    // 2. Subsequent tools/list with If-None-Match matching ETag
    const cachedRes = await simulateMcpRequest(
      'crm',
      {
        jsonrpc: '2.0',
        id: 'cursor-list-cached',
        method: 'tools/list',
        params: {},
      },
      {
        'if-none-match': etag,
      }
    );

    // Must return HTTP 304 Not Modified without payload re-serialization
    expect(cachedRes.status).toBe(304);
    expect(cachedRes.headers.get('etag')).toBe(etag);
    expect(cachedRes.headers.get('mcp-transaction-id')).toBe('tx-client-sim-001');
    expect(cachedRes.headers.get('x-smartsapp-correlation-id')).toBe('corr-client-sim-001');

    const bodyText = await cachedRes.text();
    expect(bodyText).toBe('');
  });

  it('Test Case 5: tools/call invokes capability and returns valid text content', async () => {
    // Register a mock capability in the store for predictable invocation
    const mockToolId = 'crm.test.interop_echo';
    canonicalCapabilityRegistryStore.register({
      id: mockToolId,
      version: '1.0.0',
      name: 'Interop Echo',
      description: 'Echoes back the input parameter for interop testing.',
      domain: 'crm_contacts',
      operation: 'create',
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.object({ echo: z.string() }),
      permissions: ['rbac:operations.campuses.create'],
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
        maxDurationMs: 3000,
        supportsDryRun: true,
        supportsCancellation: false,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1024 * 1024,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      handler: async (input: { message: string }) => ({
        success: true,
        data: { echo: `ECHO: ${input.message}` },
        executionId: 'exec_echo_001',
        emittedEvents: [],
        durationMs: 2,
      }),
    });

    const res = await simulateMcpRequest('crm', {
      jsonrpc: '2.0',
      id: 'cursor-call-1',
      method: 'tools/call',
      params: {
        name: 'crm_test_interop_echo',
        arguments: { message: 'Hello from Cursor IDE' },
      },
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ECHO: Hello from Cursor IDE');
  });

  it('Test Case 6: Distributed tracing headers (Mcp-Transaction-Id, X-SmartSapp-Correlation-Id, traceparent) are echoed', async () => {
    const res = await simulateMcpRequest(
      'crm',
      {
        jsonrpc: '2.0',
        id: 'trace-test-1',
        method: 'tools/list',
        params: {},
      },
      {
        'mcp-transaction-id': 'custom-tx-999',
        'x-smartsapp-correlation-id': 'custom-corr-888',
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      }
    );

    expect(res.headers.get('mcp-transaction-id')).toBe('custom-tx-999');
    expect(res.headers.get('x-smartsapp-correlation-id')).toBe('custom-corr-888');
    expect(res.headers.get('traceparent')).toBe(
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    );
  });

  it('Test Case 7: Rejects oversized payload exceeding Cloud Run 32MB ceiling with HTTP 413 (Rule 9)', async () => {
    const res = await simulateMcpRequest(
      'crm',
      {
        jsonrpc: '2.0',
        id: 'oversized-1',
        method: 'tools/list',
        params: {},
      },
      {
        'content-length': String(34 * 1024 * 1024), // 34MB
      }
    );

    expect(res.status).toBe(413);
    const body = (await res.json()) as JsonRpcResponse;
    expect(body.error?.data?.code).toBe(MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it('Test Case 8: Rejects legacy stateful Mcp-Session-Id header with HTTP 400 (Rule 38)', async () => {
    const res = await simulateMcpRequest(
      'crm',
      {
        jsonrpc: '2.0',
        id: 'legacy-sess-1',
        method: 'tools/list',
        params: {},
      },
      {
        'mcp-session-id': 'legacy-session-state-token-1234',
      }
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonRpcResponse;
    expect(body.error?.data?.code).toBe(MCP_TRANSPORT_ERROR_CODES.DEPRECATED_FEATURE_REJECTED);
  });

  it('Test Case 9: Sanitized JSON-RPC error codes on tool call with unknown tool', async () => {
    const res = await simulateMcpRequest('crm', {
      jsonrpc: '2.0',
      id: 'unknown-tool-1',
      method: 'tools/call',
      params: {
        name: 'non_existent_tool_xyz',
        arguments: {},
      },
    });

    expect(res.status).toBe(200); // In JSON-RPC, tool call errors return status 200 with isError: true or jsonrpc error
    const text = await res.text();
    expect(text).toContain('-32602');
  });
});
