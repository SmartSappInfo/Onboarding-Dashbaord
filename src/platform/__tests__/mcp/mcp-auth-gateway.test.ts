/**
 * @fileOverview Unit tests for Multi-Tenant MCP Authentication Gateway & Anti-IDOR Engine (Phase 5 Milestone 1 Task 2)
 */

import { describe, it, expect } from 'vitest';
import type { McpApiKey } from '@/lib/mcp/types';
import {
  createMcpAuthGateway,
} from '../../mcp/auth/mcp-auth-gateway';
import { MCP_TRANSPORT_ERROR_CODES } from '../../mcp/transport/transport-types';

describe('MCP Ingress Authentication Gateway (Phase 5 Milestone 1 Task 2)', () => {
  const mockApiKey: McpApiKey = {
    id: 'key_valid_123',
    keyHash: 'hash_abc',
    keyPrefix: 'sms_live_',
    name: 'Production SDR Agent Key',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    role: 'agent',
    allowedCategories: ['crm', 'memory'],
    rateLimitPerMinute: 60,
    revoked: false,
    createdAt: new Date().toISOString(),
  };

  it('fails closed with UNAUTHENTICATED when Authorization header is absent', async () => {
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => null,
      resolveClerkSession: async () => null,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED);
      expect(result.status).toBe(401);
    }
  });

  it('authenticates valid Bearer API key and returns strictly typed AgentPrincipal', async () => {
    const gateway = createMcpAuthGateway({
      lookupApiKey: async (key) => (key === 'sms_live_valid' ? mockApiKey : null),
      checkDeadManSwitch: async () => false,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer sms_live_valid',
      },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.principal.actorType).toBe('agent');
      expect(result.principal.organizationId).toBe('org_acme');
      expect(result.principal.workspaceId).toBe('ws_sales');
      expect(result.principal.userId).toBe('api_key:key_valid_123');
      expect(result.principal.grantedScopes).not.toContain('*');
    }
  });

  it('rejects revoked Bearer API keys immediately (Rule 8)', async () => {
    const revokedKey: McpApiKey = { ...mockApiKey, revoked: true };
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => revokedKey,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { authorization: 'Bearer sms_live_revoked' },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED);
      expect(result.errorMessage).toContain('revoked');
    }
  });

  it('rejects expired Bearer API keys immediately', async () => {
    const expiredKey: McpApiKey = {
      ...mockApiKey,
      expiresAt: new Date(Date.now() - 100000).toISOString(),
    };
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => expiredKey,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { authorization: 'Bearer sms_live_expired' },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED);
      expect(result.errorMessage).toContain('expired');
    }
  });

  it('enforces Anti-IDOR: rejects caller-supplied conflicting tenant headers (Finding N4 & Rule 47)', async () => {
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => mockApiKey, // key is bound to org_acme, ws_sales
      checkDeadManSwitch: async () => false,
    });

    // Caller attempts to spoof tenant via x-organization-id
    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sms_live_valid',
        'x-organization-id': 'org_victim_corp',
      },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION);
      expect(result.status).toBe(403);
    }
  });

  it('enforces Anti-IDOR: rejects caller-supplied conflicting workspace headers', async () => {
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => mockApiKey,
      checkDeadManSwitch: async () => false,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sms_live_valid',
        'x-workspace-id': 'ws_finance_secret',
      },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION);
      expect(result.status).toBe(403);
    }
  });

  it('enforces Rule 60 Emergency Dead-Man Switch (HTTP 503 MCP_EXECUTION_PAUSED)', async () => {
    const gateway = createMcpAuthGateway({
      lookupApiKey: async () => mockApiKey,
      checkDeadManSwitch: async () => true, // Emergency switch is tripped!
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { authorization: 'Bearer sms_live_valid' },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe(MCP_TRANSPORT_ERROR_CODES.MCP_EXECUTION_PAUSED);
      expect(result.status).toBe(503);
    }
  });

  it('authenticates Clerk interactive user session when present', async () => {
    const gateway = createMcpAuthGateway({
      resolveClerkSession: async () => ({
        userId: 'user_clerk_999',
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
      }),
      checkDeadManSwitch: async () => false,
    });

    const req = new Request('http://localhost:3000/api/mcp/v2/crm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const result = await gateway.authenticate(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.principal.actorType).toBe('agent');
      expect(result.principal.userId).toBe('user_clerk_999');
      expect(result.principal.organizationId).toBe('org_acme');
      expect(result.principal.workspaceId).toBe('ws_sales');
    }
  });
});
