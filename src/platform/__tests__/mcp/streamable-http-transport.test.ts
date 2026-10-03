/**
 * @fileOverview Unit tests for Stateless Streamable HTTP Transport Engine (Phase 5 Milestone 1 Task 3)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  createStreamableHttpHandler,
} from '../../mcp/transport/streamable-http-handler';
import {
  CLOUD_RUN_MAX_REQUEST_BODY_SIZE,
  MCP_TRANSPORT_ERROR_CODES,
} from '../../mcp/transport/transport-types';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../capabilities/contracts/capability-definition';

describe('Stateless Streamable HTTP Transport Engine (Spec 2026-07-28)', () => {
  const mockPrincipal: AgentPrincipal = {
    actorType: 'agent',
    userId: 'user_sdr_1',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    agentId: 'mcp_sdr_agent',
    agentVersion: '2.0.0',
    grantedScopes: ['app:crm_view', 'app:crm_manage'],
    effectiveRole: 'mcp_agent',
  };

  const sampleCapability: AnyCapabilityDefinition = {
    id: 'crm.ping',
    version: '1.0.0',
    name: 'CRM Ping',
    description: 'Health check ping for CRM',
    domain: 'crm_contacts',
    operation: 'read',
    workspaceScoped: true,
    tenantScoped: true,
    permissions: ['app:crm_view'],
    risk: {
      level: 'L0_READ',
      requiresHumanApproval: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: false,
    },
    inputSchema: z.object({
      message: z.string().optional(),
    }),
    outputSchema: z.object({
      pong: z.string(),
    }),
    handler: async (
      input: unknown,
      _ctx: CapabilityExecutionContext
    ): Promise<CapabilityExecutionResult<unknown>> => {
      const parsed = (input as { message?: string }) || {};
      return {
        success: true,
        data: { pong: parsed.message ? `echo:${parsed.message}` : 'pong' },
        executionId: 'exec_ping_1',
        emittedEvents: [],
        durationMs: 5,
      };
    },
  };

  it('rejects requests with deprecated headers like Mcp-Session-Id (Rule 38)', async () => {
    const handler = createStreamableHttpHandler({
      capabilities: [sampleCapability],
      getPrincipal: () => mockPrincipal,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'mcp-session-id': 'session-legacy-123',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    const res = await handler.handleRequest(req, { domain: 'crm' });
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe(MCP_TRANSPORT_ERROR_CODES.DEPRECATED_FEATURE_REJECTED);
  });

  it('enforces Cloud Run 32MB payload limit with HTTP 413 (Rule 9)', async () => {
    const handler = createStreamableHttpHandler({
      capabilities: [sampleCapability],
      getPrincipal: () => mockPrincipal,
    });

    // Content length exceeds 32MB limit
    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(CLOUD_RUN_MAX_REQUEST_BODY_SIZE + 1024),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    const res = await handler.handleRequest(req, { domain: 'crm' });
    expect(res.status).toBe(413);

    const body = (await res.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe(MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it('handles MCP initialize handshake and echoes transaction and correlation headers (Spec 2026-07-28)', async () => {
    const handler = createStreamableHttpHandler({
      capabilities: [sampleCapability],
      getPrincipal: () => mockPrincipal,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'mcp-transaction-id': 'tx-init-999',
        'x-smartsapp-correlation-id': 'corr-init-888',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    const res = await handler.handleRequest(req, { domain: 'crm' });
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-transaction-id')).toBe('tx-init-999');
    expect(res.headers.get('x-smartsapp-correlation-id')).toBe('corr-init-888');

    const text = await res.text();
    expect(text).toContain('smartsapp-crm-mcp');
  });

  it('normalizes missing Accept headers to allow standard JSON clients', async () => {
    const handler = createStreamableHttpHandler({
      capabilities: [sampleCapability],
      getPrincipal: () => mockPrincipal,
    });

    // Client only sends application/json without text/event-stream
    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'json-client', version: '1.0' },
        },
      }),
    });

    const res = await handler.handleRequest(req, { domain: 'crm' });
    expect(res.status).toBe(200);
  });

  it('generates deterministic transaction and correlation IDs when missing', async () => {
    const handler = createStreamableHttpHandler({
      capabilities: [sampleCapability],
      getPrincipal: () => mockPrincipal,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'client-no-tx', version: '1.0' },
        },
      }),
    });

    const res = await handler.handleRequest(req, { domain: 'crm' });
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-transaction-id')).toBeTruthy();
    expect(res.headers.get('x-smartsapp-correlation-id')).toBeTruthy();
  });

  describe('Progressive Tool Discovery Caching & ETag Validation (Rule 35, Rule 50)', () => {
    it('handles tools/list discovery, generates ETag, and caches response', async () => {
      const handler = createStreamableHttpHandler({
        capabilities: [sampleCapability],
        getPrincipal: () => mockPrincipal,
      });

      const listReq = new Request('http://localhost:3000/api/mcp/v2/crm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'list-1',
          method: 'tools/list',
          params: {},
        }),
      });

      const res = await handler.handleRequest(listReq, {
        domain: 'crm',
        principal: mockPrincipal,
      });

      expect(res.status).toBe(200);
      const etag = res.headers.get('etag');
      expect(etag).toBeTruthy();
      expect(etag).toMatch(/^[a-f0-9]{64}$/);

      const text = await res.text();
      expect(text).toContain('crm_ping');
    });

    it('returns HTTP 304 Not Modified when If-None-Match matches discovery ETag (Rule 35)', async () => {
      const handler = createStreamableHttpHandler({
        capabilities: [sampleCapability],
        getPrincipal: () => mockPrincipal,
      });

      // 1. First request generates and caches ETag
      const initialReq = new Request('http://localhost:3000/api/mcp/v2/crm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'list-warmup',
          method: 'tools/list',
          params: {},
        }),
      });

      const initialRes = await handler.handleRequest(initialReq, {
        domain: 'crm',
        principal: mockPrincipal,
      });
      const etag = initialRes.headers.get('etag');
      expect(etag).toBeTruthy();

      // 2. Second request sends If-None-Match with cached ETag
      const conditionalReq = new Request('http://localhost:3000/api/mcp/v2/crm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
          'if-none-match': etag!,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'list-conditional',
          method: 'tools/list',
          params: {},
        }),
      });

      const conditionalRes = await handler.handleRequest(conditionalReq, {
        domain: 'crm',
        principal: mockPrincipal,
      });

      expect(conditionalRes.status).toBe(304);
      expect(conditionalRes.headers.get('etag')).toBe(etag);
    });

    it('enforces multi-tenant discovery cache isolation across tenants (Rule 8, 50)', async () => {
      const handler = createStreamableHttpHandler({
        capabilities: [sampleCapability],
      });

      const tenantBPrincipal: AgentPrincipal = {
        actorType: 'agent',
        userId: 'user_tenant_b',
        organizationId: 'org_tenant_b',
        workspaceId: 'ws_tenant_b',
        agentId: 'agent_b',
        agentVersion: '2.0.0',
        grantedScopes: ['app:crm_view'],
        effectiveRole: 'mcp_agent',
      };

      // Tenant A requests discovery
      const reqA = new Request('http://localhost:3000/api/mcp/v2/crm', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'list-a', method: 'tools/list', params: {} }),
      });
      const resA = await handler.handleRequest(reqA, { domain: 'crm', principal: mockPrincipal });
      const etagA = resA.headers.get('etag');

      // Tenant B sends Tenant A's ETag in If-None-Match
      const reqB = new Request('http://localhost:3000/api/mcp/v2/crm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'if-none-match': etagA!,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'list-b', method: 'tools/list', params: {} }),
      });

      // Because Tenant B has no cached entry yet, it should NOT return 304 from Tenant A's entry
      const resB = await handler.handleRequest(reqB, { domain: 'crm', principal: tenantBPrincipal });
      expect(resB.status).toBe(200);
    });
  });
});
