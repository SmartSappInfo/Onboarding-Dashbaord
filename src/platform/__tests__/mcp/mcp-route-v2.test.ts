/**
 * @fileOverview Integration tests for Next.js App Router dynamic MCP endpoint POST /api/mcp/v2/[domain] (Phase 5 Milestone 1 Task 4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, OPTIONS } from '@/app/api/mcp/v2/[domain]/route';
import { MCP_TRANSPORT_ERROR_CODES } from '@/platform/mcp/transport/transport-types';
import * as appSurface from '@/lib/platform/app-surface';
import * as authGateway from '@/platform/mcp/auth/mcp-auth-gateway';

describe('Next.js App Router Dynamic MCP Endpoint /api/mcp/v2/[domain]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles CORS OPTIONS preflight request with compliant headers', async () => {
    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://cursor.com',
        'access-control-request-method': 'POST',
      },
    });

    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('mcp-transaction-id');
  });

  it('returns HTTP 404 INVALID_DOMAIN when an invalid domain parameter is supplied', async () => {
    const req = new Request('http://localhost:3000/api/mcp/v2/unsupported-domain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ domain: 'unsupported-domain' }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe(MCP_TRANSPORT_ERROR_CODES.INVALID_DOMAIN);
  });

  it('enforces Surface Isolation: blocks backoffice system domain on client surface (Rule 61)', async () => {
    // Mock APP_SURFACE as client surface
    vi.spyOn(appSurface, 'isBackofficeSurface').mockReturnValue(false);

    const req = new Request('http://localhost:3000/api/mcp/v2/system', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ domain: 'system' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe(MCP_TRANSPORT_ERROR_CODES.SURFACE_RESTRICTED);
  });

  it('fails with HTTP 401 when authentication fails at ingress gate', async () => {
    vi.spyOn(authGateway, 'authenticateMcpRequest').mockResolvedValue({
      success: false,
      errorCode: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED,
      errorMessage: 'Authentication required.',
      status: 401,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ domain: 'crm' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED);
  });

  it('dispatches valid authenticated requests to StreamableHttpHandler and echoes transaction headers', async () => {
    vi.spyOn(authGateway, 'authenticateMcpRequest').mockResolvedValue({
      success: true,
      principal: {
        actorType: 'agent',
        userId: 'api_key:test_key',
        organizationId: 'org_acme',
        workspaceId: 'ws_prod',
        agentId: 'mcp_test_agent',
        agentVersion: '2.0.0',
        grantedScopes: ['app:crm_view'],
        effectiveRole: 'mcp_role',
      },
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        authorization: 'Bearer sms_live_test_key',
        'mcp-transaction-id': 'tx-integration-123',
        'x-smartsapp-correlation-id': 'corr-integration-456',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'cursor-ide', version: '0.40.0' },
        },
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ domain: 'crm' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-transaction-id')).toBe('tx-integration-123');
    expect(res.headers.get('x-smartsapp-correlation-id')).toBe('corr-integration-456');

    const text = await res.text();
    expect(text).toContain('smartsapp-crm-mcp');
  });

  it('supports conditional ETag validation returning HTTP 304 on tools/list (Rule 35)', async () => {
    vi.spyOn(authGateway, 'authenticateMcpRequest').mockResolvedValue({
      success: true,
      principal: {
        actorType: 'agent',
        userId: 'api_key:test_key',
        organizationId: 'org_acme',
        workspaceId: 'ws_prod',
        agentId: 'mcp_test_agent',
        agentVersion: '2.0.0',
        grantedScopes: ['app:crm_view'],
        effectiveRole: 'mcp_role',
      },
    });

    // 1. Initial tools/list request
    const req1 = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        authorization: 'Bearer sms_live_test_key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'list-1',
        method: 'tools/list',
        params: {},
      }),
    });

    const res1 = await POST(req1, {
      params: Promise.resolve({ domain: 'crm' }),
    });

    expect(res1.status).toBe(200);
    const etag = res1.headers.get('etag');
    expect(etag).toBeTruthy();

    // 2. Conditional request with matching If-None-Match
    const req2 = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        authorization: 'Bearer sms_live_test_key',
        'if-none-match': etag!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'list-2',
        method: 'tools/list',
        params: {},
      }),
    });

    const res2 = await POST(req2, {
      params: Promise.resolve({ domain: 'crm' }),
    });

    expect(res2.status).toBe(304);
    expect(res2.headers.get('etag')).toBe(etag);
  });
});
